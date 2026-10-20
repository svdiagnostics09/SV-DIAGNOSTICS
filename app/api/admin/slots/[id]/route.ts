import { revalidatePath } from 'next/cache'
import { z, ZodError } from 'zod'
import { guard, jsonError } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { one, sql } from '@/lib/db'
import { firstIssue } from '@/lib/validation'

export const dynamic = 'force-dynamic'

const schema = z.object({
  locationId: z.number().int().positive().nullable().optional(),
  method: z.enum(['home', 'lab', 'both']).optional(),
  label: z.string().trim().min(3).max(60).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  durationMinutes: z.number().int().min(15).max(240).optional(),
  dailyCapacity: z.number().int().min(0).max(500).optional(),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(),
  isActive: z.boolean().optional(),
})

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await guard(request, { mutation: true })
    const id = Number((await context.params).id)
    const body = schema.parse(await request.json().catch(() => null))
    const existing = await one<Record<string, unknown>>('SELECT * FROM collection_slots WHERE id = $1', [id])
    if (!existing) return Response.json({ error: 'Slot not found.' }, { status: 404 })
    const sets: string[] = []
    const values: unknown[] = []
    const map: Record<string, string> = { locationId: 'location_id', method: 'method', label: 'label', startTime: 'start_time', endTime: 'end_time', durationMinutes: 'duration_minutes', dailyCapacity: 'daily_capacity', weekdays: 'weekdays', isActive: 'is_active' }
    for (const [key, column] of Object.entries(map)) {
      const value = (body as Record<string, unknown>)[key]
      if (value === undefined) continue
      values.push(value); sets.push(`${column} = $${values.length}`)
    }
    if (sets.length) {
      values.push(id)
      await sql(`UPDATE collection_slots SET ${sets.join(', ')}, updated_at = now() WHERE id = $${values.length}`, values)
    }
    await audit({ actor: admin, action: 'slot.update', entity: 'collection_slots', entityId: String(id), detail: body, request })
    revalidatePath('/book')
    return Response.json({ ok: true })
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: firstIssue(error) }, { status: 400 })
    return jsonError(error)
  }
}

/**
 * Deleting a slot that has reservations or bookings would orphan capacity, so
 * such slots are deactivated instead.
 */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await guard(request, { mutation: true })
    const id = Number((await context.params).id)
    const usage = await one<{ bookings: number; reservations: number }>(
      `SELECT (SELECT count(*) FROM bookings WHERE slot_id = $1)::int AS bookings, (SELECT count(*) FROM slot_reservations WHERE slot_id = $1)::int AS reservations`,
      [id],
    )
    if (usage && (usage.bookings > 0 || usage.reservations > 0)) {
      await sql(`UPDATE collection_slots SET is_active = false, updated_at = now() WHERE id = $1`, [id])
      await audit({ actor: admin, action: 'slot.deactivate', entity: 'collection_slots', entityId: String(id), request })
      revalidatePath('/book')
      return Response.json({ deactivated: true, message: 'Slot has bookings or reservations, so it was deactivated instead of deleted.' })
    }
    await sql('DELETE FROM collection_slots WHERE id = $1', [id])
    await audit({ actor: admin, action: 'slot.delete', entity: 'collection_slots', entityId: String(id), request })
    revalidatePath('/book')
    return Response.json({ deleted: true })
  } catch (error) {
    return jsonError(error)
  }
}
