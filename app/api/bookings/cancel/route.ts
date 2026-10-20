import { z, ZodError } from 'zod'
import { clientKey, isRateLimited, recordAttempt } from '@/lib/auth'
import { cancelByCustomer, BookingError } from '@/lib/booking'
import { firstIssue, phoneSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'

/** Customer-side cancellation. Verified by reference + phone; releases capacity. */
export async function POST(request: Request) {
  const key = clientKey(request, 'cancel')
  try {
    if (await isRateLimited(key, 8, 30)) return Response.json({ error: 'Too many cancellation attempts. Please call the laboratory.' }, { status: 429 })
    await recordAttempt(key)
    const body = z.object({
      reference: z.string().trim().min(6).max(40),
      phone: phoneSchema,
      reason: z.string().trim().max(300).optional().default(''),
    }).parse(await request.json().catch(() => null))
    const id = await cancelByCustomer(body.reference, { phone: body.phone }, body.reason)
    return Response.json({ ok: true, cancelledBookingId: id })
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: firstIssue(error) }, { status: 400 })
    if (error instanceof BookingError) return Response.json({ error: error.message }, { status: error.status })
    console.error('[cancel]', error)
    return Response.json({ error: 'The booking could not be cancelled online. Please contact the laboratory.' }, { status: 503 })
  }
}
