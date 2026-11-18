-- +goose Up
ALTER TABLE integrations DROP CONSTRAINT IF EXISTS integrations_provider_check;
ALTER TABLE integrations ADD CONSTRAINT integrations_provider_check
  CHECK (provider IN ('sentry', 'posthog', 'slack', 'webhooks', 'github_app'));

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS auto_pr_credits INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS autopr_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  repo TEXT NOT NULL DEFAULT '',
  branch TEXT NOT NULL DEFAULT '',
  pr_url TEXT NOT NULL DEFAULT '',
  pr_number INT,
  cost_cents INT NOT NULL DEFAULT 0,
  error TEXT NOT NULL DEFAULT '',
  log_excerpt TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS autopr_runs_project_idx ON autopr_runs (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS autopr_runs_ticket_idx ON autopr_runs (ticket_id, created_at DESC);
CREATE INDEX IF NOT EXISTS autopr_runs_org_idx ON autopr_runs (org_id, created_at DESC);

CREATE TABLE IF NOT EXISTS credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  delta INT NOT NULL,
  reason TEXT NOT NULL,
  run_id UUID REFERENCES autopr_runs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS credit_ledger_org_idx ON credit_ledger (org_id, created_at DESC);

-- +goose Down
DROP TABLE IF EXISTS credit_ledger;
DROP TABLE IF EXISTS autopr_runs;
ALTER TABLE organizations DROP COLUMN IF EXISTS auto_pr_credits;
DELETE FROM integrations WHERE provider = 'github_app';
ALTER TABLE integrations DROP CONSTRAINT IF EXISTS integrations_provider_check;
ALTER TABLE integrations ADD CONSTRAINT integrations_provider_check
  CHECK (provider IN ('sentry', 'posthog', 'slack', 'webhooks'));
