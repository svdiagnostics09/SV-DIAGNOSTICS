import { guard, jsonError } from '@/lib/auth'
import { one, sql } from '@/lib/db'
import { listAuditLogs } from '@/lib/audit'
import { emailConfigured } from '@/lib/notify'
import { publicPaymentStatus } from '@/lib/payments'

export const dynamic = 'force-dynamic'

/** Dashboard dashboard-data: every figure is a COUNT from PostgreSQL. */
export async function GET(request: Request) {
  try {
    await guard(request)
    const [counts, statusRows, recentBookings, recentEnquiries, recentAudit, notif] = await Promise.all([
      one<Record<string, number>>(`
        SELECT
          (SELECT count(*) FROM diagnostic_tests WHERE status = 'published')::int AS active_tests,
          (SELECT count(*) FROM health_packages WHERE status = 'published')::int AS active_packages,
          (SELECT count(*) FROM investigations WHERE is_active)::int AS investigations,
          (SELECT count(*) FROM bookings)::int AS bookings,
          (SELECT count(*) FROM bookings WHERE status = 'pending_confirmation')::int AS pending_bookings,
          (SELECT count(*) FROM bookings WHERE status = 'confirmed')::int AS confirmed_bookings,
          (SELECT count(*) FROM enquiries WHERE status = 'new')::int AS new_enquiries,
          (SELECT count(*) FROM locations WHERE is_active)::int AS active_locations,
          (SELECT count(*) FROM bookings WHERE appointment_date = CURRENT_DATE AND status <> 'cancelled')::int AS today_bookings,
          (SELECT COALESCE(sum(total_paise),0) FROM bookings WHERE payment_status = 'paid')::bigint AS collected_paise
      `),
      sql<{ status: string; n: number }>('SELECT status, count(*)::int AS n FROM bookings GROUP BY status'),
      sql<Record<string, unknown>>(`SELECT b.id, b.reference, b.patient_name, b.appointment_date::text AS day, b.slot_label, b.total_paise, b.status, b.payment_status, b.method, b.created_at
        FROM bookings b ORDER BY b.created_at DESC LIMIT 6`),
      sql<Record<string, unknown>>(`SELECT id, reference, name, subject, message, status AS enquiry_status, created_at FROM enquiries ORDER BY created_at DESC LIMIT 5`),
      listAuditLogs(8),
      one<{ n: number }>(`SELECT count(*)::int AS n FROM notifications WHERE channel <> 'in_app'`),
    ])

    return Response.json({
      counts: counts ?? {},
      byStatus: Object.fromEntries(statusRows.map((row) => [row.status, Number(row.n)])),
      recentBookings: recentBookings.map((row) => ({
        id: String(row.id),
        reference: String(row.reference),
        patientName: String(row.patient_name),
        date: String(row.day),
        slot: String(row.slot_label),
        totalPaise: Number(row.total_paise),
        status: String(row.status),
        paymentStatus: String(row.payment_status),
        method: String(row.method),
        createdAt: new Date(row.created_at as string).toISOString(),
      })),
      recentEnquiries: recentEnquiries.map((row) => ({
        id: String(row.id),
        reference: String(row.reference),
        name: String(row.name),
        subject: String(row.subject),
        message: String(row.message),
        status: String(row.enquiry_status),
        createdAt: new Date(row.created_at as string).toISOString(),
      })),
      recentAudit: recentAudit,
      integrations: {
        razorpay: publicPaymentStatus(),
        email: emailConfigured(),
        database: 'connected',
      },
      notificationsSent: Number(notif?.n ?? 0),
      generatedAt: new Date().toISOString(),
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return jsonError(error)
  }
}
