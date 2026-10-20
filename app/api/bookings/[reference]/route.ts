import { NextResponse } from 'next/server'
import { one } from '@/lib/db'
import { readCookie, SESSION_COOKIE, userForToken } from '@/lib/auth'
import { getBookingForConfirmation } from '@/lib/booking'

export const dynamic = 'force-dynamic'

/**
 * Booking confirmation. Access requires the access token issued at creation
 * (it is in the confirmation URL), the booking reference AND the registered
 * mobile number, or an authenticated administrator session.
 */
export async function GET(request: Request, { params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params
  const url = new URL(request.url)
  const token = url.searchParams.get('t') ?? ''
  const phone = url.searchParams.get('phone') ?? ''
  const phoneKey = phone ? (phone.replace(/\D/g, '').slice(-10)) : ''

  if (token) {
    const booking = await getBookingForConfirmation(reference, token)
    if (booking) return NextResponse.json(booking)
  }

  const admin = await userForToken(readCookie(request, SESSION_COOKIE))
  if (admin) {
    const row = await one<{ access_token: string }>('SELECT access_token FROM bookings WHERE upper(reference) = upper($1)', [reference])
    if (row) {
      const booking = await getBookingForConfirmation(reference, row.access_token)
      if (booking) return NextResponse.json(booking)
    }
  }

  if (phoneKey) {
    const match = await one('SELECT 1 FROM bookings WHERE upper(reference) = upper($1) AND phone = $2', [reference, phoneKey])
    if (match) {
      const row = await one<{ access_token: string }>('SELECT access_token FROM bookings WHERE upper(reference) = upper($1)', [reference])
      if (row) {
        const booking = await getBookingForConfirmation(reference, row.access_token)
        if (booking) return NextResponse.json(booking)
      }
    }
  }

  return NextResponse.json({ error: 'Booking not found.' }, { status: 404 })
}
