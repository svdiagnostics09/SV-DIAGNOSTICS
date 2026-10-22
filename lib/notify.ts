import { sql } from '@/lib/db'
import { formatINR } from '@/lib/db'
import { STATUS_LABELS, type BookingStatus } from '@/lib/booking'

/**
 * Transactional notifications.
 *
 * Email uses the Resend HTTP API when RESEND_API_KEY + EMAIL_FROM are set.
 * WhatsApp uses the Meta WhatsApp Cloud API when WHATSAPP_TOKEN +
 * WHATSAPP_PHONE_NUMBER_ID are set. Without them, every attempted message is
 * recorded as `skipped` with a clear reason — nothing is ever reported as
 * "sent" unless the provider accepted it.
 */

export const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION?.trim() || 'v23.0'

/** Server-side credentials present? (The token is never sent to the browser.) */
export function whatsappConfigured() {
  // Reports are sent by hand through wa.me, so no API credentials are needed.
  return true
}

/**
 * Normalise an Indian mobile number to the digits-only form the Cloud API
 * expects (country code + number, no `+`). Accepts 9876543210, +91 98765 43210
 * and 919876543210. Returns null when the number is not usable.
 */
export function whatsappRecipient(phone: string) {
  const digits = (phone ?? '').replace(/\D/g, '')
  if (/^[6-9]\d{9}$/.test(digits)) return `91${digits}`
  if (/^91[6-9]\d{9}$/.test(digits)) return digits
  if (/^\d{10,15}$/.test(digits)) return digits
  return null
}

/** Meta rejects template text parameters that contain newlines or tabs. */

/**
 * Report delivery is manual: the admin console opens a wa.me chat with the
 * patient's number and the administrator attaches the PDF themselves. Nothing
 * is sent by this server, so there are no WhatsApp API credentials to configure.
 * Considered "configured" once a valid phone number can be normalised.
 */
const configured = () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)

export interface DeliveryOutcome {
  status: 'sent' | 'failed' | 'skipped'
  detail: string
}

async function deliver(channel: 'email' | 'sms' | 'whatsapp', recipient: string, template: string, bookingId: string | null, subject: string, text: string): Promise<DeliveryOutcome> {
  let outcome: DeliveryOutcome
  if (channel === 'email') {
    if (!recipient) outcome = { status: 'skipped', detail: 'No email address on the booking.' }
    else if (!configured()) outcome = { status: 'skipped', detail: 'Email provider not configured (RESEND_API_KEY / EMAIL_FROM).' }
    else {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [recipient], subject, text }),
        })
        outcome = response.ok
          ? { status: 'sent', detail: `Resend accepted (${response.status}).` }
          : { status: 'failed', detail: `Resend responded ${response.status}: ${(await response.text()).slice(0, 300)}` }
      } catch (error) {
        outcome = { status: 'failed', detail: (error as Error).message }
      }
    }
  } else {
    // SMS/WhatsApp providers are intentionally not wired to a vendor here.
    outcome = { status: 'skipped', detail: `${channel} provider not configured.` }
  }
  await sql(
    `INSERT INTO notifications (booking_id, channel, recipient, template, status, detail, sent_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [bookingId, channel, recipient, template, outcome.status, outcome.detail, outcome.status === 'sent' ? new Date() : null],
  )
  return outcome
}

export async function sendBookingConfirmationEmail(input: {
  bookingId: string
  email: string | null
  reference: string
  patientName: string
  date: string
  slot: string
  totalPaise: number
  trackingLink: string
}) {
  if (!input.email) {
    await sql(`INSERT INTO notifications (booking_id, channel, recipient, template, status, detail) VALUES ($1,'email','','booking_confirmation','skipped','No email address provided.')`, [input.bookingId])
    return
  }
  return deliver('email', input.email, 'booking_confirmation', input.bookingId, `Booking ${input.reference} received — SV Diagnostics`,
    `Hello ${input.patientName},\n\nWe received your booking ${input.reference} for ${input.date}, ${input.slot}.\nAmount: ${formatINR(input.totalPaise)} (${input.totalPaise > 0 ? 'payable as selected' : ''})\n\nTrack your booking: ${input.trackingLink}\n\nSV Diagnostics`)
}

export async function sendStatusEmail(input: { bookingId: string; email: string | null; reference: string; status: BookingStatus; trackingLink: string }) {
  if (!input.email) return
  return deliver('email', input.email, 'booking_status', input.bookingId, `Booking ${input.reference}: ${STATUS_LABELS[input.status]}`,
    `Your booking ${input.reference} is now: ${STATUS_LABELS[input.status]}.\n\nView details: ${input.trackingLink}\n\nSV Diagnostics`)
}

export async function notifyStaffEmail(input: { subject: string; text: string; bookingId: string | null }) {
  await sql(`INSERT INTO notifications (booking_id, channel, recipient, template, status, detail) VALUES ($1,'in_app','staff','staff_alert','sent',$2)`, [input.bookingId, input.text.slice(0, 500)])
  return deliver('email', process.env.STAFF_EMAIL ?? '', 'staff_alert', input.bookingId, input.subject, input.text)
}

export function emailConfigured() {
  return configured()
}
