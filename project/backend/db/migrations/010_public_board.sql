-- +goose Up
ALTER TABLE projects ADD COLUMN IF NOT EXISTS board_slug TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;

UPDATE projects
SET board_slug = 'p-' || substr(replace(id::text, '-', ''), 1, 12)
WHERE board_slug IS NULL OR board_slug = '';

CREATE UNIQUE INDEX IF NOT EXISTS projects_board_slug_uidx ON projects (board_slug);
CREATE INDEX IF NOT EXISTS tickets_project_public_idx ON tickets (project_id) WHERE is_public = true;

-- +goose Down
DROP INDEX IF EXISTS tickets_project_public_idx;
DROP INDEX IF EXISTS projects_board_slug_uidx;
ALTER TABLE tickets DROP COLUMN IF EXISTS is_public;
ALTER TABLE projects DROP COLUMN IF EXISTS board_slug;
