import { revalidatePath } from 'next/cache'
import { z, ZodError } from 'zod'
import { guard, jsonError } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { one, sql } from '@/lib/db'
import { firstIssue } from '@/lib/validation'
import { getSettings } from '@/lib/settings'
import { sendWhatsappDocument, whatsappConfigured, whatsappRecipient } from '@/lib/notify'
import { hasLogo, signedBrandUrl } from '@/lib/brand-assets'
import { buildBrandedReport } from '@/lib/report-pdf'
import {
  MAX_PDF_BYTES,
  downloadById,
  liveReport,
  looksLikePdf,
  pdfHeaders,
  recordDelivery,
  reportDetailForBooking,
  safePdfName,
  saveReport,
} from '@/lib/reports'

export const dynamic = 'force-dynamic'
/** Uploading a 20 MB PDF needs headroom beyond the platform default. */
export const maxDuration = 60

/**
 * Patient reports — everything an administrator needs to hand a PDF to a patient
 * on WhatsApp.
 *
 *   GET    ?view=list&q=…             bookings with their current report + last delivery
 *   GET    ?bookingId=…               report history and every WhatsApp attempt
 *   GET    ?file=…                    the stored PDF (admin session required)
 *   POST   ?action=upload             multipart: bookingId + file (application/pdf)
 *   POST   ?action=send               JSON: { bookingId, phone? } → WhatsApp Cloud API
 *
 * There is no patient download link: a report leaves the laboratory only when an
 * administrator presses Send, and every attempt is recorded.
 */

export async function GET(request: Request) {
  try {
    await guard(request)
    const url = new URL(request.url)

    const fileId = url.searchParams.get('file')
    if (fileId) {
      if (!z.string().uuid().safeParse(fileId).success) return Response.json({ error: 'Unknown file.' }, { status: 400 })
      const file = await downloadById(fileId)
      if (!file) return Response.json({ error: 'That report no longer exists.' }, { status: 404 })
      return new Response(new Uint8Array(file.content), { headers: pdfHeaders(file.fileName, file.mimeType) })
    }

    // The exact file the patient will receive (branded cover + laboratory pages).
    const previewId = url.searchParams.get('brandedPreview')
    if (previewId) {
      if (!z.string().uuid().safeParse(previewId).success) return Response.json({ error: 'Unknown booking.' }, { status: 400 })
      const settings = await getSettings()
      const booking = await one<{ reference: string; patient_name: string; phone: string; appointment_date: string; patient_age: number | null; patient_gender: string | null }>(
        'SELECT reference, patient_name, phone, appointment_date::text AS appointment_date, patient_age, patient_gender FROM bookings WHERE id = $1',
        [previewId],
      )
      if (!booking) return Response.json({ error: 'Booking not found.' }, { status: 404 })
      const report = await liveReport(previewId)
      if (!report) return Response.json({ error: 'Upload the report PDF first.' }, { status: 409 })
      const file = await downloadById(report.id)
      if (!file) return Response.json({ error: 'That report file could not be read.' }, { status: 404 })
      const { bytes } = await buildBrandedReport(new Uint8Array(file.content), {
        brandName: settings.brandName,
        patientName: booking.patient_name,
        reference: booking.reference,
        appointmentDate: booking.appointment_date,
        patientAge: booking.patient_age,
        patientGender: booking.patient_gender,
        phone: booking.phone,
        supportPhone: settings.supportPhone,
        city: settings.city,
        fileName: report.file_name,
      })
      return new Response(new Uint8Array(bytes), {
        headers: { ...pdfHeaders(`preview-${report.file_name}`, 'application/pdf'), 'Content-Disposition': `inline; filename="${report.file_name}"` },
      })
    }

    const bookingId = url.searchParams.get('bookingId')
    if (bookingId) {
      if (!z.string().uuid().safeParse(bookingId).success) return Response.json({ error: 'Unknown booking.' }, { status: 400 })
      const booking = await one<{ id: string; reference: string; phone: string }>(`SELECT id, reference, phone FROM bookings WHERE id = $1`, [bookingId])
      if (!booking) return Response.json({ error: 'Booking not found.' }, { status: 404 })
      return Response.json(
        { ...(await reportDetailForBooking(bookingId)), reference: booking.reference, bookedPhone: booking.phone, whatsappConfigured: whatsappConfigured() },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const q = (url.searchParams.get('q') ?? '').trim()
    const filter = url.searchParams.get('filter') ?? 'all' // all | pending | sent
    const values: unknown[] = []
    const where: string[] = []
    if (q) {
      values.push(`%${q.toLowerCase()}%`)
      where.push(`(lower(b.reference) LIKE $${values.length} OR lower(b.patient_name) LIKE $${values.length} OR b.phone LIKE $${values.length})`)
    }
    const having =
      filter === 'pending' ? 'HAVING (SELECT count(*) FROM report_deliveries d WHERE d.report_id = r.id AND d.status = \'sent\') = 0'
        : filter === 'sent' ? 'HAVING (SELECT count(*) FROM report_deliveries d WHERE d.report_id = r.id AND d.status = \'sent\') > 0'
          : ''
    const rows = await sql<Record<string, unknown>>(
      `SELECT b.id, b.reference, b.patient_name, b.phone, b.appointment_date::text AS appointment_date, b.status, b.method,
              r.id AS report_id, r.file_name, r.size_bytes, r.created_at AS report_created_at, r.downloads,
              (SELECT json_build_object('status', d.status, 'createdAt', d.created_at, 'recipient', d.recipient)
                 FROM report_deliveries d WHERE d.report_id = r.id ORDER BY d.created_at DESC LIMIT 1) AS last_delivery,
              (SELECT count(*) FROM patient_reports p WHERE p.booking_id = b.id)::int AS versions
         FROM bookings b
         LEFT JOIN patient_reports r ON r.booking_id = b.id AND r.revoked_at IS NULL
         WHERE b.status <> 'cancelled' ${where.length ? `AND ${where.join(' AND ')}` : ''}
         ${having}
         ORDER BY COALESCE(r.created_at, b.created_at) DESC
         LIMIT 300`,
      values,
    )

    const counts = await one<Record<string, number>>(
      `SELECT
         (SELECT count(*) FROM patient_reports WHERE revoked_at IS NULL)::int AS uploaded,
         (SELECT count(DISTINCT rd.report_id) FROM report_deliveries rd JOIN patient_reports r ON r.id = rd.report_id AND r.revoked_at IS NULL WHERE rd.status = 'sent')::int AS delivered,
         (SELECT count(*) FROM bookings WHERE status <> 'cancelled' AND status IN ('report_ready','completed'))::int AS ready_bookings`,
    )

    return Response.json({
      reports: rows.map((row) => ({
        bookingId: String(row.id),
        reference: String(row.reference),
        patientName: String(row.patient_name),
        phone: String(row.phone),
        appointmentDate: String(row.appointment_date).slice(0, 10),
        bookingStatus: String(row.status),
        method: String(row.method),
        report: row.report_id
          ? {
            id: String(row.report_id),
            fileName: String(row.file_name),
            sizeBytes: Number(row.size_bytes),
            createdAt: new Date(row.report_created_at as string).toISOString(),
            lastDelivery: row.last_delivery as { status: string; createdAt: string; recipient: string } | null,
          }
          : null,
        versions: Number(row.versions ?? 0),
      })),
      counts: counts ?? { uploaded: 0, delivered: 0, ready_bookings: 0 },
      whatsapp: {
        configured: whatsappConfigured(),
        templates: { patient_report: '2 parameters: patient name, reference. The PDF is attached as the header document (create the template with a Document header).' },
      },
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: firstIssue(error) }, { status: 400 })
    return jsonError(error)
  }
}

/** Upload (or replace) the report for a booking. The PDF is sniffed, never trusted. */
export async function POST(request: Request) {
  try {
    const admin = await guard(request, { mutation: true })
    const action = new URL(request.url).searchParams.get('action')

    if (action === 'upload') {
      const form = await request.formData().catch(() => null)
      const bookingId = form?.get('bookingId')
      const file = form?.get('file')
      if (typeof bookingId !== 'string' || !z.string().uuid().safeParse(bookingId).success || !(file instanceof File)) {
        return Response.json({ error: 'Choose a booking and a PDF file.' }, { status: 400 })
      }
      if (file.size === 0) return Response.json({ error: 'That file is empty.' }, { status: 400 })
      if (file.size > MAX_PDF_BYTES) return Response.json({ error: 'That file is larger than 20 MB. Compress or split the report and try again.' }, { status: 413 })

      const booking = await one<{ reference: string; status: string }>('SELECT reference, status FROM bookings WHERE id = $1', [bookingId])
      if (!booking) return Response.json({ error: 'Booking not found.' }, { status: 404 })
      if (booking.status === 'cancelled') return Response.json({ error: 'This booking was cancelled — a report cannot be attached.' }, { status: 409 })

      const bytes = new Uint8Array(await file.arrayBuffer())
      if (!looksLikePdf(bytes)) return Response.json({ error: 'Only PDF reports are accepted. Export the report as a PDF and upload that file.' }, { status: 400 })

      const fileName = safePdfName(file.name, booking.reference)
      const saved = await saveReport({ bookingId, fileName, bytes, actorId: admin.id, actorEmail: admin.email })
      await audit({ actor: admin, action: 'report.upload', entity: 'patient_reports', entityId: saved.id, detail: { bookingId, reference: booking.reference, fileName, sizeBytes: bytes.length }, request })
      revalidatePath('/admin')
      return Response.json({ id: saved.id, fileName, sizeBytes: bytes.length }, { status: 201 })
    }

    // Sends the branded report through the WhatsApp Cloud API in one click.
    if (action === 'send') {
      const settings = await getSettings()
      if (!settings.whatsappReportsEnabled) return Response.json({ error: 'WhatsApp report sending is switched off in Business settings.' }, { status: 409 })
      if (!whatsappConfigured()) {
        return Response.json({ error: 'WhatsApp API is not configured on the server. Use “Open WhatsApp” to send manually, or add WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID.' }, { status: 409 })
      }
      const body = z.object({
        bookingId: z.string().uuid(),
        phone: z.string().trim().max(20).optional(),
      }).parse(await request.json().catch(() => null))

      const booking = await one<{ reference: string; patient_name: string; phone: string; appointment_date: string; patient_age: number | null; patient_gender: string | null }>(
        'SELECT reference, patient_name, phone, appointment_date::text AS appointment_date, patient_age, patient_gender FROM bookings WHERE id = $1',
        [body.bookingId],
      )
      if (!booking) return Response.json({ error: 'Booking not found.' }, { status: 404 })
      const report = await liveReport(body.bookingId)
      if (!report) return Response.json({ error: 'Upload the report PDF first, then send it.' }, { status: 409 })
      const phone = (body.phone ?? '').trim() || booking.phone
      if (!whatsappRecipient(phone)) return Response.json({ error: 'Enter a mobile number with country code, or fix the number on the booking.' }, { status: 400 })

      const file = await downloadById(report.id)
      if (!file) return Response.json({ error: 'The report file could not be read. Upload it again.' }, { status: 409 })

      // The logo is drawn into the PDF cover; WhatsApp shows the document, not
      // our thumbnail, so branding has to travel inside the file itself.
      const { bytes, branded } = await buildBrandedReport(new Uint8Array(file.content), {
        brandName: settings.brandName,
        patientName: booking.patient_name,
        reference: booking.reference,
        appointmentDate: booking.appointment_date,
        patientAge: booking.patient_age,
        patientGender: booking.patient_gender,
        phone: booking.phone,
        supportPhone: settings.supportPhone,
        city: settings.city,
        fileName: report.file_name,
      })

      const outcome = await sendWhatsappDocument({
        recipient: phone,
        patientName: booking.patient_name,
        reference: booking.reference,
        fileName: report.file_name,
        bytes,
        templateName: settings.whatsappTemplateName,
        templateLanguage: settings.whatsappTemplateLanguage,
        logoUrl: await hasLogo() ? signedBrandUrl('logo', new URL(request.url).origin) : null,
      })
      await recordDelivery({
        reportId: report.id,
        bookingId: body.bookingId,
        recipient: outcome.recipient || phone,
        status: outcome.status === 'sent' ? 'sent' : 'failed',
        detail: `${outcome.detail}${branded ? ' Branded PDF cover with logo attached.' : ' Report sent as uploaded (no PNG/JPG logo available for a cover).'}`,
        providerMessageId: outcome.providerMessageId,
        actorEmail: admin.email,
      })
      await audit({ actor: admin, action: `report.whatsapp_${outcome.status}`, entity: 'patient_reports', entityId: report.id, detail: { reference: booking.reference, recipient: outcome.recipient, branded }, request })

      if (outcome.status === 'failed') return Response.json({ error: outcome.detail }, { status: 502 })
      return Response.json({ status: 'sent', detail: outcome.detail, recipient: outcome.recipient, branded, providerMessageId: outcome.providerMessageId })
    }

    // Records that the administrator opened the patient's WhatsApp chat. The
    // message itself is sent by hand, so this is an audit trail — never a claim
    // that WhatsApp delivered anything.
    if (action === 'opened') {
      const body = z.object({ bookingId: z.string().uuid() }).parse(await request.json().catch(() => null))
      const report = await liveReport(body.bookingId)
      if (!report) return Response.json({ error: 'Upload the report PDF first.' }, { status: 409 })
      const booking = await one<{ reference: string; phone: string }>('SELECT reference, phone FROM bookings WHERE id = $1', [body.bookingId])
      if (!booking) return Response.json({ error: 'Booking not found.' }, { status: 404 })
      await recordDelivery({
        reportId: report.id,
        bookingId: body.bookingId,
        recipient: booking.phone,
        status: 'sent',
        detail: `Opened WhatsApp chat for ${booking.phone}; the administrator attached ${report.file_name} and sent it manually.`,
        providerMessageId: null,
        actorEmail: admin.email,
      })
      await audit({ actor: admin, action: 'report.whatsapp_opened', entity: 'patient_reports', entityId: report.id, detail: { reference: booking.reference, recipient: booking.phone }, request })
      return Response.json({ ok: true })
    }

    return Response.json({ error: 'Unknown action.' }, { status: 400 })
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: firstIssue(error) }, { status: 400 })
    return jsonError(error)
  }
}
