-- Upgrade script for databases created from an older schema.sql (safe to re-run).
BEGIN;
ALTER TABLE proposals DROP CONSTRAINT IF EXISTS proposals_status_check;
ALTER TABLE proposals ADD CONSTRAINT proposals_status_check
  CHECK (status IN ('Draft','Submitted','Under Review','Financial Review','Approved','Rejected','Withdrawn'));
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS estimated_budget numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expected_beneficiaries text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'Medium',
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS geography text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS review_notes text NOT NULL DEFAULT '';
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS event_type text NOT NULL DEFAULT 'Community',
  ADD COLUMN IF NOT EXISTS organizer text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS budget numeric(14,2) NOT NULL DEFAULT 0;
COMMIT;
BEGIN;
CREATE TABLE IF NOT EXISTS event_photos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
    caption text NOT NULL DEFAULT '',
    content_type text NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp', 'image/gif')),
    size_bytes integer NOT NULL CHECK (size_bytes > 0),
    data bytea NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS event_photos_event_idx ON event_photos(event_id, created_at DESC);
COMMIT;
