import { NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { publish } from '@/lib/realtime'
import { addActivity, advanceOrder, getOrder, markWhatsappSent } from '@/lib/store'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Record that the WhatsApp report message was handed off (wa.me deep link). */
export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  if (!await getSessionFromRequest(request)) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const { orderId } = await params
  const body = await request.json().catch(() => ({}))
  const order = await getOrder(orderId)
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  if (body?.action === 'advance') {
    const updated = await advanceOrder(order.order_id)
    publish('orders')
    return NextResponse.json(updated)
  }

  await markWhatsappSent(order.order_id)
  await addActivity('report', `Report sent on WhatsApp to ${order.patient_name}`)
  publish('orders')
  publish('activity')
  return NextResponse.json({ ok: true })
}
