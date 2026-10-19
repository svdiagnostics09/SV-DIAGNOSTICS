import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions, verifyCredentials } from '@/lib/auth'
import { addActivity } from '@/lib/store'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// In-memory throttle: 5 failed attempts per id per 5 minutes.
const attempts = new Map<string, { count: number; firstAt: number }>()
const WINDOW_MS = 5 * 60_000
const MAX_ATTEMPTS = 5

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const id = String(body?.id ?? '').trim()
  const password = String(body?.password ?? '')

  if (!id || !password) {
    return NextResponse.json({ error: 'Enter both your staff ID and password.' }, { status: 400 })
  }

  const key = id.toLowerCase()
  const entry = attempts.get(key)
  if (entry && Date.now() - entry.firstAt < WINDOW_MS && entry.count >= MAX_ATTEMPTS) {
    return NextResponse.json({ error: 'Too many failed attempts. Try again in a few minutes.' }, { status: 429 })
  }

  const user = await verifyCredentials(id, password)
  if (!user) {
    const next = !entry || Date.now() - entry.firstAt > WINDOW_MS ? { count: 1, firstAt: Date.now() } : { ...entry, count: entry.count + 1 }
    attempts.set(key, next)
    const remaining = MAX_ATTEMPTS - next.count
    return NextResponse.json(
      {
        error:
          remaining > 0
            ? `Invalid staff ID or password. ${remaining} attempt${remaining === 1 ? '' : 's'} left before a temporary lock.`
            : 'Too many failed attempts. Try again in a few minutes.',
        attemptsRemaining: Math.max(0, remaining),
      },
      { status: 401 },
    )
  }

  attempts.delete(key)
  const response = NextResponse.json({ user })
  ;(await cookies()).set(SESSION_COOKIE, await createSessionToken(user), sessionCookieOptions)
  await addActivity('system', `${user.name} signed in`)
  return response
}
