import { z, ZodError } from 'zod'
import { confirmCheckoutPayment } from '@/lib/payments'
import { one } from '@/lib/db'

export const dynamic = 'force-dynamic'

const schema = z.object({
  razorpay_order_id: z.string().min(4),
  razorpay_payment_id: z.string().min(4),
  razorpay_signature: z.string().min(10),
  reference: z.string().trim().min(4),
  accessToken: z.string().trim().min(10),
})

/**
 * Checkout callback verification. The signature is verified with the key
 * secret before anything is marked paid; the access token proves the caller
 * created this booking.
 */
export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json().catch(() => null))
    const booking = await one<{ id: string }>(
      'SELECT id FROM bookings WHERE upper(reference) = upper($1) AND access_token = $2',
      [body.reference, body.accessToken],
    )
    if (!booking) return Response.json({ error: 'Booking not found.' }, { status: 404 })
    const result = await confirmCheckoutPayment({
      providerOrderId: body.razorpay_order_id,
      providerPaymentId: body.razorpay_payment_id,
      signature: body.razorpay_signature,
    })
    if (!result.ok) return Response.json({ error: result.error }, { status: 400 })
    return Response.json({ ok: true, alreadyPaid: result.alreadyPaid })
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: 'Invalid payment confirmation.' }, { status: 400 })
    console.error('[payments/verify]', error)
    return Response.json({ error: 'Payment verification failed.' }, { status: 500 })
  }
}
