package application

import (
	"context"
	"database/sql"
	"errors"
)

// Downgrade freeze (audit 26 Nov): when an org drops to a plan with lower limits, nothing
// is deleted. Whatever sits beyond the new limit is frozen and comes back on upgrade:
//   - projects beyond MaxProjects (newest first) stop taking new reports,
//   - members beyond MaxSeats (latest joined first) act as viewers,
//   - repos beyond MaxReposPerProject stop routing (fallback and oldest stay on).
// Everything is computed from the current plan, so an upgrade unfreezes at once.

// ErrProjectFrozen rejects new reports on a project beyond the plan's project limit.
var ErrProjectFrozen = errors.New("project is over the plan's project limit")

// ProjectFrozen reports whether a project sits beyond its org's project limit.
// The oldest projects stay active.
func ProjectFrozen(ctx context.Context, q queryRower, projectID string) (bool, error) {
	var plan string
	var rank int
	err := q.QueryRowContext(ctx, `
		SELECT o.plan, x.rn FROM (
			SELECT id, org_id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
			FROM projects
			WHERE deleted_at IS NULL
			  AND org_id = (SELECT org_id FROM projects WHERE id=$1)
		) x JOIN organizations o ON o.id = x.org_id
		WHERE x.id=$1`, projectID).Scan(&plan, &rank)
	if errors.Is(err, sql.ErrNoRows) {
		return false, ErrNotFound
	}
	if err != nil {
		return false, err
	}
	limit := LimitsForPlan(plan).MaxProjects
	return limit > 0 && rank > limit, nil
}

// frozenProjectIDs returns the org's projects beyond its project limit.
func (s *Store) frozenProjectIDs(ctx context.Context, orgID string) (map[string]bool, error) {
	var plan string
	if err := s.DB.QueryRowContext(ctx, `SELECT plan FROM organizations WHERE id=$1`, orgID).Scan(&plan); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return map[string]bool{}, nil
		}
		return nil, err
	}
	out := map[string]bool{}
	limit := LimitsForPlan(plan).MaxProjects
	if limit == 0 {
		return out, nil
	}
	rows, err := s.DB.QueryContext(ctx, `
		SELECT id FROM projects WHERE org_id=$1 AND deleted_at IS NULL
		ORDER BY created_at, id OFFSET $2`, orgID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out[id] = true
	}
	return out, rows.Err()
}

// seatRankSQL ranks an org's non-owner members by when they joined (invite accepted,
// else account creation). Owners always keep their seat.
const seatRankSQL = `
	SELECT m.user_id, ROW_NUMBER() OVER (ORDER BY COALESCE(
		(SELECT MIN(i.accepted_at) FROM invites i
		 WHERE i.org_id = m.org_id AND lower(i.email) = lower(u.email) AND i.accepted_at IS NOT NULL),
		u.created_at), m.user_id) AS rn
	FROM memberships m JOIN users u ON u.id = m.user_id
	WHERE m.org_id = $1 AND m.role <> 'owner'`

// seatLockedUsers returns members beyond the org's seat limit. They keep their membership
// and stored role but act as viewers until the org upgrades or frees a seat.
func (s *Store) seatLockedUsers(ctx context.Context, orgID string) (map[string]bool, error) {
	var plan string
	var owners int
	if err := s.DB.QueryRowContext(ctx, `
		SELECT o.plan, (SELECT COUNT(*) FROM memberships WHERE org_id=o.id AND role='owner')
		FROM organizations o WHERE o.id=$1`, orgID).Scan(&plan, &owners); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return map[string]bool{}, nil
		}
		return nil, err
	}
	out := map[string]bool{}
	limit := LimitsForPlan(plan).MaxSeats
	if limit == 0 {
		return out, nil
	}
	allowed := limit - owners
	if allowed < 0 {
		allowed = 0
	}
	rows, err := s.DB.QueryContext(ctx, `SELECT user_id FROM (`+seatRankSQL+`) x WHERE x.rn > $2`, orgID, allowed)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out[id] = true
	}
	return out, rows.Err()
}

// effectiveRole turns a member beyond the seat limit into a viewer.
func (s *Store) effectiveRole(ctx context.Context, orgID, userID, role string) (string, error) {
	if role != "member" {
		return role, nil
	}
	locked, err := s.seatLockedUsers(ctx, orgID)
	if err != nil {
		return "", err
	}
	if locked[userID] {
		return "viewer", nil
	}
	return role, nil
}

// repoRoutingFrozen returns repos that stop routing because the project has more
// unpaused repos than the plan allows. The fallback and the oldest repos stay on.
func repoRoutingFrozen(ctx context.Context, q dbQuerier, projectID string) (map[string]bool, error) {
	var plan string
	if err := q.QueryRowContext(ctx, `
		SELECT o.plan FROM projects p JOIN organizations o ON o.id = p.org_id WHERE p.id=$1`,
		projectID).Scan(&plan); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return map[string]bool{}, nil
		}
		return nil, err
	}
	out := map[string]bool{}
	limit := LimitsForPlan(plan).MaxReposPerProject
	if limit == 0 {
		return out, nil
	}
	rows, err := q.QueryContext(ctx, `
		SELECT id FROM project_repos WHERE project_id=$1 AND NOT routing_paused
		ORDER BY is_fallback DESC, created_at, id OFFSET $2`, projectID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out[id] = true
	}
	return out, rows.Err()
}

// dbQuerier is satisfied by both *sql.DB and *sql.Tx.
type dbQuerier interface {
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
}
