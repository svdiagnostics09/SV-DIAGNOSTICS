import { formatDate } from '@/lib/format'

/**
 * Fill the staff-configured WhatsApp message without interpreting arbitrary
 * input. A report link is always present, even if a staff member removes the
 * {link} placeholder while editing the template.
 */
export function renderWhatsappReportMessage(input: {
  template: string
  patientName: string
  reference: string
  reportUrl: string
  expiresAt: string
  brandName: string
  /** When set, the invoice is mentioned alongside the report. */
  invoice?: { number: string; totalFormatted: string } | null
}) {
  const values: Record<string, string> = {
    name: input.patientName.trim() || 'there',
    reference: input.reference,
    link: input.reportUrl,
    expiresat: formatDate(input.expiresAt),
    brand: input.brandName,
  }
  const source = input.template.trim()
  const message = source.replace(/\{(name|reference|link|expiresAt|brand)\}/gi, (_, key: string) => values[key.toLowerCase()] ?? _).trim()

  const invoiceLine = input.invoice
    ? `\n\nInvoice ${input.invoice.number} for ${input.invoice.totalFormatted} is available in your booking page under “My bookings”.`
    : ''

  return /\{link\}/i.test(source)
    ? `${message}${invoiceLine}`
    : `${message}${invoiceLine}\n\nView or download your PDF report: ${input.reportUrl}`
}
