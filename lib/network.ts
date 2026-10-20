import { one, sql } from '@/lib/db'

/** Locations, service areas, slots and date availability. */

export interface LocationView {
  id: number
  name: string
  slug: string
  addressLine1: string
  addressLine2: string
  area: string
  city: string
  state: string
  pincode: string
  phone: string
  email: string
  mapsUrl: string
  openingHours: string
  services: string[]
  isActive: boolean
}

const mapLocation = (row: Record<string, unknown>): LocationView => ({
  id: Number(row.id),
  name: String(row.name),
  slug: String(row.slug),
  addressLine1: String(row.address_line1 ?? ''),
  addressLine2: String(row.address_line2 ?? ''),
  area: String(row.area ?? ''),
  city: String(row.city ?? ''),
  state: String(row.state ?? ''),
  pincode: String(row.pincode ?? ''),
  phone: String(row.phone ?? ''),
  email: String(row.email ?? ''),
  mapsUrl: String(row.maps_url ?? ''),
  openingHours: String(row.opening_hours ?? ''),
  services: (row.services as string[] | null) ?? [],
  isActive: Boolean(row.is_active),
})

export async function listLocations(includeInactive = false) {
  const rows = await sql(`SELECT * FROM locations ${includeInactive ? '' : 'WHERE is_active = true'} ORDER BY name`)
  return rows.map(mapLocation)
}

export async function getLocation(id: number) {
  const row = await one('SELECT * FROM locations WHERE id = $1', [id])
  return row ? mapLocation(row) : null
}

export interface ServiceAreaView {
  id: number
  name: string
  city: string
  pincodes: string[]
  homeCollection: boolean
  collectionFeePaise: number
  operatingHours: string
  isActive: boolean
}

const mapArea = (row: Record<string, unknown>): ServiceAreaView => ({
  id: Number(row.id),
  name: String(row.name),
  city: String(row.city ?? ''),
  pincodes: (row.pincodes as string[] | null) ?? [],
  homeCollection: Boolean(row.home_collection),
  collectionFeePaise: Number(row.collection_fee_paise ?? 0),
  operatingHours: String(row.operating_hours ?? ''),
  isActive: Boolean(row.is_active),
})

export async function listServiceAreas(includeInactive = false) {
  const rows = await sql(`SELECT * FROM service_areas ${includeInactive ? '' : 'WHERE is_active = true'} ORDER BY name`)
  return rows.map(mapArea)
}

/** The active area covering a pincode, if home collection is available there. */
export async function areaForPincode(pincode: string) {
  const row = await one(
    `SELECT * FROM service_areas WHERE is_active = true AND home_collection = true AND $1 = ANY(pincodes) ORDER BY name LIMIT 1`,
    [pincode],
  )
  return row ? mapArea(row) : null
}

export interface SlotView {
  id: number
  locationId: number | null
  method: 'home' | 'lab' | 'both'
  label: string
  startTime: string
  endTime: string
  durationMinutes: number
  dailyCapacity: number
  weekdays: number[]
  isActive: boolean
}

const normalizeTime = (value: unknown) => String(value ?? '').slice(0, 5)

const mapSlot = (row: Record<string, unknown>): SlotView => ({
  id: Number(row.id),
  locationId: row.location_id === null ? null : Number(row.location_id),
  method: String(row.method) as SlotView['method'],
  label: String(row.label),
  startTime: normalizeTime(row.start_time),
  endTime: normalizeTime(row.end_time),
  durationMinutes: Number(row.duration_minutes ?? 60),
  dailyCapacity: Number(row.daily_capacity ?? 0),
  weekdays: ((row.weekdays as number[] | null) ?? [0, 1, 2, 3, 4, 5, 6]).map(Number),
  isActive: Boolean(row.is_active),
})

export async function listSlots(includeInactive = false) {
  const rows = await sql(`SELECT * FROM collection_slots ${includeInactive ? '' : 'WHERE is_active = true'} ORDER BY start_time, label`)
  return rows.map(mapSlot)
}

export async function listBlackouts() {
  const rows = await sql<Record<string, unknown>>(
    `SELECT b.*, s.label AS slot_label, l.name AS location_name FROM slot_blackouts b
     LEFT JOIN collection_slots s ON s.id = b.slot_id LEFT JOIN locations l ON l.id = b.location_id
     WHERE b.blackout_date >= CURRENT_DATE - 1 ORDER BY b.blackout_date`,
  )
  return rows.map((row) => ({
    id: Number(row.id),
    locationId: row.location_id === null ? null : Number(row.location_id),
    locationName: row.location_name ? String(row.location_name) : 'All locations',
    slotId: row.slot_id === null ? null : Number(row.slot_id),
    slotLabel: row.slot_label ? String(row.slot_label) : 'All slots',
    date: String(row.blackout_date).slice(0, 10),
    reason: String(row.reason ?? ''),
  }))
}

/** Next `days` calendar dates (YYYY-MM-DD) in India time, excluding today when it is too late for a slot. */
export function upcomingDates(days: number, now = new Date()) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now)
  const base = new Date(`${today}T00:00:00+05:30`)
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(base.getTime() + index * 86_400_000)
    const iso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(date)
    const weekday = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short' }).format(date) === 'Sun' ? 0
      : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short' }).format(date)) + 1)
    return { date: iso, weekday, label: new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short' }).format(date) }
  })
}

export interface SlotAvailability {
  date: string
  slots: Array<{ id: number; label: string; startTime: string; remaining: number; capacity: number; available: boolean }>
}

/**
 * Availability for a location/method across the booking horizon.
 * Remaining = capacity − booked − active holds. Expired holds are ignored.
 */
export async function availability(input: { method: 'home' | 'lab'; locationId?: number | null; days: number }) {
  const slots = (await listSlots()).filter((slot) =>
    slot.method === 'both' || slot.method === input.method,
  ).filter((slot) => (input.method === 'lab' ? slot.locationId === null || slot.locationId === input.locationId : true))
  const dates = upcomingDates(input.days)
  if (!slots.length) return dates.map((d) => ({ date: d.date, label: d.label, weekday: d.weekday, slots: [] as SlotAvailability['slots'] }))

  const rows = await sql<Record<string, unknown>>(
    `SELECT r.slot_id, r.slot_date::text AS slot_date, r.capacity, r.booked,
       (SELECT count(*) FROM slot_holds h WHERE h.reservation_id = r.id AND h.released_at IS NULL AND h.expires_at > now())::int AS holds
     FROM slot_reservations r WHERE r.slot_date BETWEEN $1 AND $2`,
    [dates[0].date, dates[dates.length - 1].date],
  )
  const byKey = new Map(rows.map((row) => [`${Number(row.slot_id)}:${String(row.slot_date).slice(0, 10)}`, row]))
  const blackouts = await sql<Record<string, unknown>>(
    `SELECT blackout_date::text AS day, slot_id, location_id FROM slot_blackouts WHERE blackout_date BETWEEN $1 AND $2`,
    [dates[0].date, dates[dates.length - 1].date],
  )

  return dates.map((day) => ({
    date: day.date,
    label: day.label,
    weekday: day.weekday,
    slots: slots
      .filter((slot) => slot.weekdays.includes(day.weekday))
      .filter((slot) => !blackouts.some((b) => String(b.day).slice(0, 10) === day.date && (b.slot_id === null || Number(b.slot_id) === slot.id) && (b.location_id === null || Number(b.location_id) === slot.locationId)))
      .map((slot) => {
        const reserved = byKey.get(`${slot.id}:${day.date}`)
        const capacity = reserved ? Number(reserved.capacity) : slot.dailyCapacity
        const used = reserved ? Number(reserved.booked) + Number(reserved.holds) : 0
        const remaining = Math.max(0, capacity - used)
        return { id: slot.id, label: slot.label, startTime: slot.startTime, remaining, capacity, available: remaining > 0 }
      }),
  }))
}
