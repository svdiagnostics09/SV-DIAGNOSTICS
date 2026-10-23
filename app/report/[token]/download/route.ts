import { buildBrandedReport } from '@/lib/report-pdf'
import { downloadById, findReportByToken, pdfHeaders, recordShareDownload } from '@/lib/reports'
import { getSettings } from '@/lib/settings'
import { one } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /report/[token]/download — the patient's PDF.
 *
 * Serves the same branded file that was sent on WhatsApp (logo cover + report),
 * so the link and the attachment never disagree. The token is the credential;
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

  const [settings, booking] = await Promise.all([
    getSettings(),
    one<{ reference: string; patient_name: string; phone: string; appointment_date: string; patient_age: number | null; patient_gender: string | null }>(
      'SELECT reference, patient_name, phone, appointment_date::text AS appointment_date, patient_age, patient_gender FROM bookings WHERE id = $1',
      [report.bookingId],
    ),
  ])

  const { bytes } = await buildBrandedReport(new Uint8Array(file.content), {
    brandName: settings.brandName,
    patientName: booking?.patient_name ?? '',
    reference: booking?.reference ?? '',
    appointmentDate: booking?.appointment_date ?? null,
    patientAge: booking?.patient_age ?? null,
    patientGender: booking?.patient_gender ?? null,
    phone: booking?.phone ?? null,
    supportPhone: settings.supportPhone,
    city: settings.city,
    fileName: report.fileName,
  })

  void recordShareDownload(report.id).catch(() => undefined)

  return new Response(new Uint8Array(bytes), { headers: pdfHeaders(report.fileName, 'application/pdf') })
}
