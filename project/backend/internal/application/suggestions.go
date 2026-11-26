package application

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/closeloop/api/internal/infrastructure/auth"
	"github.com/google/uuid"
)

const (
	suggestTokenTTL   = 24 * time.Hour
	maxSuggestTitleLen = 120
	maxSuggestBodyLen  = 2000
)

type SuggestRequestResult struct {
	RawToken    string
	Email       string
	ProjectName string
	IdeaTitle   string
	BoardSlug   string
	ProjectID   string
	SendEmail   bool
}

type SuggestConfirmResult struct {
	TicketID  string `json:"idea_id"`
	BoardSlug string `json:"board_slug"`
	Email     string `json:"email"`
	Status    string `json:"status"`
	ProjectID string `json:"-"`
}

func normalizeSuggestTitle(raw string) (string, error) {
	title := strings.TrimSpace(raw)
	if title == "" {
		return "", ErrInvalidInput
	}
	if utf8.RuneCountInString(title) > maxSuggestTitleLen {
		runes := []rune(title)
		title = string(runes[:maxSuggestTitleLen])
	}
	return title, nil
}

func normalizeSuggestBody(raw string) (string, error) {
	body := strings.TrimSpace(raw)
	if utf8.RuneCountInString(body) > maxSuggestBodyLen {
		return "", ErrInvalidInput
	}
	return body, nil
}

func (s *Store) RequestIdeaSuggest(ctx context.Context, slug, rawEmail, rawTitle, rawBody string) (SuggestRequestResult, error) {
	email, err := NormalizeVoterEmail(rawEmail)
	if err != nil {
		return SuggestRequestResult{}, err
	}
	title, err := normalizeSuggestTitle(rawTitle)
	if err != nil {
		return SuggestRequestResult{}, err
	}
	body, err := normalizeSuggestBody(rawBody)
	if err != nil {
		return SuggestRequestResult{}, err
	}
	slug, err = NormalizeBoardSlug(slug)
	if err != nil {
		return SuggestRequestResult{}, ErrNotFound
	}

	var projectID, projectName, boardSlug string
	err = s.DB.QueryRowContext(ctx, `
		SELECT id, name, board_slug FROM projects
		WHERE board_slug=$1 AND deleted_at IS NULL`, slug).
		Scan(&projectID, &projectName, &boardSlug)
	if errors.Is(err, sql.ErrNoRows) {
		return SuggestRequestResult{}, ErrNotFound
	}
	if err != nil {
		return SuggestRequestResult{}, err
	}
	if frozen, err := ProjectFrozen(ctx, s.DB, projectID); err != nil {
		return SuggestRequestResult{}, err
	} else if frozen {
		return SuggestRequestResult{}, ErrProjectFrozen
	}

	raw, err := newVoteRawToken()
	if err != nil {
		return SuggestRequestResult{}, err
	}
	_, err = s.DB.ExecContext(ctx, `
		INSERT INTO idea_suggestions(project_id, email, title, body, token_hash, expires_at)
		VALUES ($1,$2,$3,$4,$5,$6)`,
		projectID, email, title, body, auth.SHA256(raw), time.Now().Add(suggestTokenTTL))
	if err != nil {
		return SuggestRequestResult{}, err
	}

	return SuggestRequestResult{
		RawToken:    raw,
		Email:       email,
		ProjectName: projectName,
		IdeaTitle:   title,
		BoardSlug:   boardSlug,
		ProjectID:   projectID,
		SendEmail:   true,
	}, nil
}

func (s *Store) EnqueueSuggestVerify(ctx context.Context, email, rawToken, projectName, ideaTitle, boardSlug string) error {
	_, err := s.DB.ExecContext(ctx, `
		INSERT INTO jobs(kind, payload) VALUES ('notify_suggest_verify', $1)`,
		mustJSON(map[string]any{
			"email":        email,
			"raw_token":    rawToken,
			"project_name": projectName,
			"idea_title":   ideaTitle,
			"board_slug":   boardSlug,
		}))
	return err
}

func (s *Store) ConfirmIdeaSuggest(ctx context.Context, rawToken string) (SuggestConfirmResult, error) {
	rawToken = strings.TrimSpace(rawToken)
	if rawToken == "" {
		return SuggestConfirmResult{}, ErrInvalidInput
	}
	hash := auth.SHA256(rawToken)

	var suggestionID, projectID, email, title, body string
	var expiresAt time.Time
	var confirmedAt sql.NullTime
	err := s.DB.QueryRowContext(ctx, `
		SELECT id, project_id, email, title, body, expires_at, confirmed_at
		FROM idea_suggestions WHERE token_hash=$1`, hash).
		Scan(&suggestionID, &projectID, &email, &title, &body, &expiresAt, &confirmedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return SuggestConfirmResult{}, ErrNotFound
	}
	if err != nil {
		return SuggestConfirmResult{}, err
	}
	if confirmedAt.Valid {
		return SuggestConfirmResult{}, ErrConflict
	}
	if time.Now().After(expiresAt) {
		return SuggestConfirmResult{}, ErrGone
	}

	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return SuggestConfirmResult{}, err
	}
	defer tx.Rollback()

	res, err := tx.ExecContext(ctx, `
		UPDATE idea_suggestions SET confirmed_at=now()
		WHERE id=$1 AND confirmed_at IS NULL AND expires_at > now()`, suggestionID)
	if err != nil {
		return SuggestConfirmResult{}, err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return SuggestConfirmResult{}, ErrConflict
	}

	var orgID, boardSlug string
	err = tx.QueryRowContext(ctx, `
		SELECT org_id, board_slug FROM projects
		WHERE id=$1 AND deleted_at IS NULL`, projectID).
		Scan(&orgID, &boardSlug)
	if errors.Is(err, sql.ErrNoRows) {
		return SuggestConfirmResult{}, ErrNotFound
	}
	if err != nil {
		return SuggestConfirmResult{}, err
	}

	reporterID, err := ensureReporterTx(ctx, tx, projectID, "", email)
	if err != nil {
		return SuggestConfirmResult{}, err
	}

	var plan string
	if err := tx.QueryRowContext(ctx, `SELECT plan FROM organizations WHERE id=$1`, orgID).Scan(&plan); err != nil {
		return SuggestConfirmResult{}, err
	}
	used, err := countOrgReportsThisMonthTx(ctx, tx, orgID)
	if err != nil {
		return SuggestConfirmResult{}, err
	}
	quotaLocked := LimitsForPlan(plan).ReportQuotaExceeded(used)

	message := body
	if message == "" {
		message = title
	}
	ctxBytes, _ := json.Marshal(map[string]any{"source": "public_suggest"})

	ticketID := uuid.NewString()
	reportID := uuid.NewString()
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO tickets(id, project_id, type, status, title, is_public)
		VALUES ($1,$2,'idea','open',$3,false)`,
		ticketID, projectID, title); err != nil {
		return SuggestConfirmResult{}, err
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO reports(id, ticket_id, reporter_id, message, platform, context, quota_locked)
		VALUES ($1,$2,$3,$4,'web',$5,$6)`,
		reportID, ticketID, reporterID, message, ctxBytes, quotaLocked); err != nil {
		return SuggestConfirmResult{}, err
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO ticket_events(ticket_id, actor, kind, payload)
		VALUES ($1,'user','created',$2)`,
		ticketID, mustJSON(map[string]any{
			"report_id":     reportID,
			"source":        "public_suggest",
			"suggestion_id": suggestionID,
		})); err != nil {
		return SuggestConfirmResult{}, err
	}
	if _, err := tx.ExecContext(ctx, `
		UPDATE idea_suggestions SET ticket_id=$2 WHERE id=$1`,
		suggestionID, ticketID); err != nil {
		return SuggestConfirmResult{}, err
	}

	if err := tx.Commit(); err != nil {
		return SuggestConfirmResult{}, err
	}
	return SuggestConfirmResult{
		TicketID:  ticketID,
		BoardSlug: boardSlug,
		Email:     email,
		Status:    "confirmed",
		ProjectID: projectID,
	}, nil
}

func ensureReporterTx(ctx context.Context, tx *sql.Tx, projectID, externalUID, email string) (string, error) {
	if externalUID == "" && email == "" {
		id := uuid.NewString()
		_, err := tx.ExecContext(ctx, `INSERT INTO reporters(id, project_id, email) VALUES ($1,$2,$3)`, id, projectID, nullStr(email))
		return id, err
	}
	var id string
	if externalUID != "" {
		err := tx.QueryRowContext(ctx, `
			INSERT INTO reporters(project_id, external_user_id, email)
			VALUES ($1,$2,$3)
			ON CONFLICT (project_id, external_user_id) WHERE external_user_id IS NOT NULL
			DO UPDATE SET email=COALESCE(EXCLUDED.email, reporters.email)
			RETURNING id`, projectID, externalUID, nullStr(email)).Scan(&id)
		return id, err
	}
	err := tx.QueryRowContext(ctx, `
		INSERT INTO reporters(project_id, email) VALUES ($1,$2) RETURNING id`, projectID, email).Scan(&id)
	return id, err
}
