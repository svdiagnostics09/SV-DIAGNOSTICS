import { NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { publish } from '@/lib/realtime'
import { addActivity, cancelOrder, getOrder, listOrderEvents, markWhatsappSent, setOrderStatus, setPayment, setStaffNote } from '@/lib/store'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Full detail for one order: fields + timeline. Admin only. */
export async function GET(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  if (!await getSessionFromRequest(request)) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const { orderId } = await params
  const order = await getOrder(orderId)
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  const { report_pdf, ...rest } = order as typeof order & { report_pdf?: Buffer }
  return NextResponse.json({ order: rest, events: await listOrderEvents(order.order_id) })
}

/**
 * Operations actions on a single order.
 * WhatsApp hand-off is refused until a report has actually been uploaded.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  if (!await getSessionFromRequest(request)) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const { orderId } = await params
  const order = await getOrder(orderId)
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const action = String(body.action ?? '')

  if (action === 'whatsapp:sent') {
    // The gate: never tell a patient their report is ready if it isn't.
    if (order.report_ready_at === null) {
      return NextResponse.json({ error: 'Upload the report PDF before sending it to the patient.' }, { status: 409 })
    }
    await markWhatsappSent(order.order_id)
    await addActivity('report', `Report sent on WhatsApp to ${order.patient_name}`)
    publish('orders')
    publish('activity')
    return NextResponse.json({ ok: true })
  }

  if (action === 'note') {
    const note = String(body.note ?? '').slice(0, 1000)
    await setStaffNote(order.order_id, note)
    publish('orders')
    return NextResponse.json({ ok: true })
  }

  if (action === 'payment') {
    const status = ['Paid', 'Pending', 'Refunded'].includes(body.status) ? body.status : 'Pending'
    await setPayment(order.order_id, status, String(body.method ?? '').slice(0, 40))
    publish('orders')
    return NextResponse.json({ ok: true })
  }

  if (action === 'cancel') {
    await cancelOrder(order.order_id, String(body.reason ?? '').slice(0, 200))
    await addActivity('status', `${order.patient_name}'s order was cancelled`)
    publish('orders')
    publish('activity')
    return NextResponse.json({ ok: true })
  }

  if (action === 'status') {
    const allowed = ['Confirmed', 'Agent assigned', 'Sample collected', 'Report ready']
    if (!allowed.includes(body.status)) return NextResponse.json({ error: 'Unknown status.' }, { status: 400 })
    // Moving to "Report ready" requires an uploaded report.
    if (body.status === 'Report ready' && order.report_ready_at === null) {
      return NextResponse.json({ error: 'Upload the report PDF to mark this order ready.' }, { status: 409 })
    }
    await setOrderStatus(order.order_id, body.status)
    publish('orders')
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
}
