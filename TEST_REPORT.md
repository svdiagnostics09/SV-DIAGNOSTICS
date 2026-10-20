# Test report — SV Diagnostics platform

Date: 2026-10-20 · Runtime: Node 22, Next.js (App Router), Neon PostgreSQL
Command: `TEST_BASE_URL=http://localhost:3100 ADMIN_PASSWORD=… node scripts/test-api.mjs`

## Automated API tests — 34 checks, all passing

| # | Area | Check | Result |
|---|------|-------|--------|
| 1 | Fixture | QA slot created with known capacity (4/day) | PASS |
| 2 | Auth | `GET /api/admin/tests` without a session → 401 | PASS |
| 3 | Auth | Login with a wrong password → 401 | PASS |
| 4 | Auth | Login succeeds and sets an HttpOnly session cookie | PASS |
| 5 | Auth | Session endpoint returns the signed-in admin | PASS |
| 6 | CSRF | Mutation without `x-sv-request` header → 403 | PASS |
| 7 | Tests | Create + publish test → 201, status `published` | PASS |
| 8 | Pricing | 20% discount applied server-side (₹1250 → ₹1000) | PASS |
| 9 | Catalogue | New test appears in public search results | PASS |
| 10 | Catalogue | Price-list page renders the new test | PASS |
| 11 | Pricing | Price update saved | PASS |
| 12 | Pricing | Updated price is reflected in the public catalogue | PASS |
| 13 | Booking | Booking created (201) | PASS |
| 14 | Booking | Reference issued and server total ₹1500 | PASS |
| 15 | Booking | Booking persisted in PostgreSQL | PASS |
| 16 | Booking | Client-supplied amount ignored; server price used | PASS |
| 17 | Idempotency | Duplicate submission returns the same booking | PASS |
| 18 | Idempotency | Duplicate submission is not double-counted | PASS |
| 19 | Capacity | 6 parallel bookings on a 4-place slot → exactly 4 succeed, 2 × 409 | PASS |
| 20 | Capacity | Counter row never exceeds `capacity` | PASS |
| 21 | Cancellation | Customer cancellation succeeds | PASS |
| 22 | Cancellation | Exactly one place returned to capacity | PASS |
| 23 | Privacy | Tracking rejects the wrong phone number | PASS |
| 24 | Privacy | Tracking works with reference + phone | PASS |
| 25 | Transitions | Illegal jump (pending → report ready) → 409 | PASS |
| 26 | Payments | Webhook with invalid signature → 401 | PASS |
| 27 | Payments | Checkout verification with bad signature → 400/404 | PASS |
| 28 | Enquiries | Valid enquiry stored with status `new` | PASS |
| 29 | Enquiries | Invalid enquiry → 400 | PASS |
| 30 | Archival | Referenced test archived instead of deleted | PASS |
| 31 | Catalogue | Archived test disappears from public catalogue | PASS |
| 32 | Auth | Logout responds | PASS |
| 33 | Catalogue fixture | QA slot + seeded service area present | PASS |
| 34 | Fixture cleanup | Test archived (referenced) disappears from public catalogue | PASS |

All fixtures (QA slot, QA tests, QA bookings, QA enquiry) are removed at the end of the run.

## Manual / HTTP verification

- Public routes render 200: `/`, `/tests`, `/tests?q=…`, `/tests/<slug>`, `/price-list`, `/packages`,
  `/packages/<slug>`, `/locations`, `/service-areas`, `/home-collection`, `/about`, `/contact`,
  `/faq`, `/blog`, `/track`, `/book`, `/book?test=<id>`, `/privacy`, `/terms`, `/refund-policy`,
  `/patient-consent`, `/booking/confirmation/<ref>`.
- Admin API endpoints return 200 with a session and 401 without: dashboard, tests, packages,
  categories, investigations, banners, faqs, blog, bookings (incl. enquiries/audit views),
  customers, reports, locations, service-areas, slots, settings. `/admin` redirects to
  `/admin/login` when signed out and renders the console when signed in.
- `npx tsc --noEmit` clean; `npx next build` completes.

## Admin credentials (this machine)

- **Login:** `/admin/login`
- **Email / username:** `admin`
- **Password:** not stored in the repo or `README`. It is a scrypt hash in the `users` table. The local password used during the build was removed from `.env.local`; reset it any time with:

  ```bash
  npm run admin:create -- --email admin --name "SV Administrator" --password "<new-strong-password>"
  ```

  `admin:create` both creates a new admin and resets an existing one, invalidating all active sessions. No admin credentials are committed to git.

## Not verifiable in this environment

- **Razorpay live flow** — no `RAZORPAY_KEY_ID/SECRET` were provided, so online payment is listed as
  "Not configured" in the admin panel and checkout reveals the server error instead of a fake success.
  Signature verification (checkout + webhook) is implemented and covered by negative tests.
- **Email delivery** — no `RESEND_API_KEY`; notifications are recorded as `skipped` with the reason.
- **Neon control-plane features** (branching, autoscaling) are managed outside the app.

## Price-list import

`scripts/data/import-price-list.mjs` loads `scripts/data/sv-price-list.tsv` (170 rows: 164 investigations + 6 SV profiles).

- 176 published diagnostic tests in the catalogue after import (164 price-list rows + 12 earlier sample rows kept by the lab).
- 9 category buckets created automatically (Biochemistry, Haematology, Microbiology, Serology & Infection, Immunology, Thyroid, Diabetes, Vitamins & Minerals, Hormones, Imaging & Cardiology).
- 2 health packages (Basic Health Check, plus any SV profile rows imported as tests — see Known limits).
- Re-running the script only updates prices/samples; it never deletes admin-created records.

## Known limits

- The app assumes one deployment region with Node runtime; SSE was replaced by authenticated
  polling (dashboard every 20 s, bookings every 30 s, enquiries every 30 s) so live counts work on
  serverless hosting too.
- Reports (PDF) are not uploaded in this version; booking statuses stop at "Report ready" and
  "Completed" and can be updated by staff.
