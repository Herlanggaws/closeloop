-- +goose Up
ALTER TABLE integrations DROP CONSTRAINT IF EXISTS integrations_provider_check;
ALTER TABLE integrations ADD CONSTRAINT integrations_provider_check
  CHECK (provider IN ('sentry', 'posthog', 'slack', 'webhooks', 'github_app', 'linear', 'jira', 'gitlab'));

ALTER TABLE project_repos ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'github';
ALTER TABLE project_repos DROP CONSTRAINT IF EXISTS project_repos_provider_check;
ALTER TABLE project_repos ADD CONSTRAINT project_repos_provider_check
  CHECK (provider IN ('github', 'gitlab'));

-- +goose Down
ALTER TABLE project_repos DROP CONSTRAINT IF EXISTS project_repos_provider_check;
ALTER TABLE project_repos DROP COLUMN IF EXISTS provider;
DELETE FROM integrations WHERE provider = 'gitlab';
ALTER TABLE integrations DROP CONSTRAINT IF EXISTS integrations_provider_check;
ALTER TABLE integrations ADD CONSTRAINT integrations_provider_check
  CHECK (provider IN ('sentry', 'posthog', 'slack', 'webhooks', 'github_app', 'linear', 'jira'));
