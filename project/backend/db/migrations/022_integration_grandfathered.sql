-- +goose Up
-- Pricing update P2 (US-64, US-69): Slack and GitHub Issues need Indie, Linear and Jira need Studio.
-- Connections that exist before the gate ships keep working on any plan.
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS grandfathered BOOLEAN NOT NULL DEFAULT false;
UPDATE integrations SET grandfathered = true;

-- +goose Down
ALTER TABLE integrations DROP COLUMN IF EXISTS grandfathered;
