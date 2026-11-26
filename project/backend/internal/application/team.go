package application

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/closeloop/api/internal/infrastructure/auth"
	"github.com/google/uuid"
)

type OrgMember struct {
	UserID    string    `json:"user_id"`
	Email     string    `json:"email"`
	Name      string    `json:"name"`
	AvatarURL string    `json:"avatar_url"`
	Role      string    `json:"role"`
	JoinedAt  time.Time `json:"joined_at"`
	// SeatLocked marks a member beyond the plan's seat limit (after a downgrade):
	// they act as a viewer until the org upgrades or frees a seat.
	SeatLocked bool `json:"seat_locked"`
}

type Invite struct {
	ID        string     `json:"id"`
	OrgID     string     `json:"org_id"`
	Email     string     `json:"email"`
	Role      string     `json:"role"`
	InvitedBy string     `json:"invited_by"`
	ExpiresAt time.Time  `json:"expires_at"`
	AcceptedAt *time.Time `json:"accepted_at,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
}

type InvitePeek struct {
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	OrgName   string    `json:"org_name"`
	ExpiresAt time.Time `json:"expires_at"`
	Expired   bool      `json:"expired"`
}

func (s *Store) CountOrgSeats(ctx context.Context, orgID string) (int, error) {
	var members, pending int
	if err := s.DB.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM memberships WHERE org_id=$1`, orgID).Scan(&members); err != nil {
		return 0, err
	}
	if err := s.DB.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM invites
		WHERE org_id=$1
		  AND accepted_at IS NULL
		  AND revoked_at IS NULL
		  AND expires_at > now()`, orgID).Scan(&pending); err != nil {
		return 0, err
	}
	return members + pending, nil
}

func (s *Store) ListOrgMembers(ctx context.Context, orgID string) ([]OrgMember, error) {
	locked, err := s.seatLockedUsers(ctx, orgID)
	if err != nil {
		return nil, err
	}
	rows, err := s.DB.QueryContext(ctx, `
		SELECT u.id, u.email, u.name, COALESCE(u.avatar_url, ''), m.role, u.created_at
		FROM memberships m
		JOIN users u ON u.id = m.user_id
		WHERE m.org_id=$1
		ORDER BY m.role='owner' DESC, u.email`, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []OrgMember
	for rows.Next() {
		var m OrgMember
		if err := rows.Scan(&m.UserID, &m.Email, &m.Name, &m.AvatarURL, &m.Role, &m.JoinedAt); err != nil {
			return nil, err
		}
		m.SeatLocked = locked[m.UserID]
		out = append(out, m)
	}
	if out == nil {
		out = []OrgMember{}
	}
	return out, rows.Err()
}

func (s *Store) ListPendingInvites(ctx context.Context, orgID string) ([]Invite, error) {
	rows, err := s.DB.QueryContext(ctx, `
		SELECT id, org_id, email, role, invited_by, expires_at, created_at
		FROM invites
		WHERE org_id=$1
		  AND accepted_at IS NULL
		  AND revoked_at IS NULL
		ORDER BY created_at DESC`, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Invite
	for rows.Next() {
		var inv Invite
		if err := rows.Scan(&inv.ID, &inv.OrgID, &inv.Email, &inv.Role, &inv.InvitedBy, &inv.ExpiresAt, &inv.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, inv)
	}
	if out == nil {
		out = []Invite{}
	}
	return out, rows.Err()
}

func (s *Store) CreateInvites(ctx context.Context, orgID, invitedBy, role string, emails []string) (invites []Invite, rawTokens []string, err error) {
	role = strings.ToLower(strings.TrimSpace(role))
	if !ValidInviteRole(role) {
		return nil, nil, ErrInvalidInput
	}

	cleaned := make([]string, 0, len(emails))
	seen := map[string]bool{}
	for _, raw := range emails {
		email := strings.ToLower(strings.TrimSpace(raw))
		if email == "" || !strings.Contains(email, "@") || seen[email] {
			continue
		}
		seen[email] = true
		cleaned = append(cleaned, email)
	}
	if len(cleaned) == 0 {
		return nil, nil, ErrInvalidInput
	}

	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return nil, nil, err
	}
	defer tx.Rollback()

	var plan string
	if err := tx.QueryRowContext(ctx, `SELECT plan FROM organizations WHERE id=$1 FOR UPDATE`, orgID).Scan(&plan); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil, ErrNotFound
		}
		return nil, nil, err
	}

	var members, pending int
	if err := tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM memberships WHERE org_id=$1`, orgID).Scan(&members); err != nil {
		return nil, nil, err
	}
	if err := tx.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM invites
		WHERE org_id=$1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()`, orgID).Scan(&pending); err != nil {
		return nil, nil, err
	}
	used := members + pending
	limits := LimitsForPlan(plan)
	if limits.MaxSeats != 0 && used+len(cleaned) > limits.MaxSeats {
		return nil, nil, ErrSeatLimit
	}

	expires := time.Now().UTC().Add(7 * 24 * time.Hour)
	for _, email := range cleaned {
		var exists bool
		if err := tx.QueryRowContext(ctx, `
			SELECT EXISTS(
				SELECT 1 FROM memberships m
				JOIN users u ON u.id = m.user_id
				WHERE m.org_id=$1 AND lower(u.email)=lower($2)
			)`, orgID, email).Scan(&exists); err != nil {
			return nil, nil, err
		}
		if exists {
			return nil, nil, ErrConflict
		}

		raw := uuid.NewString() + uuid.NewString()
		hash := auth.SHA256(raw)
		var inv Invite
		err = tx.QueryRowContext(ctx, `
			INSERT INTO invites(org_id, email, role, token_hash, invited_by, expires_at)
			VALUES ($1,$2,$3,$4,$5,$6)
			RETURNING id, org_id, email, role, invited_by, expires_at, created_at`,
			orgID, email, role, hash, invitedBy, expires).
			Scan(&inv.ID, &inv.OrgID, &inv.Email, &inv.Role, &inv.InvitedBy, &inv.ExpiresAt, &inv.CreatedAt)
		if err != nil {
			if strings.Contains(err.Error(), "unique") {
				return nil, nil, ErrConflict
			}
			return nil, nil, err
		}
		invites = append(invites, inv)
		rawTokens = append(rawTokens, raw)
	}

	if err := tx.Commit(); err != nil {
		return nil, nil, err
	}
	return invites, rawTokens, nil
}

func (s *Store) ResendInvite(ctx context.Context, orgID, inviteID, invitedBy string) (Invite, string, error) {
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return Invite{}, "", err
	}
	defer tx.Rollback()

	var inv Invite
	err = tx.QueryRowContext(ctx, `
		SELECT id, org_id, email, role, invited_by, expires_at, created_at
		FROM invites
		WHERE id=$1 AND org_id=$2 AND accepted_at IS NULL AND revoked_at IS NULL
		FOR UPDATE`, inviteID, orgID).
		Scan(&inv.ID, &inv.OrgID, &inv.Email, &inv.Role, &inv.InvitedBy, &inv.ExpiresAt, &inv.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return Invite{}, "", ErrNotFound
	}
	if err != nil {
		return Invite{}, "", err
	}

	raw := uuid.NewString() + uuid.NewString()
	hash := auth.SHA256(raw)
	expires := time.Now().UTC().Add(7 * 24 * time.Hour)
	err = tx.QueryRowContext(ctx, `
		UPDATE invites
		SET token_hash=$2, expires_at=$3, invited_by=$4
		WHERE id=$1
		RETURNING id, org_id, email, role, invited_by, expires_at, created_at`,
		inviteID, hash, expires, invitedBy).
		Scan(&inv.ID, &inv.OrgID, &inv.Email, &inv.Role, &inv.InvitedBy, &inv.ExpiresAt, &inv.CreatedAt)
	if err != nil {
		return Invite{}, "", err
	}
	if err := tx.Commit(); err != nil {
		return Invite{}, "", err
	}
	return inv, raw, nil
}

func (s *Store) RevokeInvite(ctx context.Context, orgID, inviteID string) error {
	res, err := s.DB.ExecContext(ctx, `
		UPDATE invites SET revoked_at=now()
		WHERE id=$1 AND org_id=$2 AND accepted_at IS NULL AND revoked_at IS NULL`, inviteID, orgID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) PeekInvite(ctx context.Context, rawToken string) (InvitePeek, error) {
	hash := auth.SHA256(strings.TrimSpace(rawToken))
	var peek InvitePeek
	err := s.DB.QueryRowContext(ctx, `
		SELECT i.email, i.role, o.name, i.expires_at
		FROM invites i
		JOIN organizations o ON o.id = i.org_id
		WHERE i.token_hash=$1 AND i.accepted_at IS NULL AND i.revoked_at IS NULL`, hash).
		Scan(&peek.Email, &peek.Role, &peek.OrgName, &peek.ExpiresAt)
	if errors.Is(err, sql.ErrNoRows) {
		return InvitePeek{}, ErrNotFound
	}
	if err != nil {
		return InvitePeek{}, err
	}
	peek.Expired = !peek.ExpiresAt.After(time.Now().UTC())
	return peek, nil
}

func (s *Store) AcceptInvite(ctx context.Context, rawToken, userID, userEmail string) (Org, string, error) {
	hash := auth.SHA256(strings.TrimSpace(rawToken))
	userEmail = strings.ToLower(strings.TrimSpace(userEmail))

	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return Org{}, "", err
	}
	defer tx.Rollback()

	var inviteID, orgID, email, role string
	var expires time.Time
	err = tx.QueryRowContext(ctx, `
		SELECT id, org_id, email, role, expires_at
		FROM invites
		WHERE token_hash=$1 AND accepted_at IS NULL AND revoked_at IS NULL
		FOR UPDATE`, hash).
		Scan(&inviteID, &orgID, &email, &role, &expires)
	if errors.Is(err, sql.ErrNoRows) {
		return Org{}, "", ErrNotFound
	}
	if err != nil {
		return Org{}, "", err
	}
	if !expires.After(time.Now().UTC()) {
		return Org{}, "", ErrInvalidInput
	}
	if strings.ToLower(email) != userEmail {
		return Org{}, "", ErrForbidden
	}

	var already bool
	if err := tx.QueryRowContext(ctx, `
		SELECT EXISTS(SELECT 1 FROM memberships WHERE org_id=$1 AND user_id=$2)`, orgID, userID).Scan(&already); err != nil {
		return Org{}, "", err
	}
	if already {
		_, _ = tx.ExecContext(ctx, `UPDATE invites SET accepted_at=now() WHERE id=$1`, inviteID)
		if err := tx.Commit(); err != nil {
			return Org{}, "", err
		}
		org, _, err := s.PrimaryOrg(ctx, userID)
		return org, role, err
	}

	// Invites sent on a bigger plan cannot add members past the current seat limit
	// (for example after a downgrade).
	var plan string
	var members int
	if err := tx.QueryRowContext(ctx, `
		SELECT o.plan, (SELECT COUNT(*) FROM memberships WHERE org_id=o.id)
		FROM organizations o WHERE o.id=$1`, orgID).Scan(&plan, &members); err != nil {
		return Org{}, "", err
	}
	if LimitsForPlan(plan).SeatLimitReached(members) {
		return Org{}, "", ErrSeatLimit
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO memberships(org_id, user_id, role) VALUES ($1,$2,$3)`, orgID, userID, role); err != nil {
		if strings.Contains(err.Error(), "unique") {
			return Org{}, "", ErrConflict
		}
		return Org{}, "", err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE invites SET accepted_at=now() WHERE id=$1`, inviteID); err != nil {
		return Org{}, "", err
	}

	var org Org
	if err := tx.QueryRowContext(ctx, `SELECT id, name, plan FROM organizations WHERE id=$1`, orgID).
		Scan(&org.ID, &org.Name, &org.Plan); err != nil {
		return Org{}, "", err
	}

	// Drop empty personal orgs created at signup so PrimaryOrg lands on the invited workspace.
	rows, err := tx.QueryContext(ctx, `
		SELECT o.id
		FROM organizations o
		JOIN memberships m ON m.org_id = o.id
		WHERE m.user_id=$1 AND m.role='owner' AND o.id <> $2`, userID, orgID)
	if err != nil {
		return Org{}, "", err
	}
	defer rows.Close()
	var emptyOrgs []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return Org{}, "", err
		}
		emptyOrgs = append(emptyOrgs, id)
	}
	if err := rows.Err(); err != nil {
		return Org{}, "", err
	}
	_ = rows.Close()
	for _, id := range emptyOrgs {
		var members, projects int
		if err := tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM memberships WHERE org_id=$1`, id).Scan(&members); err != nil {
			return Org{}, "", err
		}
		if err := tx.QueryRowContext(ctx, `
			SELECT COUNT(*) FROM projects WHERE org_id=$1 AND deleted_at IS NULL`, id).Scan(&projects); err != nil {
			return Org{}, "", err
		}
		// Deleting a paid org would cascade away the subscription while it keeps charging.
		live, err := liveSubscription(ctx, tx, id)
		if err != nil {
			return Org{}, "", err
		}
		if members == 1 && projects == 0 && live.Plan == "" {
			if _, err := tx.ExecContext(ctx, `DELETE FROM memberships WHERE org_id=$1`, id); err != nil {
				return Org{}, "", err
			}
			if _, err := tx.ExecContext(ctx, `DELETE FROM organizations WHERE id=$1`, id); err != nil {
				return Org{}, "", err
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return Org{}, "", err
	}
	return org, role, nil
}

func (s *Store) UpdateMemberRole(ctx context.Context, orgID, targetUserID, role, actorRole string) error {
	if actorRole != "owner" {
		return ErrForbidden
	}
	role = strings.ToLower(strings.TrimSpace(role))
	if role != "member" && role != "viewer" && role != "owner" {
		return ErrInvalidInput
	}

	var current string
	err := s.DB.QueryRowContext(ctx, `
		SELECT role FROM memberships WHERE org_id=$1 AND user_id=$2`, orgID, targetUserID).Scan(&current)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if current == "owner" && role != "owner" {
		var owners int
		if err := s.DB.QueryRowContext(ctx, `
			SELECT COUNT(*) FROM memberships WHERE org_id=$1 AND role='owner'`, orgID).Scan(&owners); err != nil {
			return err
		}
		if owners <= 1 {
			return ErrForbidden
		}
	}

	res, err := s.DB.ExecContext(ctx, `
		UPDATE memberships SET role=$3 WHERE org_id=$1 AND user_id=$2`, orgID, targetUserID, role)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) RemoveMember(ctx context.Context, orgID, targetUserID, actorUserID, actorRole string) error {
	if actorRole != "owner" && actorUserID != targetUserID {
		return ErrForbidden
	}

	var current string
	err := s.DB.QueryRowContext(ctx, `
		SELECT role FROM memberships WHERE org_id=$1 AND user_id=$2`, orgID, targetUserID).Scan(&current)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if current == "owner" {
		var owners int
		if err := s.DB.QueryRowContext(ctx, `
			SELECT COUNT(*) FROM memberships WHERE org_id=$1 AND role='owner'`, orgID).Scan(&owners); err != nil {
			return err
		}
		if owners <= 1 {
			return ErrForbidden
		}
	}

	res, err := s.DB.ExecContext(ctx, `
		DELETE FROM memberships WHERE org_id=$1 AND user_id=$2`, orgID, targetUserID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) RoleForProject(ctx context.Context, userID, projectID string) (string, error) {
	var role, orgID string
	err := s.DB.QueryRowContext(ctx, `
		SELECT m.role, m.org_id
		FROM projects p
		JOIN memberships m ON m.org_id = p.org_id
		WHERE p.id=$1 AND p.deleted_at IS NULL AND m.user_id=$2`, projectID, userID).Scan(&role, &orgID)
	if errors.Is(err, sql.ErrNoRows) {
		return "", ErrForbidden
	}
	if err != nil {
		return "", err
	}
	return s.effectiveRole(ctx, orgID, userID, role)
}

func CanWriteTickets(role string) bool {
	return role == "owner" || role == "member"
}
