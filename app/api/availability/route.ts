import { releaseExpiredHolds } from '@/lib/booking'
import { availability } from '@/lib/network'
import { getSettings } from '@/lib/settings'

export const dynamic = 'force-dynamic'

/** Slot availability for the booking flow. Never exposes other patients' data. */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const method = url.searchParams.get('method') === 'lab' ? 'lab' : 'home'
  const locationId = Number(url.searchParams.get('locationId')) || null
  try {
    await releaseExpiredHolds()
    const settings = await getSettings()
    const dates = await availability({ method, locationId, days: Number(settings.bookingHorizonDays) })
    return Response.json({ method, dates }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ error: 'Availability could not be loaded. Please try again.' }, { status: 503 })
  }
}
