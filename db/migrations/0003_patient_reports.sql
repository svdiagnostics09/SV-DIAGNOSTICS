-- 0003: patient report PDFs, their WhatsApp delivery log and the downloaded audit trail.
--
-- The PDF itself is stored as bytea so that every serverless instance (and every
-- region) sees the same file — a local `public/uploads` write would disappear on
-- the next cold start. The token is the credential used by the patient link on
-- /track: it is random, unguessable and can be revoked by the administrator.
CREATE TABLE IF NOT EXISTS patient_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  -- Nullable so a re-upload history survives when the booking's patient row goes away.
  file_name text NOT NULL,
  mime_type text NOT NULL DEFAULT 'application/pdf',
  size_bytes integer NOT NULL CHECK (size_bytes > 0),
  content bytea NOT NULL,
  sha256 text NOT NULL,
  -- Unbuffered download link: /api/reports/download?token=…
  access_token text NOT NULL UNIQUE,
  uploaded_by uuid REFERENCES users(id) ON DELETE
  SET NULL,
    uploaded_by_email text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    revoked_at timestamptz,
    downloads integer NOT NULL DEFAULT 0 CHECK (downloads >= 0),
    last_downloaded_at timestamptz
);
CREATE INDEX IF NOT EXISTS patient_reports_booking_idx ON patient_reports (booking_id, created_at DESC);
-- One live report per booking: uploading again replaces the previous one, which is
-- soft-deleted (revoked) so a link already sent on WhatsApp stops working.
CREATE UNIQUE INDEX IF NOT EXISTS patient_reports_live_key ON patient_reports (booking_id)
WHERE revoked_at IS NULL;
-- Delivery log for the WhatsApp Cloud API (one row per attempt, never updated silently).
CREATE TABLE IF NOT EXISTS report_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES patient_reports(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp')),
  recipient text NOT NULL DEFAULT '',
  template text NOT NULL DEFAULT 'patient_report',
  status text NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  provider_message_id text,
  detail text NOT NULL DEFAULT '',
  actor_email text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS report_deliveries_report_idx ON report_deliveries (report_id, created_at DESC);