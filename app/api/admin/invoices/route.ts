import { z, ZodError } from 'zod'
import { guard, jsonError } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { one, sql } from '@/lib/db'
import { formatDate, formatINR } from '@/lib/format'
import { firstIssue } from '@/lib/validation'
import { getSettings } from '@/lib/settings'
import { sendWhatsappDocument, whatsappConfigured, whatsappRecipient } from '@/lib/notify'
import { buildInvoice, invoiceFileName, type InvoiceLine } from '@/lib/invoice-pdf'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Invoices.
 *
 *   GET  ?bookingId=…                 the invoice PDF (admin session required)
 *   POST ?action=send  { bookingId }  generate and send it to the patient on WhatsApp
 *   POST ?action=link  { bookingId }  the invoice PDF plus a pre-filled wa.me chat
 *
 * The invoice is built from the booking snapshot — line items, discount and
 * collection fee as they were at booking time — so it never drifts when the
 * catalogue price changes.
 */

const bookingSchema = z.object({ bookingId: z.string().uuid() })

interface BookingRow extends Record<string, unknown> {
  reference: string
  patient_name: string
  patient_age: number | null
  patient_gender: string | null
  phone: string
  email: string | null
  method: 'home' | 'lab'
  address_line: string
  address_area: string
  pincode: string
  appointment_date: string
  slot_label: string
  subtotal_paise: number
  discount_paise: number
  collection_fee_paise: number
  total_paise: number
  payment_method: string
  payment_status: string
  created_at: string
  location_name: string | null
}

const PAYMENT_LABELS: Record<string, string> = {
  online: 'Paid online',
  pay_lab: 'Pay at lab',
  pay_home: 'Pay on collection',
}

const PAYMENT_STATUS: Record<string, string> = {
  pending: 'Pending',
  paid: 'Paid',
  failed: 'Failed',
  refunded: 'Refunded',
  cancelled: 'Cancelled',
}

/** Build the PDF for one booking, or return why it could not be built. */
async function invoiceFor(bookingId: string) {
  const booking = await one<BookingRow>(
    `SELECT b.reference, b.patient_name, b.patient_age, b.patient_gender, b.phone, b.email,
            b.method, b.address_line, b.address_area, b.pincode, b.appointment_date::text AS appointment_date,
            b.slot_label, b.subtotal_paise, b.discount_paise, b.collection_fee_paise, b.total_paise,
            b.payment_method, b.payment_status, b.created_at, l.name AS location_name
       FROM bookings b
       LEFT JOIN locations l ON l.id = b.location_id
      WHERE b.id = $1`,
    [bookingId],
  )
  if (!booking) return { error: 'Booking not found.', status: 404 as const }

  const items = await sql<Record<string, unknown>>(
    'SELECT name_snapshot, quantity, unit_price_paise, list_price_paise FROM booking_items WHERE booking_id = $1 ORDER BY id',
    [bookingId],
  )
  const lines: InvoiceLine[] = items.map((item) => ({
    name: String(item.name_snapshot),
    quantity: Number(item.quantity),
    unitPricePaise: Number(item.unit_price_paise),
    listPricePaise: Number(item.list_price_paise),
  }))

  if (lines.length === 0) return { error: 'This booking has no items to invoice.', status: 409 as const }

  const settings = await getSettings()
  const bytes = await buildInvoice({
    brandName: settings.brandName,
    tagline: settings.tagline,
    address: settings.address,
    supportPhone: settings.supportPhone,
    supportEmail: settings.supportEmail,
    city: settings.city,
    state: settings.state,
    gstin: settings.gstin,

    invoiceNumber: booking.reference,
    invoiceDate: formatDate(booking.created_at),

    reference: booking.reference,
    patientName: booking.patient_name,
    patientAge: booking.patient_age,
    patientGender: booking.patient_gender,
    phone: booking.phone,
    email: booking.email,

    method: booking.method,
    locationName: booking.location_name,
    addressLine: booking.address_line,
    addressArea: booking.address_area,
    pincode: booking.pincode,
    appointmentDate: formatDate(booking.appointment_date),
    slotLabel: booking.slot_label,

    lines,
    subtotalPaise: Number(booking.subtotal_paise),
    discountPaise: Number(booking.discount_paise),
    collectionFeePaise: Number(booking.collection_fee_paise),
    totalPaise: Number(booking.total_paise),
    paymentMethod: PAYMENT_LABELS[booking.payment_method] ?? String(booking.payment_method),
    paymentStatus: PAYMENT_STATUS[booking.payment_status] ?? String(booking.payment_status),

    taxRatePercent: settings.invoiceTaxPercent,
    notes: settings.invoiceNotes,
  })

  return { booking, bytes, fileName: invoiceFileName(booking.reference) }
}

/** GET ?bookingId= — the invoice PDF. */
export async function GET(request: Request) {
  try {
    await guard(request)
    const bookingId = new URL(request.url).searchParams.get('bookingId')
    if (!z.string().uuid().safeParse(bookingId).success) return Response.json({ error: 'Unknown booking.' }, { status: 400 })

    const result = await invoiceFor(bookingId as string)
    if ('error' in result) return Response.json({ error: result.error }, { status: result.status })

    return new Response(new Uint8Array(result.bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${result.fileName}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return jsonError(error)
  }
}

export async function POST(request: Request) {
  try {
    const admin = await guard(request, { mutation: true })
    const action = new URL(request.url).searchParams.get('action')
    const body = bookingSchema.parse(await request.json().catch(() => null))

    const result = await invoiceFor(body.bookingId)
    if ('error' in result) return Response.json({ error: result.error }, { status: result.status })
    const { booking, bytes, fileName } = result
    const settings = await getSettings()
    const amount = formatINR(Number(booking.total_paise))

    // WhatsApp Cloud API: upload the PDF and send it as a document.
    if (action === 'send') {
      if (!whatsappConfigured()) {
        return Response.json(
          { error: 'WhatsApp API is not configured. Set WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID, or use “Open WhatsApp” to send it by hand.' },
          { status: 409 },
        )
      }
      const outcome = await sendWhatsappDocument({
        recipient: booking.phone,
        patientName: booking.patient_name,
        reference: booking.reference,
        fileName,
        bytes,
        templateName: '',
        templateLanguage: 'en',
        logoUrl: null,
        patientLink: null,
        linkMessage: null,
        caption: `Hello ${booking.patient_name}, here is your invoice ${booking.reference} for ${amount} from ${settings.brandName}.`,
      })

      await sql(
        `INSERT INTO notifications (booking_id, channel, recipient, template, status, detail, sent_at) VALUES ($1,'whatsapp',$2,'booking_invoice',$3,$4,$5)`,
        [body.bookingId, outcome.recipient || booking.phone, outcome.status, outcome.detail, outcome.status === 'sent' ? new Date() : null],
      )
      await audit({ actor: admin, action: 'invoice.whatsapp_sent', entity: 'bookings', entityId: body.bookingId, detail: { reference: booking.reference, status: outcome.status }, request })

      if (outcome.status !== 'sent') return Response.json({ error: outcome.detail }, { status: 502 })
      return Response.json({ ok: true, detail: outcome.detail, recipient: outcome.recipient })
    }

    // Manual flow: return the PDF as a data-free one-time download URL plus a
    // wa.me link, so a staff member can attach it from their own phone.
    if (action === 'link') {
      const recipient = whatsappRecipient(booking.phone)
      if (!recipient) return Response.json({ error: 'The booking has no usable mobile number for WhatsApp.' }, { status: 400 })
      const message = `Hello ${booking.patient_name}, here is your invoice ${booking.reference} for ${amount} from ${settings.brandName}.`
      await audit({ actor: admin, action: 'invoice.whatsapp_opened', entity: 'bookings', entityId: body.bookingId, detail: { reference: booking.reference }, request })
      return Response.json({
        waUrl: `https://wa.me/${recipient}?text=${encodeURIComponent(message)}`,
        message,
        fileName,
        configured: whatsappConfigured(),
      })
    }

    return Response.json({ error: 'Unknown action.' }, { status: 400 })
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: firstIssue(error) }, { status: 400 })
    return jsonError(error)
  }
}
