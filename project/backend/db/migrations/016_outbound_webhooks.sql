-- +goose Up
ALTER TABLE integrations DROP CONSTRAINT IF EXISTS integrations_provider_check;
ALTER TABLE integrations ADD CONSTRAINT integrations_provider_check
  CHECK (provider IN ('sentry', 'posthog', 'slack', 'webhooks'));

-- +goose Down
DELETE FROM integrations WHERE provider = 'webhooks';
ALTER TABLE integrations DROP CONSTRAINT IF EXISTS integrations_provider_check;
ALTER TABLE integrations ADD CONSTRAINT integrations_provider_check
  CHECK (provider IN ('sentry', 'posthog', 'slack'));
