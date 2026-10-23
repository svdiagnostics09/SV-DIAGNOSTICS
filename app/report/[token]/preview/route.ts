import { downloadById, findReportByToken, recordShareDownload } from '@/lib/reports'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /report/[token]/preview — a patient-only, inline PDF preview.
 *
 * Unlike the administrator's preview endpoint, this URL is safe to place in a
 * WhatsApp message: the random token is required, has an expiry, and is
 * revoked whenever the report is replaced.
 */
export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params
  const report = await findReportByToken(token)
  if (!report) {
    return new Response('This report link has expired or was replaced. Please ask the laboratory for a new link.', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }

  const file = await downloadById(report.id)
  if (!file) return new Response('The report file is unavailable. Please contact the laboratory.', { status: 404 })

  void recordShareDownload(report.id).catch(() => undefined)

  const ascii = report.fileName.replace(/[^\x20-\x7e]+/g, '_').replace(/["\\]/g, '_')
  return new Response(new Uint8Array(file.content), {
    headers: {
      'Content-Type': file.mimeType,
      'Content-Disposition': `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(report.fileName)}`,
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  })
}
