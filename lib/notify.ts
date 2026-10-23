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
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)
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
const templateParam = (value: string) => value.replace(/[\r\n\t]+/g, ' ').trim().slice(0, 120) || '-'

/**
 * Report delivery.
 *
 * Two ways to send:
 *  - **API** (WhatsApp Cloud API): the branded PDF is uploaded to Meta and sent
 *    as a document, with the logo in the template header. One click, automatic.
 *  - **Manual** (wa.me): opens the patient's chat in the browser so a staff
 *    member attaches the PDF and presses send. Works with no setup at all.
 *
 * Neither path ever claims delivery it cannot prove: the result is what Meta
 * returned, or the fact that a chat was opened.
 */
const configured = () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)

export interface WhatsappOutcome {
  status: 'sent' | 'failed'
  detail: string
  recipient: string
  providerMessageId: string | null
}

async function graph(path: string, init: RequestInit) {
  return fetch(`https://graph.facebook.com/${WHATSAPP_API_VERSION}/${path}`, {
    ...init,
    cache: 'no-store',
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, ...(init.headers ?? {}) },
  })
}

/** Upload a PDF to Meta, returning the media id used to send it as a document. */
async function uploadDocument(bytes: Uint8Array, fileName: string): Promise<{ mediaId: string } | { error: string }> {
  const form = new FormData()
  form.append('messaging_product', 'whatsapp')
  form.append('type', 'application/pdf')
  form.append('file', new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }), fileName)
  try {
    const response = await graph(`${process.env.WHATSAPP_PHONE_NUMBER_ID}/media`, { method: 'POST', body: form })
    const payload = (await response.json().catch(() => ({}))) as { id?: string; error?: { message?: string } }
    if (!response.ok || !payload.id) {
      return { error: `Media upload failed (${response.status}): ${(payload.error?.message ?? 'unknown error').slice(0, 250)}` }
    }
    return { mediaId: payload.id }
  } catch (error) {
    return { error: `Media upload failed: ${(error as Error).message.slice(0, 250)}` }
  }
}

/**
 * Send the report PDF to a patient.
 *
 * `templateName` empty = a plain document message, which Meta only delivers
 * inside a 24-hour customer-service window. A template with a **Document**
 * header (the PDF) and an **Image** header (the logo) works at any time; the
 * body parameters are patient name and booking reference.
 */
export async function sendWhatsappDocument(input: {
  recipient: string
  patientName: string
  reference: string
  fileName: string
  bytes: Uint8Array
  templateName: string
  templateLanguage: string
  logoUrl: string | null
}): Promise<WhatsappOutcome> {
  const recipient = whatsappRecipient(input.recipient)
  if (!recipient) return { status: 'failed', detail: 'The booking has no usable mobile number for WhatsApp.', recipient: '', providerMessageId: null }
  if (!whatsappConfigured()) {
    return { status: 'failed', detail: 'WhatsApp API is not configured (WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID).', recipient, providerMessageId: null }
  }

  const uploaded = await uploadDocument(input.bytes, input.fileName)
  if ('error' in uploaded) return { status: 'failed', detail: uploaded.error, recipient, providerMessageId: null }

  const templateName = process.env.WHATSAPP_TEMPLATE_NAME?.trim() || input.templateName
  const components: unknown[] = templateName
    ? [
        { type: 'header', parameters: [{ type: 'document', document: { id: uploaded.mediaId, filename: input.fileName } }] },
        ...(input.logoUrl ? [{ type: 'header', sub_type: 'image', parameters: [{ type: 'image', image: { link: input.logoUrl } }] }] : []),
        { type: 'body', parameters: [input.patientName, input.reference].map((text) => ({ type: 'text', text: templateParam(text) })) },
      ]
    : []

  const body = templateName
    ? {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: 'template',
        template: { name: templateName, language: { code: input.templateLanguage || 'en' }, components },
      }
    : {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: 'document',
        document: { id: uploaded.mediaId, filename: input.fileName, caption: `Report for booking ${input.reference}` },
      }

  try {
    const response = await graph(`${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const payload = (await response.json().catch(() => ({}))) as { messages?: Array<{ id?: string }>; error?: { message?: string } }
    if (!response.ok) {
      return { status: 'failed', detail: `WhatsApp responded ${response.status}: ${(payload.error?.message ?? 'unknown error').slice(0, 250)}`, recipient, providerMessageId: null }
    }
    return {
      status: 'sent',
      detail: `WhatsApp accepted the report${templateName ? ` (template ${templateName})` : ' (document message)'}.`,
      recipient,
      providerMessageId: payload.messages?.[0]?.id ?? null,
    }
  } catch (error) {
    return { status: 'failed', detail: (error as Error).message.slice(0, 250), recipient, providerMessageId: null }
  }
}

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
