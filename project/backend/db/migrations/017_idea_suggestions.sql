-- +goose Up
CREATE TABLE IF NOT EXISTS idea_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  confirmed_at TIMESTAMPTZ,
  ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idea_suggestions_project_pending_idx
  ON idea_suggestions (project_id, created_at DESC)
  WHERE confirmed_at IS NULL;

-- +goose Down
DROP INDEX IF EXISTS idea_suggestions_project_pending_idx;
DROP TABLE IF EXISTS idea_suggestions;
