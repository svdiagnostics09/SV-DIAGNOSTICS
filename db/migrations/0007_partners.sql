-- 0007: partner logos.
--
-- Same reasoning as 0005_brand_assets: the bytes live in Postgres so the logo
-- survives a serverless redeploy (public/ is read-only at runtime on Vercel).
-- The image is served from /api/partners/<id>. Admins upload from
-- Admin → Partners; the homepage marquee renders whatever is marked active.
CREATE TABLE IF NOT EXISTS partner_logos (
  id uuid PRIMARY KEY,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  content bytea NOT NULL,
  size_bytes integer NOT NULL CHECK (size_bytes > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS partners (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  role text NOT NULL DEFAULT '',
  href text NOT NULL DEFAULT '',
  logo_id uuid REFERENCES partner_logos(id) ON DELETE
  SET NULL,
    sort_order integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS partners_order_idx ON partners (sort_order, created_at);