ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS quota_locked BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS reports_ticket_quota_idx
  ON reports (ticket_id, quota_locked, created_at);
