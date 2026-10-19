import { NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { publish } from '@/lib/realtime'
import { addActivity, createNotification, getSetting, setSetting } from '@/lib/store'
import { adminRecipients, isCloudApiConfigured, notifyAdminsWhatsApp } from '@/lib/notify'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  if (!await getSessionFromRequest(request)) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  return NextResponse.json({
    adminWhatsapp: await getSetting('admin_whatsapp'),
    phoneNumberId: await getSetting('whatsapp_phone_number_id'),
    apiVersion: await getSetting('whatsapp_api_version', 'v21.0'),
    hasToken: Boolean(await getSetting('whatsapp_access_token')),
    notifyOnBooking: await getSetting('notify_on_booking', '1') === '1',
    recipients: await adminRecipients(),
    cloudApi: await isCloudApiConfigured(),
  })
}

export async function PATCH(request: Request) {
  if (!await getSessionFromRequest(request)) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const body = await request.json().catch(() => ({}))

  if (typeof body.adminWhatsapp === 'string') {
    const cleaned = body.adminWhatsapp.split(',').map((value: string) => value.replace(/[^\d+\s-]/g, '').trim()).filter(Boolean).join(', ')
    await setSetting('admin_whatsapp', cleaned)
  }
  if (typeof body.phoneNumberId === 'string') await setSetting('whatsapp_phone_number_id', body.phoneNumberId.trim())
  if (typeof body.apiVersion === 'string' && body.apiVersion.trim()) await setSetting('whatsapp_api_version', body.apiVersion.trim())
  // An empty token means "keep the existing one" so the UI never needs to echo it back.
  if (typeof body.accessToken === 'string' && body.accessToken.trim()) await setSetting('whatsapp_access_token', body.accessToken.trim())
  if (typeof body.clearToken === 'boolean' && body.clearToken) await setSetting('whatsapp_access_token', '')
  if (typeof body.notifyOnBooking === 'boolean') await setSetting('notify_on_booking', body.notifyOnBooking ? '1' : '0')

  await addActivity('system', 'Notification settings updated')
  publish('settings')
  publish('notifications', { unread: false })

  return NextResponse.json({
    ok: true,
    recipients: await adminRecipients(),
    cloudApi: await isCloudApiConfigured(),
  })
}

/** Sends a real test alert so staff can confirm the channel works. */
export async function POST(request: Request) {
  if (!await getSessionFromRequest(request)) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const result = await notifyAdminsWhatsApp(
    '✅ Test alert from SV Diagnostics\n\nIf you can read this, booking alerts are configured correctly.',
  )

  await createNotification({
    kind: 'test',
    title: 'Test alert',
    body: result.detail,
    hrefTab: 'Settings',
    channel: `whatsapp:${result.mode}`,
    delivery: { whatsapp: { ok: result.ok, detail: result.detail, link: result.link } },
  })
  publish('notifications', { unread: true })

  return NextResponse.json(result)
}
