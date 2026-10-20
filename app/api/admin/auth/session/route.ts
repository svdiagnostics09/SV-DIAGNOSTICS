import { NextResponse } from 'next/server'
import { currentAdmin, destroyCurrentSession } from '@/lib/auth'
import { audit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await currentAdmin()
  return NextResponse.json({ authenticated: Boolean(user), user }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function DELETE(request: Request) {
  const user = await currentAdmin()
  await destroyCurrentSession()
  if (user) await audit({ actor: user, action: 'auth.logout', entity: 'users', entityId: user.id, request })
  return NextResponse.json({ ok: true })
}
