package application

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/closeloop/api/internal/infrastructure/auth"
	"github.com/closeloop/api/internal/infrastructure/email"
)

const (
	commentTokenTTL   = 24 * time.Hour
	maxCommentBodyLen = 2000
	maxDisplayNameLen = 80
)

type PublicComment struct {
	ID          string          `json:"id"`
	DisplayName string          `json:"display_name"`
	Initial     string          `json:"initial"`
	Body        string          `json:"body"`
	IsTeam      bool            `json:"is_team"`
	CreatedAt   time.Time       `json:"created_at"`
	Replies     []PublicComment `json:"replies,omitempty"`
}

type CommentConfirmResult struct {
	TicketID  string `json:"idea_id"`
	BoardSlug string `json:"board_slug"`
	Email     string `json:"email"`
	Status    string `json:"status"`
}

type CommentRequestResult struct {
	RawToken    string
	Email       string
	ProjectName string
	IdeaTitle   string
	BoardSlug   string
	TicketID    string
	CommentID   string
	SendEmail   bool
}

type ModerationComment struct {
	ID          string     `json:"id"`
	TicketID    string     `json:"ticket_id"`
	IdeaTitle   string     `json:"idea_title"`
	ParentID    *string    `json:"parent_id,omitempty"`
	Email       string     `json:"email"`
	DisplayName string     `json:"display_name"`
	Body        string     `json:"body"`
	IsTeam      bool       `json:"is_team"`
	Status      string     `json:"status"` // pending | visible | hidden
	CreatedAt   time.Time  `json:"created_at"`
	ConfirmedAt *time.Time `json:"confirmed_at,omitempty"`
	HiddenAt    *time.Time `json:"hidden_at,omitempty"`
}

func normalizeCommentBody(raw string) (string, error) {
	body := strings.TrimSpace(raw)
	if body == "" {
		return "", ErrInvalidInput
	}
	if utf8.RuneCountInString(body) > maxCommentBodyLen {
		return "", ErrInvalidInput
	}
	return body, nil
}

func normalizeDisplayName(raw, emailAddr string) string {
	name := strings.TrimSpace(raw)
	if name == "" {
		name = email.GreetingFromEmail(emailAddr)
	}
	if utf8.RuneCountInString(name) > maxDisplayNameLen {
		runes := []rune(name)
		name = string(runes[:maxDisplayNameLen])
	}
	return name
}

func commentInitial(displayName string) string {
	name := strings.TrimSpace(displayName)
	if name == "" {
		return "?"
	}
	r, _ := utf8.DecodeRuneInString(name)
	return strings.ToUpper(string(r))
}

func (s *Store) RequestIdeaComment(ctx context.Context, slug, ticketID, rawEmail, displayName, body, parentID string) (CommentRequestResult, error) {
	emailAddr, err := NormalizeVoterEmail(rawEmail)
	if err != nil {
		return CommentRequestResult{}, err
	}
	normalizedBody, err := normalizeCommentBody(body)
	if err != nil {
		return CommentRequestResult{}, err
	}
	board, idea, err := s.PublicIdeaBySlug(ctx, slug, ticketID)
	if err != nil {
		return CommentRequestResult{}, err
	}
	parentID = strings.TrimSpace(parentID)
	if parentID != "" {
		if err := s.assertCommentParentRoot(ctx, idea.ID, parentID); err != nil {
			return CommentRequestResult{}, err
		}
	}

	name := normalizeDisplayName(displayName, emailAddr)
	var commentID string
	if parentID == "" {
		err = s.DB.QueryRowContext(ctx, `
			INSERT INTO idea_comments(ticket_id, email, display_name, body)
			VALUES ($1,$2,$3,$4) RETURNING id`,
			idea.ID, emailAddr, name, normalizedBody).Scan(&commentID)
	} else {
		err = s.DB.QueryRowContext(ctx, `
			INSERT INTO idea_comments(ticket_id, parent_id, email, display_name, body)
			VALUES ($1,$2,$3,$4,$5) RETURNING id`,
			idea.ID, parentID, emailAddr, name, normalizedBody).Scan(&commentID)
	}
	if err != nil {
		return CommentRequestResult{}, err
	}

	raw, err := newVoteRawToken()
	if err != nil {
		return CommentRequestResult{}, err
	}
	_, err = s.DB.ExecContext(ctx, `
		INSERT INTO idea_comment_tokens(token_hash, comment_id, expires_at)
		VALUES ($1,$2,$3)`,
		auth.SHA256(raw), commentID, time.Now().Add(commentTokenTTL))
	if err != nil {
		return CommentRequestResult{}, err
	}

	return CommentRequestResult{
		RawToken:    raw,
		Email:       emailAddr,
		ProjectName: board.Name,
		IdeaTitle:   idea.Title,
		BoardSlug:   board.BoardSlug,
		TicketID:    idea.ID,
		CommentID:   commentID,
		SendEmail:   true,
	}, nil
}

func (s *Store) assertCommentParentRoot(ctx context.Context, ticketID, parentID string) error {
	var parentTicket string
	var parentParent sql.NullString
	var confirmed sql.NullTime
	var hidden sql.NullTime
	err := s.DB.QueryRowContext(ctx, `
		SELECT ticket_id, parent_id, confirmed_at, hidden_at
		FROM idea_comments WHERE id=$1`, parentID).
		Scan(&parentTicket, &parentParent, &confirmed, &hidden)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if parentTicket != ticketID || parentParent.Valid || !confirmed.Valid || hidden.Valid {
		return ErrInvalidInput
	}
	return nil
}

func (s *Store) EnqueueCommentVerify(ctx context.Context, ticketID, emailAddr, rawToken, projectName, ideaTitle, boardSlug string) error {
	_, err := s.DB.ExecContext(ctx, `
		INSERT INTO jobs(kind, payload) VALUES ('notify_comment_verify', $1)`,
		mustJSON(map[string]any{
			"ticket_id":    ticketID,
			"email":        emailAddr,
			"raw_token":    rawToken,
			"project_name": projectName,
			"idea_title":   ideaTitle,
			"board_slug":   boardSlug,
		}))
	return err
}

func (s *Store) ConfirmIdeaComment(ctx context.Context, rawToken string) (CommentConfirmResult, error) {
	rawToken = strings.TrimSpace(rawToken)
	if rawToken == "" {
		return CommentConfirmResult{}, ErrInvalidInput
	}
	hash := auth.SHA256(rawToken)

	var commentID string
	var expiresAt time.Time
	var usedAt sql.NullTime
	err := s.DB.QueryRowContext(ctx, `
		SELECT comment_id, expires_at, used_at
		FROM idea_comment_tokens WHERE token_hash=$1`, hash).
		Scan(&commentID, &expiresAt, &usedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return CommentConfirmResult{}, ErrNotFound
	}
	if err != nil {
		return CommentConfirmResult{}, err
	}
	if usedAt.Valid {
		return CommentConfirmResult{}, ErrConflict
	}
	if time.Now().After(expiresAt) {
		return CommentConfirmResult{}, ErrGone
	}

	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return CommentConfirmResult{}, err
	}
	defer tx.Rollback()

	res, err := tx.ExecContext(ctx, `
		UPDATE idea_comment_tokens SET used_at=now()
		WHERE token_hash=$1 AND used_at IS NULL AND expires_at > now()`, hash)
	if err != nil {
		return CommentConfirmResult{}, err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return CommentConfirmResult{}, ErrConflict
	}

	var ticketID, emailAddr string
	err = tx.QueryRowContext(ctx, `
		UPDATE idea_comments SET confirmed_at=COALESCE(confirmed_at, now())
		WHERE id=$1
		RETURNING ticket_id, email`, commentID).Scan(&ticketID, &emailAddr)
	if err != nil {
		return CommentConfirmResult{}, err
	}

	var slug string
	err = tx.QueryRowContext(ctx, `
		SELECT p.board_slug
		FROM projects p
		JOIN tickets t ON t.project_id=p.id
		WHERE t.id=$1 AND p.deleted_at IS NULL AND t.is_public=true`, ticketID).
		Scan(&slug)
	if errors.Is(err, sql.ErrNoRows) {
		return CommentConfirmResult{}, ErrNotFound
	}
	if err != nil {
		return CommentConfirmResult{}, err
	}
	if err := tx.Commit(); err != nil {
		return CommentConfirmResult{}, err
	}
	return CommentConfirmResult{
		TicketID:  ticketID,
		BoardSlug: slug,
		Email:     emailAddr,
		Status:    "confirmed",
	}, nil
}

func (s *Store) ListPublicComments(ctx context.Context, slug, ticketID string) ([]PublicComment, error) {
	_, _, err := s.PublicIdeaBySlug(ctx, slug, ticketID)
	if err != nil {
		return nil, err
	}
	rows, err := s.DB.QueryContext(ctx, `
		SELECT id, parent_id, display_name, body, is_team, created_at
		FROM idea_comments
		WHERE ticket_id=$1 AND confirmed_at IS NOT NULL AND hidden_at IS NULL
		ORDER BY created_at ASC`, ticketID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type row struct {
		ID          string
		ParentID    sql.NullString
		DisplayName string
		Body        string
		IsTeam      bool
		CreatedAt   time.Time
	}
	var all []row
	for rows.Next() {
		var r row
		if err := rows.Scan(&r.ID, &r.ParentID, &r.DisplayName, &r.Body, &r.IsTeam, &r.CreatedAt); err != nil {
			return nil, err
		}
		all = append(all, r)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	roots := make([]PublicComment, 0)
	repliesByParent := map[string][]PublicComment{}
	for _, r := range all {
		item := PublicComment{
			ID:          r.ID,
			DisplayName: r.DisplayName,
			Initial:     commentInitial(r.DisplayName),
			Body:        r.Body,
			IsTeam:      r.IsTeam,
			CreatedAt:   r.CreatedAt,
		}
		if r.ParentID.Valid {
			repliesByParent[r.ParentID.String] = append(repliesByParent[r.ParentID.String], item)
			continue
		}
		roots = append(roots, item)
	}
	for i := range roots {
		roots[i].Replies = repliesByParent[roots[i].ID]
		if roots[i].Replies == nil {
			roots[i].Replies = []PublicComment{}
		}
	}
	return roots, nil
}

func (s *Store) CreateTeamComment(ctx context.Context, ticketID, actorEmail, body, parentID string) (PublicComment, error) {
	t, err := s.GetTicket(ctx, ticketID)
	if err != nil {
		return PublicComment{}, err
	}
	if !t.IsPublic {
		return PublicComment{}, ErrNotFound
	}
	normalizedBody, err := normalizeCommentBody(body)
	if err != nil {
		return PublicComment{}, err
	}
	parentID = strings.TrimSpace(parentID)
	if parentID != "" {
		if err := s.assertCommentParentRoot(ctx, t.ID, parentID); err != nil {
			return PublicComment{}, err
		}
	}
	emailAddr, err := NormalizeVoterEmail(actorEmail)
	if err != nil {
		emailAddr = strings.ToLower(strings.TrimSpace(actorEmail))
	}
	name := normalizeDisplayName("", emailAddr)
	var id string
	var createdAt time.Time
	if parentID == "" {
		err = s.DB.QueryRowContext(ctx, `
			INSERT INTO idea_comments(ticket_id, email, display_name, body, is_team, confirmed_at)
			VALUES ($1,$2,$3,$4,true,now())
			RETURNING id, created_at`,
			t.ID, emailAddr, name, normalizedBody).Scan(&id, &createdAt)
	} else {
		err = s.DB.QueryRowContext(ctx, `
			INSERT INTO idea_comments(ticket_id, parent_id, email, display_name, body, is_team, confirmed_at)
			VALUES ($1,$2,$3,$4,$5,true,now())
			RETURNING id, created_at`,
			t.ID, parentID, emailAddr, name, normalizedBody).Scan(&id, &createdAt)
	}
	if err != nil {
		return PublicComment{}, err
	}
	return PublicComment{
		ID:          id,
		DisplayName: name,
		Initial:     commentInitial(name),
		Body:        normalizedBody,
		IsTeam:      true,
		CreatedAt:   createdAt,
		Replies:     []PublicComment{},
	}, nil
}

func (s *Store) ListBoardComments(ctx context.Context, projectID, status string) ([]ModerationComment, int, error) {
	status = strings.TrimSpace(strings.ToLower(status))
	if status == "" {
		status = "all"
	}
	q := `
		SELECT c.id, c.ticket_id, t.title, c.parent_id, c.email, c.display_name, c.body,
		       c.is_team, c.created_at, c.confirmed_at, c.hidden_at
		FROM idea_comments c
		JOIN tickets t ON t.id=c.ticket_id
		WHERE t.project_id=$1 AND t.is_public=true`
	switch status {
	case "pending":
		q += ` AND c.confirmed_at IS NULL`
	case "visible":
		q += ` AND c.confirmed_at IS NOT NULL AND c.hidden_at IS NULL`
	case "hidden":
		q += ` AND c.hidden_at IS NOT NULL`
	case "all":
	default:
		return nil, 0, ErrInvalidInput
	}
	q += ` ORDER BY c.created_at DESC LIMIT 200`

	rows, err := s.DB.QueryContext(ctx, q, projectID)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var out []ModerationComment
	for rows.Next() {
		var (
			m           ModerationComment
			parentID    sql.NullString
			confirmedAt sql.NullTime
			hiddenAt    sql.NullTime
		)
		if err := rows.Scan(
			&m.ID, &m.TicketID, &m.IdeaTitle, &parentID, &m.Email, &m.DisplayName, &m.Body,
			&m.IsTeam, &m.CreatedAt, &confirmedAt, &hiddenAt,
		); err != nil {
			return nil, 0, err
		}
		if parentID.Valid {
			v := parentID.String
			m.ParentID = &v
		}
		if confirmedAt.Valid {
			t := confirmedAt.Time
			m.ConfirmedAt = &t
		}
		if hiddenAt.Valid {
			t := hiddenAt.Time
			m.HiddenAt = &t
		}
		switch {
		case !confirmedAt.Valid:
			m.Status = "pending"
		case hiddenAt.Valid:
			m.Status = "hidden"
		default:
			m.Status = "visible"
		}
		out = append(out, m)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	if out == nil {
		out = []ModerationComment{}
	}

	var pending int
	if err := s.DB.QueryRowContext(ctx, `
		SELECT COUNT(*)
		FROM idea_comments c
		JOIN tickets t ON t.id=c.ticket_id
		WHERE t.project_id=$1 AND t.is_public=true AND c.confirmed_at IS NULL`, projectID).
		Scan(&pending); err != nil {
		return nil, 0, err
	}
	return out, pending, nil
}

func (s *Store) SetCommentHidden(ctx context.Context, commentID string, projectID string, hidden bool) error {
	var n int
	err := s.DB.QueryRowContext(ctx, `
		SELECT COUNT(*)
		FROM idea_comments c
		JOIN tickets t ON t.id=c.ticket_id
		WHERE c.id=$1 AND t.project_id=$2`, commentID, projectID).Scan(&n)
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	if hidden {
		_, err = s.DB.ExecContext(ctx, `
			UPDATE idea_comments SET hidden_at=COALESCE(hidden_at, now()) WHERE id=$1`, commentID)
	} else {
		_, err = s.DB.ExecContext(ctx, `
			UPDATE idea_comments SET hidden_at=NULL WHERE id=$1`, commentID)
	}
	return err
}
