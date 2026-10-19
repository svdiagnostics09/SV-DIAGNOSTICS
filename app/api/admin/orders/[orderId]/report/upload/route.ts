import { NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { publish } from '@/lib/realtime'
import { addActivity, attachReportPdf, getOrder, getSetting, removeReportPdf, whatsappLink } from '@/lib/store'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

/** Real upload: the PDF the patient receives is the file staff chose here. */
export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const { orderId } = await params
  const order = await getOrder(orderId)
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a PDF file to upload.' }, { status: 400 })

  if (file.size === 0) return NextResponse.json({ error: 'That file is empty.' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'PDF must be under 10 MB.' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  // Verify it is really a PDF, not just something renamed .pdf
  if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
    return NextResponse.json({ error: 'That file is not a valid PDF.' }, { status: 400 })
  }

  const notes = String(form?.get('notes') ?? '').slice(0, 500)
  await attachReportPdf(order.order_id, buffer, { filename: file.name.slice(0, 120), notes })
  await addActivity('report', `Report uploaded for ${order.patient_name} · ${order.order_id}`)
  publish('orders')
  publish('activity')

  const origin = new URL(request.url).origin
  const message = `Hello ${order.patient_name}, your ${order.test_name} report from ${await getSetting('brand_name', 'SV Diagnostics')} is ready.\n\nOrder ID: ${order.order_id}\nDownload: ${origin}/report/${order.order_id}\n\nThank you.`

  return NextResponse.json({
    ok: true,
    orderId: order.order_id,
    filename: file.name,
    bytes: buffer.length,
    whatsappUrl: order.phone ? whatsappLink(order.phone, message) : null,
  })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  if (!await getSessionFromRequest(request)) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const { orderId } = await params
  const order = await getOrder(orderId)
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  await removeReportPdf(order.order_id)
  publish('orders')
  return NextResponse.json({ ok: true })
}
