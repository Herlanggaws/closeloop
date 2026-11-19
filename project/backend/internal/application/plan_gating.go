package application

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

// ErrQuotaLocked is returned when every report on a ticket is locked by the
// monthly report quota (US-63). It unlocks on upgrade or at the next reset.
var ErrQuotaLocked = errors.New("quota locked")

// PremiumRequiredError means the org's plan does not include a feature.
// The HTTP layer maps it to 402 PREMIUM_REQUIRED with required_plan.
type PremiumRequiredError struct {
	Feature      string
	RequiredPlan string
}

func (e *PremiumRequiredError) Error() string {
	return fmt.Sprintf("%s needs the %s plan", e.Feature, PlanDisplayName(e.RequiredPlan))
}

// ErrBusinessNotAvailable rejects self-serve moves to Business until M6 (D-22).
var ErrBusinessNotAvailable = errors.New("Business is not available yet.")

func PlanDisplayName(plan string) string {
	switch NormalizePlan(plan) {
	case "indie":
		return "Indie"
	case "studio":
		return "Studio"
	case "business":
		return "Business"
	default:
		return "Free"
	}
}

// QuotaResetAt is the first instant of next month (UTC), when quota-locked reports unlock.
func QuotaResetAt(now time.Time) time.Time {
	now = now.UTC()
	return time.Date(now.Year(), now.Month()+1, 1, 0, 0, 0, 0, time.UTC)
}

// OrgPlanForProject returns the normalized plan of the org that owns a project.
func (s *Store) OrgPlanForProject(ctx context.Context, projectID string) (string, error) {
	var plan string
	err := s.DB.QueryRowContext(ctx, `
		SELECT o.plan FROM projects p JOIN organizations o ON o.id = p.org_id
		WHERE p.id=$1`, projectID).Scan(&plan)
	if errors.Is(err, sql.ErrNoRows) {
		return "", ErrNotFound
	}
	if err != nil {
		return "", err
	}
	return NormalizePlan(plan), nil
}

// IntegrationState reports whether a provider row exists for a project and whether
// it was connected before plan gating shipped (grandfathered keeps working on any plan).
func (s *Store) IntegrationState(ctx context.Context, projectID, provider string) (exists, grandfathered bool, err error) {
	err = s.DB.QueryRowContext(ctx, `
		SELECT grandfathered FROM integrations WHERE project_id=$1 AND provider=$2`,
		projectID, provider).Scan(&grandfathered)
	if errors.Is(err, sql.ErrNoRows) {
		return false, false, nil
	}
	if err != nil {
		return false, false, err
	}
	return true, grandfathered, nil
}

// RequireIntegrationUse checks the plan for using a provider (creating issues, etc.).
// Connections made before gating shipped keep working on every plan.
func (s *Store) RequireIntegrationUse(ctx context.Context, projectID, provider, connectionProvider string) error {
	plan, err := s.OrgPlanForProject(ctx, projectID)
	if err != nil {
		return err
	}
	if IntegrationAllowed(plan, provider) {
		return nil
	}
	_, grandfathered, err := s.IntegrationState(ctx, projectID, connectionProvider)
	if err != nil {
		return err
	}
	if grandfathered {
		return nil
	}
	return &PremiumRequiredError{Feature: integrationFeatureName(provider), RequiredPlan: RequiredPlanForIntegration(provider)}
}

// RequireIntegrationConnect checks the plan before a new connection. Editing an
// existing connection is always allowed so old setups never break.
func (s *Store) RequireIntegrationConnect(ctx context.Context, projectID, provider string) error {
	plan, err := s.OrgPlanForProject(ctx, projectID)
	if err != nil {
		return err
	}
	if IntegrationAllowed(plan, provider) {
		return nil
	}
	exists, _, err := s.IntegrationState(ctx, projectID, provider)
	if err != nil {
		return err
	}
	if exists {
		return nil
	}
	return &PremiumRequiredError{Feature: integrationFeatureName(provider), RequiredPlan: RequiredPlanForIntegration(provider)}
}

// RequireBoardPublish checks the plan before an idea goes public (Indie and up).
func (s *Store) RequireBoardPublish(ctx context.Context, projectID string) error {
	plan, err := s.OrgPlanForProject(ctx, projectID)
	if err != nil {
		return err
	}
	if BoardAllowed(plan) {
		return nil
	}
	return &PremiumRequiredError{Feature: "Public board", RequiredPlan: "indie"}
}

func integrationFeatureName(provider string) string {
	switch provider {
	case "slack":
		return "Slack"
	case "github_issues":
		return "GitHub Issues"
	case "linear":
		return "Linear"
	case "jira":
		return "Jira"
	default:
		return provider
	}
}

// ProjectRepoCount counts repos connected to a project. Until multi-repo (D-11)
// lands, a project has at most one repo: the GitHub App's repo_full_name.
func (s *Store) ProjectRepoCount(ctx context.Context, projectID string) (int, error) {
	var raw json.RawMessage
	err := s.DB.QueryRowContext(ctx, `
		SELECT config FROM integrations WHERE project_id=$1 AND provider='github_app'`, projectID).Scan(&raw)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	var cfg map[string]any
	_ = json.Unmarshal(raw, &cfg)
	if repo, _ := cfg["repo_full_name"].(string); repo != "" {
		return 1, nil
	}
	return 0, nil
}

// AutoPRCreditsGranted sums credits ever granted to an org (starter seeds, packs);
// run debits and refunds are tied to a run and excluded.
func (s *Store) AutoPRCreditsGranted(ctx context.Context, orgID string) (int, error) {
	var n int
	err := s.DB.QueryRowContext(ctx, `
		SELECT COALESCE(SUM(delta), 0) FROM credit_ledger
		WHERE org_id=$1 AND run_id IS NULL AND delta > 0`, orgID).Scan(&n)
	return n, err
}

// TicketReporter is one person (or anonymous report) on a ticket, for the S-07
// Reporters panel (D-03). Anonymous reports each count as their own reporter.
type TicketReporter struct {
	ReporterID     string `json:"reporter_id,omitempty"`
	Email          string `json:"email,omitempty"`
	ExternalUserID string `json:"external_user_id,omitempty"`
	Platform       string `json:"platform"`
}

// TicketReporterList returns reporters in first-report order plus a per-platform count.
// Quota-locked reports are left out, same as TicketReports.
func (s *Store) TicketReporterList(ctx context.Context, ticketID string) ([]TicketReporter, map[string]int, error) {
	rows, err := s.DB.QueryContext(ctx, `
		SELECT COALESCE(r.id::text, ''), COALESCE(r.email, ''), COALESCE(r.external_user_id, ''),
		       COALESCE(NULLIF(rep.platform, ''), 'web'), rep.id::text
		FROM reports rep
		LEFT JOIN reporters r ON r.id = rep.reporter_id
		WHERE rep.ticket_id=$1
		  AND (rep.quota_locked = false OR rep.created_at < date_trunc('month', now()))
		ORDER BY rep.created_at`, ticketID)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()
	out := []TicketReporter{}
	byPlatform := map[string]int{}
	seen := map[string]bool{}
	for rows.Next() {
		var item TicketReporter
		var reportID string
		if err := rows.Scan(&item.ReporterID, &item.Email, &item.ExternalUserID, &item.Platform, &reportID); err != nil {
			return nil, nil, err
		}
		key := "anon:" + reportID
		if item.ReporterID != "" {
			key = item.ReporterID + "|" + item.Platform
		}
		if seen[key] {
			continue
		}
		seen[key] = true
		out = append(out, item)
		byPlatform[item.Platform]++
	}
	return out, byPlatform, rows.Err()
}
