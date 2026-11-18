package application

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"
	"unicode"

	"github.com/google/uuid"
)

var boardSlugPattern = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)

type PublicIdea struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Type      string    `json:"type"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
}

type PublicBoard struct {
	Name      string `json:"name"`
	BoardSlug string `json:"board_slug"`
}

func NormalizeBoardSlug(raw string) (string, error) {
	slug := strings.ToLower(strings.TrimSpace(raw))
	if len(slug) < 3 || len(slug) > 48 {
		return "", ErrInvalidInput
	}
	if !boardSlugPattern.MatchString(slug) {
		return "", ErrInvalidInput
	}
	return slug, nil
}

func SlugifyBoardName(name string) string {
	var b strings.Builder
	lastDash := false
	for _, r := range strings.ToLower(strings.TrimSpace(name)) {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			b.WriteRune(r)
			lastDash = false
			continue
		}
		if !lastDash && b.Len() > 0 {
			b.WriteByte('-')
			lastDash = true
		}
	}
	out := strings.Trim(b.String(), "-")
	if out == "" {
		out = "board"
	}
	if len(out) > 40 {
		out = strings.Trim(out[:40], "-")
	}
	if len(out) < 3 {
		out = "board"
	}
	return out
}

func (s *Store) allocateBoardSlug(ctx context.Context, tx *sql.Tx, name string) (string, error) {
	base := SlugifyBoardName(name)
	for i := 0; i < 24; i++ {
		candidate := base
		if i > 0 {
			candidate = fmt.Sprintf("%s-%s", base, uuid.NewString()[:6])
		}
		if len(candidate) > 48 {
			candidate = candidate[:48]
		}
		var exists bool
		err := tx.QueryRowContext(ctx, `
			SELECT EXISTS(SELECT 1 FROM projects WHERE board_slug=$1)`, candidate).Scan(&exists)
		if err != nil {
			return "", err
		}
		if !exists {
			return candidate, nil
		}
	}
	return "", ErrConflict
}

func (s *Store) SetTicketPublic(ctx context.Context, ticketID string, isPublic bool, actor string) error {
	t, err := s.GetTicket(ctx, ticketID)
	if err != nil {
		return err
	}
	if t.IsPublic == isPublic {
		return nil
	}
	_, err = s.DB.ExecContext(ctx, `
		UPDATE tickets SET is_public=$2, updated_at=now() WHERE id=$1`, ticketID, isPublic)
	if err != nil {
		return err
	}
	_, err = s.DB.ExecContext(ctx, `
		INSERT INTO ticket_events(ticket_id, actor, kind, payload)
		VALUES ($1,$2,'publish_changed',$3)`,
		ticketID, actor, mustJSON(map[string]any{"is_public": isPublic}))
	return err
}

func (s *Store) PublicBoardBySlug(ctx context.Context, slug string) (PublicBoard, []PublicIdea, error) {
	slug, err := NormalizeBoardSlug(slug)
	if err != nil {
		return PublicBoard{}, nil, ErrNotFound
	}
	var board PublicBoard
	err = s.DB.QueryRowContext(ctx, `
		SELECT name, board_slug FROM projects
		WHERE board_slug=$1 AND deleted_at IS NULL`, slug).
		Scan(&board.Name, &board.BoardSlug)
	if errors.Is(err, sql.ErrNoRows) {
		return PublicBoard{}, nil, ErrNotFound
	}
	if err != nil {
		return PublicBoard{}, nil, err
	}

	rows, err := s.DB.QueryContext(ctx, `
		SELECT id, title, type, status, created_at
		FROM tickets
		WHERE project_id=(SELECT id FROM projects WHERE board_slug=$1 AND deleted_at IS NULL)
		  AND is_public=true
		  AND status <> 'duplicate'
		ORDER BY created_at DESC
		LIMIT 100`, slug)
	if err != nil {
		return PublicBoard{}, nil, err
	}
	defer rows.Close()
	ideas := []PublicIdea{}
	for rows.Next() {
		var idea PublicIdea
		if err := rows.Scan(&idea.ID, &idea.Title, &idea.Type, &idea.Status, &idea.CreatedAt); err != nil {
			return PublicBoard{}, nil, err
		}
		ideas = append(ideas, idea)
	}
	return board, ideas, rows.Err()
}

func (s *Store) PublicIdeaBySlug(ctx context.Context, slug, ticketID string) (PublicBoard, PublicIdea, error) {
	slug, err := NormalizeBoardSlug(slug)
	if err != nil {
		return PublicBoard{}, PublicIdea{}, ErrNotFound
	}
	var board PublicBoard
	var idea PublicIdea
	err = s.DB.QueryRowContext(ctx, `
		SELECT p.name, p.board_slug, t.id, t.title, t.type, t.status, t.created_at
		FROM projects p
		JOIN tickets t ON t.project_id=p.id
		WHERE p.board_slug=$1 AND p.deleted_at IS NULL
		  AND t.id=$2 AND t.is_public=true AND t.status <> 'duplicate'`,
		slug, ticketID).
		Scan(&board.Name, &board.BoardSlug, &idea.ID, &idea.Title, &idea.Type, &idea.Status, &idea.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return PublicBoard{}, PublicIdea{}, ErrNotFound
	}
	return board, idea, err
}
