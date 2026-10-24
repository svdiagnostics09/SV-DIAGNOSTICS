import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { logoDataUrl } from '@/lib/brand-assets'

/**
 * Branded invoice for a booking.
 *
 * The invoice is generated from the booking snapshot (line items, prices,
 * discount, collection fee), not from the live catalogue, so an invoice sent
 * last month still shows what the patient actually paid.
 *
 * The logo is embedded in the PDF itself — WhatsApp shows the document, not a
 * thumbnail we control, so the brand has to be inside the file.
 */

const INK = rgb(0.04, 0.14, 0.24)      // navy ink
const NAVY = rgb(0.043, 0.145, 0.27)   // --color-forest
const MUTED = rgb(0.35, 0.42, 0.5)
const LINE = rgb(0.86, 0.89, 0.94)
const TINT = rgb(0.953, 0.969, 0.98)

const A4: [number, number] = [595.28, 841.89]
const MARGIN = 48

export interface InvoiceLine {
  name: string
  quantity: number
  /** Final unit price actually charged, in paise. */
  unitPricePaise: number
  /** Struck-through list price, in paise. 0 when there is no discount. */
  listPricePaise: number
}

export interface InvoiceDetails {
  brandName: string
  tagline?: string
  address?: string
  supportPhone?: string
  supportEmail?: string
  city?: string
  state?: string
  invoiceNumber: string
  invoiceDate: string

  reference: string
  patientName: string
  patientAge?: number | null
  patientGender?: string | null
  phone?: string | null
  email?: string | null

  method: 'home' | 'lab'
  locationName?: string | null
  addressLine?: string
  addressArea?: string
  pincode?: string
  appointmentDate: string
  slotLabel: string

  lines: InvoiceLine[]
  subtotalPaise: number
  discountPaise: number
  collectionFeePaise: number
  totalPaise: number
  paymentMethod: string
  paymentStatus: string

  /** Tax rate applied to the taxable value, e.g. 0 for a GST-exempt pathology bill. */
  taxRatePercent: number
  /** GSTIN printed in the header. Comes from Business settings when set. */
  gstin?: string
  notes?: string
}

/** ₹1,234.50 — pdf-lib has no locale formatting, so this is deliberate. */
export function rupees(paise: number) {
  const value = (paise ?? 0) / 100
  const [whole, decimals] = value.toFixed(2).split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `Rs. ${grouped}.${decimals}`
}

/** Keep text inside its column: pdf-lib has no wrapping engine of its own. */
function fit(text: string, font: PDFFont, size: number, maxWidth: number) {
  if (maxWidth <= 0) return ''
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text
  let clipped = text
  while (clipped.length > 1 && font.widthOfTextAtSize(`${clipped}\u2026`, size) > maxWidth) clipped = clipped.slice(0, -1)
  return `${clipped}\u2026`
}

/** Like fit(), but shrinks the type down to `minSize` before clipping. */
function fitShrink(text: string, font: PDFFont, size: number, minSize: number, maxWidth: number) {
  if (maxWidth <= 0) return { text: '', size }
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return { text, size }
  let current = size
  while (current > minSize) {
    current -= 0.25
    if (font.widthOfTextAtSize(text, current) <= maxWidth) return { text, size: current }
  }
  return { text: fit(text, font, minSize, maxWidth), size: minSize }
}

/** Greedy word wrap, capped so a long item name cannot push the table off the page. */
function wrap(text: string, font: PDFFont, size: number, maxWidth: number, maxLines = 2) {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) { current = candidate; continue }
    if (current) lines.push(current)
    current = word
    if (lines.length === maxLines - 1) break
  }
  if (current && lines.length < maxLines) lines.push(current)
  const consumed = lines.join(' ').split(/\s+/).filter(Boolean).length
  if (consumed < words.length && lines.length) lines[lines.length - 1] = fit(`${lines[lines.length - 1]}…`, font, size, maxWidth)
  return lines
}

function label(page: PDFPage, font: PDFFont, text: string, x: number, y: number) {
  page.drawText(text.toUpperCase(), { x, y, size: 7.5, font, color: MUTED })
}

export async function buildInvoice(details: InvoiceDetails): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage(A4)
  const { width, height } = page.getSize()

  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const right = width - MARGIN

  // ---- Header band -------------------------------------------------------
  page.drawRectangle({ x: 0, y: height - 132, width, height: 132, color: TINT })
  page.drawRectangle({ x: 0, y: height - 137, width, height: 5, color: NAVY })

  let logoWidth = 0
  const logo = await logoDataUrl().catch(() => null)
  if (logo) {
    try {
      const embedded = logo.includes('image/png') ? await pdf.embedPng(logo) : await pdf.embedJpg(logo)
      const scale = Math.min(46 / embedded.height, 150 / embedded.width)
      const drawW = embedded.width * scale
      const drawH = embedded.height * scale
      page.drawImage(embedded, { x: MARGIN, y: height - 66, width: drawW, height: drawH })
      logoWidth = drawW
    } catch {
      // A corrupt logo must not block the invoice.
    }
  }

  const brandX = MARGIN + logoWidth + (logoWidth ? 16 : 0)
  page.drawText(fit(details.brandName, bold, 18, width / 2 - brandX), { x: brandX, y: height - 50, size: 18, font: bold, color: NAVY })
  const brandLine = [details.tagline, [details.city, details.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ')
  if (brandLine) page.drawText(fit(brandLine, regular, 9, width / 2 - brandX), { x: brandX, y: height - 65, size: 9, font: regular, color: MUTED })
  if (details.address) page.drawText(fit(details.address, regular, 8.5, width / 2 - brandX), { x: brandX, y: height - 79, size: 8.5, font: regular, color: MUTED })
  const contact = [details.supportPhone, details.supportEmail].filter(Boolean).join('  ·  ')
  if (contact) {
    // The email must stay complete — shrink the line before clipping it.
    const drawn = fitShrink(contact, regular, 8.5, 7, width / 2 - brandX)
    page.drawText(drawn.text, { x: brandX, y: height - 93, size: drawn.size, font: regular, color: MUTED })
  }
  if (details.gstin) page.drawText(`GSTIN ${details.gstin}`, { x: brandX, y: height - 107, size: 8.5, font: regular, color: MUTED })

  // Invoice title, right aligned.
  const title = 'INVOICE'
  page.drawText(title, { x: right - bold.widthOfTextAtSize(title, 22), y: height - 56, size: 22, font: bold, color: NAVY })
  const numberLine = `# ${details.invoiceNumber}`
  page.drawText(numberLine, { x: right - regular.widthOfTextAtSize(numberLine, 9.5), y: height - 74, size: 9.5, font: regular, color: INK })
  const dateLine = details.invoiceDate
  page.drawText(dateLine, { x: right - regular.widthOfTextAtSize(dateLine, 9.5), y: height - 88, size: 9.5, font: regular, color: MUTED })
  const statusLine = `${details.paymentMethod} · ${details.paymentStatus}`
  page.drawText(statusLine, { x: right - regular.widthOfTextAtSize(statusLine, 9), y: height - 102, size: 9, font: bold, color: NAVY })

  // ---- Billed to / collection -------------------------------------------
  let y = height - 172
  const columnWidth = (width - MARGIN * 2 - 24) / 2
  const rightColumnX = MARGIN + columnWidth + 24

  label(page, bold, 'Billed to', MARGIN, y)
  label(page, bold, details.method === 'home' ? 'Home collection' : 'Laboratory visit', rightColumnX, y)
  y -= 14

  const billLines = [
    details.patientName,
    [details.patientAge != null ? `${details.patientAge} yrs` : null, details.patientGender ? details.patientGender[0].toUpperCase() + details.patientGender.slice(1) : null].filter(Boolean).join(' · '),
    details.phone ?? '',
    details.email ?? '',
  ].filter(Boolean)

  const collectionLines = [
    details.appointmentDate,
    details.slotLabel,
    `Booking ref ${details.reference}`,
    details.method === 'home'
      ? [details.addressLine, details.addressArea, details.pincode].filter(Boolean).join(', ')
      : [details.locationName, details.city].filter(Boolean).join(', '),
  ].filter(Boolean)

  const rows = Math.max(billLines.length, collectionLines.length)
  for (let index = 0; index < rows; index += 1) {
    if (billLines[index]) {
      const drawn = index === 0 ? { text: fit(billLines[index], bold, 9.5, columnWidth), size: 9.5 } : fitShrink(billLines[index], regular, 9.5, 7.5, columnWidth)
      page.drawText(drawn.text, { x: MARGIN, y, size: drawn.size, font: index === 0 ? bold : regular, color: index === 0 ? INK : MUTED })
    }
    if (collectionLines[index]) {
      // Addresses and emails should not lose their tail to a "…"; shrink first.
      const drawn = fitShrink(collectionLines[index], regular, 9.5, 7.5, columnWidth)
      page.drawText(drawn.text, { x: rightColumnX, y, size: drawn.size, font: regular, color: MUTED })
    }
    y -= 14
  }

  // ---- Items table -------------------------------------------------------
  y -= 16
  const cols = {
    item: MARGIN,
    qty: right - 330,
    // Rate needs room for both the charged price and the struck list price
    // beneath it ("Rs. 2,499.00" at 7.5pt is ~52pt wide).
    rate: right - 236,
    amount: right - 90,
  }

  page.drawRectangle({ x: MARGIN, y: y - 6, width: width - MARGIN * 2, height: 22, color: TINT })
  label(page, bold, 'Description', cols.item + 8, y)
  label(page, bold, 'Qty', cols.qty, y)
  label(page, bold, 'Rate', cols.rate, y)
  label(page, bold, 'Amount', cols.amount, y)
  y -= 26

  for (const line of details.lines) {
    const nameLines = wrap(line.name, regular, 9.5, cols.qty - cols.item - 20)
    const struck = line.listPricePaise > line.unitPricePaise
    // The row is as tall as its tallest column: the wrapped description, or the
    // rate plus the struck list price beneath it.
    const descriptionHeight = nameLines.length * 12
    const rateHeight = struck ? 24 : 12
    const rowHeight = Math.max(descriptionHeight, rateHeight) + 10
    // Header baseline for this row.
    const rowTop = y
    nameLines.forEach((text, index) => {
      page.drawText(text, { x: cols.item + 8, y: rowTop - index * 12, size: 9.5, font: index === 0 ? bold : regular, color: INK })
    })
    page.drawText(String(line.quantity), { x: cols.qty, y: rowTop, size: 9.5, font: regular, color: INK })
    page.drawText(rupees(line.unitPricePaise), { x: cols.rate, y: rowTop, size: 9.5, font: regular, color: INK })
    if (struck) {
      // List price directly beneath the charged rate, inside the Rate column.
      const struckText = rupees(line.listPricePaise)
      const struckSize = 8
      const struckWidth = regular.widthOfTextAtSize(struckText, struckSize)
      // Drop below the 9.5pt rate line, then strike through the glyph middle
      // (cap height ≈ 0.7em, so half of that above the baseline).
      const struckY = rowTop - 11
      page.drawText(struckText, { x: cols.rate, y: struckY, size: struckSize, font: regular, color: MUTED })
      page.drawLine({ start: { x: cols.rate, y: struckY + 2.8 }, end: { x: cols.rate + struckWidth, y: struckY + 2.8 }, thickness: 0.5, color: MUTED })
    }
    page.drawText(rupees(line.unitPricePaise * line.quantity), { x: cols.amount, y: rowTop, size: 9.5, font: bold, color: INK })

    // Advance past the row, then draw the divider in the gap below it.
    y = rowTop - rowHeight
    page.drawLine({ start: { x: MARGIN, y: y + 4 }, end: { x: right, y: y + 4 }, thickness: 0.5, color: LINE })
    y -= 8
  }

  // ---- Totals ------------------------------------------------------------
  // Labels share one left edge; every amount right-aligns to the page edge, so
  // the figures and the total line up as a column instead of a ragged edge.
  //
  // These follow the stored booking model in lib/booking.ts:
  //   subtotalPaise = sum(list price × qty)   ← the pre-discount figure
  //   discountPaise = subtotal − net
  //   totalPaise    = net + collection fee
  // so the column reads: Subtotal − Discount (+ Home fee) = Total.
  const totalsLabelX = cols.rate - 40
  const amountRight = (text: string, font: typeof regular, size: number) => right - font.widthOfTextAtSize(text, size)

  const isHome = details.method === 'home' && details.collectionFeePaise > 0
  const hasDiscount = details.discountPaise > 0
  if (hasDiscount || isHome) {
    page.drawText('Subtotal', { x: totalsLabelX, y, size: 9, font: regular, color: MUTED })
    const amount = rupees(details.subtotalPaise)
    page.drawText(amount, { x: amountRight(amount, regular, 9.5), y, size: 9.5, font: regular, color: INK })
    y -= 16
  }
  if (hasDiscount) {
    page.drawText('Discount', { x: totalsLabelX, y, size: 9, font: regular, color: MUTED })
    const amount = `- ${rupees(details.discountPaise)}`
    page.drawText(amount, { x: amountRight(amount, regular, 9.5), y, size: 9.5, font: regular, color: INK })
    y -= 16
  }
  if (isHome) {
    page.drawText('Home collection fee', { x: totalsLabelX, y, size: 9, font: regular, color: MUTED })
    const amount = rupees(details.collectionFeePaise)
    page.drawText(amount, { x: amountRight(amount, regular, 9.5), y, size: 9.5, font: regular, color: INK })
    y -= 16
  }

  const taxable = Math.max(0, details.totalPaise)
  const taxPaise = Math.round(taxable * (details.taxRatePercent / 100))
  if (details.taxRatePercent > 0) {
    page.drawText(`Tax (${details.taxRatePercent}%)`, { x: totalsLabelX, y, size: 9, font: regular, color: MUTED })
    const taxAmount = rupees(taxPaise)
    page.drawText(taxAmount, { x: amountRight(taxAmount, regular, 9.5), y, size: 9.5, font: regular, color: INK })
    y -= 16
  }

  const payable = Math.max(details.totalPaise, taxable + taxPaise)
  y -= 4
  page.drawLine({ start: { x: totalsLabelX, y: y + 10 }, end: { x: right, y: y + 10 }, thickness: 0.8, color: LINE })
  page.drawText('Total payable', { x: totalsLabelX, y: y - 8, size: 10.5, font: bold, color: INK })
  const totalText = rupees(payable)
  page.drawText(totalText, { x: amountRight(totalText, bold, 15), y: y - 10, size: 15, font: bold, color: NAVY })

  // ---- Footer ------------------------------------------------------------
  const footer = [
    details.notes?.trim() || 'This is a computer-generated invoice. Prices are those agreed at the time of booking.',
    'This invoice covers the diagnostic services listed above. It is not a medical report and gives no medical advice.',
    details.supportPhone ? `Questions about this invoice? Call ${details.supportPhone}.` : 'Questions about this invoice? Quote the booking reference above.',
  ]

  let footerY = 96
  page.drawLine({ start: { x: MARGIN, y: footerY + 14 }, end: { x: right, y: footerY + 14 }, thickness: 0.5, color: LINE })
  for (const [index, text] of footer.entries()) {
    for (const lineText of wrap(text, index === 0 ? regular : regular, 8, width - MARGIN * 2, 2)) {
      page.drawText(lineText, { x: MARGIN, y: footerY, size: 8, font: regular, color: MUTED })
      footerY -= 11
    }
    if (index === 0) footerY -= 3
  }

  pdf.setTitle(`${details.brandName} invoice ${details.invoiceNumber}`)
  pdf.setSubject(`Invoice for booking ${details.reference}`)
  pdf.setAuthor(details.brandName)
  pdf.setCreator(details.brandName)
  pdf.setCreationDate(new Date())

  return pdf.save()
}

/** Stable, WhatsApp-friendly file name. */
export function invoiceFileName(reference: string) {
  const safe = reference.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 40) || 'booking'
  return `Invoice-${safe}.pdf`
}
