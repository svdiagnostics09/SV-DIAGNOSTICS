import { revalidatePath } from 'next/cache'
import { z, ZodError } from 'zod'
import { guard, jsonError } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { one, sql } from '@/lib/db'
import { firstIssue } from '@/lib/validation'
import { getSettings } from '@/lib/settings'
import { sendWhatsappReport, whatsappConfigured, whatsappRecipient } from '@/lib/notify'
import {
  MAX_PDF_BYTES,
  downloadById,
  liveReport,
  looksLikePdf,
  pdfHeaders,
  recordDelivery,
  reportDetailForBooking,
  revokeReport,
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
 *   DELETE ?reportId=…&bookingId=…    revoke the live report so old links stop working
 *
 * Nothing is ever sent automatically: an administrator must press Send.
 */

const publicBase = (request: Request) => (process.env.NEXT_PUBLIC_SITE_URL?.trim() || new URL(request.url).origin).replace(/\/$/, '')

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

    const bookingId = url.searchParams.get('bookingId')
    if (bookingId) {
      if (!z.string().uuid().safeParse(bookingId).success) return Response.json({ error: 'Unknown booking.' }, { status: 400 })
      const booking = await one(`SELECT id FROM bookings WHERE id = $1`, [bookingId])
      if (!booking) return Response.json({ error: 'Booking not found.' }, { status: 404 })
      return Response.json(
        { ...(await reportDetailForBooking(bookingId)), whatsappConfigured: whatsappConfigured() },
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
            downloads: Number(row.downloads),
            lastDelivery: row.last_delivery as { status: string; createdAt: string; recipient: string } | null,
          }
          : null,
        versions: Number(row.versions ?? 0),
      })),
      counts: counts ?? { uploaded: 0, delivered: 0, ready_bookings: 0 },
      whatsapp: {
        configured: whatsappConfigured(),
        templates: { patient_report: '3 parameters: patient name, reference, report link' },
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

    if (action === 'send') {
      const settings = await getSettings()
      if (!settings.whatsappReportsEnabled) return Response.json({ error: 'WhatsApp report sending is switched off in Business settings.' }, { status: 409 })
      const body = z.object({
        bookingId: z.string().uuid(),
        phone: z.string().trim().max(20).optional(),
      }).parse(await request.json().catch(() => null))

      const booking = await one<{ reference: string; patient_name: string; phone: string }>('SELECT reference, patient_name, phone FROM bookings WHERE id = $1', [body.bookingId])
      if (!booking) return Response.json({ error: 'Booking not found.' }, { status: 404 })
      const report = await liveReport(body.bookingId)
      if (!report) return Response.json({ error: 'Upload the report PDF first, then send it.' }, { status: 409 })

      const phone = (body.phone ?? '').trim() || booking.phone
      if (!whatsappRecipient(phone)) return Response.json({ error: 'Enter a mobile number with country code, or fix the number on the booking.' }, { status: 400 })

      const link = `${publicBase(request)}/api/reports/download?token=${encodeURIComponent(report.access_token)}`
      const outcome = await sendWhatsappReport({
        recipient: phone,
        patientName: booking.patient_name,
        reference: booking.reference,
        fileName: report.file_name,
        link,
        templateName: settings.whatsappTemplateName,
        templateLanguage: settings.whatsappTemplateLanguage,
        templateParam: settings.whatsappTemplateParam,
      })
      await recordDelivery({
        reportId: report.id,
        bookingId: body.bookingId,
        recipient: outcome.recipient || phone,
        status: outcome.status,
        detail: outcome.detail,
        providerMessageId: outcome.providerMessageId,
        actorEmail: admin.email,
      })
      await audit({ actor: admin, action: `report.whatsapp_${outcome.status}`, entity: 'patient_reports', entityId: report.id, detail: { reference: booking.reference, recipient: outcome.recipient, detail: outcome.detail }, request })

      if (outcome.status === 'failed') return Response.json({ error: `WhatsApp did not accept the message. ${outcome.detail}`, status: outcome.status }, { status: 502 })
      return Response.json({ status: outcome.status, detail: outcome.detail, recipient: outcome.recipient, providerMessageId: outcome.providerMessageId })
    }

    return Response.json({ error: 'Unknown action.' }, { status: 400 })
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: firstIssue(error) }, { status: 400 })
    return jsonError(error)
  }
}

/** Revoke a report so any link already sent on WhatsApp stops resolving. */
export async function DELETE(request: Request) {
  try {
    const admin = await guard(request, { mutation: true })
    const url = new URL(request.url)
    const reportId = url.searchParams.get('reportId')
    const bookingId = url.searchParams.get('bookingId')
    if (!reportId || !bookingId || !z.string().uuid().safeParse(reportId).success || !z.string().uuid().safeParse(bookingId).success) {
      return Response.json({ error: 'Unknown report.' }, { status: 400 })
    }
    const removed = await revokeReport(reportId, bookingId)
    if (!removed.length) return Response.json({ error: 'That report is no longer active.' }, { status: 409 })
    await audit({ actor: admin, action: 'report.revoke', entity: 'patient_reports', entityId: reportId, detail: { bookingId }, request })
    return Response.json({ revoked: true })
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: firstIssue(error) }, { status: 400 })
    return jsonError(error)
  }
}
