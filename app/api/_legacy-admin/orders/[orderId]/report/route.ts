import { NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { publish } from '@/lib/realtime'
import { addActivity, attachReportPdf, getOrder, getSetting, whatsappLink } from '@/lib/store'
import { buildReportPdf } from '@/lib/report'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Admin: generate and attach the PDF report for an order. */
export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  if (!await getSessionFromRequest(request)) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const { orderId } = await params
  const body = await request.json().catch(() => ({}))
  const order = await getOrder(orderId)
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const origin = new URL(request.url).origin
  // Never silently replace a real lab report that staff uploaded.
  if (order.report_uploaded_at && !body.replaceUploaded) {
    return NextResponse.json({ error: 'A staff-uploaded report already exists. Remove it first or confirm replacement.' }, { status: 409 })
  }
  const pdf = await buildReportPdf({
    order,
    brandName: await getSetting('brand_name', 'SV Diagnostics'),
    labPhone: await getSetting('lab_phone'),
    logoDataUrl: await getSetting('logo_data_url'),
    notes: typeof body?.notes === 'string' ? body.notes.slice(0, 500) : undefined,
    verifyUrl: `${origin}/report/${order.order_id}`,
  })

  await attachReportPdf(order.order_id, pdf, { filename: `AUTO-${order.order_id}.pdf`, notes: 'Auto-generated summary (not a lab-issued report)' })
  await addActivity('report', `Report issued for ${order.patient_name} · ${order.order_id}`)
  publish('orders')
  publish('activity')

  const message = `Hello ${order.patient_name}, your ${order.test_name} report from ${await getSetting('brand_name', 'SV Diagnostics')} is ready.\n\nOrder ID: ${order.order_id}\nDownload: ${origin}/report/${order.order_id}\n\nThank you.`
  return NextResponse.json({
    ok: true,
    orderId: order.order_id,
    bytes: pdf.length,
    whatsappUrl: order.phone ? whatsappLink(order.phone, message) : null,
  })
}

export async function GET(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params
  const order = await getOrder(orderId)
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  return NextResponse.json({
    orderId: order.order_id,
    patientName: order.patient_name,
    testName: order.test_name,
    status: order.status,
    hasReport: order.report_ready_at !== null,
    reportReadyAt: order.report_ready_at,
    whatsappSentAt: order.whatsapp_sent_at,
  })
}
