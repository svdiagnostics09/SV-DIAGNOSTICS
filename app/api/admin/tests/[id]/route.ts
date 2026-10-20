import { revalidatePath } from 'next/cache'
import { z, ZodError } from 'zod'
import { guard, jsonError } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { one, sql } from '@/lib/db'
import { getTestById } from '@/lib/catalogue'
import { firstIssue, slugify } from '@/lib/validation'

export const dynamic = 'force-dynamic'

const patchSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  categoryId: z.number().int().positive().nullable().optional(),
  description: z.string().max(8000).optional(),
  shortDescription: z.string().max(400).optional(),
  pricePaise: z.number().int().min(1).max(10_000_000).optional(),
  discountType: z.enum(['none', 'percent', 'amount']).optional(),
  discountValue: z.number().int().min(0).optional(),
  sampleType: z.string().max(80).optional(),
  sampleTypes: z.array(z.string().trim().max(60)).max(10).optional(),
  reportType: z.string().max(80).optional(),
  turnaroundHours: z.number().int().min(1).max(2000).nullable().optional(),
  preparation: z.string().max(4000).optional(),
  fastingRequired: z.boolean().optional(),
  fastingHours: z.number().int().min(0).max(48).nullable().optional(),
  homeCollection: z.boolean().optional(),
  isPopular: z.boolean().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  imageUrl: z.string().max(500).optional(),
  investigationIds: z.array(z.number().int().positive()).max(100).optional(),
})

const COLUMNS: Record<string, string> = {
  name: 'name', categoryId: 'category_id', description: 'description', shortDescription: 'short_description',
  pricePaise: 'price_paise', discountType: 'discount_type', discountValue: 'discount_value', sampleType: 'sample_type',
  sampleTypes: 'sample_types', reportType: 'report_type', turnaroundHours: 'turnaround_hours', preparation: 'preparation',
  fastingRequired: 'fasting_required', fastingHours: 'fasting_hours', homeCollection: 'home_collection',
  isPopular: 'is_popular', status: 'status', imageUrl: 'image_url',
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await guard(request)
    const test = await getTestById(Number((await params).id))
    if (!test) return Response.json({ error: 'Test not found.' }, { status: 404 })
    const investigations = await sql<{ id: number }>('SELECT investigation_id AS id FROM test_investigations WHERE test_id = $1', [test.id])
    return Response.json({ ...test, investigationIds: investigations.map((row) => Number(row.id)) })
  } catch (error) {
    return jsonError(error)
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await guard(request, { mutation: true })
    const id = Number((await params).id)
    if (!Number.isInteger(id)) return Response.json({ error: 'Invalid test id.' }, { status: 400 })
    const body = patchSchema.parse(await request.json().catch(() => null))
    const existing = await one<Record<string, unknown>>('SELECT * FROM diagnostic_tests WHERE id = $1', [id])
    if (!existing) return Response.json({ error: 'Test not found.' }, { status: 404 })

    const sets: string[] = []
    const values: unknown[] = []
    for (const [key, column] of Object.entries(COLUMNS)) {
      const value = (body as Record<string, unknown>)[key]
      if (value === undefined) continue
      values.push(key === 'categoryId' ? value : value)
      sets.push(`${column} = $${values.length}`)
    }
    if (body.name && body.name !== existing.name) {
      const base = slugify(body.name)
      let slug = base
      for (let suffix = 2; await one('SELECT 1 FROM diagnostic_tests WHERE slug = $1 AND id <> $2', [slug, id]); suffix += 1) slug = `${base}-${suffix}`
      values.push(slug)
      sets.push(`slug = $${values.length}`)
    }

    const nextPrice = body.pricePaise ?? Number(existing.price_paise)
    const nextType = body.discountType ?? String(existing.discount_type)
    const nextValue = body.discountValue ?? Number(existing.discount_value)
    if (body.discountType === 'none' && body.discountValue !== undefined && body.discountValue !== 0) {
      return Response.json({ error: 'A “none” discount cannot have a value.' }, { status: 400 })
    }
    if (nextType === 'percent' && (nextValue < 1 || nextValue > 100)) return Response.json({ error: 'Percentage discount must be between 1 and 100.' }, { status: 400 })
    if (nextType === 'amount' && nextValue >= nextPrice) return Response.json({ error: 'Flat discount must be less than the price.' }, { status: 400 })

    if (sets.length) {
      values.push(id)
      await sql(`UPDATE diagnostic_tests SET ${sets.join(', ')}, updated_at = now() WHERE id = $${values.length}`, values)
    }

    if (body.investigationIds) {
      await sql('DELETE FROM test_investigations WHERE test_id = $1', [id])
      for (const investigationId of body.investigationIds) {
        await sql('INSERT INTO test_investigations (test_id, investigation_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, investigationId])
      }
    }

    await audit({ actor: admin, action: 'test.update', entity: 'diagnostic_tests', entityId: String(id), detail: Object.keys(body), request })
    revalidatePath('/'); revalidatePath('/tests'); revalidatePath('/price-list')
    if (existing.slug) revalidatePath(`/tests/${existing.slug}`)
    return Response.json(await getTestById(id))
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: firstIssue(error) }, { status: 400 })
    if ((error as { code?: string }).code === '23514') return Response.json({ error: 'The discount settings are not valid for this price.' }, { status: 400 })
    return jsonError(error)
  }
}

/**
 * Archive, never hard-delete: booking_items and package_tests reference tests.
 * DELETE performs an archive unless the test has never been used, in which case
 * it is removed so a mistake can be cleaned up.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await guard(request, { mutation: true })
    const id = Number((await params).id)
    const usage = await one<{ bookings: number; packages: number }>(
      `SELECT (SELECT count(*) FROM booking_items WHERE test_id = $1)::int AS bookings,
              (SELECT count(*) FROM package_tests WHERE test_id = $1)::int AS packages`,
      [id],
    )
    if (!usage) return Response.json({ error: 'Test not found.' }, { status: 404 })
    if (usage.bookings > 0 || usage.packages > 0) {
      await sql(`UPDATE diagnostic_tests SET status = 'archived', updated_at = now() WHERE id = $1`, [id])
      await audit({ actor: admin, action: 'test.archive', entity: 'diagnostic_tests', entityId: String(id), detail: usage, request })
      revalidatePath('/'); revalidatePath('/tests'); revalidatePath('/price-list')
      return Response.json({ archived: true, message: `Test archived — it is referenced by ${usage.bookings} booking item(s) and ${usage.packages} package(s), so it was not deleted.` })
    }
    await sql('DELETE FROM diagnostic_tests WHERE id = $1', [id])
    await audit({ actor: admin, action: 'test.delete', entity: 'diagnostic_tests', entityId: String(id), request })
    revalidatePath('/'); revalidatePath('/tests'); revalidatePath('/price-list')
    return Response.json({ deleted: true })
  } catch (error) {
    return jsonError(error)
  }
}
