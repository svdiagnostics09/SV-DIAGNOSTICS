import { createHmac, timingSafeEqual } from 'node:crypto'
import { one, sql, transaction } from '@/lib/db'
import type { BookingStatus } from '@/lib/booking'

/**
 * Razorpay integration.
 *
 * - Orders are created server-side with the amount stored in the booking.
 * - Payment status only changes after a signature-verified checkout callback or
 *   a webhook whose HMAC we verify ourselves.
 * - Webhook events are recorded in payment_events with a UNIQUE (provider,
 *   event_id) index, and the booking update happens in the same transaction, so
 *   replays are no-ops.
 * - Card data never touches this server.
 */

export function razorpayConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
}

export function razorpayWebhookConfigured() {
  return Boolean(process.env.RAZORPAY_WEBHOOK_SECRET)
}

/** A key id is safe to expose; its presence lets the checkout script load. */
export function publicPaymentStatus() {
  return {
    configured: razorpayConfigured(),
    webhookConfigured: razorpayWebhookConfigured(),
    keyId: process.env.RAZORPAY_KEY_ID ?? '',
    mode: process.env.RAZORPAY_KEY_ID?.startsWith('rzp_live') ? 'live' : process.env.RAZORPAY_KEY_ID ? 'test' : 'not_configured',
  }
}

function authHeader() {
  const key = process.env.RAZORPAY_KEY_ID
  const secret = process.env.RAZORPAY_KEY_SECRET
  if (!key || !secret) throw new Error('Razorpay credentials are not configured.')
  return `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`
}

export async function createRazorpayOrder(input: { bookingId: string; reference: string; amountPaise: number; email?: string | null; phone: string }) {
  if (!razorpayConfigured()) throw new Error('Razorpay is not configured.')
  const receipt = input.reference.slice(0, 40)
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: 'INR',
      receipt,
      notes: { booking_reference: input.reference, booking_id: input.bookingId },
    }),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`Razorpay order failed: ${response.status} ${JSON.stringify(body).slice(0, 300)}`)
  await sql(
    `INSERT INTO payments (booking_id, provider, provider_order_id, amount_paise, status) VALUES ($1,'razorpay',$2,$3,'created')
     ON CONFLICT (provider, provider_order_id) DO NOTHING`,
    [input.bookingId, body.id, input.amountPaise],
  )
  return { orderId: body.id as string, amountPaise: input.amountPaise, keyId: process.env.RAZORPAY_KEY_ID! }
}

/** Razorpay checkout handler signature: HMAC_SHA256(order_id|payment_id, key_secret). */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string) {
  const secret = process.env.RAZORPAY_KEY_SECRET
  if (!secret) return false
  const expected = createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(signature ?? '')
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Webhook signature: HMAC_SHA256(raw body, webhook secret). */
export function verifyWebhookSignature(rawBody: string, signature: string | null) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!secret || !signature) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  return a.length === b.length && timingSafeEqual(a, b)
}

export interface WebhookEvent {
  id?: string
  event?: string
  payload?: {
    payment?: { entity?: { id?: string; order_id?: string; amount?: number; status?: string; method?: string; error_description?: string } }
    refund?: { entity?: { id?: string; payment_id?: string; amount?: number; status?: string } }
  }
}

const mapPaymentStatus = (status: string | undefined): 'paid' | 'failed' | 'refunded' | null =>
  status === 'captured' ? 'paid' : status === 'failed' ? 'failed' : status === 'refunded' ? 'refunded' : null

/**
 * Idempotently apply a verified webhook. Returns what happened so the caller
 * can log it; repeating the same event id is a no-op.
 */
export async function applyWebhookEvent(event: WebhookEvent) {
  const eventId = event.id
  const eventType = event.event ?? 'unknown'
  if (!eventId) return { applied: false, reason: 'missing_event_id' as const }

  const already = await one('SELECT 1 FROM payment_events WHERE provider = $1 AND event_id = $2', ['razorpay', eventId])
  if (already) return { applied: false, reason: 'duplicate' as const }

  const paymentEntity = event.payload?.payment?.entity
  const refundEntity = event.payload?.refund?.entity
  const providerOrderId = paymentEntity?.order_id
  const providerPaymentId = paymentEntity?.id
  const refundPaymentId = refundEntity?.payment_id

  return transaction(async (client) => {
    const payment = providerOrderId
      ? (await client.query('SELECT * FROM payments WHERE provider = $1 AND provider_order_id = $2 FOR UPDATE', ['razorpay', providerOrderId])).rows[0]
      : refundPaymentId
        ? (await client.query('SELECT * FROM payments WHERE provider = $1 AND provider_payment_id = $2 FOR UPDATE', ['razorpay', refundPaymentId])).rows[0]
        : null

    const inserted = await client.query(
      `INSERT INTO payment_events (payment_id, booking_id, provider, event_id, event_type, payload) VALUES ($1,$2,'razorpay',$3,$4,$5::jsonb)
       ON CONFLICT (provider, event_id) DO NOTHING RETURNING id`,
      [payment?.id ?? null, payment?.booking_id ?? null, eventId, eventType, JSON.stringify(event)],
    )
    if (!inserted.rowCount) return { applied: false, reason: 'duplicate' as const }
    if (!payment) return { applied: false, reason: 'unknown_payment' as const }

    const booking = (await client.query('SELECT id, status, total_paise, reference FROM bookings WHERE id = $1 FOR UPDATE', [payment.booking_id])).rows[0]
    if (!booking) return { applied: false, reason: 'unknown_booking' as const }

    if (eventType.startsWith('payment.')) {
      const next = mapPaymentStatus(paymentEntity?.status)
      if (!next) return { applied: false, reason: 'ignored_status' as const }
      // Amount mismatch: never mark as paid.
      if (next === 'paid' && Number(paymentEntity?.amount) !== Number(booking.total_paise)) {
        await client.query(`INSERT INTO booking_events (booking_id, kind, message, actor) VALUES ($1,'payment',$2,'razorpay-webhook')`, [booking.id, `Payment amount mismatch (${paymentEntity?.amount} vs ${booking.total_paise}) — not marked paid.`])
        return { applied: false, reason: 'amount_mismatch' as const }
      }
      await client.query(
        `UPDATE payments SET status = $2, provider_payment_id = COALESCE($3, provider_payment_id), method = COALESCE($4, method), updated_at = now() WHERE id = $1`,
        [payment.id, next, providerPaymentId ?? null, paymentEntity?.method ?? null],
      )
      await client.query(`UPDATE bookings SET payment_status = $2, updated_at = now() WHERE id = $1`, [booking.id, next])
      if (next === 'paid' && booking.status === 'pending_confirmation') {
        await client.query(`UPDATE bookings SET status = 'confirmed', updated_at = now() WHERE id = $1 AND status = 'pending_confirmation'`, [booking.id])
        await client.query(`INSERT INTO booking_events (booking_id, kind, message, actor) VALUES ($1,'status','Booking confirmed after verified payment','razorpay-webhook')`, [booking.id])
      }
      await client.query(`INSERT INTO booking_events (booking_id, kind, message, actor) VALUES ($1,'payment',$2,'razorpay-webhook')`, [booking.id, `Payment ${next}${providerPaymentId ? ` · ${providerPaymentId}` : ''} (verified webhook)`])
      return { applied: true, reason: 'payment' as const, bookingReference: booking.reference as string, status: next }
    }

    if (eventType.startsWith('refund.')) {
      const refunded = Number(refundEntity?.amount ?? 0)
      const paymentPaid = booking.status !== 'cancelled'
      await client.query(`UPDATE payments SET status = 'refunded', updated_at = now() WHERE id = $1`, [payment.id])
      await client.query(`UPDATE bookings SET payment_status = 'refunded', updated_at = now() WHERE id = $1`, [booking.id])
      if (paymentPaid && refunded >= Number(booking.total_paise)) {
        await client.query(`INSERT INTO booking_events (booking_id, kind, message, actor) VALUES ($1,'payment',$2,'razorpay-webhook')`, [booking.id, `Refund processed · ${refunded}`])
      }
      return { applied: true, reason: 'refund' as const, bookingReference: booking.reference as string, status: 'refunded' }
    }

    return { applied: false, reason: 'unhandled_event' as const }
  })
}

/** Mark a booking paid after verifying the checkout callback (not on page return). */
export async function confirmCheckoutPayment(input: { providerOrderId: string; providerPaymentId: string; signature: string }) {
  if (!verifyCheckoutSignature(input.providerOrderId, input.providerPaymentId, input.signature)) {
    return { ok: false as const, error: 'Payment signature verification failed.' }
  }
  return transaction(async (client) => {
    const payment = (await client.query('SELECT * FROM payments WHERE provider = $1 AND provider_order_id = $2 FOR UPDATE', ['razorpay', input.providerOrderId])).rows[0]
    if (!payment) return { ok: false as const, error: 'Payment record not found.' }
    const booking = (await client.query('SELECT id, status, total_paise, reference, payment_status FROM bookings WHERE id = $1 FOR UPDATE', [payment.booking_id])).rows[0]
    if (!booking) return { ok: false as const, error: 'Booking not found.' }
    if (booking.payment_status === 'paid') return { ok: true as const, reference: booking.reference as string, alreadyPaid: true }
    const eventId = `checkout:${input.providerPaymentId}`
    const inserted = await client.query(
      `INSERT INTO payment_events (payment_id, booking_id, provider, event_id, event_type, payload) VALUES ($1,$2,'razorpay',$3,'payment.captured',$4::jsonb)
       ON CONFLICT (provider, event_id) DO NOTHING RETURNING id`,
      [payment.id, booking.id, eventId, JSON.stringify(input)],
    )
    if (!inserted.rowCount) return { ok: true as const, reference: booking.reference as string, alreadyPaid: true }
    await client.query(`UPDATE payments SET status = 'paid', provider_payment_id = $2, updated_at = now() WHERE id = $1`, [payment.id, input.providerPaymentId])
    await client.query(`UPDATE bookings SET payment_status = 'paid', status = CASE WHEN status = 'pending_confirmation' THEN 'confirmed' ELSE status END, updated_at = now() WHERE id = $1`, [booking.id])
    await client.query(`INSERT INTO booking_events (booking_id, kind, message, actor) VALUES ($1,'payment',$2,'razorpay-checkout')`, [booking.id, `Payment verified · ${input.providerPaymentId}`])
    return { ok: true as const, reference: booking.reference as string, alreadyPaid: false }
  })
}

export async function listPaymentsForAdmin(limit = 100) {
  const rows = await sql(
    `SELECT p.*, b.reference FROM payments p JOIN bookings b ON b.id = p.booking_id ORDER BY p.created_at DESC LIMIT $1`,
    [limit],
  )
  return rows.map((row) => ({
    id: String(row.id),
    reference: String(row.reference),
    providerOrderId: String(row.provider_order_id),
    providerPaymentId: row.provider_payment_id ? String(row.provider_payment_id) : null,
    amountPaise: Number(row.amount_paise),
    status: String(row.status),
    method: String(row.method ?? ''),
    createdAt: new Date(row.created_at as string).toISOString(),
  }))
}

/** Refunds are issued from the Razorpay dashboard or API; we record the intent. */
export async function recordManualRefund(bookingId: string, amountPaise: number, note: string, actor: string) {
  return transaction(async (client) => {
    const booking = (await client.query('SELECT id, payment_status FROM bookings WHERE id = $1 FOR UPDATE', [bookingId])).rows[0]
    if (!booking) return { ok: false as const, error: 'Booking not found.' }
    if (booking.payment_status !== 'paid') return { ok: false as const, error: 'Only paid bookings can be refunded.' }
    if (amountPaise > 0) {
      await client.query(`UPDATE bookings SET payment_status = 'refunded', updated_at = now() WHERE id = $1`, [bookingId])
      await client.query(`UPDATE payments SET status = 'refunded', updated_at = now() WHERE booking_id = $1`, [bookingId])
    }
    await client.query(`INSERT INTO booking_events (booking_id, kind, message, actor) VALUES ($1,'payment',$2,$3)`, [bookingId, `Refund recorded · ₹${(amountPaise / 100).toLocaleString('en-IN')}${note ? ` — ${note}` : ''}. Issue the refund in Razorpay; this records it.`, actor])
    return { ok: true as const }
  })
}

export type { BookingStatus }
