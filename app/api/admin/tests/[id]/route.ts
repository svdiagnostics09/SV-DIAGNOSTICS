import { NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { publish } from '@/lib/realtime'
import { addActivity, deleteTest, updateTest } from '@/lib/store'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await getSessionFromRequest(request)) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const { id } = await params
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })

  const price = body.price === undefined ? undefined : Number(body.price)
  if (price !== undefined && (!Number.isInteger(price) || price <= 0)) {
    return NextResponse.json({ error: 'Enter a valid price in rupees.' }, { status: 400 })
  }

  const test = await updateTest(Number(id), {
    ...(body.name !== undefined ? { name: String(body.name).trim() } : {}),
    ...(body.category !== undefined ? { category: String(body.category) } : {}),
    ...(body.description !== undefined ? { description: String(body.description) } : {}),
    ...(price !== undefined ? { price } : {}),
    ...(body.discountType !== undefined ? { discountType: body.discountType } : {}),
    ...(body.discountValue !== undefined ? { discountValue: Math.max(0, Number(body.discountValue) || 0) } : {}),
    ...(body.reportHours !== undefined ? { reportHours: String(body.reportHours) } : {}),
    ...(body.prep !== undefined ? { prep: String(body.prep) } : {}),
    ...(body.active !== undefined ? { active: Boolean(body.active) } : {}),
  })

  if (!test) return NextResponse.json({ error: 'Test not found' }, { status: 404 })
  await addActivity('system', `Test updated: ${test.name} → ₹${test.finalPrice}`)
  publish('tests')
  publish('activity')
  return NextResponse.json(test)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await getSessionFromRequest(request)) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const { id } = await params
  const ok = await deleteTest(Number(id))
  if (!ok) return NextResponse.json({ error: 'Test not found' }, { status: 404 })
  publish('tests')
  return NextResponse.json({ ok: true })
}
