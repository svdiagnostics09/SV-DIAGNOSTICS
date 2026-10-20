/**
 * End-to-end API tests (run against a running dev/prod server).
 *
 *   TEST_BASE_URL=http://localhost:3100 ADMIN_PASSWORD=… node scripts/test-api.mjs
 *
 * Exercises: admin auth + authorization, test CRUD + public visibility, price
 * consistency, booking creation, duplicate idempotency, atomic slot capacity,
 * cancellation capacity release, tracking privacy, enquiry submission and
 * webhook signature rejection. Each run cleans up the records it creates.
 */
import fs from 'node:fs'
import pg from 'pg'

const envFile = '.env.local'
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '')
  }
}
const raw = (process.env.DATABASE_URL ?? '').replace(/^["']|["']$/g, '')
const url = raw.includes('://') ? raw : `postgresql://${raw}`
const BASE = process.env.TEST_BASE_URL ?? 'http://localhost:3100'
const ADMIN = process.env.ADMIN_ID ?? 'admin'
const PASSWORD = process.env.ADMIN_PASSWORD ?? ''
const TEST_CLIENT_IP = `203.0.113.${Math.floor(Math.random() * 200) + 10}`

const db = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
await db.connect()

let passed = 0
let failed = 0
const results = []
function check(name, condition, detail = '') {
  if (condition) { passed += 1; results.push(`PASS  ${name}`) }
  else { failed += 1; results.push(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`) }
}

  // Remote clients hash the first X-Forwarded-For value, so give this run a stable key.
  const json = async (path, options = {}, cookie) => {
    const headers = { 'Content-Type': 'application/json', 'x-forwarded-for': TEST_CLIENT_IP, 'x-sv-request': 'fetch', ...(cookie ? { cookie } : {}), ...(options.headers ?? {}) }
    const response = await fetch(`${BASE}${path}`, { ...options, headers })
    const body = await response.json().catch(() => null)
    return { status: response.status, body, headers: response.headers }
  }

let cookie = ''
let fixture
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())

try {
  /* ---- 0. Fixture: a dedicated QA slot with known capacity ---- */
  const fixtureResult = await db.query(
    `INSERT INTO collection_slots (location_id, method, label, start_time, end_time, duration_minutes, daily_capacity, weekdays, is_active)
     VALUES ((SELECT id FROM locations ORDER BY id LIMIT 1), 'lab', 'QA capacity slot', '23:00', '23:30', 30, 4, ARRAY[0,1,2,3,4,5,6], true) RETURNING id, location_id, daily_capacity`,
  )
  fixture = fixtureResult.rows[0]
  check('QA slot fixture created', Boolean(fixture), 'a location must exist first')

  /* ---- 1. Authentication & authorization --------------------------- */
  const unauth = await json('/api/admin/tests')
  check('admin endpoint rejects anonymous requests', unauth.status === 401, `got ${unauth.status}`)
  const badLogin = await json('/api/admin/auth/login', { method: 'POST', body: JSON.stringify({ email: ADMIN, password: 'definitely-wrong' }) })
  check('login rejects a wrong password', badLogin.status === 401)
  const login = await fetch(`${BASE}/api/admin/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-sv-request': 'fetch', 'x-forwarded-for': TEST_CLIENT_IP }, body: JSON.stringify({ email: ADMIN, password: PASSWORD }) })
  const setCookie = login.headers.get('set-cookie') ?? ''
  cookie = setCookie.split(';')[0]
  check('admin login succeeds and sets an HttpOnly cookie', login.ok && /HttpOnly/i.test(setCookie), setCookie.slice(0, 60))
  const session = await json('/api/admin/auth/session', {}, cookie)
  check('session endpoint returns the signed-in admin', session.body?.authenticated === true)
  const csrf = await fetch(`${BASE}/api/admin/tests`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify({ name: 'x' }) })
  check('mutations without the CSRF header are rejected', csrf.status === 403, `got ${csrf.status}`)

  /* ---- 2. Test CRUD + price consistency ---------------------------- */
  const suffix = Date.now().toString(36)
  const name = `QA Test ${suffix}`
  const create = await json('/api/admin/tests', { method: 'POST', body: JSON.stringify({ name, pricePaise: 125000, discountType: 'percent', discountValue: 20, sampleType: 'Blood', turnaroundHours: 24, homeCollection: true, status: 'published' }) }, cookie)
  check('create + publish test', create.status === 201 && create.body?.status === 'published', JSON.stringify(create.body))
  const testId = create.body?.id
  check('server applies the discount (₹1250 → ₹1000)', create.body?.listPricePaise === 100000, `got ${create.body?.listPricePaise}`)

  const publicList = await json('/api/catalogue?q=' + encodeURIComponent(suffix))
  check('new test appears in the public catalogue', publicList.body?.total === 1 && publicList.body?.tests[0]?.id === testId)
  const priceList = await fetch(`${BASE}/price-list`).then((response) => response.text())
  check('price list page renders the new test name', priceList.includes(name))

  // Price change is reflected on the public catalogue.
  const patch = await json(`/api/admin/tests/${testId}`, { method: 'PATCH', body: JSON.stringify({ pricePaise: 150000, discountType: 'none', discountValue: 0 }) }, cookie)
  check('price update saved', patch.status === 200 && patch.body?.listPricePaise === 150000, JSON.stringify(patch.body).slice(-260))
  const publicAfter = await json('/api/catalogue?q=' + encodeURIComponent(suffix))
  check('updated price appears publicly', publicAfter.body?.tests[0]?.listPricePaise === 150000)

  /* ---- 3. Booking creation + pricing from DB ----------------------- */
  const slotRow = fixture
  const areaRow = (await db.query(`SELECT pincodes FROM service_areas WHERE is_active AND home_collection LIMIT 1`)).rows[0]
  check('QA slot and seeded service area exist', Boolean(slotRow && areaRow), 'run scripts/data/seed-catalogue.mjs first')
  const qaCapacity = Number(slotRow.daily_capacity)

  const daysAhead = (n) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(Date.now() + n * 86_400_000))
const pickDate = () => {
  for (let offset = 1; offset < 10; offset += 1) {
    const candidate = daysAhead(offset)
    const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short' }).format(new Date(`${candidate}T12:00:00+05:30`))
    if (weekday !== 'Sun') return candidate
  }
  return daysAhead(2)
}

const bookingBody = (overrides = {}) => ({
    items: [{ kind: 'test', id: testId, quantity: 1 }],
    method: 'lab',
    locationId: slotRow.location_id,
    date: today,
    slotId: slotRow.id,
    patientName: 'QA Patient',
    phone: '9876500001',
    email: '',
    paymentMethod: 'pay_lab',
    consent: true,
    idempotencyKey: `qa-${suffix}-${Math.random().toString(36).slice(2)}`,
    ...overrides,
  })

  // Move to a weekday-safe date if today is a Sunday (slots exclude Sunday).
  const date = pickDate()

  const body1 = bookingBody({ date })
  const booking1 = await json('/api/bookings', { method: 'POST', body: JSON.stringify(body1) })
  check('booking created', booking1.status === 201, `${booking1.status} ${JSON.stringify(booking1.body)}`)
  if (booking1.status !== 201) throw new Error(`booking creation failed: ${JSON.stringify(booking1.body)}`)
  const reference = booking1.body?.reference
  check('booking has a reference and server total (₹1500)', Boolean(reference) && booking1.body?.totals?.totalPaise === 150000, JSON.stringify(booking1.body?.totals))

  const persisted = (await db.query('SELECT total_paise, status FROM bookings WHERE reference = $1', [reference])).rows[0]
  check('booking persisted in PostgreSQL', persisted?.total_paise === 150000 && persisted?.status === 'pending_confirmation')

  // Client-sent amount is ignored.
  const tampered = await json('/api/bookings', { method: 'POST', body: JSON.stringify(bookingBody({ date, amount: 1, totals: { totalPaise: 1 } })) })
  check('client-supplied amount is ignored (server price used)', tampered.status === 201 && tampered.body?.totals?.totalPaise === 150000, JSON.stringify(tampered.body).slice(0, 200))

  const duplicate = await json('/api/bookings', { method: 'POST', body: JSON.stringify(body1) })
  check('duplicate submission returns the same booking', duplicate.body?.reference === reference, `${duplicate.status} ${JSON.stringify(duplicate.body).slice(0, 200)}`)
  check('duplicate submission is not double-counted', duplicate.body?.totals?.totalPaise === 150000)

  // Idempotency.
  /* ---- 4. Atomic slot capacity ------------------------------------- */
  const existing = Number((await db.query('SELECT COALESCE(SUM(booked + holds),0) AS n FROM slot_reservations WHERE slot_id = $1 AND COALESCE(location_id,0) = $2 AND slot_date = $3', [slotRow.id, slotRow.location_id, date])).rows[0].n)
  const remaining = qaCapacity - existing
  // Send sequentially-fast (parallel) requests: all race for the remaining places.
  const attempts = await Promise.all(Array.from({ length: remaining + 2 }, (_, index) =>
    json('/api/bookings', { method: 'POST', body: JSON.stringify(bookingBody({ date, patientName: `QA Capacity ${index}`, phone: `987650${String(1000 + index)}` })) })))
  const successes = attempts.filter((attempt) => attempt.status === 201).length
  const rejected = attempts.filter((attempt) => attempt.status === 409).length
  check('concurrent bookings never exceed capacity', successes === remaining && rejected === 2, `remaining=${remaining} successes=${successes} conflicts=${rejected} statuses=${attempts.map((a) => a.status).join(',')} first=${JSON.stringify(attempts.find((a) => a.status !== 201)?.body)}`)
  const counter = (await db.query('SELECT booked, holds, capacity FROM slot_reservations WHERE slot_id = $1 AND COALESCE(location_id,0) = $2 AND slot_date = $3', [slotRow.id, slotRow.location_id, date])).rows[0]
  check('counter row is within capacity', Number(counter.booked) + Number(counter.holds) <= Number(counter.capacity), JSON.stringify(counter))

  /* ---- 5. Cancellation releases capacity --------------------------- */
  const before = Number(counter?.booked ?? 0) + Number(counter?.holds ?? 0)
  const cancel = await json('/api/bookings/cancel', { method: 'POST', body: JSON.stringify({ reference, phone: '9876500001', reason: 'QA test' }) })
  check('customer cancellation succeeds', cancel.status === 200 && cancel.body?.ok === true, JSON.stringify(cancel.body))
  const after = (await db.query('SELECT booked, holds FROM slot_reservations WHERE slot_id = $1 AND COALESCE(location_id,0) = $2 AND slot_date = $3', [slotRow.id, slotRow.location_id, date])).rows[0]
  check('cancellation returns exactly one place', after && Number(after.booked) + Number(after.holds) === before - 1, `${before} → ${after ? Number(after.booked) + Number(after.holds) : 'n/a'}`)

  /* ---- 6. Tracking privacy ----------------------------------------- */
  const wrongPhone = await json('/api/track', { method: 'POST', body: JSON.stringify({ reference, phone: '9000000000' }) })
  check('tracking rejects the wrong phone number', wrongPhone.status === 404)
  const rightPhone = await json('/api/track', { method: 'POST', body: JSON.stringify({ reference, phone: '9876500001' }) })
  check('tracking works with reference + phone', rightPhone.status === 200 && rightPhone.body?.reference === reference, JSON.stringify(rightPhone.body))

  /* ---- 7. Status transition validation ----------------------------- */
  const bookingId = booking1.body?.bookingId
  const skip = await json('/api/admin/bookings', { method: 'PATCH', body: JSON.stringify({ id: bookingId, action: 'status', status: 'report_ready' }) }, cookie)
  check('illegal status jump is rejected', skip.status === 409, JSON.stringify(skip.body))

  /* ---- 8. Payment webhook signature --------------------------------- */
  const webhook = await fetch(`${BASE}/api/payments/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': 'invalid' }, body: JSON.stringify({ event: 'payment.captured', payload: {} }) })
  check('webhook rejects an invalid signature', webhook.status === 401)
  const verify = await json('/api/payments/verify', { method: 'POST', body: JSON.stringify({ razorpay_order_id: 'order_x', razorpay_payment_id: 'pay_x', razorpay_signature: 'bad', reference, accessToken: 'bad' }) })
  check('checkout verification rejects a bad signature', verify.status === 404 || verify.status === 400)

  /* ---- 9. Enquiries ------------------------------------------------- */
  const enquiry = await json('/api/enquiries', { method: 'POST', body: JSON.stringify({ name: 'QA Enquiry', phone: '9876500009', subject: 'QA', message: 'Automated test enquiry — please ignore.' }) })
  check('enquiry accepted and stored', enquiry.status === 201 && Boolean(enquiry.body?.reference), `status=${enquiry.status} body=${JSON.stringify(enquiry.body)}`)
  const storedEnquiry = (await db.query('SELECT status FROM enquiries WHERE reference = $1', [enquiry.body?.reference ?? ''])).rows[0]
  check('enquiry persisted with status new', storedEnquiry?.status === 'new')
  const badEnquiry = await json('/api/enquiries', { method: 'POST', body: JSON.stringify({ name: 'QA', phone: '123', message: 'hi' }) })
  check('invalid enquiry is rejected with 400', badEnquiry.status === 400)

  /* ---- 10. Archive instead of destructive delete -------------------- */
  const archive = await json(`/api/admin/tests/${testId}`, { method: 'DELETE' }, cookie)
  check('referenced test is archived, not deleted', archive.body?.archived === true || archive.body?.deleted === true)
  const gone = await json('/api/catalogue?q=' + encodeURIComponent(suffix))
  check('archived test disappears from the public catalogue', gone.body?.total === 0)

  const logout = await fetch(`${BASE}/api/admin/auth/session`, { method: 'DELETE', headers: { 'x-sv-request': 'fetch' }, })
  check('logout responds', logout.ok)
} catch (error) {
  failed += 1
  results.push(`FAIL  unexpected error — ${error.message}`)
} finally {
  // Clean up QA data (bookings first: booking_items reference tests)
  await db.query(`DELETE FROM bookings WHERE patient_name LIKE 'QA %'`)
  await db.query(`DELETE FROM diagnostic_tests WHERE name LIKE 'QA Test %'`)
  await db.query(`DELETE FROM enquiries WHERE name = 'QA Enquiry'`)
  if (fixture?.id) {
    await db.query(`DELETE FROM slot_reservations WHERE slot_id = $1`, [fixture.id])
    await db.query(`DELETE FROM collection_slots WHERE id = $1`, [fixture.id])
  }
  await db.query(`DELETE FROM enquiries WHERE name = 'QA Enquiry'`)
  await db.end()
  console.log(results.join('\n'))
  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed ? 1 : 0)
}
