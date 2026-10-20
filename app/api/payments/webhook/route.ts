import { applyWebhookEvent, verifyWebhookSignature, type WebhookEvent } from '@/lib/payments'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Razorpay webhook. The raw body is read before JSON parsing so the HMAC is
 * computed over exactly what Razorpay signed. Unverified payloads are rejected.
 * Event ids are unique in payment_events, making replays no-ops.
 */
export async function POST(request: Request) {
  const signature = request.headers.get('x-razorpay-signature')
  const raw = await request.text()
  if (!verifyWebhookSignature(raw, signature)) {
    return Response.json({ error: 'Invalid signature.' }, { status: 401 })
  }
  let event: WebhookEvent
  try {
    event = JSON.parse(raw) as WebhookEvent
  } catch {
    return Response.json({ error: 'Invalid payload.' }, { status: 400 })
  }
  try {
    const result = await applyWebhookEvent(event)
    return Response.json({ received: true, ...result })
  } catch (error) {
    console.error('[razorpay-webhook]', error)
    // Non-2xx makes Razorpay retry; our event-id constraint makes retries safe.
    return Response.json({ error: 'Webhook processing failed.' }, { status: 500 })
  }
}
