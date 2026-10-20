import { revalidatePath } from 'next/cache'
import { z, ZodError } from 'zod'
import { guard, jsonError } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { one, sql } from '@/lib/db'
import { firstIssue } from '@/lib/validation'

export const dynamic = 'force-dynamic'

const schema = z.object({
  name: z.string().trim().min(3).max(120).optional(),
  description: z.string().max(4000).optional(),
  preparation: z.string().max(2000).optional(),
  sampleType: z.string().max(120).optional(),
  turnaroundHours: z.number().int().min(1).max(2000).nullable().optional(),
  pricePaise: z.number().int().min(1).max(10_000_000).optional(),
  originalPricePaise: z.number().int().min(0).max(10_000_000).nullable().optional(),
  homeCollection: z.boolean().optional(),
  isPopular: z.boolean().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  testIds: z.array(z.number().int().positive()).max(80).optional(),
})

async function validate(testIds: number[], pricePaise: number, originalPricePaise: number | null | undefined, status: string) {
  if (testIds.length === 0) return status === 'published' ? 'A published package needs at least one included test.' : null
  const rows = await sql<{ id: number; status: string }>('SELECT id, status FROM diagnostic_tests WHERE id = ANY($1::int[])', [testIds])
  if (rows.length !== new Set(testIds).size) return 'One or more selected tests no longer exist.'
  if (status === 'published' && rows.some((row) => row.status !== 'published')) return 'Published packages can only include published tests.'
  if (originalPricePaise && originalPricePaise < pricePaise) return 'The original price must be greater than or equal to the package price.'
  return null
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await guard(request, { mutation: true })
    const id = Number((await context.params).id)
    const body = schema.parse(await request.json().catch(() => null))
    const current = await one<Record<string, unknown>>('SELECT * FROM health_packages WHERE id = $1', [id])
    if (!current) return Response.json({ error: 'Package not found.' }, { status: 404 })

    const pricePaise = body.pricePaise ?? Number(current.price_paise)
    const original = body.originalPricePaise === undefined ? (current.original_price_paise === null ? null : Number(current.original_price_paise)) : body.originalPricePaise
    const status = body.status ?? String(current.status)
    const testIds = body.testIds ?? (await sql<{ test_id: number }>('SELECT test_id FROM package_tests WHERE package_id = $1', [id])).map((row) => Number(row.test_id))
    const problem = await validate(testIds, pricePaise, original, status)
    if (problem) return Response.json({ error: problem }, { status: 400 })

    const map: Record<string, string> = {
      name: 'name', description: 'description', preparation: 'preparation', sampleType: 'sample_type', turnaroundHours: 'turnaround_hours',
      pricePaise: 'price_paise', originalPricePaise: 'original_price_paise', homeCollection: 'home_collection', isPopular: 'is_popular', status: 'status',
    }
    const sets: string[] = []
    const values: unknown[] = []
    for (const [key, column] of Object.entries(map)) {
      const value = (body as Record<string, unknown>)[key]
      if (value === undefined) continue
      values.push(value); sets.push(`${column} = $${values.length}`)
    }
    if (sets.length) {
      values.push(id)
      await sql(`UPDATE health_packages SET ${sets.join(', ')}, updated_at = now() WHERE id = $${values.length}`, values)
    }
    if (body.testIds) {
      await sql('DELETE FROM package_tests WHERE package_id = $1', [id])
      for (const testId of body.testIds) await sql('INSERT INTO package_tests (package_id, test_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, testId])
    }
    await audit({ actor: admin, action: 'package.update', entity: 'health_packages', entityId: String(id), detail: Object.keys(body), request })
    revalidatePath('/'); revalidatePath('/packages')
    if (current.slug) revalidatePath(`/packages/${current.slug}`)
    return Response.json({ ok: true })
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: firstIssue(error) }, { status: 400 })
    return jsonError(error)
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await guard(request, { mutation: true })
    const id = Number((await context.params).id)
    const usage = await one<{ n: number }>('SELECT count(*)::int AS n FROM booking_items WHERE package_id = $1', [id])
    if (usage && usage.n > 0) {
      await sql(`UPDATE health_packages SET status = 'archived', updated_at = now() WHERE id = $1`, [id])
      await audit({ actor: admin, action: 'package.archive', entity: 'health_packages', entityId: String(id), request })
      revalidatePath('/'); revalidatePath('/packages')
      return Response.json({ archived: true, message: 'Package archived — it is referenced by existing bookings.' })
    }
    await sql('DELETE FROM health_packages WHERE id = $1', [id])
    await audit({ actor: admin, action: 'package.delete', entity: 'health_packages', entityId: String(id), request })
    revalidatePath('/'); revalidatePath('/packages')
    return Response.json({ deleted: true })
  } catch (error) {
    return jsonError(error)
  }
}
