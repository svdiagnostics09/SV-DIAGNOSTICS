import { NextResponse } from 'next/server'
import { publish } from '@/lib/realtime'
import { cleanPatientName } from '@/lib/realtime'
import { addActivity, createNotification, createOrder, getSetting, getTest, pruneNotifications } from '@/lib/store'
import { notifyAdminsWhatsApp } from '@/lib/notify'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function normalizePhone(raw: string) {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `+91${digits}`
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`
  if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`
  return ''
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid booking request.' }, { status: 400 })

  const name = cleanPatientName(String(body.name ?? ''))
  const phone = normalizePhone(String(body.phone ?? ''))
  const testId = Number(body.testId)
  const test = Number.isInteger(testId) ? await getTest(testId) : null
  const type = body.type === 'Lab visit' ? 'Lab visit' : 'Home collection'
  const slot = String(body.slot ?? '').trim()
  const pincode = String(body.pincode ?? '').replace(/\D/g, '').slice(0, 6)

  if (name.length < 2) return NextResponse.json({ error: 'Please enter the patient’s full name.' }, { status: 400 })
  if (!phone) return NextResponse.json({ error: 'Enter a valid 10-digit mobile number.' }, { status: 400 })
  if (!test || !test.active) return NextResponse.json({ error: 'That test is no longer available.' }, { status: 400 })
  if (!slot) return NextResponse.json({ error: 'Choose a collection slot.' }, { status: 400 })
  if (type === 'Home collection' && pincode.length !== 6) {
    return NextResponse.json({ error: 'Enter a valid 6-digit pincode for home collection.' }, { status: 400 })
  }

  const collectionFee = type === 'Home collection' ? Number(await getSetting('collection_fee', '99')) || 0 : 0
  const order = await createOrder({
    patientName: name,
    phone,
    pincode,
    testId: test.id,
    testName: test.name,
    type,
    slot,
    amount: test.finalPrice + collectionFee,
  })

  await addActivity('booking', `${name} booked ${test.name} · ${type}`)

  // ---- Staff alerts -------------------------------------------------
  // In-app notification is immediate; WhatsApp is best-effort. A provider
  // outage must never fail a patient's booking, so failures are recorded
  // rather than thrown.
  let delivery: Awaited<ReturnType<typeof notifyAdminsWhatsApp>> | null = null
  if (await getSetting('notify_on_booking', '1') === '1') {
    const message = [
      '🧪 New booking — SV Diagnostics',
      '',
      `Patient: ${name}`,
      `Test: ${test.name}`,
      `Type: ${type}${type === 'Home collection' ? ` · ${pincode}` : ''}`,
      `Slot: ${slot}`,
      `Amount: ₹${(test.finalPrice + collectionFee).toLocaleString('en-IN')}`,
      `Order: ${order.order_id}`,
      `Phone: ${phone}`,
      '',
      'Open the admin console → Orders to assign a collector.',
    ].join('\n')

    try {
      delivery = await notifyAdminsWhatsApp(message)
    } catch (error) {
      delivery = { ok: false, mode: 'manual-link', detail: (error as Error).message }
    }

    await createNotification({
      kind: 'booking',
      title: `New booking · ${name}`,
      body: `${test.name} · ${type} · ${slot} · ₹${(test.finalPrice + collectionFee).toLocaleString('en-IN')}`,
      orderId: order.order_id,
      hrefTab: 'Orders',
      channel: delivery ? `whatsapp:${delivery.mode}` : '',
      delivery: delivery ? { whatsapp: { ok: delivery.ok, detail: delivery.detail, link: delivery.link } } : {},
    })
    await pruneNotifications()
  }

  publish('orders')
  publish('activity')
  publish('notifications', { unread: true })

  return NextResponse.json({
    orderId: order.order_id,
    patientName: order.patient_name,
    testName: order.test_name,
    type: order.type,
    slot: order.slot,
    amount: order.amount,
    status: order.status,
  }, { status: 201 })
}
