import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { SESSION_COOKIE, readSessionToken } from '@/lib/auth'
import { ensureDefaultAdmin, isAdminConfigured } from '@/lib/store'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  await ensureDefaultAdmin()
  const session = await readSessionToken((await cookies()).get(SESSION_COOKIE)?.value)
  return NextResponse.json({
    authenticated: Boolean(session),
    user: session?.user ?? null,
    // Only unconfigured deployments advertise the default password.
    demo: await isAdminConfigured() && !process.env.ADMIN_PASSWORD,
  })
}

export async function DELETE() {
  ;(await cookies()).delete(SESSION_COOKIE)
  return NextResponse.json({ ok: true })
}
