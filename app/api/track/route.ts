import { z, ZodError } from 'zod'
import { clientKey, isRateLimited, recordAttempt } from '@/lib/auth'
import { trackBooking } from '@/lib/booking'
import { firstIssue, phoneSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'

/** Tracking requires the reference AND the registered mobile number. */
export async function POST(request: Request) {
  const key = clientKey(request, 'track')
  try {
    if (await isRateLimited(key, 12, 10)) return Response.json({ error: 'Too many lookups. Please wait a few minutes and try again.' }, { status: 429 })
    await recordAttempt(key)
    const schema = z.object({ reference: z.string().trim().min(6, 'Enter your booking reference.').max(40), phone: phoneSchema })
    const body = schema.parse(await request.json().catch(() => null))
    const result = await trackBooking(body.reference, body.phone)
    if (!result) return Response.json({ error: 'No booking matches that reference and mobile number.' }, { status: 404 })
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: firstIssue(error) }, { status: 400 })
    console.error('[track]', error)
    return Response.json({ error: 'The booking could not be retrieved. Please try again.' }, { status: 503 })
  }
}
