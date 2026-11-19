-- +goose Up
-- Pricing update P1 (US-60, US-61): every plan gets all MCP tools.
-- Give active MCP tokens of Free orgs the write scope and log one audit row per org.
-- Revoked tokens are deleted rows, so they are never touched here.
WITH upgraded AS (
  UPDATE mcp_tokens t
  SET scopes = array_append(t.scopes, 'write')
  FROM projects p
  JOIN organizations o ON o.id = p.org_id
  WHERE t.project_id = p.id
    AND o.plan = 'free'
    AND NOT ('write' = ANY(t.scopes))
  RETURNING p.org_id, t.id
)
INSERT INTO audit_logs (org_id, actor, action, target, payload)
SELECT org_id, 'system', 'mcp.token.scope_upgraded', '',
       jsonb_build_object('tokens', COUNT(*), 'scopes', jsonb_build_array('read', 'write'))
FROM upgraded
GROUP BY org_id;

-- +goose Down
-- Not reversible on purpose: removing write would break agents that already rely on it.
SELECT 1;
