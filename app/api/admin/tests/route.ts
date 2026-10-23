import { revalidatePath } from 'next/cache'
import { z, ZodError } from 'zod'
import { guard, jsonError } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { one, sql } from '@/lib/db'
import { mapTest } from '@/lib/catalogue'
import { firstIssue, slugify } from '@/lib/validation'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  name: z.string().trim().min(2, 'Enter the test name.').max(160),
  categoryId: z.number().int().positive().nullable().optional(),
  description: z.string().max(8000).optional().default(''),
  shortDescription: z.string().max(400).optional().default(''),
  pricePaise: z.number().int().min(0).max(10_000_000, 'Price looks too high.'),
  discountType: z.enum(['none', 'percent', 'amount']).default('none'),
  discountValue: z.number().int().min(0).default(0),
  sampleType: z.string().max(80).optional().default(''),
  sampleTypes: z.array(z.string().trim().max(60)).max(10).optional().default([]),
  reportType: z.string().max(80).optional().default(''),
  turnaroundHours: z.number().int().min(1).max(2000).nullable().optional(),
  preparation: z.string().max(4000).optional().default(''),
  fastingRequired: z.boolean().default(false),
  fastingHours: z.number().int().min(0).max(48).nullable().optional(),
  homeCollection: z.boolean().default(true),
  isPopular: z.boolean().default(false),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  imageUrl: z.string().max(500).optional().default(''),
  investigationIds: z.array(z.number().int().positive()).max(100).optional().default([]),
}).refine((value) => value.discountType !== 'percent' || (value.discountValue >= 1 && value.discountValue <= 100), { message: 'Percentage discount must be between 1 and 100.', path: ['discountValue'] })
  .refine((value) => value.discountType !== 'amount' || value.discountValue < value.pricePaise, { message: 'Flat discount must be less than the price.', path: ['discountValue'] })
  .refine((value) => value.pricePaise > 0, { message: 'Enter a price greater than zero.', path: ['pricePaise'] })

const SELECT = `SELECT t.*, c.name AS category_name, c.slug AS category_slug,
  (SELECT count(*) FROM test_investigations ti WHERE ti.test_id = t.id) AS investigation_count
  FROM diagnostic_tests t LEFT JOIN diagnostic_categories c ON c.id = t.category_id`

async function listAllTests(includeArchived = true) {
  const rows = await sql(`${SELECT} ${includeArchived ? '' : "WHERE t.status <> 'archived'"} ORDER BY t.status, t.name`)
  return rows.map(mapTest)
}

export async function GET(request: Request) {
  try {
    await guard(request)
    const url = new URL(request.url)
    return Response.json({ tests: await listAllTests(url.searchParams.get('archived') !== '0') })
  } catch (error) {
    return jsonError(error)
  }
}

export async function POST(request: Request) {
  try {
    const admin = await guard(request, { mutation: true })
    const body = bodySchema.parse(await request.json().catch(() => null))

    const slugBase = slugify(body.name)
    let slug = slugBase
    for (let suffix = 2; await one('SELECT 1 FROM diagnostic_tests WHERE slug = $1', [slug]); suffix += 1) slug = `${slugBase}-${suffix}`

    const row = await one<Record<string, unknown>>(
      `INSERT INTO diagnostic_tests (category_id, name, slug, short_description, description, sample_type, sample_types, report_type,
         turnaround_hours, preparation, fasting_required, fasting_hours, price_paise, discount_type, discount_value,
         home_collection, is_popular, status, image_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING id`,
      [
        body.categoryId ?? null, body.name, slug, body.shortDescription || body.description.slice(0, 200), body.description,
        body.sampleType, body.sampleTypes, body.reportType, body.turnaroundHours ?? null, body.preparation,
        body.fastingRequired, body.fastingHours ?? null, body.pricePaise, body.discountType, body.discountValue,
        body.homeCollection, body.isPopular, body.status, body.imageUrl,
      ],
    )
    if (body.investigationIds.length) {
      for (const investigationId of body.investigationIds) {
        await sql('INSERT INTO test_investigations (test_id, investigation_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [Number(row!.id), investigationId])
      }
    }
    await audit({ actor: admin, action: 'test.create', entity: 'diagnostic_tests', entityId: String(row!.id), detail: { name: body.name, status: body.status }, request })
    revalidatePath('/'); revalidatePath('/tests'); revalidatePath('/price-list')
    const created = await one(`${SELECT} WHERE t.id = $1`, [Number(row!.id)])
    return Response.json(created ? mapTest(created) : { id: Number(row!.id) }, { status: 201 })
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: firstIssue(error) }, { status: 400 })
    return jsonError(error)
  }
}
