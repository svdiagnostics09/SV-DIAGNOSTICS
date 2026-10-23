import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { getSettings } from '@/lib/settings'
import { getBrandAsset } from '@/lib/brand-assets'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * The site icon chosen in Admin → Business settings.
 *
 * Reads from the brand_assets table (not public/uploads, which does not survive
 * a Vercel deploy), so the logo in the browser tab matches the one uploaded.
 * Falls back to the built-in mark so a fresh install is never blank.
 */
export async function GET() {
  try {
    const asset = await getBrandAsset('favicon')
    if (asset) {
      return new Response(new Uint8Array(asset.content), {
        headers: {
          'Content-Type': asset.mimeType,
          'Cache-Control': 'public, max-age=3600',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    }

    // A logo with no separate favicon still makes a better tab icon than a generic mark.
    const logo = await getBrandAsset('logo')
    if (logo && ['image/png', 'image/jpeg'].includes(logo.mimeType)) {
      return new Response(new Uint8Array(logo.content), {
        headers: { 'Content-Type': logo.mimeType, 'Cache-Control': 'public, max-age=3600' },
      })
    }

    // An externally hosted icon is allowed too.
    const settings = await getSettings()
    if (settings.faviconUrl?.startsWith('https://')) return Response.redirect(settings.faviconUrl, 302)
  } catch {
    // fall through to the built-in icon
  }

  const fallback = path.join(process.cwd(), 'public', 'icon.svg')
  const bytes = await readFile(fallback)
  return new Response(new Uint8Array(bytes), {
    headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=300' },
  })
}
