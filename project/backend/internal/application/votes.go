package application

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"net/mail"
	"strings"
	"time"

	"github.com/closeloop/api/internal/infrastructure/auth"
)

const voteTokenTTL = 24 * time.Hour

type VoteConfirmResult struct {
	TicketID  string `json:"idea_id"`
	BoardSlug string `json:"board_slug"`
	Email     string `json:"email"`
	Status    string `json:"status"`
}

func NormalizeVoterEmail(raw string) (string, error) {
	email := strings.ToLower(strings.TrimSpace(raw))
	if email == "" {
		return "", ErrInvalidInput
	}
	parsed, err := mail.ParseAddress(email)
	if err != nil || parsed.Address == "" {
		return "", ErrInvalidInput
	}
	return strings.ToLower(parsed.Address), nil
}

func newVoteRawToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

type VoteRequestResult struct {
	RawToken    string
	Email       string
	ProjectName string
	IdeaTitle   string
	BoardSlug   string
	TicketID    string
	SendEmail   bool
}

// RequestIdeaVote creates a confirm token when needed.
// If the email already confirmed a vote, SendEmail=false (caller still returns 202).
func (s *Store) RequestIdeaVote(ctx context.Context, slug, ticketID, rawEmail string) (VoteRequestResult, error) {
	email, err := NormalizeVoterEmail(rawEmail)
	if err != nil {
		return VoteRequestResult{}, err
	}
	board, idea, err := s.PublicIdeaBySlug(ctx, slug, ticketID)
	if err != nil {
		return VoteRequestResult{}, err
	}
	out := VoteRequestResult{
		Email:       email,
		ProjectName: board.Name,
		IdeaTitle:   idea.Title,
		BoardSlug:   board.BoardSlug,
		TicketID:    idea.ID,
	}

	var confirmed sql.NullTime
	err = s.DB.QueryRowContext(ctx, `
		SELECT confirmed_at FROM idea_votes WHERE ticket_id=$1 AND email=$2`,
		idea.ID, email).Scan(&confirmed)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return VoteRequestResult{}, err
	}
	if confirmed.Valid {
		return out, nil
	}

	raw, err := newVoteRawToken()
	if err != nil {
		return VoteRequestResult{}, err
	}
	hash := auth.SHA256(raw)
	_, err = s.DB.ExecContext(ctx, `
		UPDATE idea_vote_tokens SET used_at=now()
		WHERE ticket_id=$1 AND email=$2 AND used_at IS NULL`, idea.ID, email)
	if err != nil {
		return VoteRequestResult{}, err
	}
	_, err = s.DB.ExecContext(ctx, `
		INSERT INTO idea_vote_tokens(token_hash, ticket_id, email, expires_at)
		VALUES ($1,$2,$3,$4)`,
		hash, idea.ID, email, time.Now().Add(voteTokenTTL))
	if err != nil {
		return VoteRequestResult{}, err
	}
	_, err = s.DB.ExecContext(ctx, `
		INSERT INTO idea_votes(ticket_id, email)
		VALUES ($1,$2)
		ON CONFLICT (ticket_id, email) DO NOTHING`, idea.ID, email)
	if err != nil {
		return VoteRequestResult{}, err
	}
	out.RawToken = raw
	out.SendEmail = true
	return out, nil
}

func (s *Store) EnqueueVoteVerify(ctx context.Context, ticketID, email, rawToken, projectName, ideaTitle, boardSlug string) error {
	_, err := s.DB.ExecContext(ctx, `
		INSERT INTO jobs(kind, payload) VALUES ('notify_vote_verify', $1)`,
		mustJSON(map[string]any{
			"ticket_id":    ticketID,
			"email":        email,
			"raw_token":    rawToken,
			"project_name": projectName,
			"idea_title":   ideaTitle,
			"board_slug":   boardSlug,
		}))
	return err
}

func (s *Store) ConfirmIdeaVote(ctx context.Context, rawToken string) (VoteConfirmResult, error) {
	rawToken = strings.TrimSpace(rawToken)
	if rawToken == "" {
		return VoteConfirmResult{}, ErrInvalidInput
	}
	hash := auth.SHA256(rawToken)

	var ticketID, email string
	var expiresAt time.Time
	var usedAt sql.NullTime
	err := s.DB.QueryRowContext(ctx, `
		SELECT ticket_id, email, expires_at, used_at
		FROM idea_vote_tokens WHERE token_hash=$1`, hash).
		Scan(&ticketID, &email, &expiresAt, &usedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return VoteConfirmResult{}, ErrNotFound
	}
	if err != nil {
		return VoteConfirmResult{}, err
	}
	if usedAt.Valid {
		return VoteConfirmResult{}, ErrConflict
	}
	if time.Now().After(expiresAt) {
		return VoteConfirmResult{}, ErrGone
	}

	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return VoteConfirmResult{}, err
	}
	defer tx.Rollback()

	res, err := tx.ExecContext(ctx, `
		UPDATE idea_vote_tokens SET used_at=now()
		WHERE token_hash=$1 AND used_at IS NULL AND expires_at > now()`, hash)
	if err != nil {
		return VoteConfirmResult{}, err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return VoteConfirmResult{}, ErrConflict
	}

	_, err = tx.ExecContext(ctx, `
		INSERT INTO idea_votes(ticket_id, email, confirmed_at)
		VALUES ($1,$2,now())
		ON CONFLICT (ticket_id, email) DO UPDATE
		SET confirmed_at=COALESCE(idea_votes.confirmed_at, excluded.confirmed_at)`,
		ticketID, email)
	if err != nil {
		return VoteConfirmResult{}, err
	}

	var slug string
	err = tx.QueryRowContext(ctx, `
		SELECT p.board_slug
		FROM projects p
		JOIN tickets t ON t.project_id=p.id
		WHERE t.id=$1 AND p.deleted_at IS NULL AND t.is_public=true`, ticketID).
		Scan(&slug)
	if errors.Is(err, sql.ErrNoRows) {
		return VoteConfirmResult{}, ErrNotFound
	}
	if err != nil {
		return VoteConfirmResult{}, err
	}
	if err := tx.Commit(); err != nil {
		return VoteConfirmResult{}, err
	}
	return VoteConfirmResult{
		TicketID:  ticketID,
		BoardSlug: slug,
		Email:     email,
		Status:    "confirmed",
	}, nil
}

func (s *Store) ideaVoteCount(ctx context.Context, ticketID string) (int, error) {
	var n int
	err := s.DB.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM idea_votes
		WHERE ticket_id=$1 AND confirmed_at IS NOT NULL`, ticketID).Scan(&n)
	return n, err
}

func (s *Store) ListConfirmedVoterEmails(ctx context.Context, ticketID string) ([]string, error) {
	rows, err := s.DB.QueryContext(ctx, `
		SELECT email FROM idea_votes
		WHERE ticket_id=$1 AND confirmed_at IS NOT NULL
		ORDER BY confirmed_at ASC`, ticketID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var emails []string
	for rows.Next() {
		var email string
		if err := rows.Scan(&email); err != nil {
			return nil, err
		}
		emails = append(emails, email)
	}
	return emails, rows.Err()
}

// EnqueueVoteReleased queues voter release mail when the ticket is public and has confirmed votes.
func (s *Store) EnqueueVoteReleased(ctx context.Context, ticketID string) error {
	t, err := s.GetTicket(ctx, ticketID)
	if err != nil {
		return err
	}
	if !t.IsPublic {
		return nil
	}
	p, err := s.ProjectByID(ctx, t.ProjectID)
	if err != nil {
		return err
	}
	if !p.VoterNotifyEnabled {
		return nil
	}
	n, err := s.ideaVoteCount(ctx, ticketID)
	if err != nil {
		return err
	}
	if n == 0 {
		return nil
	}
	_, err = s.DB.ExecContext(ctx, `
		INSERT INTO jobs(kind, payload) VALUES ('notify_vote_released', $1)`,
		mustJSON(map[string]any{"ticket_id": ticketID}))
	return err
}

type VoteReleasedNotify struct {
	Emails      []string
	ProjectName string
	BoardSlug   string
	IdeaTitle   string
	ReleaseNote string
	VoteCount   int
	ReportCount int
	TicketID    string
}

func (s *Store) VoteReleasedNotifyData(ctx context.Context, ticketID string) (VoteReleasedNotify, error) {
	t, err := s.GetTicket(ctx, ticketID)
	if err != nil {
		return VoteReleasedNotify{}, err
	}
	if !t.IsPublic {
		return VoteReleasedNotify{}, nil
	}
	p, err := s.ProjectByID(ctx, t.ProjectID)
	if err != nil {
		return VoteReleasedNotify{}, err
	}
	emails, err := s.ListConfirmedVoterEmails(ctx, ticketID)
	if err != nil {
		return VoteReleasedNotify{}, err
	}
	if len(emails) == 0 {
		return VoteReleasedNotify{}, nil
	}
	note := ""
	if t.FixedNote.Valid {
		note = t.FixedNote.String
	}
	return VoteReleasedNotify{
		Emails:      emails,
		ProjectName: p.Name,
		BoardSlug:   p.BoardSlug,
		IdeaTitle:   t.Title,
		ReleaseNote: note,
		VoteCount:   len(emails),
		ReportCount: t.ReportCount,
		TicketID:    t.ID,
	}, nil
}
