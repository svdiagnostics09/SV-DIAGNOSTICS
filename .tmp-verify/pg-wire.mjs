// TEMPORARY local verification harness — delete after use.
// Bridges the Postgres wire protocol to PGlite so `pg` (and therefore the Next
// app) can run against a throwaway in-process database on localhost.
import net from 'node:net'
import { PGlite } from '@electric-sql/pglite'

const PORT = Number(process.env.PORT ?? 5544)
if (PORT < 1024 || PORT > 65000) throw new Error('refusing non-local port')

const db = await PGlite.create()
const sessions = new Map()
let nextPid = 100

const b = (s) => Buffer.from(s, 'utf8')
const i16 = (n) => { const x = Buffer.alloc(2); x.writeInt16BE(n); return x }
const i32 = (n) => { const x = Buffer.alloc(4); x.writeInt32BE(n); return x }
const cstr = (s) => Buffer.concat([b(s), Buffer.from([0])])
const msg = (type, ...parts) => Buffer.concat([b(type), i32(4 + parts.reduce((n, p) => n + p.length, 0)), ...parts])

/** Parse a Bind/Execute request built by pg from a SQL string + parameters. */
function splitStatements(sql) {
  return sql.split(/;(?=(?:[^']*'[^']*')*[^']*$)/).map((s) => s.trim()).filter(Boolean)
}

function parseRowDescription(cols) {
  return msg('T', i16(cols.length), ...cols.map((c, idx) => Buffer.concat([
    cstr(c.name), i32(0), i16(idx + 1), i32(c.dataTypeID ?? 25), i16(-1), i32(-1), i16(0),
  ])))
}

const OIDS = { 16: 16, 20: 20, 21: 21, 23: 23, 25: 25, 1700: 1700, 1082: 1082, 1114: 1114, 1184: 1184, 2950: 2950, 17: 17, 3802: 3802, 114: 114, 1185: 1185, 1009: 1009, 1007: 1007, 1015: 1015, 1005: 1005 }

function textValue(value, oid) {
  if (value === null || value === undefined) return null
  if (oid === 17 && value instanceof Uint8Array) return `\\x${Buffer.from(value).toString('hex')}`
  if (value instanceof Date) return value.toISOString()
  if (value instanceof Uint8Array) return Buffer.from(value).toString('utf8')
  if (Array.isArray(value)) return `{${value.map((v) => (v === null ? 'NULL' : typeof v === 'string' ? `"${v.replace(/"/g, '\\"')}"` : String(v))).join(',')}}`
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function dataRows(rows, cols) {
  const out = [msg('C', i16(rows.length))]
  for (const row of rows) {
    const values = cols.map((c) => {
      const text = textValue(row[c.name], c.dataTypeID)
      return text === null ? i32(-1) : (() => { const buf = b(text); return Buffer.concat([i32(buf.length), buf]) })()
    })
    out.push(msg('D', ...values))
  }
  return Buffer.concat(out)
}

/** Create a JSONB/OID parameter from a pgBind string without pg's encoder. */
function decodeParam(value) {
  if (value === null) return null
  if (/^\\x[0-9a-fA-F]*$/.test(value) || /^[0-9a-fA-F]+$/.test(value) && value.length % 2 === 0) return value
  return value
}

function respond(socket, session, payload) {
  // Execute a single SQL statement and send the result set (or CommandComplete).
  const run = async () => {
    const statements = splitStatements(session.sql)
    let cols = []
    for (const statement of statements) {
      if (/^\s*(BEGIN|COMMIT|ROLLBACK|SET LOCAL|SET|SAVEPOINT|RELEASE)/i.test(statement)) {
        if (/^\s*(BEGIN|COMMIT|ROLLBACK)/i.test(statement)) await db.exec(statement)
        socket.write(msg('C', cstr(statement.split(/\s+/)[0].toUpperCase())))
        continue
      }
      // pg sends $n placeholders; PGlite accepts the same text when values are passed.
      const result = await db.query(statement, session.params)
      const fields = result.fields ?? []
      cols = fields.map((f) => ({ name: f.name, dataTypeID: OIDS[f.dataTypeID] ?? f.dataTypeID ?? 25 }))
      if (cols.length) socket.write(parseRowDescription(cols))
      socket.write(dataRows(result.rows ?? [], cols))
      socket.write(msg('C', cstr(`SELECT ${result.affectedRows ?? result.rows?.length ?? 0}`)))
    }
  }
  run()
    .then(() => socket.write(msg('Z', b('I'))))
    .catch((error) => {
      socket.write(msg('E', b('S'), cstr('ERROR'), b('C'), cstr('XX000'), b('M'), cstr(String(error.message).slice(0, 500)), Buffer.from([0])))
      socket.write(msg('Z', b('I')))
    })
  void payload
}

net.createServer((socket) => {
  let buffer = Buffer.alloc(0)
  let startup = true
  const session = { params: [], sql: '', mid: null, portal: null }
  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk])
    while (buffer.length >= 4) {
      const length = buffer.readInt32BE(0)
      if (buffer.length < length) return
      if (startup) {
        buffer = buffer.subarray(length)
        const pid = nextPid++
        sessions.set(pid, session)
        socket.write(msg('R', i32(0)))
        socket.write(msg('S', cstr('server_version'), cstr('15.0'), cstr('client_encoding'), cstr('UTF8'), cstr('DateStyle'), cstr('ISO, MDY'), Buffer.from([0])))
        socket.write(msg('K', i32(pid), i32(1)))
        socket.write(msg('Z', b('I')))
        startup = false
        continue
      }
      const type = String.fromCharCode(buffer[0])
      const body = buffer.subarray(5, length)
      buffer = buffer.subarray(length)
      if (type === 'Q') {
        session.sql = body.toString('utf8', 0, body.length - 1)
        session.params = []
        respond(socket, session, body)
      } else if (type === 'P') {
        session.mid = body.toString('utf8', 0, body.indexOf(0))
        socket.write(msg('1'))
      } else if (type === 'B') {
        const values = []
        let offset = 0
        while (offset < body.length && body[offset] !== 0) offset++ // portal
        offset++
        while (offset < body.length && body[offset] !== 0) offset++ // statement
        offset++
        const nFormats = body.readInt16BE(offset); offset += 2 + nFormats * 2
        const nParams = body.readInt16BE(offset); offset += 2
        for (let i = 0; i < nParams; i++) {
          const len = body.readInt32BE(offset); offset += 4
          if (len === -1) { values.push(null); continue }
          values.push(decodeParam(body.toString('utf8', offset, offset + len)))
          offset += len
        }
        session.params = values
        session.sql = session.mid ?? ''
        socket.write(msg('2'))
      } else if (type === 'D') {
        socket.write(msg('n'))
      } else if (type === 'C') {
        socket.write(msg('2'))
      } else if (type === 'E') {
        respond(socket, session, body)
      } else if (type === 'S') {
        socket.write(msg('Z', b('I')))
      } else if (type === 'X') {
        socket.end()
      }
    }
  })
  socket.on('error', () => undefined)
}).listen(PORT, '127.0.0.1', () => console.log(`pg-wire listening on 127.0.0.1:${PORT}`))
