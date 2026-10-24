import { getPartnerLogo } from '@/lib/partners'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/partners/<logoId>
 *
 * A partner logo uploaded in Admin → Partners. Served from Postgres so it
 * survives redeploys. The id is unique per upload, so it is immutable and
 * cached for a year.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const asset = await getPartnerLogo(id)
  if (!asset) return new Response('Not found', { status: 404 })
  return new Response(new Uint8Array(asset.content), {
    headers: {
      'Content-Type': asset.mimeType,
      'Content-Length': String(asset.content.length),
      'Cache-Control': 'public, max-age=31536000, immutable',
      ETag: `"${asset.updatedAt}-${asset.content.length}"`,
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
