import { revalidatePath } from 'next/cache'
import { guard, jsonError } from '@/lib/auth'
import { sql } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Admin notification inbox.
 *
 * Every new booking writes an `in_app` row through notifyStaffEmail(), so the
 * data already exists — this endpoint is what the bell in the admin topbar
 * reads. It is a shared staff inbox: marking read clears it for everyone.
 */

interface NotificationRow extends Record<string, unknown> {
  id: string
  detail: string
  created_at: string
  read_at: string | null
  booking_id: string | null
  reference: string | null
  patient_name: string | null
  status: string | null
  total_paise: string | number | null
}

function shape(row: NotificationRow) {
  return {
    id: row.id,
    // The detail column holds the plain-text alert written at booking time.
    text: row.detail,
    createdAt: new Date(row.created_at).toISOString(),
    read: row.read_at !== null,
    bookingId: row.booking_id,
    reference: row.reference,
    patientName: row.patient_name,
    status: row.status,
    totalPaise: row.total_paise === null ? null : Number(row.total_paise),
  }
}

const LIST_SQL = `
  SELECT n.id, n.detail, n.created_at, n.read_at, n.booking_id,
         b.reference, b.patient_name, b.status, b.total_paise
  FROM notifications n
  JOIN bookings b ON b.id = n.booking_id
  WHERE n.channel = 'in_app'
  ORDER BY n.created_at DESC
  LIMIT 30`

/** GET — the 30 most recent alerts plus the unread count. */
export async function GET(request: Request) {
  try {
    await guard(request)

    // read_at was added in migration 0008. If this deployment is running before
    // the migration, fall back to "everything is unread" rather than 500-ing the
    // bell on every page of the admin console.
    let rows: NotificationRow[]
    let hasReadState = true
    try {
      rows = await sql<NotificationRow>(LIST_SQL)
    } catch {
      hasReadState = false
      rows = await sql<NotificationRow>(
        `${LIST_SQL.replace('n.read_at,', 'NULL::timestamptz AS read_at,')}`,
      ).catch(() => [])
    }

    const items = rows.map(shape)
    return Response.json({
      items,
      unread: items.filter((item) => !item.read).length,
      hasReadState,
    })
  } catch (error) {
    return jsonError(error)
  }
}

/** PATCH — { ids?: string[] } marks those alerts read; omit ids to clear all. */
export async function PATCH(request: Request) {
  try {
    await guard(request, { mutation: true })
    const body = await request.json().catch(() => ({})) as { ids?: unknown }
    const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === 'string') : null

    if (ids && ids.length > 0) {
      await sql(
        `UPDATE notifications SET read_at = now()
         WHERE channel = 'in_app' AND read_at IS NULL AND id = ANY($1::uuid[])`,
        [ids],
      )
    } else if (ids === null) {
      // Only booking alerts — contact-form enquiries are handled on that screen.
      await sql(`UPDATE notifications SET read_at = now() WHERE channel = 'in_app' AND read_at IS NULL AND booking_id IS NOT NULL`)
    }

    revalidatePath('/admin')
    return Response.json({ ok: true })
  } catch (error) {
    return jsonError(error)
  }
}
