-- +goose Up
CREATE TABLE IF NOT EXISTS idea_votes (
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (ticket_id, email)
);

CREATE INDEX IF NOT EXISTS idea_votes_ticket_confirmed_idx
  ON idea_votes (ticket_id)
  WHERE confirmed_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS idea_vote_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL UNIQUE,
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idea_vote_tokens_ticket_email_idx
  ON idea_vote_tokens (ticket_id, email)
  WHERE used_at IS NULL;

-- +goose Down
DROP INDEX IF EXISTS idea_vote_tokens_ticket_email_idx;
DROP TABLE IF EXISTS idea_vote_tokens;
DROP INDEX IF EXISTS idea_votes_ticket_confirmed_idx;
DROP TABLE IF EXISTS idea_votes;
