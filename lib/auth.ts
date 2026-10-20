import { createHash, randomBytes, timingSafeEqual, scryptSync } from 'node:crypto'
import { cookies } from 'next/headers'
import { one, sql } from '@/lib/db'

/**
 * Session authentication for administrators.
 *
 * - Passwords: scrypt with a per-user salt (users.password_hash).
 * - Sessions: random 256-bit token in an httpOnly, SameSite=Lax cookie. Only a
 *   SHA-256 hash of the token is stored, so a database leak cannot mint
 *   sessions. Tokens expire and can be revoked server-side (logout, password
 *   reset, deactivation).
 */

export const SESSION_COOKIE = 'sv_admin_session'
export const SESSION_TTL_HOURS = 8

export interface AdminUser {
  id: string
  email: string
  name: string
  role: 'admin' | 'owner'
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const N = 16384, r = 8, p = 1
  const hash = scryptSync(password, salt, 64, { N, r, p, maxmem: 64 * 1024 * 1024 })
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${hash.toString('base64')}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const [, N, r, p, saltB64, hashB64] = parts
  const expected = Buffer.from(hashB64, 'base64')
  try {
    const actual = scryptSync(password, Buffer.from(saltB64, 'base64'), expected.length, { N: Number(N), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 })
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

/* ------------------------------------------------------------------ */
/* Server-side helpers                                                 */
/* ------------------------------------------------------------------ */

export async function authenticate(identifier: string, password: string): Promise<AdminUser | null> {
  const email = identifier.trim()
  if (!email || !password) return null
  const row = await one<{ id: string; email: string; name: string; password_hash: string; role: AdminUser['role']; is_active: boolean }>(
    'SELECT id, email, name, password_hash, role, is_active FROM users WHERE lower(email) = lower($1)',
    [email],
  )
  if (!row || !row.is_active) {
    verifyPassword(password, DUMMY_HASH) // keep timing roughly constant for unknown users
    return null
  }
  if (!verifyPassword(password, row.password_hash)) return null
  return { id: row.id, email: row.email, name: row.name, role: row.role }
}

const DUMMY_HASH = hashPassword('sv-invalid-placeholder-value')

export async function createSession(user: AdminUser): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600_000)
  await sql('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [hashToken(token), user.id, expiresAt])
  await sql('DELETE FROM sessions WHERE expires_at < now()')
  return { token, expiresAt }
}

/** Resolve a session token to a live, active user. */
export async function userForToken(token: string | undefined | null): Promise<AdminUser | null> {
  if (!token) return null
  const row = await one<{ id: string; email: string; name: string; role: AdminUser['role'] }>(
    `SELECT u.id, u.email, u.name, u.role FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now() AND u.is_active = true`,
    [hashToken(token)],
  )
  return row ?? null
}

export async function currentAdmin(): Promise<AdminUser | null> {
  const store = await cookies()
  return userForToken(store.get(SESSION_COOKIE)?.value)
}

export async function destroyCurrentSession() {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (token) await sql('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)])
  store.delete(SESSION_COOKIE)
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: SESSION_TTL_HOURS * 3600,
}

/* ------------------------------------------------------------------ */
/* API-route guard                                                     */
/* ------------------------------------------------------------------ */

export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function readCookie(request: Request, name: string) {
  const header = request.headers.get('cookie') ?? ''
  const entry = header.split(/;\s*/).find((part) => part.startsWith(`${name}=`))
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : undefined
}

/** Every /api/admin route starts with this. */
export async function requireAdmin(request: Request): Promise<AdminUser> {
  const user = await userForToken(readCookie(request, SESSION_COOKIE))
  if (!user) throw new HttpError(401, 'Authentication required.')
  return user
}

/** Owner-only actions (admin user management, business settings). */
export async function requireOwner(request: Request): Promise<AdminUser> {
  const user = await requireAdmin(request)
  if (user.role !== 'owner') throw new HttpError(403, 'Only the owner can perform this action.')
  return user
}

/**
 * CSRF defence in depth: state-changing requests must carry the
 * `x-sv-request: fetch` header that our own client sends (a cross-site form
 * cannot set custom headers) and must originate from the same host.
 */
export function assertSameOrigin(request: Request) {
  if (request.headers.get('x-sv-request') !== 'fetch') throw new HttpError(403, 'Missing request header.')
  const origin = request.headers.get('origin')
  if (origin) {
    try {
      if (new URL(origin).host !== request.headers.get('host')) throw new HttpError(403, 'Cross-origin request blocked.')
    } catch (error) {
      if (error instanceof HttpError) throw error
      throw new HttpError(403, 'Invalid origin.')
    }
  }
}

/** Route guard used by every admin API handler. */
export async function guard(request: Request, options: { owner?: boolean; mutation?: boolean } = {}): Promise<AdminUser> {
  if (options.mutation) assertSameOrigin(request)
  return options.owner ? requireOwner(request) : requireAdmin(request)
}

export function jsonError(error: unknown) {
  if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status })
  console.error('[api]', error)
  return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
}

/* ------------------------------------------------------------------ */
/* Rate limiting (Postgres-backed so it survives restarts)             */
/* ------------------------------------------------------------------ */

export async function isRateLimited(key: string, limit: number, windowMinutes: number) {
  const row = await one<{ n: number }>(
    `SELECT count(*)::int AS n FROM login_attempts WHERE key = $1 AND created_at > now() - ($2 || ' minutes')::interval`,
    [key, windowMinutes],
  )
  return (row?.n ?? 0) >= limit
}

export async function recordAttempt(key: string) {
  await sql('INSERT INTO login_attempts (key) VALUES ($1)', [key])
  await sql(`DELETE FROM login_attempts WHERE created_at < now() - interval '1 day'`)
}

export async function clearAttempts(key: string) {
  await sql('DELETE FROM login_attempts WHERE key = $1', [key])
}

/** A stable, non-reversible client identifier (IP is never stored raw). */
export function clientKey(request: Request, scope: string) {
  const rawClientIp = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
  return `${scope}:${createHash('sha256').update(rawClientIp).digest('hex').slice(0, 16)}`
}

export function ipHash(request: Request) {
  const ip = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
  return createHash('sha256').update(ip + (process.env.IP_HASH_SALT ?? 'sv')).digest('hex').slice(0, 24)
}
