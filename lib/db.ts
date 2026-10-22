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

/**
 * Optional driver override. Points every query at a Postgres-compatible server
 * over HTTP (e.g. a local test harness); production always uses the pg Pool.
 * Format: postgresql+http://host:port/database
 */
const HTTP_DRIVER = (process.env.DATABASE_URL ?? '').startsWith('postgresql+http://')

const globalForDb = globalThis as typeof globalThis & {
  __svPool?: Pool
  __svDb?: ReturnType<typeof drizzle<typeof schema>>
}

export function connectionString() {
  const url = (process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? '').trim().replace(/^["']|["']$/g, '')
  if (!url) throw new Error('DATABASE_URL is not configured. Add the Neon pooled connection string.')
  return url
}

/**
 * SSL mode is decided here, not by the `sslmode=` query parameter.
 *
 * pg 8 warns that `prefer`/`require`/`verify-ca` are treated as `verify-full`
 * today but will mean weaker things in pg 9. Stripping the parameter and
 * passing an explicit `ssl` option keeps the current behaviour, silent, and
 * intentional: managed Postgres (Neon) uses a certificate we do not verify,
 * while `sslmode=disable` (local Postgres) stays unencrypted.
 */
function poolConfig(url: string) {
  const disableSsl = /[?&]sslmode=disable\b/.test(url)
  const withoutSslMode = url
    .replace(/([?&])sslmode=[^&]*&?/g, '$1')
    .replace(/[?&]$/, '')
    .replace(/([?&])&+/g, '$1')
  return {
    connectionString: withoutSslMode,
    ssl: disableSsl ? undefined : { rejectUnauthorized: false },
  }
}

export function dbConfigured() {
  return Boolean((process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? '').trim())
}

export function pool(): Pool {
  if (globalForDb.__svPool) return globalForDb.__svPool
  if (HTTP_DRIVER) {
    // Test harness only — matches the subset of the Pool API our helpers use.
    globalForDb.__svPool = new HttpQueryable(connectionString()) as unknown as Pool
    return globalForDb.__svPool
  }
  const p = new Pool({
    ...poolConfig(connectionString()),
    max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 15_000,
  })
  // An idle client error would otherwise crash the server process.
  p.on('error', (error) => console.error('[db] idle client error:', error.message))
  globalForDb.__svPool = p
  return p
}

export const db = () => (globalForDb.__svDb ??= drizzle(pool(), { schema }))

/**
 * Minimal pg-Pool look-alike over Postgres' HTTP API. Used only when
 * DATABASE_URL uses the postgresql+http:// scheme (local verification).
 * Postgres collects parameter type OIDs from the extended-protocol Parse
 * message, so TEXT-format parameter values are accepted as typed as long as
 * they are unambiguous (see docs: "Rendering conventions for text format").
 */
class HttpQueryable {
  private endpoint: string
  constructor(private url: string) {
    const parsed = new URL(url.replace(/^postgresql\+http:/, 'http:'))
    const database = decodeURIComponent(parsed.pathname.replace(/^\//, '')) || 'postgres'
    this.endpoint = `${parsed.origin}/sql/${encodeURIComponent(database)}`
  }
  async query(text: string, values: unknown[] = []): Promise<{ rows: Array<Record<string, unknown>>; rowCount: number }> {
    const query = { text, params: values.map((value) => (Buffer.isBuffer(value) ? `\\x${value.toString('hex')}` : value)) }
    const response = await fetch(`${this.endpoint}?format=arrays`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([query]),
      cache: 'no-store',
    })
    const payload = await response.json().catch(() => null) as { result?: Array<{ cols?: Array<{ name: string }>; rows?: unknown[][]; rowCount?: number }>; error?: string } | null
    if (!response.ok || !payload?.result) throw new Error(`http-sql ${response.status}: ${payload?.error ?? 'no result'}`)
    const result = payload.result[0]
    const names = (result?.cols ?? []).map((column) => column.name)
    const rows = (result?.rows ?? []).map((row) => {
      const object: Record<string, unknown> = {}
      names.forEach((name, index) => { object[name] = row[index] })
      return object
    })
    return { rows, rowCount: result?.rowCount ?? rows.length }
  }
  async connect() {
    const client = this
    return { query: (text: string, values?: unknown[]) => client.query(text, values), release: () => undefined }
  }
  on() { return this }
}

/** Run a parameterised query and return rows. */
const DATE_COLUMNS = new Set(['slot_date', 'appointment_date', 'day', 'blackout_date', 'date'])
/** Columns stored as bytea. pg hands them back as "\x…" hex strings. */
const BLOB_COLUMNS = new Set(['content'])

/**
 * pg returns DATE as a JS Date in local time and bytea (report PDFs) as
 * hex-encoded text. Normalise dates to YYYY-MM-DD and decode blobs to Buffers.
 */
function normaliseRow(row: Record<string, unknown>): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...row }
  for (const key of Object.keys(copy)) {
    const value = copy[key]
    if (value instanceof Date && DATE_COLUMNS.has(key)) {
      copy[key] = new Intl.DateTimeFormat('en-CA', { timeZone: IST, year: 'numeric', month: '2-digit', day: '2-digit' }).format(value)
    } else if (typeof value === 'string' && BLOB_COLUMNS.has(key)) {
      copy[key] = Buffer.from(value, 'hex')
    }
  }
  return copy
}

export async function sql<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  values: unknown[] = [],
): Promise<T[]> {
  const result = await pool().query(text, values as unknown[])
  return result.rows.map((row) => normaliseRow(row)) as T[]
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
