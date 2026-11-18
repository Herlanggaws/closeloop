-- +goose Up
ALTER TABLE projects ADD COLUMN IF NOT EXISTS banner_enabled BOOLEAN NOT NULL DEFAULT true;

-- +goose Down
ALTER TABLE projects DROP COLUMN IF EXISTS banner_enabled;
