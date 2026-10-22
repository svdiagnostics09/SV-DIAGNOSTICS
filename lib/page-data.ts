import { listCategories, listTests } from '@/lib/catalogue'
import { getSettings, publicSettings } from '@/lib/settings'
import { listLocations, listServiceAreas } from '@/lib/network'

/**
 * Shared read model for public pages. Every value is read from PostgreSQL at
 * request time. Admin mutations call revalidatePath('/') so pages (including
 * the ISR copies) reflect the change on the next request.
 */

export async function siteShell() {
  // All independent reads go out together — a sequential chain here adds a full
  // round trip per query to every public page.
  const [settings, locations, categories, areas] = await Promise.all([
    getSettings(),
    listLocations(),
    listCategories(),
    listServiceAreas(),
  ])
  return {
    settings: publicSettings(settings),
    categories,
    locations,
    areas,
    // `listLocations()` already returns the full row, so no second query.
    primaryLocation: locations[0] ?? null,
  }
}

export type SiteShell = Awaited<ReturnType<typeof siteShell>>

export async function popularTests(limit = 8) {
  const result = await listTests({ popularOnly: true, pageSize: limit })
  if (result.tests.length >= 4) return result.tests
  const fallback = await listTests({ pageSize: limit })
  const seen = new Set(result.tests.map((test) => test.id))
  return [...result.tests, ...fallback.tests.filter((test) => !seen.has(test.id))].slice(0, limit)
}
