import { PDFDocument } from 'pdf-lib'
import { buildBrandedReport } from '@/lib/report-pdf'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const src = await PDFDocument.create()
  const page = src.addPage([595.28, 841.89])
  page.drawText('ORIGINAL LABORATORY REPORT', { x: 60, y: 760, size: 18 })
  const original = await src.save()
  const { bytes, branded } = await buildBrandedReport(new Uint8Array(original), {
    brandName: 'SV Diagnostics', patientName: 'Ravi Kumar Reddy', reference: 'SV-2026-AB12CD34',
    appointmentDate: '2026-10-24', patientAge: 34, patientGender: 'male', phone: '9876543210',
    supportPhone: '+91 90000 12345', city: 'Hyderabad', fileName: 'report.pdf',
  })
  const check = await PDFDocument.load(bytes)
  return Response.json({ branded, pages: check.getPageCount(), sizeKb: Math.round(bytes.length / 1024) })
}
