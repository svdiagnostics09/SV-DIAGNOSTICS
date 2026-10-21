import { listPackages, listTests } from '@/lib/catalogue'

export const dynamic = 'force-dynamic'

/**
 * Unified storefront search across both tests and health packages, so the hero
 * search can filter "Lab Tests" and "Checkups" from one query.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const q = (url.searchParams.get('q') ?? '').trim()
  const limit = Math.min(12, Math.max(1, Number(url.searchParams.get('limit') ?? '8') || 8))

  try {
    const [tests, packages] = await Promise.all([
      listTests({ q: q || undefined, pageSize: limit }),
      listPackages(),
    ])
    const term = q.toLowerCase()
    const matchedPackages = (term
      ? packages.filter((pack) => pack.name.toLowerCase().includes(term) || pack.description.toLowerCase().includes(term))
      : packages
    ).slice(0, limit)

    return Response.json(
      {
        tests: tests.tests.map((test) => ({
          kind: 'test' as const,
          id: test.id, name: test.name, slug: test.slug,
          categoryName: test.categoryName, pricePaise: test.pricePaise, listPricePaise: test.listPricePaise,
          turnaroundHours: test.turnaroundHours, homeCollection: test.homeCollection,
          description: test.shortDescription || test.description,
          parameterCount: test.investigationCount,
          preparation: test.preparation, sampleType: test.sampleType, isPopular: test.isPopular,
        })),
        packages: matchedPackages.map((pack) => ({
          kind: 'package' as const,
          id: pack.id, name: pack.name, slug: pack.slug,
          categoryName: 'Health package', pricePaise: pack.pricePaise,
          listPricePaise: pack.originalPricePaise && pack.originalPricePaise > pack.pricePaise ? pack.originalPricePaise : pack.pricePaise,
          turnaroundHours: pack.turnaroundHours, homeCollection: pack.homeCollection,
          description: pack.description,
          parameterCount: pack.testCount,
          preparation: pack.preparation, sampleType: pack.sampleType, isPopular: pack.isPopular,
        })),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch {
    return Response.json({ error: 'Search is unavailable right now.' }, { status: 503 })
  }
}
