import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { getSettings } from '@/lib/settings'

export const dynamic = 'force-dynamic'

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
}

/**
 * Serves the favicon chosen in Admin → Business settings. Falls back to the
 * built-in icon so the tab is never blank on a fresh install.
 */
export async function GET() {
  try {
    const settings = await getSettings()
    const url = settings.faviconUrl
    if (url?.startsWith('/uploads/')) {
      // Resolve inside public/ only — never allow path traversal out of it.
      const publicDir = path.join(process.cwd(), 'public')
      const filePath = path.join(publicDir, decodeURIComponent(url))
      if (!filePath.startsWith(path.join(publicDir, 'uploads'))) throw new Error('invalid path')
      const bytes = await readFile(filePath)
      const ext = path.extname(filePath).slice(1).toLowerCase()
      return new Response(new Uint8Array(bytes), {
        headers: { 'Content-Type': MIME[ext] ?? 'image/png', 'Cache-Control': 'public, max-age=300' },
      })
    }
    if (url?.startsWith('https://')) return Response.redirect(url, 302)
  } catch {
    // fall through to the built-in icon
  }

  const fallback = path.join(process.cwd(), 'public', 'icon.svg')
  const bytes = await readFile(fallback)
  return new Response(new Uint8Array(bytes), {
    headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=300' },
  })
}
