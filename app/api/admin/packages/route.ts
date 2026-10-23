import { revalidatePath } from 'next/cache'
import { z, ZodError } from 'zod'
import { guard, jsonError } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { one, sql } from '@/lib/db'
import { firstIssue } from '@/lib/validation'

export const dynamic = 'force-dynamic'

async function listAdminPackages() {
  const rows = await sql<Record<string, unknown>>(
    `SELECT p.*, count(pt.test_id)::int AS test_count,
       COALESCE(sum(CASE WHEN t.discount_type = 'percent' THEN round(t.price_paise * (100 - t.discount_value) / 100.0)
                         WHEN t.discount_type = 'amount' THEN t.price_paise - t.discount_value
                         ELSE t.price_paise END), 0)::int AS tests_sum
     FROM health_packages p LEFT JOIN package_tests pt ON pt.package_id = p.id LEFT JOIN diagnostic_tests t ON t.id = pt.test_id
     GROUP BY p.id ORDER BY p.status, p.name`,
  )
  return rows.map((row) => ({
    id: Number(row.id),
    name: String(row.name),
    slug: String(row.slug),
    description: String(row.description ?? ''),
    preparation: String(row.preparation ?? ''),
    sampleType: String(row.sample_type ?? ''),
    turnaroundHours: row.turnaround_hours === null ? null : Number(row.turnaround_hours),
    pricePaise: Number(row.price_paise),
    originalPricePaise: row.original_price_paise === null ? null : Number(row.original_price_paise),
    homeCollection: Boolean(row.home_collection),
    isPopular: Boolean(row.is_popular),
    status: String(row.status),
    testCount: Number(row.test_count),
    testsSumPaise: Number(row.tests_sum),
  }))
}

export async function GET(request: Request) {
  try {
    await guard(request)
    return Response.json(await listAdminPackages())
  } catch (error) {
    return jsonError(error)
  }
}

const schema = z.object({
  name: z.string().trim().min(3, 'Enter the package name.').max(120),
  description: z.string().max(4000).optional().default(''),
  preparation: z.string().max(2000).optional().default(''),
  sampleType: z.string().max(120).optional().default(''),
  turnaroundHours: z.number().int().min(1).max(2000).nullable().optional(),
  pricePaise: z.number().int().min(1, 'Enter the package price.').max(10_000_000),
  originalPricePaise: z.number().int().min(0).max(10_000_000).nullable().optional(),
  homeCollection: z.boolean().optional().default(true),
  isPopular: z.boolean().optional().default(false),
  status: z.enum(['draft', 'published', 'archived']).optional().default('draft'),
  testIds: z.array(z.number().int().positive()).max(80).optional().default([]),
})

/** Server-side package validation: contents exist and the price is sane. */
async function validatePackage(testIds: number[], pricePaise: number, originalPricePaise: number | null | undefined, status: string) {
  if (testIds.length === 0) return status === 'published' ? 'A published package needs at least one included test.' : null
  const rows = await sql<{ id: number; status: string }>('SELECT id, status FROM diagnostic_tests WHERE id = ANY($1::int[])', [testIds])
  if (rows.length !== new Set(testIds).size) return 'One or more selected tests no longer exist.'
  if (status === 'published' && rows.some((row) => row.status !== 'published')) return 'Published packages can only include published tests.'
  if (originalPricePaise && originalPricePaise < pricePaise) return 'The original price must be greater than or equal to the package price.'
  return null
}

export async function POST(request: Request) {
  try {
    const admin = await guard(request, { mutation: true })
    const body = schema.parse(await request.json().catch(() => null))
    const problem = await validatePackage(body.testIds, body.pricePaise, body.originalPricePaise, body.status)
    if (problem) return Response.json({ error: problem }, { status: 400 })
    const slugBase = body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80) || `package-${Date.now()}`
    let slug = slugBase
    for (let suffix = 2; await one('SELECT 1 FROM health_packages WHERE slug = $1', [slug]); suffix += 1) slug = `${slugBase}-${suffix}`
    const row = await one<{ id: number }>(
      `INSERT INTO health_packages (name, slug, description, preparation, sample_type, turnaround_hours, price_paise, original_price_paise, home_collection, is_popular, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [body.name, slug, body.description, body.preparation, body.sampleType, body.turnaroundHours ?? null, body.pricePaise, body.originalPricePaise ?? null, body.homeCollection, body.isPopular, body.status],
    )
    for (const testId of body.testIds) await sql('INSERT INTO package_tests (package_id, test_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [row!.id, testId])
    await audit({ actor: admin, action: 'package.create', entity: 'health_packages', entityId: String(row!.id), detail: { name: body.name, pricePaise: body.pricePaise, tests: body.testIds }, request })
    revalidatePath('/'); revalidatePath('/packages')
    return Response.json({ id: row!.id }, { status: 201 })
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: firstIssue(error) }, { status: 400 })
    return jsonError(error)
  }
}

