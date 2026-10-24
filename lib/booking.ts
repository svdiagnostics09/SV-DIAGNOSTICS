import { randomBytes, randomUUID } from 'node:crypto'
import type { PoolClient } from 'pg'
import { getTestById, getPackageById } from '@/lib/catalogue'
import { one, sql, transaction } from '@/lib/db'
import { areaForPincode, getLocation } from '@/lib/network'
import { getSettings } from '@/lib/settings'

/**
 * Booking engine.
 *
 * Prices are always recomputed here from the database — a browser-submitted
 * amount is ignored. Slot capacity is reserved atomically: inside one
 * transaction the slot reservation row is incremented and locked with
 * SELECT … FOR UPDATE, and the table constraint booked + holds <= capacity is
 * the final backstop. A second customer racing for the last place waits on the
 * lock, re-reads the row, and receives a 409 instead of overbooking.
 */

export type BookingStatus =
  | 'pending_confirmation' | 'confirmed' | 'collection_scheduled' | 'sample_collected'
  | 'processing' | 'report_ready' | 'completed' | 'cancelled'

export const BOOKING_STATUSES: BookingStatus[] = [
  'pending_confirmation', 'confirmed', 'collection_scheduled', 'sample_collected', 'processing', 'report_ready', 'completed', 'cancelled',
]

export const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending_confirmation: ['confirmed', 'cancelled'],
  confirmed: ['collection_scheduled', 'cancelled'],
  collection_scheduled: ['sample_collected', 'cancelled'],
  sample_collected: ['processing'],
  processing: ['report_ready'],
  report_ready: ['completed'],
  completed: [],
  cancelled: [],
}

export const STATUS_LABELS: Record<BookingStatus, string> = {
  pending_confirmation: 'Pending confirmation',
  confirmed: 'Confirmed',
  collection_scheduled: 'Sample collection scheduled',
  sample_collected: 'Sample collected',
  processing: 'Processing',
  report_ready: 'Report ready',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export interface CartItemInput { kind: 'test' | 'package'; id: number; quantity?: number }

export interface PricingLine {
  kind: 'test' | 'package'
  id: number
  name: string
  unitPricePaise: number
  listPricePaise: number
  quantity: number
  homeCollection: boolean
}

export class BookingError extends Error {
  status: number
  code: string
  constructor(status: number, message: string, code = 'invalid') {
    super(message)
    this.status = status
    this.code = code
  }
}

const MAX_ITEMS = 12

/** Server-side price calculation. Nothing here trusts the client. */
export async function priceCart(items: CartItemInput[], method: 'home' | 'lab') {
  if (!items.length) throw new BookingError(400, 'Select at least one test or package.')
  if (items.length > MAX_ITEMS) throw new BookingError(400, `A booking can include at most ${MAX_ITEMS} items.`)
  const settings = await getSettings()
  if (method === 'home' && !settings.collectionEnabled) throw new BookingError(400, 'Home collection is currently unavailable.')

  const lines: PricingLine[] = []
  const seen = new Set<string>()
  for (const item of items) {
    const quantity = Math.min(5, Math.max(1, Math.floor(item.quantity ?? 1)))
    const key = `${item.kind}:${item.id}`
    if (seen.has(key)) throw new BookingError(400, 'The same item was added twice.')
    seen.add(key)
    if (item.kind === 'test') {
      const test = await getTestById(item.id)
      if (!test || test.status !== 'published') throw new BookingError(400, 'One of the selected tests is no longer available.')
      if (method === 'home' && !test.homeCollection) throw new BookingError(400, `“${test.name}” is not available for home collection. Please choose a laboratory visit.`)
      lines.push({ kind: 'test', id: test.id, name: test.name, unitPricePaise: test.listPricePaise, listPricePaise: test.pricePaise, quantity, homeCollection: test.homeCollection })
    } else {
      const pack = await getPackageById(item.id)
      if (!pack || pack.status !== 'published') throw new BookingError(400, 'One of the selected packages is no longer available.')
      if (method === 'home' && !pack.homeCollection) throw new BookingError(400, `“${pack.name}” is not available for home collection.`)
      if (pack.testCount === 0) throw new BookingError(400, `“${pack.name}” has no tests configured yet.`)
      lines.push({ kind: 'package', id: pack.id, name: pack.name, unitPricePaise: pack.pricePaise, listPricePaise: pack.originalPricePaise ?? pack.pricePaise, quantity, homeCollection: pack.homeCollection })
    }
  }

  const subtotalPaise = lines.reduce((sum, line) => sum + line.listPricePaise * line.quantity, 0)
  const netPaise = lines.reduce((sum, line) => sum + line.unitPricePaise * line.quantity, 0)
  const discountPaise = subtotalPaise - netPaise
  const collectionFeePaise = method === 'home' ? Math.max(0, settings.collectionFeePaise) : 0
  return { lines, subtotalPaise, discountPaise, collectionFeePaise, totalPaise: netPaise + collectionFeePaise }
}

export interface CreateBookingInput {
  items: CartItemInput[]
  method: 'home' | 'lab'
  locationId?: number | null
  pincode?: string
  addressLine?: string
  addressArea?: string
  date: string
  slotId: number
  patientName: string
  patientAge?: number | null
  patientGender?: 'male' | 'female' | 'other' | null
  phone: string
  email?: string | null
  paymentMethod: 'pay_lab' | 'pay_home'
  consentAccepted: boolean
  idempotencyKey?: string | null
  ipHash?: string
  userAgent?: string
}

export interface CreatedBooking {
  id: string
  reference: string
  accessToken: string
  totalPaise: number
  subtotalPaise: number
  discountPaise: number
  collectionFeePaise: number
  status: BookingStatus
  paymentMethod: 'pay_lab' | 'pay_home'
  paymentStatus: string
  holdExpiresAt: string | null
}

export function indiaToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
}

const newReference = () => `SV-${new Date().getFullYear()}-${Array.from(randomBytes(4), (byte) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[byte % 32]).join('')}`

/** Release expired checkout holds (and cancel their unpaid bookings). */
async function expireHolds(client: PoolClient) {
  const expired = await client.query<{ id: string; booking_id: string | null; reservation_id: string }>(
    `SELECT id, booking_id, reservation_id FROM slot_holds WHERE released_at IS NULL AND expires_at <= now() FOR UPDATE SKIP LOCKED`,
  )
  for (const hold of expired.rows) {
    await client.query('UPDATE slot_holds SET released_at = now() WHERE id = $1', [hold.id])
    await client.query('UPDATE slot_reservations SET holds = GREATEST(0, holds - 1), updated_at = now() WHERE id = $1', [hold.reservation_id])
    if (hold.booking_id) {
      const updated = await client.query(
        `UPDATE bookings SET status = 'cancelled', cancellation_reason = 'Payment not completed in time',
           payment_status = CASE WHEN payment_status = 'pending' THEN 'cancelled' ELSE payment_status END, updated_at = now()
         WHERE id = $1 AND status = 'pending_confirmation' AND payment_status <> 'paid' RETURNING id`,
        [hold.booking_id],
      )
      if (updated.rowCount) {
        await client.query(`INSERT INTO booking_events (booking_id, kind, message, actor) VALUES ($1, 'status', 'Hold expired — slot released', 'system')`, [hold.booking_id])
      }
    }
  }
}

/** Create-or-update and lock the counter row for a slot/date, then check capacity. */
async function reserveCapacity(client: PoolClient, input: { slotId: number; locationId: number | null; method: 'home' | 'lab'; date: string; capacity: number }) {
  await client.query(
    `INSERT INTO slot_reservations (slot_id, location_id, method, slot_date, capacity)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (slot_id, COALESCE(location_id, 0), slot_date)
     DO UPDATE SET capacity = EXCLUDED.capacity, updated_at = now()
     WHERE slot_reservations.capacity <> EXCLUDED.capacity`,
    [input.slotId, input.locationId, input.method, input.date, input.capacity],
  )
  const locked = await client.query<{ id: string; capacity: number; booked: number; holds: number }>(
    `SELECT id, capacity, booked, holds FROM slot_reservations
     WHERE slot_id = $1 AND COALESCE(location_id, 0) = COALESCE($2, 0) AND slot_date = $3 FOR UPDATE`,
    [input.slotId, input.locationId, input.date],
  )
  const row = locked.rows[0]
  if (!row) throw new BookingError(409, 'That time slot is not available. Please pick another.', 'slot_unavailable')
  if (Number(row.booked) + Number(row.holds) + 1 > Number(row.capacity)) {
    throw new BookingError(409, 'This slot is now full. Please choose another time.', 'slot_full')
  }
  return row
}

export async function createBooking(input: CreateBookingInput): Promise<CreatedBooking> {
  const settings = await getSettings()

  // Duplicate submission guard: same idempotency key returns the existing booking.
  if (input.idempotencyKey) {
    const existing = await one<Record<string, unknown>>('SELECT * FROM bookings WHERE idempotency_key = $1', [input.idempotencyKey])
    if (existing) {
      return {
        id: String(existing.id), reference: String(existing.reference), accessToken: String(existing.access_token),
        totalPaise: Number(existing.total_paise), subtotalPaise: Number(existing.subtotal_paise), discountPaise: Number(existing.discount_paise),
        collectionFeePaise: Number(existing.collection_fee_paise), status: existing.status as BookingStatus,
        paymentMethod: existing.payment_method as CreatedBooking['paymentMethod'], paymentStatus: String(existing.payment_status), holdExpiresAt: null,
      }
    }
  }

  if (!input.consentAccepted) throw new BookingError(400, 'Please accept the patient consent and booking terms.')
  if (input.method === 'lab' && !input.locationId) throw new BookingError(400, 'Choose a laboratory location.')
  if (input.method === 'home' && (!input.pincode || !input.addressLine)) throw new BookingError(400, 'Enter the collection address and pincode.')

  const location = input.method === 'lab' ? await getLocation(Number(input.locationId)) : null
  if (input.method === 'lab' && (!location || !location.isActive)) throw new BookingError(400, 'That laboratory is not accepting bookings.')

  const area = input.method === 'home' ? await areaForPincode(String(input.pincode)) : null
  if (input.method === 'home' && !area) throw new BookingError(400, 'Home collection is not available for this pincode yet. Please choose a laboratory visit.')

  // Prices are recomputed from the database; the browser never sends an amount.
  const priced = await priceCart(input.items, input.method)

  const slotRow = await one<{ id: number; label: string; method: string; location_id: number | null; daily_capacity: number; weekdays: number[] | null; is_active: boolean }>(
    'SELECT id, label, method, location_id, daily_capacity, weekdays, is_active FROM collection_slots WHERE id = $1',
    [input.slotId],
  )
  if (!slotRow || !slotRow.is_active) throw new BookingError(400, 'That collection slot is not available.')
  if (slotRow.method !== 'both' && slotRow.method !== input.method) throw new BookingError(400, 'That slot does not support the selected collection method.')
  if (input.method === 'lab' && slotRow.location_id !== null && Number(slotRow.location_id) !== input.locationId) throw new BookingError(400, 'That slot belongs to another laboratory.')

  // Date rules: within the horizon, correct weekday, not blacked out.
  const base = new Date(`${indiaToday()}T00:00:00+05:30`)
  const horizon = new Set(Array.from({ length: settings.bookingHorizonDays + 1 }, (_, index) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(base.getTime() + index * 86_400_000))))
  if (!horizon.has(input.date)) throw new BookingError(400, 'Choose a date within the booking window.')
  const weekdayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(
    new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short' }).format(new Date(`${input.date}T12:00:00+05:30`)),
  )
  if (!(slotRow.weekdays ?? [0, 1, 2, 3, 4, 5, 6]).map(Number).includes(weekdayIndex)) throw new BookingError(400, 'The laboratory is closed on that day.')
  const blackout = await one(
    `SELECT 1 FROM slot_blackouts WHERE blackout_date = $1 AND (slot_id IS NULL OR slot_id = $2) AND (location_id IS NULL OR location_id = $3)`,
    [input.date, input.slotId, input.method === 'lab' ? input.locationId : null],
  )
  if (blackout) throw new BookingError(400, 'No collection on that date. Please pick another day.')

  if (input.paymentMethod === 'pay_home' && (input.method !== 'home' || !settings.payAtHomeEnabled)) throw new BookingError(400, 'Pay at collection is not available for this booking.')
  if (input.paymentMethod === 'pay_lab' && (input.method !== 'lab' || !settings.payAtLabEnabled)) throw new BookingError(400, 'Pay at laboratory is not available for this booking.')

  if (input.paymentMethod === 'pay_home' && (input.method !== 'home' || !settings.payAtHomeEnabled)) throw new BookingError(400, 'Pay at collection is not available for this booking.')
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const reference = newReference()
    try {
      return await reserveAndCreate({ ...input, settings, priced, slotRow, area, reference })
    } catch (error) {
      // Reference collision is astronomically unlikely; retry with a new one.
      if ((error as { code?: string }).code === '23505' && (error as { constraint?: string }).constraint === 'bookings_reference_key') continue
      throw error
    }
  }
  throw new BookingError(500, 'Could not allocate a booking reference. Please try again.')
}

interface ReserveContext {
  settings: Awaited<ReturnType<typeof getSettings>>
  priced: Awaited<ReturnType<typeof priceCart>>
  slotRow: { id: number; label: string; method: string; location_id: number | null; daily_capacity: number; weekdays: number[] | null; is_active: boolean }
  area: Awaited<ReturnType<typeof areaForPincode>>
  reference: string
}

async function reserveAndCreate(input: CreateBookingInput & ReserveContext): Promise<CreatedBooking> {
  const { priced, slotRow, area, settings } = input
  return transaction(async (client) => {
    await expireHolds(client)
    const reservation = await reserveCapacity(client, {
      slotId: input.slotId, locationId: input.method === 'lab' ? input.locationId ?? null : null, method: input.method, date: input.date, capacity: slotRow.daily_capacity,
    })

    const bookingId = randomUUID()
    const accessToken = randomBytes(24).toString('base64url')
    const holdExpiresAt = new Date(Date.now() + settings.slotHoldMinutes * 60_000)
    await client.query('UPDATE slot_reservations SET holds = holds + 1, updated_at = now() WHERE id = $1', [reservation.id])

    await client.query(
      `INSERT INTO bookings (id, reference, access_token, patient_name, patient_age, patient_gender, phone, email, method, location_id,
         service_area_id, address_line, address_area, pincode, appointment_date, slot_id, slot_label, reservation_id,
         subtotal_paise, discount_paise, collection_fee_paise, total_paise, payment_method, payment_status, status,
         consent_accepted, consent_ref, idempotency_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,'pending',$24,true,$25,$26)`,
      [
        bookingId, input.reference, accessToken, input.patientName, input.patientAge ?? null, input.patientGender ?? null,
        input.phone, input.email ?? null, input.method, input.method === 'lab' ? input.locationId : null,
        area?.id ?? null, input.addressLine ?? '', input.addressArea ?? '', input.pincode ?? '',
        input.date, input.slotId, slotRow.label, reservation.id,
        priced.subtotalPaise, priced.discountPaise, priced.collectionFeePaise, priced.totalPaise,
        input.paymentMethod, 'pending_confirmation', randomUUID(), input.idempotencyKey ?? null,
      ],
    )
    for (const line of priced.lines) {
      await client.query(
        `INSERT INTO booking_items (booking_id, kind, test_id, package_id, name_snapshot, unit_price_paise, list_price_paise, quantity)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [bookingId, line.kind, line.kind === 'test' ? line.id : null, line.kind === 'package' ? line.id : null, line.name, line.unitPricePaise, line.listPricePaise, line.quantity],
      )
    }
    await client.query(
      `INSERT INTO consent_records (booking_id, consent_type, version, accepted, ip_hash, user_agent) VALUES ($1, 'patient_consent_and_terms', $2, true, $3, $4)`,
      [bookingId, settings.consentVersion, input.ipHash ?? '', (input.userAgent ?? '').slice(0, 300)],
    )
    await client.query('INSERT INTO slot_holds (reservation_id, booking_id, expires_at) VALUES ($1, $2, $3)', [reservation.id, bookingId, holdExpiresAt])
    await client.query(
      `INSERT INTO booking_events (booking_id, kind, message, actor) VALUES ($1, 'created', $2, 'customer')`,
      [bookingId, `Booking placed · ${priced.lines.map((line) => line.name).join(', ')} · ${input.method === 'home' ? 'Home collection' : 'Laboratory visit'}`],
    )

    return {
      id: bookingId, reference: input.reference, accessToken, totalPaise: priced.totalPaise, subtotalPaise: priced.subtotalPaise,
      discountPaise: priced.discountPaise, collectionFeePaise: priced.collectionFeePaise,
      status: 'pending_confirmation' as BookingStatus, paymentMethod: input.paymentMethod, paymentStatus: 'pending',
      holdExpiresAt: holdExpiresAt.toISOString(),
    }
  })
}

export async function consumeHold(bookingId: string) {
  await transaction(async (client) => {
    const hold = (await client.query<{ id: string; reservation_id: string }>(
      'SELECT id, reservation_id FROM slot_holds WHERE booking_id = $1 AND released_at IS NULL FOR UPDATE',
      [bookingId],
    )).rows[0]
    if (!hold) return
    await client.query('UPDATE slot_holds SET released_at = now() WHERE id = $1', [hold.id])
    await client.query('UPDATE slot_reservations SET holds = GREATEST(0, holds - 1), booked = booked + 1, updated_at = now() WHERE id = $1', [hold.reservation_id])
  })
}

/**
 * Release holds for unpaid bookings whose checkout expired. Called lazily by
 * availability reads; the booking becomes cancelled and the slot is freed.
 */
export async function releaseExpiredHolds() {
  await transaction(async (client) => {
    const expired = (await client.query<{ id: string; booking_id: string | null; reservation_id: string }>(
      `SELECT id, booking_id, reservation_id FROM slot_holds WHERE released_at IS NULL AND expires_at <= now() FOR UPDATE SKIP LOCKED`,
    )).rows
    // Count how many open holds each reservation actually has, so the counter
    // is corrected rather than decremented blindly (never below zero).
    const affected = new Set<string>()
    for (const hold of expired) {
      await client.query('UPDATE slot_holds SET released_at = now() WHERE id = $1', [hold.id])
      affected.add(hold.reservation_id)
    }
    for (const reservationId of affected) {
      await client.query(
        `UPDATE slot_reservations r SET holds = GREATEST(0, (SELECT count(*) FROM slot_holds h WHERE h.reservation_id = r.id AND h.released_at IS NULL)), updated_at = now() WHERE r.id = $1`,
        [reservationId],
      )
    }
    // Cancel still-pending bookings that no longer own an open hold. This also
    // repairs holds orphaned by failed checkouts or interrupted requests.
    await client.query(
      `UPDATE bookings SET status = 'cancelled', cancellation_reason = 'Payment not completed in time',
         payment_status = CASE WHEN payment_status = 'pending' THEN 'cancelled' ELSE payment_status END, updated_at = now()
       WHERE status = 'pending_confirmation' AND payment_status <> 'paid'
         AND created_at < now() - interval '3 minutes'
         AND NOT EXISTS (SELECT 1 FROM slot_holds h WHERE h.booking_id = bookings.id AND h.released_at IS NULL)
       RETURNING id`,
    )
    for (const hold of expired) {
      if (!hold.booking_id) continue
      const updated = await client.query(
        `UPDATE bookings SET status = 'cancelled', cancellation_reason = 'Payment not completed in time', payment_status = CASE WHEN payment_status = 'pending' THEN 'cancelled' ELSE payment_status END, updated_at = now()
         WHERE id = $1 AND status = 'pending_confirmation' AND payment_status <> 'paid' RETURNING id, reference`,
        [hold.booking_id],
      )
      if (updated.rowCount) {
        await client.query(`INSERT INTO booking_events (booking_id, kind, message, actor) VALUES ($1, 'status', 'Hold expired — slot released', 'system')`, [hold.booking_id])
      }
    }
  })
}

/* ------------------------------------------------------------------ */
/* Status changes                                                      */
/* ------------------------------------------------------------------ */

/**
 * Controlled state transitions. Cancellation frees capacity exactly once:
 * either the open hold is released or a booked place is returned.
 */
export async function transitionBooking(bookingId: string, next: BookingStatus, actor: string, note?: string) {
  return transaction(async (client) => {
    const booking = (await client.query<{ id: string; status: BookingStatus; reservation_id: string | null }>(
      'SELECT id, status, reservation_id FROM bookings WHERE id = $1 FOR UPDATE',
      [bookingId],
    )).rows[0]
    if (!booking) throw new BookingError(404, 'Booking not found.')
    if (booking.status === next) return next
    if (next !== 'cancelled' && !ALLOWED_TRANSITIONS[booking.status].includes(next)) {
      throw new BookingError(409, `Cannot move a booking from “${STATUS_LABELS[booking.status]}” to “${STATUS_LABELS[next]}”.`)
    }

    if (next === 'cancelled') {
      const hold = (await client.query<{ id: string }>('SELECT id FROM slot_holds WHERE booking_id = $1 AND released_at IS NULL FOR UPDATE', [bookingId])).rows[0]
      await client.query(
        `UPDATE bookings SET status = 'cancelled', cancellation_reason = COALESCE(NULLIF($2,''), cancellation_reason),
           payment_status = CASE WHEN payment_status = 'pending' THEN 'cancelled' ELSE payment_status END, updated_at = now() WHERE id = $1`,
        [bookingId, note ?? ''],
      )
      if (booking.reservation_id) {
        if (hold) {
          await client.query('UPDATE slot_holds SET released_at = now() WHERE id = $1', [hold.id])
          await client.query('UPDATE slot_reservations SET holds = GREATEST(0, holds - 1), updated_at = now() WHERE id = $1', [booking.reservation_id])
        } else {
          await client.query('UPDATE slot_reservations SET booked = GREATEST(0, booked - 1), updated_at = now() WHERE id = $1', [booking.reservation_id])
        }
      }
      await client.query(`INSERT INTO booking_events (booking_id, kind, message, actor) VALUES ($1, 'status', $2, $3)`, [bookingId, `Cancelled${note ? ` — ${note}` : ''} · slot capacity released`, actor])
      return 'cancelled' as BookingStatus
    }

    // Any forward move past pending_confirmation consumes the hold.
    const hold = (await client.query<{ id: string; reservation_id: string }>('SELECT id, reservation_id FROM slot_holds WHERE booking_id = $1 AND released_at IS NULL FOR UPDATE', [bookingId])).rows[0]
    if (hold) {
      await client.query('UPDATE slot_holds SET released_at = now() WHERE id = $1', [hold.id])
      await client.query('UPDATE slot_reservations SET holds = GREATEST(0, holds - 1), booked = booked + 1, updated_at = now() WHERE id = $1', [hold.reservation_id])
    }
    await client.query('UPDATE bookings SET status = $2, updated_at = now() WHERE id = $1', [bookingId, next])
    await client.query(`INSERT INTO booking_events (booking_id, kind, message, actor) VALUES ($1, 'status', $2, $3)`, [bookingId, `Status changed to ${STATUS_LABELS[next]}${note ? ` — ${note}` : ''}`, actor])
    return next
  })
}

/** Customer-side cancellation: reference + registered phone, within the window. */
export async function cancelByCustomer(reference: string, verification: { phone: string }, reason: string) {
  const settings = await getSettings()
  const row = await one<{ id: string; status: BookingStatus; appointment_date: string }>(
    'SELECT id, status, appointment_date::text AS appointment_date FROM bookings WHERE upper(reference) = upper($1) AND phone = $2',
    [reference, verification.phone],
  )
  if (!row) throw new BookingError(404, 'No booking matches those details.')
  if (row.status === 'cancelled') throw new BookingError(409, 'This booking is already cancelled.')
  if (!['pending_confirmation', 'confirmed'].includes(row.status)) throw new BookingError(409, 'Collection has already started for this booking. Please contact the laboratory.')
  const appointmentStart = new Date(`${row.appointment_date}T00:00:00+05:30`).getTime()
  if (Date.now() > appointmentStart - settings.cancellationWindowHours * 3600_000) {
    throw new BookingError(409, `Online cancellation closes ${settings.cancellationWindowHours} hours before the appointment. Please call the laboratory.`)
  }
  await transitionBooking(row.id, 'cancelled', 'customer', reason || 'Cancelled by customer')
  return row.id
}

/* ------------------------------------------------------------------ */
/* Customer tracking / confirmation                                    */
/* ------------------------------------------------------------------ */

export interface TrackingResult {
  reference: string
  status: BookingStatus
  statusLabel: string
  paymentStatus: string
  paymentMethod: string
  method: 'home' | 'lab'
  appointmentDate: string
  slotLabel: string
  totalPaise: number
  createdAt: string
  items: Array<{ name: string; quantity: number; unitPricePaise: number }>
  timeline: Array<{ message: string; at: string; actor: string }>
  /** Report metadata only — the PDF itself is sent on WhatsApp by staff. */
  report: { fileName: string; uploadedAt: string } | null
}

/** Requires BOTH the random reference and the registered phone number. */
export async function trackBooking(reference: string, phone: string): Promise<TrackingResult | null> {
  const row = await one<Record<string, unknown>>('SELECT * FROM bookings WHERE upper(reference) = upper($1) AND phone = $2', [reference.trim(), phone])
  if (!row) return null
  const items = await sql<{ name_snapshot: string; quantity: number; unit_price_paise: number }>(
    'SELECT name_snapshot, quantity, unit_price_paise FROM booking_items WHERE booking_id = $1 ORDER BY name_snapshot',
    [row.id],
  )
  const [timeline, report] = await Promise.all([
    sql<{ message: string; created_at: Date; actor: string }>(
      'SELECT message, created_at, actor FROM booking_events WHERE booking_id = $1 ORDER BY created_at',
      [row.id],
    ),
    one<{ file_name: string; created_at: Date }>(
      'SELECT file_name, created_at FROM patient_reports WHERE booking_id = $1 AND revoked_at IS NULL',
      [row.id],
    ),
  ])
  return {
    reference: String(row.reference),
    status: row.status as BookingStatus,
    statusLabel: STATUS_LABELS[row.status as BookingStatus],
    paymentStatus: String(row.payment_status),
    paymentMethod: String(row.payment_method),
    method: row.method as 'home' | 'lab',
    appointmentDate: String(row.appointment_date).slice(0, 10),
    slotLabel: String(row.slot_label),
    totalPaise: Number(row.total_paise),
    createdAt: new Date(row.created_at as string).toISOString(),
    items: items.map((item) => ({ name: item.name_snapshot, quantity: Number(item.quantity), unitPricePaise: Number(item.unit_price_paise) })),
    timeline: timeline.map((event) => ({ message: event.message, at: new Date(event.created_at).toISOString(), actor: event.actor })),
    report: report
      ? { fileName: report.file_name, uploadedAt: new Date(report.created_at).toISOString() }
      : null,
  }
}

export async function getBookingForConfirmation(reference: string, token: string) {
  const row = await one<Record<string, unknown>>('SELECT * FROM bookings WHERE upper(reference) = upper($1) AND access_token = $2', [reference, token])
  if (!row) return null
  const items = await sql<{ name_snapshot: string; quantity: number; unit_price_paise: number }>(
    'SELECT name_snapshot, quantity, unit_price_paise FROM booking_items WHERE booking_id = $1 ORDER BY name_snapshot',
    [row.id],
  )
  return {
    reference: String(row.reference),
    status: row.status as BookingStatus,
    paymentMethod: String(row.payment_method),
    paymentStatus: String(row.payment_status),
    method: row.method as 'home' | 'lab',
    appointmentDate: String(row.appointment_date).slice(0, 10),
    slotLabel: String(row.slot_label),
    patientName: String(row.patient_name),
    phone: String(row.phone),
    totalPaise: Number(row.total_paise),
    subtotalPaise: Number(row.subtotal_paise),
    discountPaise: Number(row.discount_paise),
    items: items.map((item) => ({ name: item.name_snapshot, quantity: Number(item.quantity), unitPricePaise: Number(item.unit_price_paise) })),
  }
}

/**
 * Every booking belonging to one mobile number, newest first.
 *
 * This is the "My bookings" lookup: a patient recognises their own number far
 * more readily than a booking reference. It returns a summary per booking —
 * enough to list them and open the full timeline on demand.
 *
 * Privacy note: a phone number alone is weaker proof than reference + phone, so
 * the caller rate-limits hard and this returns summaries only (no address, no
 * report contents).
 */
export interface BookingSummary {
  reference: string
  status: BookingStatus
  statusLabel: string
  paymentStatus: string
  method: 'home' | 'lab'
  appointmentDate: string
  slotLabel: string
  totalPaise: number
  createdAt: string
  itemCount: number
  hasReport: boolean
}

export async function listBookingsByPhone(phone: string, limit = 25): Promise<BookingSummary[]> {
  const rows = await sql<Record<string, unknown>>(
    `SELECT b.id, b.reference, b.status, b.payment_status, b.method, b.appointment_date,
            b.slot_label, b.total_paise, b.created_at,
            (SELECT count(*)::int FROM booking_items i WHERE i.booking_id = b.id) AS item_count,
            EXISTS (SELECT 1 FROM patient_reports r WHERE r.booking_id = b.id AND r.revoked_at IS NULL) AS has_report
       FROM bookings b
      WHERE b.phone = $1
      ORDER BY b.created_at DESC
      LIMIT $2`,
    [phone, limit],
  )
  return rows.map((row) => ({
    reference: String(row.reference),
    status: row.status as BookingStatus,
    statusLabel: STATUS_LABELS[row.status as BookingStatus] ?? String(row.status),
    paymentStatus: String(row.payment_status),
    method: row.method as 'home' | 'lab',
    appointmentDate: String(row.appointment_date).slice(0, 10),
    slotLabel: String(row.slot_label),
    totalPaise: Number(row.total_paise),
    createdAt: new Date(row.created_at as string).toISOString(),
    itemCount: Number(row.item_count),
    hasReport: Boolean(row.has_report),
  }))
}
