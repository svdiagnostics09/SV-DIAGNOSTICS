-- 0005: brand assets (logo, favicon) live in Postgres.
--
-- They used to be written to public/uploads/brand, which does not survive a
-- Vercel deployment: every deploy starts from a fresh read-only filesystem, so
-- the logo vanished and the URL in business_settings pointed at a 404. Storing
-- the bytes next to the settings keeps the logo available to every instance and
-- lets the PDF cover and the WhatsApp send reuse the same file.
CREATE TABLE IF NOT EXISTS brand_assets (
  id text PRIMARY KEY CHECK (id IN ('logo', 'favicon')),
  file_name text NOT NULL,
  mime_type text NOT NULL,
  content bytea NOT NULL,
  size_bytes integer NOT NULL CHECK (size_bytes > 0),
  updated_by_email text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);