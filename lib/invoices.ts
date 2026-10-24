import { one } from '@/lib/db'
import { formatINR } from '@/lib/format'

/**
 * The invoice identity shared by the PDF route and the report's WhatsApp
 * message. The invoice number is the booking reference, so a patient holding
 * either document can quote one number.
 */
export interface InvoiceSummary {
  number: string
  totalPaise: number
  totalFormatted: string
}

export async function invoiceSummary(bookingId: string): Promise<InvoiceSummary | null> {
  const row = await one<{ reference: string; total_paise: number | string }>(
    'SELECT reference, total_paise FROM bookings WHERE id = $1',
    [bookingId],
  )
  if (!row) return null
  const totalPaise = Number(row.total_paise)
  return { number: row.reference, totalPaise, totalFormatted: formatINR(totalPaise) }
}
