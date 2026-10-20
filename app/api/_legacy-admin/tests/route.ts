import { NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { publish } from '@/lib/realtime'
import { addActivity, createTest, listTests } from '@/lib/store'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const includeInactive = new URL(request.url).searchParams.get('all') === '1' && Boolean(await getSessionFromRequest(request))
  return NextResponse.json(await listTests(includeInactive))
}

export async function POST(request: Request) {
  if (!await getSessionFromRequest(request)) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const name = String(body?.name ?? '').trim()
  const category = String(body?.category ?? 'Other').trim()
  const price = Number(body?.price)
  const discountType = ['none', 'percent', 'amount'].includes(body?.discountType) ? body.discountType : 'none'
  const discountValue = Math.max(0, Number(body?.discountValue) || 0)

  if (name.length < 2) return NextResponse.json({ error: 'Enter a test name.' }, { status: 400 })
  if (!Number.isInteger(price) || price <= 0) return NextResponse.json({ error: 'Enter a valid price in rupees.' }, { status: 400 })
  if (discountType === 'percent' && discountValue > 100) return NextResponse.json({ error: 'Percentage discount cannot exceed 100.' }, { status: 400 })
  if (discountType === 'amount' && discountValue >= price) return NextResponse.json({ error: 'Discount must be less than the price.' }, { status: 400 })

  const test = await createTest({
    name,
    category,
    description: String(body?.description ?? ''),
    price,
    discountType,
    discountValue,
    reportHours: String(body?.reportHours ?? '24 hours'),
    prep: String(body?.prep ?? 'No fasting'),
  })

  await addActivity('system', `Test added: ${test.name} (₹${test.finalPrice})`)
  publish('tests')
  publish('activity')
  return NextResponse.json(test, { status: 201 })
}
