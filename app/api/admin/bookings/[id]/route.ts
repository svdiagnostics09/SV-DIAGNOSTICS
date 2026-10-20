import { guard, jsonError } from '@/lib/auth'
import { sql } from '@/lib/db'
import { STATUS_LABELS, type BookingStatus } from '@/lib/booking'

export const dynamic = 'force-dynamic'

/** Full booking detail, including timeline and payment attempts (staff only). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await guard(request)
    const { id } = await params
    const booking = (await sql<Record<string, unknown>>(
      `SELECT b.*, l.name AS location_name, a.name AS area_name FROM bookings b
       LEFT JOIN locations l ON l.id = b.location_id LEFT JOIN service_areas a ON a.id = b.service_area_id WHERE b.id = $1`,
      [id],
    ))[0]
    if (!booking) return Response.json({ error: 'Booking not found.' }, { status: 404 })
    const [items, events, payments, notifications, consents] = await Promise.all([
      sql('SELECT kind, name_snapshot, unit_price_paise, quantity FROM booking_items WHERE booking_id = $1', [id]),
      sql('SELECT kind, message, actor, created_at FROM booking_events WHERE booking_id = $1 ORDER BY created_at DESC', [id]),
      sql('SELECT provider_order_id, provider_payment_id, amount_paise, status, method, created_at FROM payments WHERE booking_id = $1 ORDER BY created_at DESC', [id]),
      sql('SELECT channel, recipient, template, status, detail, created_at FROM notifications WHERE booking_id = $1 ORDER BY created_at DESC', [id]),
      sql('SELECT consent_type, version, accepted, accepted_at FROM consent_records WHERE booking_id = $1', [id]),
    ])
    return Response.json({
      booking: {
        id: String(booking.id),
        reference: String(booking.reference),
        patientName: String(booking.patient_name),
        age: booking.patient_age === null ? null : Number(booking.patient_age),
        gender: booking.patient_gender ? String(booking.patient_gender) : null,
        phone: String(booking.phone),
        email: booking.email ? String(booking.email) : null,
        method: String(booking.method),
        locationName: booking.location_name ? String(booking.location_name) : null,
        areaName: booking.area_name ? String(booking.area_name) : null,
        addressLine: String(booking.address_line ?? ''),
        addressArea: String(booking.address_area ?? ''),
        pincode: String(booking.pincode ?? ''),
        appointmentDate: String(booking.appointment_date).slice(0, 10),
        slotLabel: String(booking.slot_label),
        subtotalPaise: Number(booking.subtotal_paise),
        discountPaise: Number(booking.discount_paise),
        collectionFeePaise: Number(booking.collection_fee_paise),
        totalPaise: Number(booking.total_paise),
        paymentMethod: String(booking.payment_method),
        paymentStatus: String(booking.payment_status),
        status: String(booking.status),
        statusLabel: STATUS_LABELS[booking.status as BookingStatus],
        internalNotes: String(booking.internal_notes ?? ''),
        cancellationReason: String(booking.cancellation_reason ?? ''),
        consentAccepted: Boolean(booking.consent_accepted),
        createdAt: new Date(booking.created_at as string).toISOString(),
        updatedAt: new Date(booking.updated_at as string).toISOString(),
      },
      items: items.map((row) => ({ kind: String(row.kind), name: String(row.name_snapshot), unitPricePaise: Number(row.unit_price_paise), quantity: Number(row.quantity) })),
      events: events.map((row) => ({ kind: String(row.kind), message: String(row.message), actor: String(row.actor), at: new Date(row.created_at as string).toISOString() })),
      payments: payments.map((row) => ({ providerOrderId: String(row.provider_order_id), providerPaymentId: row.provider_payment_id ? String(row.provider_payment_id) : null, amountPaise: Number(row.amount_paise), status: String(row.status), method: String(row.method ?? ''), createdAt: new Date(row.created_at as string).toISOString() })),
      notifications: notifications.map((row) => ({ channel: String(row.channel), recipient: String(row.recipient), template: String(row.template), status: String(row.status), detail: String(row.detail), at: new Date(row.created_at as string).toISOString() })),
      consents: consents.map((row) => ({ type: String(row.consent_type), version: String(row.version), accepted: Boolean(row.accepted), at: new Date(row.accepted_at as string).toISOString() })),
    })
  } catch (error) {
    return jsonError(error)
  }
}
