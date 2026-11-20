-- +goose Up
-- S-12 Widget section (nZUSl): button label, position, accent colour. Accent is Studio+.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS widget_label TEXT NOT NULL DEFAULT 'Report a problem';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS widget_position TEXT NOT NULL DEFAULT 'bottom_right'
  CHECK (widget_position IN ('bottom_right', 'bottom_left', 'hidden'));
ALTER TABLE projects ADD COLUMN IF NOT EXISTS widget_accent TEXT NOT NULL DEFAULT '#171717';

-- +goose Down
ALTER TABLE projects DROP COLUMN IF EXISTS widget_accent;
ALTER TABLE projects DROP COLUMN IF EXISTS widget_position;
ALTER TABLE projects DROP COLUMN IF EXISTS widget_label;
