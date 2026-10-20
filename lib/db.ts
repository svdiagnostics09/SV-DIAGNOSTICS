import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool, type PoolClient } from 'pg'
import * as schema from '@/db/schema'

/**
 * Neon PostgreSQL access.
 *
 * `pg` Pool over the pooled (`-pooler`) connection string. Queries are
 * parameterised by the driver; booking writes that need atomicity use
 * `transaction()` which takes a row lock on the slot reservation.
 *
 * Drizzle is attached for schema-typed helpers; the raw `sql` function is used
 * where a query is clearer written out (aggregates, vendor-agnostic upserts).
 */

const globalForDb = globalThis as typeof globalThis & {
  __svPool?: Pool
  __svDb?: ReturnType<typeof drizzle<typeof schema>>
}

export function connectionString() {
  const url = (process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? '').trim().replace(/^["']|["']$/g, '')
  if (!url) throw new Error('DATABASE_URL is not configured. Add the Neon pooled connection string.')
  return url
}

export function dbConfigured() {
  return Boolean((process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? '').trim())
}

export function pool(): Pool {
  if (globalForDb.__svPool) return globalForDb.__svPool
  const p = new Pool({
    connectionString: connectionString(),
    max: Number(process.env.DATABASE_POOL_SIZE ?? 5),
    ssl: /sslmode=disable/.test(connectionString()) ? undefined : { rejectUnauthorized: false },
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 15_000,
  })
  // An idle client error would otherwise crash the server process.
  p.on('error', (error) => console.error('[db] idle client error:', error.message))
  globalForDb.__svPool = p
  return p
}

export const db = () => (globalForDb.__svDb ??= drizzle(pool(), { schema }))

/** Run a parameterised query and return rows. */
const DATE_COLUMNS = new Set(['slot_date', 'appointment_date', 'day', 'blackout_date', 'date'])

/** pg returns DATE as a JS Date in local time; we normalise to YYYY-MM-DD strings. */
function normaliseDates(row: Record<string, unknown>): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...row }
  for (const key of Object.keys(copy)) {
    const value = copy[key]
    if (value instanceof Date && DATE_COLUMNS.has(key)) {
      copy[key] = new Intl.DateTimeFormat('en-CA', { timeZone: IST, year: 'numeric', month: '2-digit', day: '2-digit' }).format(value)
    }
  }
  return copy
}

export async function sql<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  values: unknown[] = [],
): Promise<T[]> {
  const result = await pool().query(text, values as unknown[])
  return result.rows.map((row) => normaliseDates(row)) as T[]
}

export async function one<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  values: unknown[] = [],
): Promise<T | null> {
  const rows = await sql<T>(text, values)
  return rows[0] ?? null
}

/**
 * Run `work` inside a transaction. The callback may run more than once only
 * when the error is a serialization failure, which is safe for the booking
 * logic (it re-reads capacity under a fresh lock).
 */
export async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect()
  try {
    await client.query('BEGIN')
    // Fail fast instead of piling up behind a slow transaction.
    await client.query("SET LOCAL lock_timeout = '8s'")
    const result = await work(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch {
      // connection already gone
    }
    throw error
  } finally {
    client.release()
  }
}

/* Money helpers ------------------------------------------------------ */

/** Rupees (number, may have decimals) → integer paise. */
export const toPaise = (rupees: number) => Math.round(rupees * 100)

/** Integer paise → formatted INR, without decimals when whole. */
export function formatINR(paise: number) {
  const value = paise / 100
  return '₹' + value.toLocaleString('en-IN', { minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 })
}

/** Effective test price in paise after the configured discount. */
export function effectivePrice(pricePaise: number, discountType: string, discountValue: number) {
  if (discountType === 'percent') return Math.max(0, Math.round((pricePaise * (100 - Math.min(100, discountValue))) / 100))
  if (discountType === 'amount') return Math.max(0, pricePaise - discountValue)
  return pricePaise
}

/** India-local helpers. Appointment dates are stored as calendar dates. */
export const IST = 'Asia/Kolkata'
export function indiaDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: IST, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}
export function formatIndiaTime(value: Date | string, options: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat('en-IN', { timeZone: IST, ...options }).format(typeof value === 'string' ? new Date(value) : value)
}
