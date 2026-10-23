import { revalidatePath } from 'next/cache'
import { z, ZodError } from 'zod'
import { guard, jsonError } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { one, sql } from '@/lib/db'
import { firstIssue } from '@/lib/validation'

export const dynamic = 'force-dynamic'

const schema = z.object({
  locationId: z.number().int().positive().nullable().optional(),
  method: z.enum(['home', 'lab', 'both']).optional().default('both'),
  label: z.string().trim().min(3, 'Enter a slot label.').max(60),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Start time must be HH:MM.'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'End time must be HH:MM.'),
  durationMinutes: z.number().int().min(15).max(240).optional().default(60),
  dailyCapacity: z.number().int().min(0).max(500, 'Capacity per day cannot exceed 500.'),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1, 'Select at least one weekday.').max(7),
  isActive: z.boolean().optional().default(true),
})

interface SlotRow { id: number; label: string; method: string; location_id: number | null; daily_capacity: number; start_time: string; end_time: string; weekdays: number[]; is_active: boolean }

async function listAllSlots() {
  const rows = await sql(
    `SELECT s.*, l.name AS location_name FROM collection_slots s LEFT JOIN locations l ON l.id = s.location_id ORDER BY s.start_time, s.label`,
  )
  return rows.map((row) => ({
    id: Number(row.id),
    locationId: row.location_id === null ? null : Number(row.location_id),
    locationName: row.location_name ?? 'All locations',
    method: row.method,
    label: row.label,
    startTime: String(row.start_time).slice(0, 5),
    endTime: String(row.end_time).slice(0, 5),
    durationMinutes: Number((row as unknown as { duration_minutes: number }).duration_minutes),
    dailyCapacity: Number(row.daily_capacity),
    weekdays: ((row.weekdays as number[] | null) ?? []).map(Number),
    isActive: Boolean(row.is_active),
  }))
}

export async function GET(request: Request) {
  try {
    await guard(request)
    const [slots, blackouts] = await Promise.all([
      listAllSlots(),
      sql(`SELECT b.id, b.blackout_date::text AS date, b.reason, b.slot_id, b.location_id, s.label AS slot_label, l.name AS location_name
           FROM slot_blackouts b LEFT JOIN collection_slots s ON s.id = b.slot_id LEFT JOIN locations l ON l.id = b.location_id
           WHERE b.blackout_date >= CURRENT_DATE - 7 ORDER BY b.blackout_date`),
    ])
    return Response.json({
      slots,
      blackouts: blackouts.map((row) => ({ id: Number(row.id), date: String(row.date).slice(0, 10), reason: String(row.reason ?? ''), slotId: row.slot_id, slotLabel: row.slot_label ?? 'All slots', locationId: row.location_id, locationName: row.location_name ?? 'All locations' })),
      reservations: await sql(`SELECT r.id, r.slot_id, r.slot_date::text AS date, r.capacity, r.booked, r.holds, s.label FROM slot_reservations r JOIN collection_slots s ON s.id = r.slot_id WHERE r.slot_date >= CURRENT_DATE ORDER BY r.slot_date, r.slot_id LIMIT 100`),
    })
  } catch (error) {
    return jsonError(error)
  }
}

export async function POST(request: Request) {
  try {
    const admin = await guard(request, { mutation: true })
    const body = schema.parse(await request.json().catch(() => null))
    if (body.startTime >= body.endTime) return Response.json({ error: 'End time must be after the start time.' }, { status: 400 })
    const row = await one<{ id: number }>(
      `INSERT INTO collection_slots (location_id, method, label, start_time, end_time, duration_minutes, daily_capacity, weekdays, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [body.locationId ?? null, body.method, body.label, body.startTime, body.endTime, body.durationMinutes, body.dailyCapacity, body.weekdays, body.isActive],
    )
    await audit({ actor: admin, action: 'slot.create', entity: 'collection_slots', entityId: String(row!.id), detail: body, request })
    revalidatePath('/book')
    return Response.json({ id: row!.id }, { status: 201 })
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: firstIssue(error) }, { status: 400 })
    return jsonError(error)
  }
}

/** Blackout days: { date, slotId?, locationId?, reason } */
export async function PUT(request: Request) {
  try {
    const admin = await guard(request, { mutation: true })
    const body = z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      slotId: z.number().int().positive().nullable().optional(),
      locationId: z.number().int().positive().nullable().optional(),
      reason: z.string().trim().max(160).optional().default(''),
    }).parse(await request.json().catch(() => null))
    await sql(
      `INSERT INTO slot_blackouts (blackout_date, slot_id, location_id, reason) VALUES ($1,$2,$3,$4)
       ON CONFLICT (COALESCE(location_id, 0), COALESCE(slot_id, 0), blackout_date) DO UPDATE SET reason = EXCLUDED.reason`,
      [body.date, body.slotId ?? null, body.locationId ?? null, body.reason],
    )
    await audit({ actor: admin, action: 'slot.blackout', entity: 'slot_blackouts', entityId: body.date, detail: body, request })
    revalidatePath('/book')
    return Response.json({ ok: true }, { status: 201 })
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: firstIssue(error) }, { status: 400 })
    return jsonError(error)
  }
}
