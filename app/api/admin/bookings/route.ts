import { revalidatePath } from 'next/cache'
import { z, ZodError } from 'zod'
import { guard, jsonError } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { one, sql } from '@/lib/db'
import { listEnquiries } from '@/lib/content'
import { listAuditLogs } from '@/lib/audit'
import { BOOKING_STATUSES, STATUS_LABELS, transitionBooking, BookingError, type BookingStatus } from '@/lib/booking'
import { recordManualRefund } from '@/lib/payments'
import { firstIssue, emailSchema } from '@/lib/validation'
import { sendStatusEmail } from '@/lib/notify'

export const dynamic = 'force-dynamic'

export interface AdminBooking {
  id: string
  reference: string
  patientName: string
  age: number | null
  gender: string | null
  phone: string
  email: string | null
  method: string
  locationName: string | null
  areaName: string | null
  addressLine: string
  pincode: string
  appointmentDate: string
  slotLabel: string
  totalPaise: number
  subtotalPaise: number
  discountPaise: number
  collectionFeePaise: number
  paymentMethod: string
  paymentStatus: string
  status: BookingStatus
  statusLabel: string
  internalNotes: string
  createdAt: string
  items: Array<{ name: string; kind: string; unitPricePaise: number; quantity: number }>
  events: Array<{ kind: string; message: string; actor: string; at: string }>
  payments: Array<{ providerOrderId: string; providerPaymentId: string | null; amountPaise: number; status: string; method: string }>
}

/** Booking list with server-side pagination, search and filters. */
export async function listBookings(query: { q?: string; status?: string; method?: string; locationId?: number; from?: string; to?: string; page?: number; pageSize?: number }) {
  const pageSize = Math.min(100, Math.max(5, query.pageSize ?? 20))
  const page = Math.max(1, query.page ?? 1)
  const where: string[] = []
  const values: unknown[] = []
  if (query.q?.trim()) {
    values.push(`%${query.q.trim().toLowerCase()}%`)
    where.push(`(lower(b.reference) LIKE $${values.length} OR lower(b.patient_name) LIKE $${values.length} OR b.phone LIKE $${values.length} OR lower(coalesce(b.email,'')) LIKE $${values.length})`)
  }
  if (query.status && query.status !== 'all') { values.push(query.status); where.push(`b.status = $${values.length}`) }
  if (query.method && query.method !== 'all') { values.push(query.method); where.push(`b.method = $${values.length}`) }
  if (query.locationId) { values.push(query.locationId); where.push(`b.location_id = $${values.length}`) }
  if (query.from) { values.push(query.from); where.push(`b.appointment_date >= $${values.length}`) }
  if (query.to) { values.push(query.to); where.push(`b.appointment_date <= $${values.length}`) }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const count = await one<{ total: number }>(`SELECT count(*)::int AS total FROM bookings b ${whereSql}`, values)
  values.push(pageSize, (page - 1) * pageSize)
  const rows = await sql<Record<string, unknown>>(
    `SELECT b.*, l.name AS location_name, a.name AS area_name FROM bookings b
     LEFT JOIN locations l ON l.id = b.location_id LEFT JOIN service_areas a ON a.id = b.service_area_id
     ${whereSql} ORDER BY b.created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  )
  const ids = rows.map((row) => String(row.id))
  const items = ids.length ? await sql<Record<string, unknown>>('SELECT * FROM booking_items WHERE booking_id = ANY($1::uuid[])', [ids]) : []
  return {
    total: count?.total ?? 0,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil((count?.total ?? 0) / pageSize)),
    bookings: rows.map((row) => ({
      id: String(row.id),
      reference: String(row.reference),
      patientName: String(row.patient_name),
      age: row.patient_age === null ? null : Number(row.patient_age),
      gender: row.patient_gender ? String(row.patient_gender) : null,
      phone: String(row.phone),
      email: row.email ? String(row.email) : null,
      method: String(row.method),
      locationName: row.location_name ? String(row.location_name) : null,
      areaName: row.area_name ? String(row.area_name) : null,
      addressLine: String(row.address_line ?? ''),
      pincode: String(row.pincode ?? ''),
      appointmentDate: String(row.appointment_date).slice(0, 10),
      slotLabel: String(row.slot_label),
      totalPaise: Number(row.total_paise),
      subtotalPaise: Number(row.subtotal_paise),
      discountPaise: Number(row.discount_paise),
      collectionFeePaise: Number(row.collection_fee_paise),
      paymentMethod: String(row.payment_method),
      paymentStatus: String(row.payment_status),
      status: row.status as BookingStatus,
      statusLabel: STATUS_LABELS[row.status as BookingStatus],
      internalNotes: String(row.internal_notes ?? ''),
      createdAt: new Date(row.created_at as string).toISOString(),
      items: items.filter((item) => item.booking_id === row.id).map((item) => ({ name: String(item.name_snapshot), kind: String(item.kind), unitPricePaise: Number(item.unit_price_paise), quantity: Number(item.quantity) })),
      events: [],
      payments: [],
    })),
  }
}

export async function GET(request: Request) {
  try {
    await guard(request)
    const url = new URL(request.url)
    const view = url.searchParams.get('view')
    if (view === 'enquiries') return Response.json({ enquiries: await listEnquiries() })
    if (view === 'audit') return Response.json({ logs: await listAuditLogs(Number(url.searchParams.get('limit') ?? 200)) })
    const data = await listBookings({
      q: url.searchParams.get('q') ?? undefined,
      status: url.searchParams.get('status') ?? undefined,
      method: url.searchParams.get('method') ?? undefined,
      locationId: Number(url.searchParams.get('locationId')) || undefined,
      from: url.searchParams.get('from') ?? undefined,
      to: url.searchParams.get('to') ?? undefined,
      page: Number(url.searchParams.get('page') ?? 1),
      pageSize: Number(url.searchParams.get('pageSize') ?? 20),
    })
    return Response.json({ ...data, statuses: BOOKING_STATUSES })
  } catch (error) {
    return jsonError(error)
  }
}

const patchSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('status'), status: z.enum(BOOKING_STATUSES as [BookingStatus, ...BookingStatus[]]), note: z.string().max(300).optional() }),
  z.object({ action: z.literal('cancel'), reason: z.string().trim().min(3, 'Give a cancellation reason.').max(300) }),
  z.object({ action: z.literal('notes'), notes: z.string().max(2000) }),
  z.object({ action: z.literal('email'), email: emailSchema }),
  z.object({ action: z.literal('refund'), amountPaise: z.number().int().min(0).max(10_000_000), note: z.string().max(300).optional() }),
])

export async function PATCH(request: Request) {
  try {
    const admin = await guard(request, { mutation: true })
    const body = z.object({ id: z.string().uuid() }).and(patchSchema).parse(await request.json().catch(() => null))
    const booking = await one<{ reference: string; email: string | null }>('SELECT reference, email FROM bookings WHERE id = $1', [body.id])
    if (!booking) return Response.json({ error: 'Booking not found.' }, { status: 404 })

    if (body.action === 'status') {
      const next = await transitionBooking(body.id, body.status, admin.email, body.note)
      await audit({ actor: admin, action: 'booking.status', entity: 'bookings', entityId: body.id, detail: { reference: booking.reference, status: next }, request })
      void sendStatusEmail({ bookingId: body.id, email: booking.email, reference: booking.reference, status: next, trackingLink: `${new URL(request.url).origin}/track?ref=${encodeURIComponent(booking.reference)}` }).catch(() => undefined)
    } else if (body.action === 'cancel') {
      await transitionBooking(body.id, 'cancelled', admin.email, body.reason)
      await audit({ actor: admin, action: 'booking.cancel', entity: 'bookings', entityId: body.id, detail: { reference: booking.reference, reason: body.reason }, request })
    } else if (body.action === 'notes') {
      await sql('UPDATE bookings SET internal_notes = $2, updated_at = now() WHERE id = $1', [body.id, body.notes])
      await audit({ actor: admin, action: 'booking.notes', entity: 'bookings', entityId: body.id, request })
    } else if (body.action === 'email') {
      await sql('UPDATE bookings SET email = $2, updated_at = now() WHERE id = $1', [body.id, body.email || null])
      await audit({ actor: admin, action: 'booking.email_update', entity: 'bookings', entityId: body.id, request })
    } else if (body.action === 'refund') {
      const result = await recordManualRefund(body.id, body.amountPaise, body.note ?? '', admin.email)
      if (!result.ok) return Response.json({ error: result.error }, { status: 409 })
      await audit({ actor: admin, action: 'booking.refund_recorded', entity: 'bookings', entityId: body.id, detail: { amountPaise: body.amountPaise }, request })
    }

    revalidatePath('/admin')
    return Response.json({ ok: true })
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: firstIssue(error) }, { status: 400 })
    if (error instanceof BookingError) return Response.json({ error: error.message }, { status: error.status })
    if ((error as { code?: string }).code === '23505') return Response.json({ error: 'That change conflicts with the current booking state.' }, { status: 409 })
    return jsonError(error)
  }
}
