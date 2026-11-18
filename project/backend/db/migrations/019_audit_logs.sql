-- +goose Up
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT '',
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_org_created_idx ON audit_logs (org_id, created_at DESC);
CREATE INDEX audit_logs_org_action_idx ON audit_logs (org_id, action, created_at DESC);

-- +goose Down
DROP TABLE IF EXISTS audit_logs;
