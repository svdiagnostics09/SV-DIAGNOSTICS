import { getOrder, getReportPdf } from '@/lib/store'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Public report download, keyed by order ID (e.g. SV-2026-AB12CD).
 * Knowing the order ID is the credential here — the same model as a lab slip.
 */
export async function GET(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params
  const order = await getOrder(orderId)
  if (!order) {
    return Response.json({ error: 'No order found for that ID.' }, { status: 404 })
  }

  const report = await getReportPdf(order.order_id)
  if (!report) {
    return Response.json({
      error: 'Your report is not ready yet.',
      status: order.status,
      orderId: order.order_id,
    }, { status: 409 })
  }

  // ?view=1 renders in the browser (staff preview); default forces a download.
  const disposition = new URL(request.url).searchParams.get('view') === '1' ? 'inline' : 'attachment'
  const filename = order.report_filename && order.report_filename.toLowerCase().endsWith('.pdf')
    ? order.report_filename.replace(/["\\]/g, '')
    : `${order.order_id}-report.pdf`

  return new Response(new Uint8Array(report.pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${disposition}; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
