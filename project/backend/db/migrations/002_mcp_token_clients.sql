-- +goose Up
ALTER TABLE mcp_tokens
  ADD COLUMN IF NOT EXISTS clients JSONB NOT NULL DEFAULT '[]'::jsonb;

-- +goose Down
ALTER TABLE mcp_tokens DROP COLUMN IF EXISTS clients;
