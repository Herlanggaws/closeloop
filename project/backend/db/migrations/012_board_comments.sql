-- +goose Up
CREATE TABLE IF NOT EXISTS idea_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES idea_comments(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  is_team BOOLEAN NOT NULL DEFAULT false,
  confirmed_at TIMESTAMPTZ,
  hidden_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idea_comments_ticket_visible_idx
  ON idea_comments (ticket_id, created_at)
  WHERE confirmed_at IS NOT NULL AND hidden_at IS NULL;

CREATE INDEX IF NOT EXISTS idea_comments_ticket_moderation_idx
  ON idea_comments (ticket_id, created_at DESC);

CREATE TABLE IF NOT EXISTS idea_comment_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL UNIQUE,
  comment_id UUID NOT NULL REFERENCES idea_comments(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idea_comment_tokens_comment_idx
  ON idea_comment_tokens (comment_id)
  WHERE used_at IS NULL;

-- +goose Down
DROP INDEX IF EXISTS idea_comment_tokens_comment_idx;
DROP TABLE IF EXISTS idea_comment_tokens;
DROP INDEX IF EXISTS idea_comments_ticket_moderation_idx;
DROP INDEX IF EXISTS idea_comments_ticket_visible_idx;
DROP TABLE IF EXISTS idea_comments;
