-- 0002: reconcile legacy objects and harden the payment-event indexes.
--
-- The database already contained a legacy `notifications` table (id integer,
-- order_id text, no booking_id) from the previous prototype. The new model
-- needs booking_id/subject/template/status. Rename the old table out of the way
-- (kept for reference, not dropped) and create the new one.
DO $$ BEGIN IF to_regclass('public.notifications') IS NOT NULL
AND NOT EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_name = 'notifications'
    AND column_name = 'booking_id'
) THEN
ALTER TABLE notifications
  RENAME TO notifications_legacy_v1;
END IF;
END $$;
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES bookings(id) ON DELETE
  SET NULL,
    channel text NOT NULL CHECK (
      channel IN ('email', 'sms', 'whatsapp', 'in_app')
    ),
    recipient text NOT NULL DEFAULT '',
    template text NOT NULL,
    status text NOT NULL DEFAULT 'queued' CHECK (
      status IN ('queued', 'sent', 'failed', 'skipped')
    ),
    detail text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    sent_at timestamptz
);
CREATE INDEX IF NOT EXISTS notifications_created_idx ON notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_booking_idx ON notifications (booking_id);
-- Payment event idempotency: one row per provider event id.
CREATE UNIQUE INDEX IF NOT EXISTS payment_events_event_key ON payment_events (provider, event_id);
-- Fast lookup of unused holds per reservation (expiry sweeps).
CREATE INDEX IF NOT EXISTS slot_holds_reservation_idx ON slot_holds (reservation_id)
WHERE released_at IS NULL;