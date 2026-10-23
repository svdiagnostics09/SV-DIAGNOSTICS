import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { logoDataUrl } from '@/lib/brand-assets'

/**
 * Branded patient report.
 *
 * A report PDF cannot carry an image on its own — WhatsApp shows the document
 * file, not a thumbnail you control — so the brand has to be inside the PDF.
 * We prepend one cover page carrying the logo, patient details and booking
 * reference, then keep the laboratory's own pages exactly as uploaded.
 *
 * If no PNG/JPG logo has been uploaded, the original PDF is returned untouched:
 * a report must never fail to send because of branding.
 */

const INK = rgb(0.11, 0.19, 0.17)
const MUTED = rgb(0.42, 0.47, 0.45)
const BRAND = rgb(0.0, 0.73, 0.55)
const LINE = rgb(0.85, 0.88, 0.87)

export interface ReportCoverDetails {
  brandName: string
  patientName: string
  reference: string
  appointmentDate?: string | null
  patientAge?: number | null
  patientGender?: string | null
  phone?: string | null
  supportPhone?: string | null
  city?: string | null
  /** Filename shown in the WhatsApp message. */
  fileName: string
}

/** Keep text inside its column: pdf-lib has no wrapping engine of its own. */
function fit(text: string, font: { widthOfTextAtSize: (text: string, size: number) => number }, size: number, maxWidth: number) {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text
  let clipped = text
  while (clipped.length > 1 && font.widthOfTextAtSize(`${clipped}…`, size) > maxWidth) clipped = clipped.slice(0, -1)
  return `${clipped}…`
}

export async function buildBrandedReport(
  original: Uint8Array,
  details: ReportCoverDetails,
): Promise<{ bytes: Uint8Array; branded: boolean }> {
  const logo = await logoDataUrl()
  if (!logo) return { bytes: original, branded: false }

  let source: PDFDocument
  try {
    source = await PDFDocument.load(original, { ignoreEncryption: true })
  } catch {
    // A scanned PDF with an unusual structure: send it unbranded rather than fail.
    return { bytes: original, branded: false }
  }

  const merged = await PDFDocument.create()
  const cover = merged.addPage([595.28, 841.89]) // A4 portrait, points
  const { width, height } = cover.getSize()
  const margin = 48

  const bold = await merged.embedFont(StandardFonts.HelveticaBold)
  const regular = await merged.embedFont(StandardFonts.Helvetica)

  // --- Header band -------------------------------------------------------
  cover.drawRectangle({ x: 0, y: height - 132, width, height: 132, color: rgb(0.96, 0.99, 0.98) })
  cover.drawRectangle({ x: 0, y: height - 136, width, height: 4, color: BRAND })

  let logoWidth = 0
  try {
    const embedded = logo.includes('image/png') ? await merged.embedPng(logo) : await merged.embedJpg(logo)
    const maxH = 56
    const scale = Math.min(maxH / embedded.height, 170 / embedded.width)
    const drawW = embedded.width * scale
    const drawH = embedded.height * scale
    cover.drawImage(embedded, { x: margin, y: height - 76, width: drawW, height: drawH })
    logoWidth = drawW
  } catch {
    // A corrupt logo must not block the report.
  }

  const brandX = margin + logoWidth + (logoWidth ? 18 : 0)
  cover.drawText(fit(details.brandName, bold, 19, width - brandX - margin), { x: brandX, y: height - 58, size: 19, font: bold, color: INK })
  cover.drawText('Patient Report', { x: brandX, y: height - 80, size: 12, font: regular, color: MUTED })

  // --- Patient block -----------------------------------------------------
  let y = height - 178
  cover.drawText('REPORT DETAILS', { x: margin, y, size: 9, font: bold, color: MUTED })
  y -= 10
  cover.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: LINE })
  y -= 26

  const rows: Array<[string, string]> = [
    ['Patient', details.patientName],
    ['Booking reference', details.reference],
  ]
  if (details.appointmentDate) rows.push(['Collection date', details.appointmentDate])
  if (details.patientAge !== null && details.patientAge !== undefined) rows.push(['Age', String(details.patientAge)])
  if (details.patientGender) rows.push(['Gender', details.patientGender.charAt(0).toUpperCase() + details.patientGender.slice(1)])
  if (details.phone) rows.push(['Registered mobile', details.phone])

  for (const [label, value] of rows) {
    cover.drawText(label, { x: margin, y, size: 10, font: regular, color: MUTED })
    cover.drawText(fit(value, bold, 11, width - margin * 2 - 150), { x: margin + 150, y, size: 11, font: bold, color: INK })
    y -= 22
    cover.drawLine({ start: { x: margin, y: y + 10 }, end: { x: width - margin, y: y + 10 }, thickness: 0.5, color: LINE })
  }

  // --- Footer ------------------------------------------------------------
  const footer = [
    `Report: ${details.fileName}`,
    details.supportPhone ? `Questions about this report? Call ${details.supportPhone}.` : 'Questions about this report? Contact the laboratory using your booking reference.',
    'This report contains confidential medical information. Please keep it private.',
  ]
  let fy = 108
  for (const [index, line] of footer.entries()) {
    cover.drawText(fit(line, index === 0 ? bold : regular, 9, width - margin * 2), {
      x: margin, y: fy, size: 9, font: index === 0 ? bold : regular, color: index === 0 ? INK : MUTED,
    })
    fy -= 14
  }
  cover.drawLine({ start: { x: margin, y: 128 }, end: { x: width - margin, y: 128 }, thickness: 0.5, color: LINE })

  // --- Laboratory pages, unchanged --------------------------------------
  const pages = await merged.copyPages(source, source.getPageIndices())
  for (const page of pages) merged.addPage(page)

  merged.setTitle(`${details.brandName} report ${details.reference}`)
  merged.setSubject(`Patient report for booking ${details.reference}`)
  merged.setAuthor(details.brandName)
  merged.setProducer(`${details.brandName} · ${details.city ?? ''}`.trim())
  merged.setCreationDate(new Date())

  const bytes = await merged.save()
  return { bytes, branded: true }
}
