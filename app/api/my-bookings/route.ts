import { z, ZodError } from 'zod'
import { clientKey, isRateLimited, recordAttempt } from '@/lib/auth'
import { listBookingsByPhone } from '@/lib/booking'
import { firstIssue, phoneSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'

/**
 * "My bookings" — every booking for one mobile number.
 *
 * Deliberately stricter than /api/track: a phone number is a weaker secret than
 * reference + phone, so the budget is smaller (8 lookups / 10 min) and the
 * payload is summaries only. The full timeline still requires the reference via
 * /api/track.
 */
export async function POST(request: Request) {
  const key = clientKey(request, 'my-bookings')
  try {
    if (await isRateLimited(key, 8, 10)) {
      return Response.json({ error: 'Too many lookups. Please wait a few minutes and try again.' }, { status: 429 })
    }
    await recordAttempt(key)

    const body = z.object({ phone: phoneSchema }).parse(await request.json().catch(() => null))
    const bookings = await listBookingsByPhone(body.phone)
    return Response.json(
      { bookings, phone: body.phone },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: firstIssue(error) }, { status: 400 })
    console.error('[my-bookings]', error)
    return Response.json({ error: 'Your bookings could not be retrieved. Please try again.' }, { status: 503 })
  }
}
