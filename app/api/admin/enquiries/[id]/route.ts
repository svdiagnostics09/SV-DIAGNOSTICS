import { revalidatePath } from 'next/cache'
import { z, ZodError } from 'zod'
import { guard, jsonError } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { one, sql } from '@/lib/db'
import { firstIssue } from '@/lib/validation'

export const dynamic = 'force-dynamic'

const patchSchema = z.object({
  status: z.enum(['new', 'in_progress', 'resolved', 'archived']).optional(),
  internalNote: z.string().max(2000).optional(),
})

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await guard(request, { mutation: true })
    const { id } = await context.params
    const body = patchSchema.parse(await request.json().catch(() => null))
    const existing = await one('SELECT id FROM enquiries WHERE id = $1', [id])
    if (!existing) return Response.json({ error: 'Enquiry not found.' }, { status: 404 })
    const sets: string[] = []
    const values: unknown[] = []
    if (body.status) { values.push(body.status); sets.push(`status = $${values.length}`) }
    if (body.internalNote !== undefined) { values.push(body.internalNote); sets.push(`internal_note = $${values.length}`) }
    if (sets.length) {
      values.push(id)
      await sql(`UPDATE enquiries SET ${sets.join(', ')}, updated_at = now() WHERE id = $${values.length}`, values)
    }
    await audit({ actor: admin, action: 'enquiry.update', entity: 'enquiries', entityId: id, detail: body, request })
    revalidatePath('/admin')
    return Response.json({ ok: true })
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: firstIssue(error) }, { status: 400 })
    return jsonError(error)
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await guard(request, { mutation: true })
    const { id } = await context.params
    await sql(`UPDATE enquiries SET status = 'archived', updated_at = now() WHERE id = $1`, [id])
    await audit({ actor: admin, action: 'enquiry.archive', entity: 'enquiries', entityId: id, request })
    return Response.json({ archived: true })
  } catch (error) {
    return jsonError(error)
  }
}
