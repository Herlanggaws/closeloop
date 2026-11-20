package application

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"regexp"
	"strings"
)

// Widget look per project (S-12 Widget, nZUSl). Label and position are on every
// plan; a custom accent colour is "your own widget branding" and needs Studio.

const (
	DefaultWidgetLabel  = "Report a problem"
	DefaultWidgetAccent = "#171717"
	maxWidgetLabelLen   = 40
)

var hexColor = regexp.MustCompile(`^#[0-9A-Fa-f]{6}$`)

type WidgetSettings struct {
	Label    string `json:"label"`
	Position string `json:"position"` // bottom_right | bottom_left | hidden
	Accent   string `json:"accent"`
}

func (s *Store) WidgetSettings(ctx context.Context, projectID string) (WidgetSettings, error) {
	var w WidgetSettings
	err := s.DB.QueryRowContext(ctx, `
		SELECT widget_label, widget_position, widget_accent FROM projects WHERE id=$1`, projectID).
		Scan(&w.Label, &w.Position, &w.Accent)
	if errors.Is(err, sql.ErrNoRows) {
		return w, ErrNotFound
	}
	return w, err
}

// EffectiveWidgetSettings is what the widget renders: the accent falls back to
// the default below Studio (e.g. after a downgrade) without losing the saved value.
func (s *Store) EffectiveWidgetSettings(ctx context.Context, projectID, plan string) (WidgetSettings, error) {
	w, err := s.WidgetSettings(ctx, projectID)
	if err != nil {
		return w, err
	}
	if !PlanAtLeast(plan, "studio") {
		w.Accent = DefaultWidgetAccent
	}
	return w, nil
}

type WidgetSettingsInput struct {
	Label    *string `json:"label"`
	Position *string `json:"position"`
	Accent   *string `json:"accent"`
}

func (s *Store) UpdateWidgetSettings(ctx context.Context, projectID string, in WidgetSettingsInput) (WidgetSettings, error) {
	cur, err := s.WidgetSettings(ctx, projectID)
	if err != nil {
		return cur, err
	}
	if in.Label != nil {
		label := strings.TrimSpace(*in.Label)
		if label == "" {
			label = DefaultWidgetLabel
		}
		if len([]rune(label)) > maxWidgetLabelLen {
			return cur, fmt.Errorf("%w: label is too long", ErrInvalidInput)
		}
		cur.Label = label
	}
	if in.Position != nil {
		switch *in.Position {
		case "bottom_right", "bottom_left", "hidden":
			cur.Position = *in.Position
		default:
			return cur, fmt.Errorf("%w: invalid position", ErrInvalidInput)
		}
	}
	if in.Accent != nil {
		accent := strings.ToUpper(strings.TrimSpace(*in.Accent))
		if !hexColor.MatchString(accent) {
			return cur, fmt.Errorf("%w: accent must be #RRGGBB", ErrInvalidInput)
		}
		if accent != strings.ToUpper(DefaultWidgetAccent) {
			plan, err := s.OrgPlanForProject(ctx, projectID)
			if err != nil {
				return cur, err
			}
			if !PlanAtLeast(plan, "studio") {
				return cur, &PremiumRequiredError{Feature: "Custom widget branding", RequiredPlan: "studio"}
			}
		}
		cur.Accent = accent
	}
	// Only touch the fields that were sent, so two quick saves never undo each other.
	var label, position, accent sql.NullString
	if in.Label != nil {
		label = sql.NullString{String: cur.Label, Valid: true}
	}
	if in.Position != nil {
		position = sql.NullString{String: cur.Position, Valid: true}
	}
	if in.Accent != nil {
		accent = sql.NullString{String: cur.Accent, Valid: true}
	}
	if _, err := s.DB.ExecContext(ctx, `
		UPDATE projects SET
			widget_label = COALESCE($2, widget_label),
			widget_position = COALESCE($3, widget_position),
			widget_accent = COALESCE($4, widget_accent)
		WHERE id=$1`, projectID, label, position, accent); err != nil {
		return cur, err
	}
	return s.WidgetSettings(ctx, projectID)
}
