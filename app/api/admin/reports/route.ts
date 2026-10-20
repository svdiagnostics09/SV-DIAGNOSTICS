import { guard, jsonError } from '@/lib/auth'
import { one, sql } from '@/lib/db'
import { listPaymentsForAdmin, publicPaymentStatus } from '@/lib/payments'

export const dynamic = 'force-dynamic'

/** Reports + payments screen data. All figures derive from bookings/payments. */
export async function GET(request: Request) {
  try {
    await guard(request)
    const [summary, byStatus, byMethod, topTests, daily, payments, refundsResult] = await Promise.all([
      one<Record<string, number>>(`SELECT
        count(*)::int AS bookings,
        count(*) FILTER (WHERE status <> 'cancelled')::int AS active_bookings,
        count(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
        count(*) FILTER (WHERE payment_status = 'paid')::int AS paid_bookings,
        count(*) FILTER (WHERE payment_status = 'pending' AND status <> 'cancelled')::int AS unpaid_bookings,
        COALESCE(sum(total_paise) FILTER (WHERE status <> 'cancelled'),0)::bigint AS booked_value,
        COALESCE(sum(total_paise) FILTER (WHERE payment_status = 'paid'),0)::bigint AS collected_value,
        count(*) FILTER (WHERE appointment_date = CURRENT_DATE AND status <> 'cancelled')::int AS today
        FROM bookings`),
      sql<{ status: string; n: number; value: unknown }>('SELECT status, count(*)::int AS n, COALESCE(sum(total_paise),0) AS value FROM bookings GROUP BY status ORDER BY status'),
      sql<{ payment_method: string; n: number }>('SELECT payment_method, count(*)::int AS n FROM bookings GROUP BY payment_method'),
      sql<{ name: string; n: number; revenue: unknown }>(`SELECT name_snapshot AS name, sum(quantity)::int AS n, sum(unit_price_paise * quantity) AS revenue
        FROM booking_items bi JOIN bookings b ON b.id = bi.booking_id WHERE b.status <> 'cancelled' GROUP BY name_snapshot ORDER BY n DESC LIMIT 10`),
      sql<{ day: string; n: number; value: unknown }>(`SELECT appointment_date::text AS day, count(*)::int AS n, COALESCE(sum(total_paise),0) AS value
        FROM bookings WHERE appointment_date BETWEEN CURRENT_DATE - 13 AND CURRENT_DATE + 7 AND status <> 'cancelled' GROUP BY appointment_date ORDER BY appointment_date`),
      listPaymentsForAdmin(100),
      one<{ n: number }>(`SELECT count(*)::int AS n FROM bookings WHERE payment_status = 'refunded'`),
    ])
    return Response.json({
      summary: summary ?? {},
      byStatus: byStatus.map((row) => ({ status: row.status, count: Number(row.n), valuePaise: Number(row.value) })),
      byMethod: byMethod.map((row) => ({ method: row.payment_method, count: Number(row.n) })),
      topTests: topTests.map((row) => ({ name: row.name, count: Number(row.n), revenuePaise: Number(row.revenue) })),
      daily: daily.map((row) => ({ day: String(row.day).slice(0, 10), count: Number(row.n), valuePaise: Number(row.value) })),
      payments,
      refundCount: Number(refundsResult?.n ?? 0),
      razorpay: publicPaymentStatus(),
    })
  } catch (error) {
    return jsonError(error)
  }
}
