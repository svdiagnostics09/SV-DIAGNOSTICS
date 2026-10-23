import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { one, sql } from '@/lib/db'

/**
 * Brand assets (logo / favicon).
 *
 * The bytes live in Postgres so they survive serverless deploys — a file under
 * public/uploads/brand does not. The public URL is `/api/brand/<id>`, which is
 * long-cached and reads straight from this table.
 *
 * WhatsApp and Meta need to fetch a logo by URL, and that URL goes into the PDF
 * cover too, so access is deliberately public for reading. Uploading and
 * deleting stay behind the admin session.
 */

export type BrandAssetId = 'logo' | 'favicon'

export const BRAND_ASSETS: Record<BrandAssetId, { url: string }> = {
  logo: { url: '/api/brand/logo' },
  favicon: { url: '/api/brand/favicon' },
}

export interface BrandAsset {
  id: BrandAssetId
  fileName: string
  mimeType: string
  content: Buffer
  updatedAt: string
}

const asId = (value: string): BrandAssetId | null =>
  value === 'logo' || value === 'favicon' ? value : null

export async function putBrandAsset(input: {
  id: BrandAssetId
  fileName: string
  mimeType: string
  bytes: Uint8Array
  actorEmail: string
}) {
  await sql(
    `INSERT INTO brand_assets (id, file_name, mime_type, content, size_bytes, updated_by_email, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (id) DO UPDATE SET
       file_name = EXCLUDED.file_name,
       mime_type = EXCLUDED.mime_type,
       content = EXCLUDED.content,
       size_bytes = EXCLUDED.size_bytes,
       updated_by_email = EXCLUDED.updated_by_email,
       updated_at = now()`,
    [input.id, input.fileName, input.mimeType, Buffer.from(input.bytes), input.bytes.length, input.actorEmail],
  )
}

export async function getBrandAsset(id: string): Promise<BrandAsset | null> {
  const assetId = asId(id)
  if (!assetId) return null
  const row = await one<Record<string, unknown>>(
    'SELECT id, file_name, mime_type, content, updated_at FROM brand_assets WHERE id = $1',
    [assetId],
  )
  if (!row) return null
  return {
    id: assetId,
    fileName: String(row.file_name),
    mimeType: String(row.mime_type),
    content: row.content as Buffer,
    updatedAt: new Date(row.updated_at as string).toISOString(),
  }
}

export async function deleteBrandAsset(id: BrandAssetId) {
  await sql('DELETE FROM brand_assets WHERE id = $1', [id])
}

/** True once a logo has been uploaded (used to decide whether to draw a cover). */
export async function hasLogo() {
  return Boolean(await one('SELECT 1 FROM brand_assets WHERE id = $1', ['logo']))
}

/**
 * The logo as a data URL for embedding in a PDF. Meta reports the document
 * name, not the cover image, so the logo must be drawn into the PDF itself.
 */
export async function logoDataUrl(): Promise<string | null> {
  const asset = await getBrandAsset('logo')
  if (!asset) return null
  // pdf-lib can embed PNG and JPG only; an SVG or ICO logo is skipped silently.
  if (!['image/png', 'image/jpeg'].includes(asset.mimeType)) return null
  return `data:${asset.mimeType};base64,${asset.content.toString('base64')}`
}

/**
 * Short-lived read URL for external services (Meta fetches the logo by URL).
 * HMAC-signed so the endpoint can be public without exposing a stable secret.
 */
function signingSecret() {
  return process.env.BRAND_URL_SECRET || process.env.IP_HASH_SALT || 'sv-brand-url'
}

export function signedBrandUrl(id: BrandAssetId, origin: string) {
  const expires = Math.floor(Date.now() / 1000) + 60 * 60 // 1 hour: enough for one send
  const signature = createHmac('sha256', signingSecret()).update(`${id}:${expires}`).digest('hex').slice(0, 32)
  return `${origin.replace(/\/$/, '')}/api/brand/${id}?exp=${expires}&sig=${signature}`
}

export function verifyBrandSignature(id: string, expires: string, signature: string) {
  const exp = Number(expires)
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false
  const expected = createHmac('sha256', signingSecret()).update(`${id}:${exp}`).digest('hex').slice(0, 32)
  const a = Buffer.from(expected)
  const b = Buffer.from(signature ?? '')
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Filename for the uploaded asset, with a cache-busting suffix. */
export function assetFileName(id: BrandAssetId, ext: string) {
  return `${id}-${randomUUID().slice(0, 8)}.${ext}`
}
