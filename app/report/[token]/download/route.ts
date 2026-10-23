import { downloadById, findReportByToken, pdfHeaders, recordShareDownload } from '@/lib/reports'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /report/[token]/download — the patient's PDF.
 *
 * Serves the exact PDF uploaded by the laboratory. The token is the credential;
 * every download is counted and the response is never cached.
 */
export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params
  const report = await findReportByToken(token)
  if (!report) {
    return new Response('This report link has expired or was replaced. Please ask the laboratory for a new link.', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  const file = await downloadById(report.id)
  if (!file) return new Response('The report file is unavailable. Please contact the laboratory.', { status: 404 })

  void recordShareDownload(report.id).catch(() => undefined)

  return new Response(new Uint8Array(file.content), { headers: pdfHeaders(report.fileName, file.mimeType) })
}
