# SV Diagnostics — Lab & Imaging (Hyderabad)

Production-oriented diagnostic laboratory platform: public website, database-backed
catalogue, booking engine with atomic slot capacity, Razorpay payments, and an
administrator console (CMS, bookings, enquiries, settings, audit log).

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Lucide
- **Backend:** Next.js route handlers (Node runtime), Zod validation
- **Database:** Neon PostgreSQL via `pg` (Pool) + Drizzle schema definitions
- **Auth:** server-side sessions (httpOnly cookie, SHA-256 token hash in `sessions`), scrypt passwords
- **Payments:** Razorpay orders, signature-verified checkout, HMAC-verified idempotent webhooks

> No fabricated data ships with the app. The dashboard shows real counts (zeros when empty),
> and every placeholder in the price list, banners, FAQs and locations is created by an
> administrator. `scripts/data/seed-catalogue.mjs` is an **optional sample seed** for local
> development — it is clearly labelled and never run automatically.

---

## 1. Setup

```bash
cp .env.example .env.local     # fill DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD
npm install
npm run db:migrate             # applies db/migrations/*.sql, creates the first owner account
npm run dev                    # http://localhost:3000
```

Then sign in at `/admin/login` and add your locations, service areas, slots, categories,
tests and packages. The website reflects those changes immediately.

Optional local sample data (Hyderabad locations, 9 tests, one package, 4 slots, FAQs, a banner):

```bash
npm run db:seed
```

Create another administrator (or reset a password) from the server:

```bash
npm run admin:create -- --email owner@svdiagnostics.in --name "Owner" --password "a-long-password"
```

## 2. Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Neon **pooled** connection string (`-pooler` host) |
| `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD` | first run | Bootstrap owner account (≥10 chars). No default exists. |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | for online payment | Server-side order creation + checkout signature checks |
| `RAZORPAY_WEBHOOK_SECRET` | for webhooks | HMAC verification of `/api/payments/webhook` |
| `RESEND_API_KEY`, `EMAIL_FROM`, `STAFF_EMAIL` | optional | Transactional email + staff alerts |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | for WhatsApp reports | Meta WhatsApp Cloud API credentials (server-only) |
| `WHATSAPP_TEMPLATE_NAME`, `WHATSAPP_API_VERSION` | optional | Pin the template / Graph version instead of the Business settings values |
| `NEXT_PUBLIC_SITE_URL` | recommended | Absolute origin used in the patient report link (e.g. `https://svdiagnostics.in`) |
| `IP_HASH_SALT` | optional | Salt for hashed client identifiers in consent records |
| `DATABASE_POOL_SIZE` | optional | Pool size (default 5, suitable for Neon pooled connections) |

Secrets live only in server code. `RAZORPAY_KEY_SECRET`, the webhook secret and the database
URL are never sent to the browser.

## 3. Database

`db/migrations/0001_init.sql` creates the normalised schema; `schema_migrations` tracks what has
been applied. Key design points:

- **Money** is stored in integer **paise**; all timestamps are `timestamptz` (UTC). Appointment
  dates are calendar dates; display uses `Asia/Kolkata`.
- **Capacity:** `slot_reservations` has one row per `(slot, location, date)` with
  `capacity`, `booked`, `holds` and a `CHECK (booked + holds <= capacity)` constraint.
  `bookings` → `slot_reservations(reservation_id)`; short-lived `slot_holds` expire.
- **Controlled statuses:** `bookings.status` is constrained to the eight states in the brief;
  transitions are validated in `lib/booking.ts` (`ALLOWED_TRANSITIONS`).
- **Idempotency:** `bookings.idempotency_key` (unique), `payment_events(provider, event_id)` (unique).
- **References:** booking references are random (`SV-2026-XXXXXXXX`), never sequential, and
  combined with the registered phone for tracking.

Tables: users, sessions, customer_profiles, patients, diagnostic_categories, diagnostic_tests,
investigations, test_investigations, health_packages, package_tests, locations, service_areas,
collection_slots, slot_blackouts, slot_reservations, slot_holds, bookings, booking_items,
booking_events, payments, payment_events, consent_records, notifications, audit_logs,
enquiries, banners, faqs, blog_posts, business_settings, login_attempts.

## 4. Booking, capacity and payments

1. `PUT /api/bookings` gives a server-computed price preview (browser totals are cosmetic).
2. `POST /api/bookings` re-prices from the database, validates method/location/pincode/weekday/
   blackout/horizon, then inside **one transaction** inserts (or refreshes) the reservation row,
   locks it with `SELECT … FOR UPDATE`, checks capacity, increments `holds`, writes the booking,
   items, consent record and hold. Racing requests wait on the lock and receive **409** once full.
3. Confirming a booking (staff action or a verified payment) converts the hold into `booked`.
   Cancelling releases exactly one place (hold or booked) — never twice.
4. Unpaid holds expire after `slotHoldMinutes`; `releaseExpiredHolds()` runs lazily on availability
   reads and cancels abandoned `pending_confirmation` bookings, freeing capacity.
5. Online payment creates a Razorpay order server-side. The booking becomes **paid/confirmed only**
   after the signature-verified callback (`/api/payments/verify`) or a verified webhook. Amount
   mismatches are logged and never marked paid. Webhook replays are no-ops.

## 5. Security

- Sessions: 256-bit random token, only its SHA-256 hash stored, 8h expiry, revocable (logout,
  password change, deactivation). `HttpOnly`, `SameSite=Lax`, `Secure` in production.
- Password hash: scrypt (N=16384) with per-user salt. No hardcoded production password.
- Login rate limiting in Postgres (per account and per IP); successful logins don't count.
- CSRF: `proxy.ts` + API guards require `x-sv-request: fetch` and a same-origin `Origin` on mutations.
- Every `/api/admin/*` handler calls `guard()` (session verify + role); owner-only actions use
  `guard({ owner: true })`. All SQL is parameterised. Errors are generic to clients.
- Tracking/cancellation require reference **and** registered mobile number; confirmation pages
  require an access token (or an authenticated admin). Confirmation pages are `noindex`.
- Audit log records sign-ins, catalogue changes, booking status changes, refunds and settings updates.

## 6. Patient reports on WhatsApp

**Admin → Operations → Patient Reports.** One row per booking, with the current
report, its last WhatsApp attempt and three actions:

1. **Upload PDF** — stored in Postgres (`patient_reports.content`), so every
   serverless instance sees the same file. Only PDFs pass (checked by file
   signature, max 20 MB). Uploading a new version revokes the previous link.
2. **Send on WhatsApp** — never automatic. The send is logged in
   `report_deliveries` with Meta's message id, or the exact error Meta returned.
3. **History** — every version, download count and delivery attempt; a different
   mobile number can be used for one send without changing the booking.

The patient gets a private link (`/api/reports/download?token=…`, 32 random
bytes, revocable) and can also open the report from **Track booking** after
entering the reference *and* registered mobile number.

Configure it at Meta for Developers → WhatsApp → API Setup, then set
`WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` on the host. The default template
`patient_report` needs three body parameters — `{{1}}` patient name, `{{2}}`
booking reference, `{{3}}` report link. Plain text (no template) only works
within 24 hours of the patient messaging you; templates work any time. Set the
template name under **Business settings → WhatsApp report delivery**.

## 7. Testing

```bash
npm run dev                     # in one terminal
npm test                        # in another (TEST_BASE_URL defaults to :3100; set it to your port)
# e.g. TEST_BASE_URL=http://localhost:3000 ADMIN_PASSWORD=… npm test
```

`scripts/test-api.mjs` runs 30+ checks covering authentication/authorization, CSRF, test CRUD and
public visibility, price consistency, booking persistence, client-amount tampering, idempotent
duplicates, concurrent capacity enforcement, cancellation capacity release, tracking privacy,
illegal status jumps, webhook/checkout signature rejection, enquiry validation and archiving.
It creates and removes its own fixtures. See `TEST_REPORT.md` for the latest run.

## 8. Deployment

1. Create a Neon project; copy the **pooled** connection string.
2. Set all environment variables in your host (Vercel: Project → Settings → Environment Variables).
3. Build command `npm run build`, start command `npm start`. Run `npm run db:migrate` once (locally or
   in a release step) against the production database.
4. In Razorpay, add the webhook `https://<domain>/api/payments/webhook` for `payment.captured`,
   `payment.failed`, `refund.processed` and set the same secret as `RAZORPAY_WEBHOOK_SECRET`.
5. Serve over HTTPS (`Secure` cookies are on in production) and verify `/admin/login` works with
   the owner account.

### Vercel (recommended)

`vercel.json` pins the Node framework and the `bom1` region, and gives the
report-upload route 60 seconds.

```bash
npx vercel link                     # link this folder to the Vercel project
# Add every variable from .env.example under Project → Settings → Environment Variables
DATABASE_URL="postgres://…" ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run db:migrate
npx vercel --prod
```

Migrations are **not** run by the build — run `db:migrate` once per schema change
against the production `DATABASE_URL` (step 3). Then set `NEXT_PUBLIC_SITE_URL`
to the production domain and redeploy so WhatsApp links use it.

> Brand logo uploads still write to `public/uploads/brand` (local disk). On a
> read-only/serverless host that folder does not persist across deployments —
> upload the logo once after each deploy, or host it and paste a URL. Patient
> report PDFs are **not** affected: they live in Postgres.

### Self-hosted (Node / Docker / Render / Railway)

The app needs Node 22+ and one long-running process; no filesystem writes are
required for anything except the brand logo.

```bash
npm ci && npm run build && npm run db:migrate && npm start
```

## 9. Layout

```
app/                 routes (public pages, admin page, API route handlers)
components/site/     public UI (header/footer, cards, booking wizard, tracking, forms)
components/admin/    console shell + panels (dashboard, tests, bookings, settings…)
lib/                 db, auth, validation, catalogue, network, booking, payments, content, audit,
                     notify (email + WhatsApp), reports (patient report PDFs)
db/                  schema.ts (Drizzle), migrations, migrate runner
scripts/             test-api.mjs, create-admin.mjs, data/seed-catalogue.mjs (optional)
```

