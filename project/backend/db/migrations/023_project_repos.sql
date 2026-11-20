-- +goose Up
-- Multi-repo per project (D-11, PRD Multi-repo R1–R4).
CREATE TABLE IF NOT EXISTS project_repos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  installation_id BIGINT NOT NULL DEFAULT 0,
  account_login TEXT NOT NULL DEFAULT '',
  full_name TEXT NOT NULL,
  default_branch TEXT NOT NULL DEFAULT 'main',
  is_fallback BOOLEAN NOT NULL DEFAULT false,
  routing_paused BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, full_name)
);
-- At most one fallback per project.
CREATE UNIQUE INDEX IF NOT EXISTS project_repos_one_fallback
  ON project_repos (project_id) WHERE is_fallback;

CREATE TABLE IF NOT EXISTS project_repo_routes (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('web', 'android', 'ios', 'backend', 'shared')),
  repo_id UUID NOT NULL REFERENCES project_repos(id) ON DELETE CASCADE,
  path TEXT NOT NULL DEFAULT '',
  UNIQUE (project_id, platform)
);
CREATE INDEX IF NOT EXISTS project_repo_routes_repo_idx ON project_repo_routes (repo_id);

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS repo_id UUID REFERENCES project_repos(id) ON DELETE SET NULL;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS repo_path TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS tickets_repo_idx ON tickets (project_id, repo_id);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS allow_cross_repo_read BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE autopr_runs DROP CONSTRAINT IF EXISTS autopr_runs_status_check;
ALTER TABLE autopr_runs ADD CONSTRAINT autopr_runs_status_check
  CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled', 'needs_reroute'));
ALTER TABLE autopr_runs ADD COLUMN IF NOT EXISTS suggested_repo TEXT NOT NULL DEFAULT '';
ALTER TABLE autopr_runs ADD COLUMN IF NOT EXISTS reroute_reason TEXT NOT NULL DEFAULT '';

-- Existing single repo (github_app config.repo_full_name) becomes the project's fallback.
INSERT INTO project_repos (project_id, installation_id, account_login, full_name, default_branch, is_fallback)
SELECT i.project_id,
       COALESCE(NULLIF(i.config->>'installation_id', '')::bigint, 0),
       COALESCE(i.config->>'account_login', ''),
       i.config->>'repo_full_name',
       COALESCE(NULLIF(i.config->>'default_branch', ''), 'main'),
       true
FROM integrations i
WHERE i.provider = 'github_app'
  AND COALESCE(i.config->>'repo_full_name', '') <> ''
ON CONFLICT (project_id, full_name) DO NOTHING;

UPDATE tickets t SET repo_id = r.id
FROM project_repos r
WHERE r.project_id = t.project_id AND r.is_fallback AND t.repo_id IS NULL;

-- +goose Down
ALTER TABLE autopr_runs DROP COLUMN IF EXISTS reroute_reason;
ALTER TABLE autopr_runs DROP COLUMN IF EXISTS suggested_repo;
ALTER TABLE autopr_runs DROP CONSTRAINT IF EXISTS autopr_runs_status_check;
ALTER TABLE autopr_runs ADD CONSTRAINT autopr_runs_status_check
  CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled'));
ALTER TABLE projects DROP COLUMN IF EXISTS allow_cross_repo_read;
ALTER TABLE tickets DROP COLUMN IF EXISTS repo_path;
ALTER TABLE tickets DROP COLUMN IF EXISTS repo_id;
DROP TABLE IF EXISTS project_repo_routes;
DROP TABLE IF EXISTS project_repos;
