import { NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { publish } from '@/lib/realtime'
import { addActivity, getSetting, publicSettings, setSetting, updateAdminCredentials } from '@/lib/store'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_LOGO_BYTES = 400 * 1024

export async function GET(request: Request) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  return NextResponse.json({
    ...await publicSettings(),
    adminId: await getSetting('admin_id', 'admin'),
    adminName: await getSetting('admin_name', 'Operations lead'),
  })
}

export async function PATCH(request: Request) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })

  // Branding (no password needed)
  if (typeof body.brandName === 'string') await setSetting('brand_name', body.brandName.trim() || 'SV Diagnostics')
  if (typeof body.tagline === 'string') await setSetting('brand_tagline', body.tagline.trim())
  if (typeof body.labPhone === 'string') await setSetting('lab_phone', body.labPhone.trim())
  if (body.collectionFee !== undefined) await setSetting('collection_fee', String(Math.max(0, Number(body.collectionFee) || 0)))
  if (typeof body.logo === 'string') {
    const logo = body.logo
    if (logo === '') {
      await setSetting('logo_data_url', '')
    } else if (!/^data:image\/(png|jpeg|jpg|svg\+xml|webp);base64,/.test(logo)) {
      return NextResponse.json({ error: 'Logo must be a PNG, JPG, SVG or WebP image.' }, { status: 400 })
    } else if (Buffer.byteLength(logo, 'utf8') > MAX_LOGO_BYTES) {
      return NextResponse.json({ error: 'Logo is too large — keep it under 400 KB.' }, { status: 400 })
    } else {
      await setSetting('logo_data_url', logo)
    }
  }

  // Credentials (current password required)
  if (body.newPassword || body.adminId || body.adminName) {
    const result = await updateAdminCredentials({
      adminId: body.adminId,
      adminName: body.adminName,
      currentPassword: String(body.currentPassword ?? ''),
      newPassword: body.newPassword ? String(body.newPassword) : undefined,
    })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    await addActivity('system', 'Admin credentials updated')
  }

  await addActivity('system', 'Branding settings updated')
  publish('settings')
  return NextResponse.json({ ok: true, ...await publicSettings() })
}
