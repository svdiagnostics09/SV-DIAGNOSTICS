/**
 * Create or reset an administrator account.
 *
 *   node scripts/create-admin.mjs --email owner@svdiagnostics.in --name "Owner" --password '••••••••••'
 *
 * There is deliberately no public admin registration and no built-in default
 * password. Re-running with an existing email resets that account's password
 * and invalidates every active session.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { hashPassword } from '../db/migrate-lib.mjs'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const envFile = path.join(root, '.env.local')
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '')
  }
}

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, value, index, all) => {
    if (value.startsWith('--')) pairs.push([value.slice(2), all[index + 1]])
    return pairs
  }, []),
)
const email = (args.email ?? '').trim()
const name = (args.name ?? 'Administrator').trim()
const password = args.password ?? ''
const role = args.role === 'admin' ? 'admin' : 'owner'

if (!email || password.length < 10) {
  console.error('Usage: node scripts/create-admin.mjs --email you@example.com --password "<10+ characters>" [--name "Name"] [--role admin|owner]')
  process.exit(1)
}

const client = new pg.Client({ connectionString: (() => { const raw = (process.env.DATABASE_URL ?? '').trim().replace(/^["']|["']$/g, ''); return raw.includes('://') ? raw : `postgresql://${raw}` })(), ssl: { rejectUnauthorized: false } })
await client.connect()
const existing = await client.query('SELECT id FROM users WHERE lower(email) = lower($1)', [email])
if (existing.rowCount) {
  await client.query('UPDATE users SET password_hash = $1, name = $2, role = $3, is_active = true, updated_at = now() WHERE id = $4', [hashPassword(password), name, role, existing.rows[0].id])
  await client.query('DELETE FROM sessions WHERE user_id = $1', [existing.rows[0].id])
  console.log(`Password reset for ${email}. All sessions signed out.`)
} else {
  await client.query('INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, $4)', [email, name, hashPassword(password), role])
  console.log(`Created ${role} account ${email}.`)
}
await client.end()
