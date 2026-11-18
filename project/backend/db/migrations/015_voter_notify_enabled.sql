-- +goose Up
ALTER TABLE projects ADD COLUMN IF NOT EXISTS voter_notify_enabled BOOLEAN NOT NULL DEFAULT true;

-- +goose Down
ALTER TABLE projects DROP COLUMN IF EXISTS voter_notify_enabled;
