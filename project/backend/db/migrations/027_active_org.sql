-- +goose Up
-- A user can belong to several workspaces (their own plus ones they were invited to).
-- active_org_id is the one the dashboard is showing; NULL falls back to the user's own.
ALTER TABLE users ADD COLUMN IF NOT EXISTS active_org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- +goose Down
ALTER TABLE users DROP COLUMN IF EXISTS active_org_id;
