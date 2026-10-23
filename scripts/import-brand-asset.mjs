/**
 * One-off: copy a logo/favicon that was uploaded to public/uploads/brand (the
 * old, non-persistent location) into the brand_assets table.
 *
 *   node scripts/import-brand-asset.mjs --kind logo --file public/uploads/brand/logo-….jpg
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const envFile = path.join(root, '.env.local')
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const arg = (name) => {
  const index = process.argv.indexOf(`--${name}`)
  return index > -1 ? process.argv[index + 1] : undefined
}

const kind = arg('kind')
const file = arg('file')
const email = arg('email') ?? 'system'
if ((kind !== 'logo' && kind !== 'favicon') || !file) {
  console.error('Usage: node scripts/import-brand-asset.mjs --kind logo|favicon --file <path> [--email admin@…]')
  process.exit(1)
}

const ext = path.extname(file).slice(1).toLowerCase()
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml', ico: 'image/x-icon' }
const mime = MIME[ext]
if (!mime) { console.error(`Unsupported file type: ${ext}`); process.exit(1) }

const bytes = fs.readFileSync(path.resolve(root, file))
const raw = (process.env.DATABASE_URL ?? '').trim().replace(/^["']|["']$/g, '')
const url = raw.includes('://') ? raw : `postgresql://${raw}`

const client = new pg.Client({
  connectionString: url.replace(/([?&])sslmode=[^&]*&?/g, '$1').replace(/[?&]$/, '').replace(/([?&])&+/g, '$1'),
  ssl: /sslmode=disable/.test(url) ? undefined : { rejectUnauthorized: false },
})
await client.connect()

await client.query(
  `INSERT INTO brand_assets (id, file_name, mime_type, content, size_bytes, updated_by_email, updated_at)
   VALUES ($1, $2, $3, $4, $5, $6, now())
   ON CONFLICT (id) DO UPDATE SET file_name = EXCLUDED.file_name, mime_type = EXCLUDED.mime_type,
     content = EXCLUDED.content, size_bytes = EXCLUDED.size_bytes, updated_by_email = EXCLUDED.updated_by_email, updated_at = now()`,
  [kind, path.basename(file), mime, bytes, bytes.length, email],
)

// The settings rows must point at the persistent route, not the old disk path.
const field = kind === 'logo' ? 'logoUrl' : 'faviconUrl'
await client.query(
  `INSERT INTO business_settings (key, value, updated_at) VALUES ($1, $2::jsonb, now())
   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
  [field, JSON.stringify(`/api/brand/${kind}`)],
)

console.log(`Imported ${kind} (${bytes.length} bytes, ${mime}) and pointed ${field} at /api/brand/${kind}.`)
await client.end()
