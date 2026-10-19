import { getOrder } from '@/lib/store'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Public order lookup — never returns the PDF, only its availability. */
export async function GET(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params
  const order = await getOrder(orderId)
  if (!order) return Response.json({ error: 'No order found for that ID.' }, { status: 404 })

  return Response.json({
    orderId: order.order_id,
    patientName: order.patient_name,
    testName: order.test_name,
    type: order.type,
    slot: order.slot,
    amount: order.amount,
    status: order.status,
    createdAt: order.created_at,
    hasReport: order.report_ready_at !== null,
  })
}
