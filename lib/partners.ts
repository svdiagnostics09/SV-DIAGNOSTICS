import { sql } from '@/lib/db'

/**
 * Partner logos shown in the horizontal marquee on the homepage.
 *
 * Image bytes live in Postgres (table `partner_logos`) for the same reason the
 * brand logo does: `public/` is not writable on a serverless deployment, so a
 * file written at upload time would 404 after the next release. The public URL
 * is `/api/partners/<logoId>`, long-cached and immutable per upload.
 *
 * Rows are managed from Admin → Partners.
 */

export interface Partner {
  id: string
  name: string
  /** Short line under the name, e.g. 'Hospital partner'. May be empty. */
  role: string
  /** Optional outbound link. */
  href: string
  /** `/api/partners/<id>`, or '' when the partner has no uploaded image. */
  logoUrl: string
  sortOrder: number
  isActive: boolean
}

/** Shape consumed by the storefront component. */
export interface PublicPartner {
  id: string
  name: string
  role: string
  href?: string
  logoUrl: string
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value)

function toPartner(row: Record<string, unknown>): Partner {
  const logoId = row.logo_id ? String(row.logo_id) : ''
  return {
    id: String(row.id),
    name: String(row.name),
    role: String(row.role ?? ''),
    href: String(row.href ?? ''),
    logoUrl: logoId ? partnerLogoUrl(logoId, row.logo_updated_at ? new Date(row.logo_updated_at as string).getTime() : undefined) : '',
    sortOrder: Number(row.sort_order ?? 0),
    isActive: Boolean(row.is_active),
  }
}

/**
 * `?v=` is the logo's upload time so a replacement image shows up immediately
 * even though the URL path stays the same (and is cached for a year).
 */
export function partnerLogoUrl(logoId: string, version?: number) {
  return version ? `/api/partners/${logoId}?v=${version}` : `/api/partners/${logoId}`
}

const SELECT = `SELECT p.id, p.name, p.role, p.href, p.logo_id, p.sort_order, p.is_active, l.updated_at AS logo_updated_at
                FROM partners p
                LEFT JOIN partner_logos l ON l.id = p.logo_id`

/** All partners, ordered — used by the admin panel. */
export async function listPartners(): Promise<Partner[]> {
  const rows = await sql<Record<string, unknown>>(`${SELECT} ORDER BY p.sort_order ASC, p.created_at ASC`)
  return rows.map(toPartner)
}

/** Only active partners, for the storefront marquee. */
export async function listPublicPartners(): Promise<PublicPartner[]> {
  const rows = await sql<Record<string, unknown>>(`${SELECT} WHERE p.is_active = true ORDER BY p.sort_order ASC, p.created_at ASC`)
  return rows.map(toPartner).map(({ id, name, role, href, logoUrl }) => ({
    id,
    name,
    role,
    href: href || undefined,
    logoUrl,
  }))
}

export async function createPartner(input: { id: string; name: string; role: string; href: string; sortOrder: number }) {
  const next = await sql<{ next: number }>('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM partners')
  const sortOrder = Number.isFinite(input.sortOrder) ? input.sortOrder : Number(next[0]?.next ?? 0)
  await sql(
    `INSERT INTO partners (id, name, role, href, sort_order) VALUES ($1, $2, $3, $4, $5)`,
    [input.id, input.name, input.role, input.href, sortOrder],
  )
}

export async function updatePartner(id: string, patch: { name?: string; role?: string; href?: string; sortOrder?: number; isActive?: boolean }) {
  await sql(
    `UPDATE partners SET
       name = COALESCE($2, name),
       role = COALESCE($3, role),
       href = COALESCE($4, href),
       sort_order = COALESCE($5, sort_order),
       is_active = COALESCE($6, is_active),
       updated_at = now()
     WHERE id = $1`,
    [
      id,
      patch.name ?? null,
      patch.role ?? null,
      patch.href ?? null,
      typeof patch.sortOrder === 'number' ? patch.sortOrder : null,
      typeof patch.isActive === 'boolean' ? patch.isActive : null,
    ],
  )
}

export async function deletePartner(id: string) {
  // Capture the image first — the FK is ON DELETE SET NULL, so it would
  // otherwise be left orphaned in partner_logos.
  const rows = await sql<{ logo_id: string | null }>('SELECT logo_id FROM partners WHERE id = $1', [id])
  const logoId = rows[0]?.logo_id
  await sql('DELETE FROM partners WHERE id = $1', [id])
  if (logoId) await sql('DELETE FROM partner_logos WHERE id = $1', [logoId])
}

/** Replaces the image for one partner. The old bytes are removed first. */
export async function putPartnerLogo(input: { partnerId: string; logoId: string; fileName: string; mimeType: string; bytes: Uint8Array; actorEmail: string }) {
  // Drop the image currently attached to this partner, then insert the new one.
  // Deleting by the NEW id would be a no-op and would leak the old blob on
  // every replace.
  const previous = await sql<{ logo_id: string | null }>('SELECT logo_id FROM partners WHERE id = $1', [input.partnerId])
  const previousLogoId = previous[0]?.logo_id
  await sql(
    `INSERT INTO partner_logos (id, file_name, mime_type, content, size_bytes, updated_at)
     VALUES ($1, $2, $3, $4, $5, now())`,
    [input.logoId, input.fileName, input.mimeType, Buffer.from(input.bytes), input.bytes.length],
  )
  await sql('UPDATE partners SET logo_id = $2, updated_at = now() WHERE id = $1', [input.partnerId, input.logoId])
  if (previousLogoId) await sql('DELETE FROM partner_logos WHERE id = $1', [previousLogoId])
}

export async function getPartnerLogo(id: string) {
  if (!isUuid(id)) return null
  const rows = await sql<Record<string, unknown>>(
    'SELECT file_name, mime_type, content, updated_at FROM partner_logos WHERE id = $1',
    [id],
  )
  const row = rows[0]
  if (!row) return null
  return {
    fileName: String(row.file_name),
    mimeType: String(row.mime_type),
    content: row.content as Buffer,
    updatedAt: new Date(row.updated_at as string).toISOString(),
  }
}

/** Reads the partner row for an upload, ignoring the "not found" case. */
export async function findPartner(id: string) {
  if (!isUuid(id)) return null
  const rows = await sql<{ id: string; name: string }>('SELECT id, name FROM partners WHERE id = $1', [id])
  return rows[0] ?? null
}
