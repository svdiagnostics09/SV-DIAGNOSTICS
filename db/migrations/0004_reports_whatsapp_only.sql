-- 0004: patient reports are delivered by WhatsApp only.
--
-- There is no public download link any more: an administrator uploads the PDF and
-- presses “Send on WhatsApp”, which uploads the file to Meta and sends it as a
-- document message. The per-report access token that backed /api/reports/download
-- is therefore no longer written, and its uniqueness requirement is removed while
-- the historical column is kept so existing rows stay intact.
ALTER TABLE patient_reports ALTER COLUMN access_token DROP NOT NULL;

-- 0003 declared access_token UNIQUE, which creates a constraint rather than a
-- plain index — dropping the constraint is what allows NULLs to coexist.
ALTER TABLE patient_reports DROP CONSTRAINT IF EXISTS patient_reports_access_token_key;
DROP INDEX IF EXISTS patient_reports_access_token_key;
DROP INDEX IF EXISTS patient_reports_access_token_idx;

CREATE INDEX IF NOT EXISTS patient_reports_access_token_idx ON patient_reports (access_token);