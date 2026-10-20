import { listCategories, listTests } from '@/lib/catalogue'
import { getSettings, publicSettings } from '@/lib/settings'
import { getLocation, listLocations, listServiceAreas } from '@/lib/network'

/**
 * Shared read model for public pages. Every value is read from PostgreSQL at
 * request time. Admin mutations call revalidatePath('/') so pages (including
 * the ISR copies) reflect the change on the next request.
 */

export async function siteShell() {
  const settings = await getSettings()
  const locations = await listLocations()
  return {
    settings: publicSettings(settings),
    categories: await listCategories(),
    locations,
    areas: await listServiceAreas(),
    primaryLocation: locations[0] ? await getLocation(locations[0].id) : null,
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
