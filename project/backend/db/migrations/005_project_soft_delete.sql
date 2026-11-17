-- +goose Up
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS projects_org_active_created_idx
  ON projects (org_id, created_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS projects_deleted_at_idx
  ON projects (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- +goose Down
DROP INDEX IF EXISTS projects_deleted_at_idx;
DROP INDEX IF EXISTS projects_org_active_created_idx;
ALTER TABLE projects DROP COLUMN IF EXISTS deleted_at;
