import crypto from 'node:crypto'

/** scrypt password hash, format: scrypt$N$r$p$saltB64$hashB64 */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16)
  const N = 16384, r = 8, p = 1, keylen = 64
  const hash = crypto.scryptSync(password, salt, keylen, { N, r, p, maxmem: 64 * 1024 * 1024 })
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${hash.toString('base64')}`
}
