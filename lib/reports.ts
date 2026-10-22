import { createHash, randomBytes } from 'node:crypto'
import { one, sql } from '@/lib/db'

/**
 * Patient report PDFs.
 *
 * A report is stored in Postgres (`patient_reports.content`, bytea) so every
 * serverless instance serves the same bytes — writing to `public/uploads` would
 * vanish when the function scales out or a container is recycled.
 *
 * Files are reached in two ways:
 *   1. Administrator (session cookie)  → /api/admin/reports/file?id=…
 *   2. Patient link (random token)     → /api/reports/download?token=…
 * The token is revoked automatically when a newer report replaces the booking's
 * report, so a link already forwarded on WhatsApp stops resolving.
 */

/** Meta's media limit is 100 MB; 20 MB is plenty for a scanned report. */
export const MAX_PDF_BYTES = 20 * 1024 * 1024

export const REPORT_MIME = 'application/pdf'

/** `%PDF-` must be the first bytes — a renamed .docx or image is not a report. */
export function looksLikePdf(bytes: Uint8Array): boolean {
  return bytes.length > 1024 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d
}

export function newReportToken(): string {
  return randomBytes(32).toString('base64url')
}

export const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')

/** Strip directory components and characters that break headers or Content-Disposition. */
export function safePdfName(name: string, reference: string): string {
  const base = (name || '').replace(/\\/g, '/').split('/').pop() ?? ''
  const cleaned = base
    .replace(/\.pdf$/i, '')
    .replace(/[^\w .-]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80)
  return `${cleaned || `report-${reference}`}.pdf`
}

export interface ReportSummary {
  id: string
  fileName: string
  sizeBytes: number
  sha256: string
  createdAt: string
  revokedAt: string | null
  downloads: number
  lastDownloadedAt: string | null
  uploadedBy: string
}

export interface DeliverySummary {
  id: string
  status: 'sent' | 'failed' | 'skipped'
  recipient: string
  detail: string
  providerMessageId: string | null
  actor: string
  createdAt: string
}

const toIso = (value: unknown) => (value ? new Date(value as string).toISOString() : null)

/**
 * Store a report for a booking. Any previous live report is revoked in the same
 * statement batch, preserving the unique "one live report" index.
 */
export async function saveReport(input: {
  bookingId: string
  fileName: string
  bytes: Uint8Array
  actorId: string
  actorEmail: string
}): Promise<{ id: string; accessToken: string; fileName: string }> {
  await sql('UPDATE patient_reports SET revoked_at = now() WHERE booking_id = $1 AND revoked_at IS NULL', [input.bookingId])
  const address = Buffer.from(input.bytes)
  const row = await one<{ id: string; access_token: string; file_name: string }>(
    `INSERT INTO patient_reports (booking_id, file_name, mime_type, size_bytes, content, sha256, access_token, uploaded_by, uploaded_by_email)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, access_token, file_name`,
    [input.bookingId, input.fileName, REPORT_MIME, address.length, address, sha256(input.bytes), newReportToken(), input.actorId, input.actorEmail],
  )
  if (!row) throw new Error('The report could not be saved.')
  return { id: row.id, accessToken: row.access_token, fileName: row.file_name }
}

/** Live reports for the given bookings, newest first (bytes are not loaded). */
export async function liveReportsForBookings(bookingIds: string[]): Promise<Map<string, ReportSummary & { bookingId: string }>> {
  if (!bookingIds.length) return new Map()
  const rows = await sql<Record<string, unknown>>(
    `SELECT id, booking_id, file_name, size_bytes, sha256, created_at, downloads, last_downloaded_at, uploaded_by_email
     FROM patient_reports WHERE booking_id = ANY($1::uuid[]) AND revoked_at IS NULL`,
    [bookingIds],
  )
  return new Map(rows.map((row) => [String(row.booking_id), {
    id: String(row.id),
    bookingId: String(row.booking_id),
    fileName: String(row.file_name),
    sizeBytes: Number(row.size_bytes),
    sha256: String(row.sha256),
    createdAt: new Date(row.created_at as string).toISOString(),
    revokedAt: null,
    downloads: Number(row.downloads),
    lastDownloadedAt: toIso(row.last_downloaded_at),
    uploadedBy: String(row.uploaded_by_email ?? ''),
  }]))
}

/** Full detail for one booking: live report, history and delivery attempts. */
export async function reportDetailForBooking(bookingId: string) {
  const [reports, deliveries] = await Promise.all([
    sql<Record<string, unknown>>(
      `SELECT id, file_name, size_bytes, sha256, created_at, revoked_at, downloads, last_downloaded_at, uploaded_by_email
       FROM patient_reports WHERE booking_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [bookingId],
    ),
    sql<Record<string, unknown>>(
      `SELECT id, status, recipient, detail, provider_message_id, actor_email, created_at
       FROM report_deliveries WHERE booking_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [bookingId],
    ),
  ])
  return {
    reports: reports.map((row): ReportSummary => ({
      id: String(row.id),
      fileName: String(row.file_name),
      sizeBytes: Number(row.size_bytes),
      sha256: String(row.sha256),
      createdAt: new Date(row.created_at as string).toISOString(),
      revokedAt: toIso(row.revoked_at),
      downloads: Number(row.downloads),
      lastDownloadedAt: toIso(row.last_downloaded_at),
      uploadedBy: String(row.uploaded_by_email ?? ''),
    })),
    deliveries: deliveries.map((row): DeliverySummary => ({
      id: String(row.id),
      status: row.status as DeliverySummary['status'],
      recipient: String(row.recipient),
      detail: String(row.detail),
      providerMessageId: row.provider_message_id ? String(row.provider_message_id) : null,
      actor: String(row.actor_email ?? ''),
      createdAt: new Date(row.created_at as string).toISOString(),
    })),
  }
}

/** Live report id for a booking (used before a send). */
export async function liveReport(bookingId: string) {
  return one<{ id: string; file_name: string; access_token: string; size_bytes: number }>(
    `SELECT id, file_name, access_token, size_bytes FROM patient_reports WHERE booking_id = $1 AND revoked_at IS NULL`,
    [bookingId],
  )
}

export async function revokeReport(reportId: string, bookingId: string) {
  return sql('UPDATE patient_reports SET revoked_at = now() WHERE id = $1 AND booking_id = $2 AND revoked_at IS NULL RETURNING id', [reportId, bookingId])
}

export async function recordDelivery(input: {
  reportId: string
  bookingId: string
  recipient: string
  status: string
  detail: string
  providerMessageId: string | null
  actorEmail: string
}) {
  await sql(
    `INSERT INTO report_deliveries (report_id, booking_id, channel, recipient, template, status, provider_message_id, detail, actor_email)
     VALUES ($1, $2, 'whatsapp', $3, 'patient_report', $4, $5, $6, $7)`,
    [input.reportId, input.bookingId, input.recipient, input.status, input.providerMessageId, input.detail.slice(0, 600), input.actorEmail],
  )
}

/**
 * Resolve a download token. Returns the file bytes for a live report only.
 * Rows are counted as a download here because this is the only patient path.
 */
export async function downloadByToken(token: string) {
  const row = await one<Record<string, unknown>>(
    `SELECT r.id, r.file_name, r.mime_type, r.content, r.booking_id
     FROM patient_reports r
     WHERE r.access_token = $1 AND r.revoked_at IS NULL`,
    [token],
  )
  if (!row) return null
  await sql('UPDATE patient_reports SET downloads = downloads + 1, last_downloaded_at = now() WHERE id = $1', [String(row.id)])
  return {
    fileName: String(row.file_name),
    mimeType: String(row.mime_type ?? REPORT_MIME),
    content: row.content as Buffer,
  }
}

/** Administrator download by report id. */
export async function downloadById(id: string) {
  const row = await one<Record<string, unknown>>(
    `SELECT file_name, mime_type, content FROM patient_reports WHERE id = $1`,
    [id],
  )
  if (!row) return null
  return { fileName: String(row.file_name), mimeType: String(row.mime_type ?? REPORT_MIME), content: row.content as Buffer }
}

/** Content-Disposition that works for non-ASCII file names too. */
export function pdfHeaders(fileName: string, mimeType: string) {
  const ascii = fileName.replace(/[^\x20-\x7e]+/g, '_').replace(/["\\]/g, '_')
  return {
    'Content-Type': mimeType,
    'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    'Cache-Control': 'private, no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  }
}
