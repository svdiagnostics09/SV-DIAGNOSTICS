-- 0008: read state for in-app staff notifications.
--
-- The notifications table already records every in_app alert (written on
-- booking creation). The admin bell needs to know which of them a staff member
-- has already seen, so a single nullable timestamp is enough — this is a shared
-- inbox, not a per-user one.
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS read_at timestamptz;
CREATE INDEX IF NOT EXISTS notifications_unread_idx ON notifications (created_at DESC)
WHERE read_at IS NULL
  AND channel = 'in_app';