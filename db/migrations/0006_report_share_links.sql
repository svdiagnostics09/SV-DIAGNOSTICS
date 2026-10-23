-- 0006: shareable patient report link.
--
-- A report is sent on WhatsApp as a PDF, and the same message can carry a link
-- the patient can open later on any device to download it. The link is not a
-- public URL: it needs a random, unguessable token that is stored as a SHA-256
-- hash (never in clear, so a database leak cannot be replayed), it expires, and
-- it can be revoked when a newer report replaces it.
ALTER TABLE patient_reports
ADD COLUMN IF NOT EXISTS share_token_hash text;
ALTER TABLE patient_reports
ADD COLUMN IF NOT EXISTS share_token_expires_at timestamptz;
ALTER TABLE patient_reports
ADD COLUMN IF NOT EXISTS share_token_created_at timestamptz;
CREATE INDEX IF NOT EXISTS patient_reports_share_token_idx ON patient_reports (share_token_hash);