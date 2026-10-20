import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { currentAdmin } from '@/lib/auth'
import { sql } from '@/lib/db'
import { AdminConsole } from '@/components/admin/admin-console'

export const metadata: Metadata = { title: 'Admin', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const user = await currentAdmin()
  if (!user) redirect('/admin/login')

  let dashboard: Record<string, unknown> | null = null
  let bookings: unknown = null
  try {
    const counts = (await sql(`SELECT
      (SELECT count(*) FROM diagnostic_tests WHERE status = 'published')::int AS active_tests,
      (SELECT count(*) FROM health_packages WHERE status = 'published')::int AS active_packages,
      (SELECT count(*) FROM investigations WHERE is_active)::int AS investigations,
      (SELECT count(*) FROM bookings)::int AS bookings,
      (SELECT count(*) FROM bookings WHERE status = 'pending_confirmation')::int AS pending_bookings,
      (SELECT count(*) FROM bookings WHERE status = 'confirmed')::int AS confirmed_bookings,
      (SELECT count(*) FROM enquiries WHERE status = 'new')::int AS new_enquiries,
      (SELECT count(*) FROM locations WHERE is_active)::int AS active_locations,
      (SELECT count(*) FROM bookings WHERE appointment_date = CURRENT_DATE AND status <> 'cancelled')::int AS today_bookings,
      (SELECT COALESCE(sum(total_paise),0) FROM bookings WHERE payment_status = 'paid')::bigint AS collected_paise`))[0]
    dashboard = counts ?? null
    bookings = { bookings: [], total: 0, page: 1, pages: 1 }
  } catch (error) {
    console.error('[admin] initial data failed', error)
  }

  return <AdminConsole user={user} dashboard={dashboard} bookings={bookings} />
}
