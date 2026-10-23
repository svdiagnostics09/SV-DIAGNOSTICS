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

  return /\{link\}/i.test(source)
    ? message
    : `${message}\n\nView or download your PDF report: ${input.reportUrl}`
}
