package application

import (
	"context"
	"encoding/json"
	"strconv"
	"time"
)

type AuditEntry struct {
	ID        string          `json:"id"`
	OrgID     string          `json:"org_id"`
	Actor     string          `json:"actor"`
	Action    string          `json:"action"`
	Target    string          `json:"target"`
	IP        string          `json:"ip"`
	Payload   json.RawMessage `json:"payload"`
	CreatedAt time.Time       `json:"created_at"`
}

type AuditFilter struct {
	Action string
	Actor  string
	Since  time.Time
	Limit  int
}

func (s *Store) InsertAudit(
	ctx context.Context,
	orgID, actor, action, target, ip string,
	payload map[string]any,
) error {
	if orgID == "" || action == "" {
		return ErrInvalidInput
	}
	if actor == "" {
		actor = "system"
	}
	body := mustJSON(payload)
	_, err := s.DB.ExecContext(ctx, `
		INSERT INTO audit_logs(org_id, actor, action, target, ip, payload)
		VALUES ($1,$2,$3,$4,$5,$6)`,
		orgID, actor, action, target, ip, body)
	return err
}

func (s *Store) ListAuditLogs(ctx context.Context, orgID string, filter AuditFilter) ([]AuditEntry, error) {
	limit := filter.Limit
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	q := `
		SELECT id, org_id, actor, action, target, ip, payload, created_at
		FROM audit_logs
		WHERE org_id = $1`
	args := []any{orgID}
	argN := 2
	if filter.Action != "" {
		q += ` AND action = $` + strconv.Itoa(argN)
		args = append(args, filter.Action)
		argN++
	}
	if filter.Actor != "" {
		q += ` AND actor ILIKE $` + strconv.Itoa(argN)
		args = append(args, "%"+filter.Actor+"%")
		argN++
	}
	if !filter.Since.IsZero() {
		q += ` AND created_at >= $` + strconv.Itoa(argN)
		args = append(args, filter.Since.UTC())
		argN++
	}
	q += ` ORDER BY created_at DESC LIMIT $` + strconv.Itoa(argN)
	args = append(args, limit)

	rows, err := s.DB.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []AuditEntry
	for rows.Next() {
		var e AuditEntry
		if err := rows.Scan(&e.ID, &e.OrgID, &e.Actor, &e.Action, &e.Target, &e.IP, &e.Payload, &e.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}
