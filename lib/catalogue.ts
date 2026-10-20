import { effectivePrice, one, sql } from '@/lib/db'

/** Database-backed diagnostic catalogue, packages, categories, investigations. */

export interface Category {
  id: number
  name: string
  slug: string
  description: string
  sortOrder: number
  isActive: boolean
  testCount: number
}

export interface TestView {
  id: number
  name: string
  slug: string
  categoryId: number | null
  categoryName: string
  categorySlug: string
  shortDescription: string
  description: string
  sampleType: string
  sampleTypes: string[]
  reportType: string
  turnaroundHours: number | null
  preparation: string
  fastingRequired: boolean
  fastingHours: number | null
  pricePaise: number
  listPricePaise: number
  discountType: 'none' | 'percent' | 'amount'
  discountValue: number
  homeCollection: boolean
  isPopular: boolean
  status: 'draft' | 'published' | 'archived'
  imageUrl: string
  investigationCount?: number
}

type TestRow = Record<string, unknown>

export function mapTest(row: TestRow): TestView {
  const pricePaise = Number(row.price_paise)
  const discountType = String(row.discount_type) as TestView['discountType']
  const discountValue = Number(row.discount_value)
  return {
    id: Number(row.id),
    name: String(row.name),
    slug: String(row.slug),
    categoryId: row.category_id === null ? null : Number(row.category_id),
    categoryName: String(row.category_name ?? ''),
    categorySlug: String(row.category_slug ?? ''),
    shortDescription: String(row.short_description ?? ''),
    description: String(row.description ?? ''),
    sampleType: String(row.sample_type ?? ''),
    sampleTypes: (row.sample_types as string[] | null) ?? [],
    reportType: String(row.report_type ?? ''),
    turnaroundHours: row.turnaround_hours === null || row.turnaround_hours === undefined ? null : Number(row.turnaround_hours),
    preparation: String(row.preparation ?? ''),
    fastingRequired: Boolean(row.fasting_required),
    fastingHours: row.fasting_hours === null || row.fasting_hours === undefined ? null : Number(row.fasting_hours),
    pricePaise,
    listPricePaise: effectivePrice(pricePaise, discountType, discountValue),
    discountType,
    discountValue,
    homeCollection: Boolean(row.home_collection),
    isPopular: Boolean(row.is_popular),
    status: String(row.status) as TestView['status'],
    imageUrl: String(row.image_url ?? ''),
    investigationCount: row.investigation_count === undefined ? undefined : Number(row.investigation_count),
  }
}

const TEST_SELECT = `
  SELECT t.*, c.name AS category_name, c.slug AS category_slug,
    (SELECT count(*) FROM test_investigations ti WHERE ti.test_id = t.id) AS investigation_count
  FROM diagnostic_tests t LEFT JOIN diagnostic_categories c ON c.id = t.category_id`

export interface CatalogueQuery {
  q?: string
  category?: string
  sort?: 'name' | 'price_asc' | 'price_desc' | 'turnaround'
  page?: number
  pageSize?: number
  includeUnpublished?: boolean
  popularOnly?: boolean
  ids?: number[]
}

export async function listTests(query: CatalogueQuery = {}) {
  const pageSize = Math.min(500, Math.max(1, query.pageSize ?? 12))
  const page = Math.max(1, query.page ?? 1)
  const values: unknown[] = []
  const where: string[] = []
  if (!query.includeUnpublished) where.push(`t.status = 'published'`)
  if (query.popularOnly) where.push(`t.is_popular = true`)
  if (query.q?.trim()) {
    values.push(`%${query.q.trim().toLowerCase()}%`)
    where.push(`(lower(t.name) LIKE $${values.length} OR lower(t.short_description) LIKE $${values.length} OR lower(coalesce(c.name,'')) LIKE $${values.length})`)
  }
  if (query.category && query.category !== 'all') {
    values.push(query.category)
    where.push(`c.slug = $${values.length}`)
  }
  if (query.ids?.length) {
    values.push(query.ids)
    where.push(`t.id = ANY($${values.length}::int[])`)
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const orderSql =
    query.sort === 'price_asc' ? 'ORDER BY effective_price ASC, base.name ASC'
    : query.sort === 'price_desc' ? 'ORDER BY effective_price DESC, base.name ASC'
    : query.sort === 'turnaround' ? 'ORDER BY base.turnaround_hours NULLS LAST, base.name ASC'
    : 'ORDER BY base.is_popular DESC, base.name ASC'
  values.push(pageSize, (page - 1) * pageSize)
  const rows = await sql<TestRow>(`
    WITH base AS (${TEST_SELECT} ${whereSql})
    SELECT base.*, CASE
      WHEN base.discount_type = 'percent' THEN round(base.price_paise * (100 - base.discount_value) / 100.0)
      WHEN base.discount_type = 'amount' THEN base.price_paise - base.discount_value
      ELSE base.price_paise END AS effective_price
    FROM base ${orderSql} LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  )
  // Same filters, same joins — the count reflects the actual query result.
  const count = await one<{ total: number }>(`SELECT count(*)::int AS total FROM (${TEST_SELECT} ${whereSql}) AS counted`, values.slice(0, values.length - 2))
  const total = count?.total ?? 0
  return { tests: rows.map(mapTest), total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) }
}

export async function getTestBySlug(slug: string) {
  const row = await one<TestRow>(`${TEST_SELECT} WHERE t.slug = $1`, [slug])
  return row ? mapTest(row) : null
}

export async function getTestById(id: number) {
  const row = await one<TestRow>(`${TEST_SELECT} WHERE t.id = $1`, [id])
  return row ? mapTest(row) : null
}

export async function getTestsForPackage(packageId: number) {
  const rows = await sql<TestRow>(
    `${TEST_SELECT} JOIN package_tests pt ON pt.test_id = t.id WHERE pt.package_id = $1 ORDER BY t.name`,
    [packageId],
  )
  return rows.map(mapTest)
}

/** Every published test, for the price list (paged internally to stay under statement limits). */
export async function listAllPublishedTests() {
  const out: TestView[] = []
  for (let page = 1; ; page += 1) {
    const result = await listTests({ pageSize: 500, page })
    out.push(...result.tests)
    if (page >= result.pages) return out
  }
}

export async function listCategories(includeInactive = false) {
  const rows = await sql<Record<string, unknown>>(
    `SELECT c.*, (SELECT count(*) FROM diagnostic_tests t WHERE t.category_id = c.id AND t.status = 'published') AS test_count
     FROM diagnostic_categories c ${includeInactive ? '' : 'WHERE c.is_active = true'} ORDER BY c.sort_order, c.name`,
  )
  return rows.map((row) => ({
    id: Number(row.id),
    name: String(row.name),
    slug: String(row.slug),
    description: String(row.description ?? ''),
    sortOrder: Number(row.sort_order),
    isActive: Boolean(row.is_active),
    testCount: Number(row.test_count ?? 0),
  })) satisfies Category[]
}

/* Packages ------------------------------------------------------------ */

export interface PackageView {
  id: number
  name: string
  slug: string
  description: string
  preparation: string
  sampleType: string
  turnaroundHours: number | null
  pricePaise: number
  originalPricePaise: number | null
  homeCollection: boolean
  isPopular: boolean
  status: 'draft' | 'published' | 'archived'
  imageUrl: string
  testCount: number
  testsSumPaise: number
}

function mapPackage(row: Record<string, unknown>): PackageView {
  return {
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
    status: String(row.status) as PackageView['status'],
    imageUrl: String(row.image_url ?? ''),
    testCount: Number(row.test_count ?? 0),
    testsSumPaise: Number(row.tests_sum ?? 0),
  }
}

const PACKAGE_SELECT = `
  SELECT p.*, count(pt.test_id)::int AS test_count,
    COALESCE(sum(CASE WHEN t.discount_type = 'percent' THEN round(t.price_paise * (100 - t.discount_value) / 100.0)
                      WHEN t.discount_type = 'amount' THEN t.price_paise - t.discount_value
                      ELSE t.price_paise END), 0)::int AS tests_sum
  FROM health_packages p
  LEFT JOIN package_tests pt ON pt.package_id = p.id
  LEFT JOIN diagnostic_tests t ON t.id = pt.test_id`

export async function listPackages(options: { includeUnpublished?: boolean; popularOnly?: boolean } = {}) {
  const where: string[] = []
  if (!options.includeUnpublished) where.push(`p.status = 'published'`)
  if (options.popularOnly) where.push('p.is_popular = true')
  const rows = await sql(PACKAGE_SELECT + (where.length ? ` WHERE ${where.join(' AND ')}` : '') + ' GROUP BY p.id ORDER BY p.is_popular DESC, p.price_paise ASC')
  return rows.map(mapPackage)
}

export async function getPackageBySlug(slug: string) {
  const row = await one(PACKAGE_SELECT + ' WHERE p.slug = $1 GROUP BY p.id', [slug])
  if (!row) return null
  const pack = mapPackage(row)
  return { ...pack, tests: await getTestsForPackage(pack.id) }
}

export async function getPackageById(id: number) {
  const row = await one(PACKAGE_SELECT + ' WHERE p.id = $1 GROUP BY p.id', [id])
  return row ? mapPackage(row) : null
}

/* Investigations ------------------------------------------------------ */

export async function listInvestigations(includeInactive = false) {
  const rows = await sql<Record<string, unknown>>(
    `SELECT i.*, (SELECT count(*) FROM test_investigations ti WHERE ti.investigation_id = i.id)::int AS test_count
     FROM investigations i ${includeInactive ? '' : 'WHERE i.is_active = true'} ORDER BY i.name`,
  )
  return rows.map((row) => ({
    id: Number(row.id),
    name: String(row.name),
    description: String(row.description ?? ''),
    isActive: Boolean(row.is_active),
    testCount: Number(row.test_count ?? 0),
  }))
}

export async function investigationsForTest(testId: number) {
  const rows = await sql<{ id: number; name: string }>(
    `SELECT i.id, i.name FROM investigations i JOIN test_investigations ti ON ti.investigation_id = i.id WHERE ti.test_id = $1 ORDER BY i.name`,
    [testId],
  )
  return rows.map((row) => ({ id: Number(row.id), name: String(row.name) }))
}
