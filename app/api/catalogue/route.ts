import { listTests } from '@/lib/catalogue'

export const dynamic = 'force-dynamic'

/** Public catalogue search used by the tests page (debounced) and booking flow. */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const sortParam = url.searchParams.get('sort')
  const sort = sortParam === 'price_asc' || sortParam === 'price_desc' || sortParam === 'name' || sortParam === 'turnaround' ? sortParam : 'name'
  try {
    const result = await listTests({
      q: url.searchParams.get('q') ?? undefined,
      category: url.searchParams.get('category') ?? undefined,
      sort,
      page: Number(url.searchParams.get('page') ?? '1') || 1,
      pageSize: Math.min(48, Number(url.searchParams.get('pageSize') ?? '12') || 12),
    })
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ error: 'The catalogue could not be loaded.' }, { status: 503 })
  }
}
