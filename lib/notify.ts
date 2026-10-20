import { sql } from '@/lib/db'
import { formatINR } from '@/lib/db'
import { STATUS_LABELS, type BookingStatus } from '@/lib/booking'

/**
 * Transactional notifications.
 *
 * Email uses the Resend HTTP API when RESEND_API_KEY + EMAIL_FROM are set.
 * Without them, every attempted message is recorded as `skipped` with a clear
 * reason — nothing is ever reported as "sent" unless the provider accepted it.
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
