import { z, ZodError } from 'zod'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { authenticate, clearAttempts, clientKey, createSession, isRateLimited, recordAttempt, sessionCookieOptions, SESSION_COOKIE } from '@/lib/auth'
import { audit } from '@/lib/audit'
import { one } from '@/lib/db'

export const dynamic = 'force-dynamic'

const schema = z.object({ email: z.string().trim().min(2).max(120), password: z.string().min(1).max(200) })

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json().catch(() => null))
    const ipKey = clientKey(request, 'login-ip')
    const userKey = `login-user:${body.email.toLowerCase()}`
    // Successful sign-ins never count toward the failure budget.
    if (await isRateLimited(ipKey, 25, 15) || await isRateLimited(userKey, 6, 15)) {
      return NextResponse.json({ error: 'Too many failed attempts. Please wait 15 minutes.' }, { status: 429 })
    }
    const user = await authenticate(body.email, body.password)
    if (!user) {
      await Promise.all([recordAttempt(ipKey), recordAttempt(userKey)])
      await audit({ action: 'auth.login_failed', entity: 'users', entityId: body.email.slice(0, 80), request })
      const remaining = Math.max(0, 6 - (await one<{ n: number }>(`SELECT count(*)::int AS n FROM login_attempts WHERE key = $1 AND created_at > now() - interval '15 minutes'`, [userKey]))!.n)
      return NextResponse.json({ error: remaining > 0 ? `Invalid email or password. ${remaining} attempt${remaining === 1 ? '' : 's'} left.` : 'Too many failed attempts. Please wait 15 minutes.' }, { status: 401 })
    }
    await clearAttempts(userKey)
    const { token } = await createSession(user)
    ;(await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions)
    await audit({ actor: user, action: 'auth.login', entity: 'users', entityId: user.id, request })
    return NextResponse.json({ user })
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: 'Enter your email and password.' }, { status: 400 })
    console.error('[login]', error)
    return NextResponse.json({ error: 'Sign in is temporarily unavailable.' }, { status: 503 })
  }
}
