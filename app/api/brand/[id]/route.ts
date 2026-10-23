import { getBrandAsset } from '@/lib/brand-assets'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/brand/logo | /api/brand/favicon
 *
 * The brand image uploaded in Admin → Business settings. Served from Postgres
 * so it survives redeploys. Immutable for a day, with an ETag so repeat visits
 * get a 304 instead of the bytes.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const asset = await getBrandAsset(id)
  if (!asset) return new Response('Not found', { status: 404 })

  const etag = `"${asset.updatedAt}-${asset.content.length}"`
  return new Response(new Uint8Array(asset.content), {
    headers: {
      'Content-Type': asset.mimeType,
      'Content-Length': String(asset.content.length),
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      ETag: etag,
      'Content-Disposition': `inline; filename="${asset.fileName}"`,
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
