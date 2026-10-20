import { guard, jsonError } from '@/lib/auth'
import { sql } from '@/lib/db'

export const dynamic = 'force-dynamic'

/** Customers & patients (restricted: authenticated admins only). */
export async function GET(request: Request) {
  try {
    await guard(request)
    const url = new URL(request.url)
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
    const rows = await sql<Record<string, unknown>>(
      `SELECT phone, max(patient_name) AS name, count(*)::int AS bookings,
              count(DISTINCT email) FILTER (WHERE email IS NOT NULL) AS emails,
              max(created_at) AS last_booking,
              (array_agg(reference ORDER BY created_at DESC))[1] AS latest_reference
       FROM bookings WHERE ($1 = '' OR lower(patient_name) LIKE $2 OR phone LIKE $2)
       GROUP BY phone ORDER BY last_booking DESC LIMIT 200`,
      [q, `%${q}%`],
    )
    const recent = await sql<Record<string, unknown>>(
      `SELECT b.reference, b.patient_name, b.appointment_date::text AS day, b.status, b.created_at FROM bookings b
       ${q ? 'WHERE lower(b.patient_name) LIKE $1 OR b.phone LIKE $1' : ''} ORDER BY b.created_at DESC LIMIT 50`,
      q ? [`%${q}%`] : [],
    )
    return Response.json({
      customers: rows.map((row) => ({
        phone: String(row.phone),
        name: String(row.name),
        bookings: Number(row.bookings),
        emails: Number(row.emails ?? 0),
        lastBooking: new Date(row.last_booking as string).toISOString(),
        latestReference: String(row.latest_reference),
      })),
      recent: recent.map((row) => ({ reference: String(row.reference), patientName: String(row.patient_name), date: String(row.day).slice(0, 10), status: String(row.status), createdAt: new Date(row.created_at as string).toISOString() })),
    })
  } catch (error) {
    return jsonError(error)
  }
}
