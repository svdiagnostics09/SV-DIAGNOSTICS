/**
 * Migration runner + bootstrap owner account.
 *
 *   node db/migrate.mjs
 *
 * Applies every SQL file in db/migrations once, tracked in schema_migrations.
 * Bootstrap creates the first owner from ADMIN_EMAIL / ADMIN_PASSWORD when the
 * users table is empty. No default password is ever created.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { hashPassword } from './migrate-lib.mjs'

const root = path.dirname(fileURLToPath(import.meta.url))
const envFile = path.join(root, '..', '.env.local')
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '')
  }
}

const raw = (process.env.DATABASE_URL ?? '').trim().replace(/^["']|["']$/g, '')
const url = raw.includes('://') ? raw : `postgresql://${raw}`
if (!url) {
  console.error('DATABASE_URL is not set (add it to .env.local).')
  process.exit(1)
}

const client = new pg.Client({ connectionString: url, ssl: /sslmode=disable/.test(url) ? undefined : { rejectUnauthorized: false } })
await client.connect()

await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`)
const applied = new Set((await client.query('SELECT name FROM schema_migrations')).rows.map((row) => row.name))

for (const file of fs.readdirSync(path.join(root, 'migrations')).filter((name) => name.endsWith('.sql')).sort()) {
  if (applied.has(file)) {
    console.log(`= ${file} (already applied)`)
    continue
  }
  const sqlText = fs.readFileSync(path.join(root, 'migrations', file), 'utf8')
  console.log(`> ${file}`)
  await client.query('BEGIN')
  try {
    await client.query(sqlText)
    await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file])
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    console.error(`Migration ${file} failed:`, error.message)
    process.exit(1)
  }
}

const { rows } = await client.query('SELECT count(*)::int AS n FROM users')
if (rows[0].n === 0) {
  const email = (process.env.ADMIN_EMAIL ?? '').trim()
  const password = process.env.ADMIN_PASSWORD ?? ''
  if (email && password.length >= 10) {
    await client.query(
      `INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, 'owner')`,
      [email, process.env.ADMIN_NAME ?? 'Administrator', hashPassword(password)],
    )
    console.log(`+ owner account created for ${email}`)
  } else {
    console.log('! No admin user exists and ADMIN_EMAIL/ADMIN_PASSWORD (>=10 chars) are not set — run `npm run admin:create -- --email you@example.com`.')
  }
} else {
  console.log(`= ${rows[0].n} admin user(s) present`)
}


await client.end()
console.log('Migrations complete.')
