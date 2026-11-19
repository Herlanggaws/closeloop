package application

import "strings"

// PlanLimits mirrors PRD pricing plus seat defaults for M1 team invites.
// Zero means unlimited.
type PlanLimits struct {
	MaxProjects        int
	ReportsPerMonth    int
	MaxSeats           int
	MaxReposPerProject int
}

func LimitsForPlan(plan string) PlanLimits {
	switch strings.ToLower(strings.TrimSpace(plan)) {
	case "indie":
		return PlanLimits{MaxProjects: 3, ReportsPerMonth: 1000, MaxSeats: 1, MaxReposPerProject: 5}
	case "studio":
		return PlanLimits{MaxProjects: 0, ReportsPerMonth: 10000, MaxSeats: 5, MaxReposPerProject: 10}
	case "business":
		return PlanLimits{MaxProjects: 0, ReportsPerMonth: 0, MaxSeats: 0, MaxReposPerProject: 0}
	default:
		return PlanLimits{MaxProjects: 1, ReportsPerMonth: 50, MaxSeats: 1, MaxReposPerProject: 3}
	}
}

// ReplayAllowed is true for Studio and Business (F11 session replay).
func ReplayAllowed(plan string) bool {
	switch NormalizePlan(plan) {
	case "studio", "business":
		return true
	default:
		return false
	}
}

// ReplayRetentionDays returns how long uploaded replays are kept. Zero means no replay storage.
func ReplayRetentionDays(plan string) int {
	switch NormalizePlan(plan) {
	case "studio":
		return 7
	case "business":
		return 30
	default:
		return 0
	}
}

func ValidPlan(plan string) bool {
	switch strings.ToLower(strings.TrimSpace(plan)) {
	case "free", "indie", "studio", "business":
		return true
	default:
		return false
	}
}

func NormalizePlan(plan string) string {
	p := strings.ToLower(strings.TrimSpace(plan))
	if !ValidPlan(p) {
		return "free"
	}
	return p
}

func ValidInviteRole(role string) bool {
	switch strings.ToLower(strings.TrimSpace(role)) {
	case "member", "viewer":
		return true
	default:
		return false
	}
}

func (l PlanLimits) ProjectLimitReached(used int) bool {
	if l.MaxProjects == 0 {
		return false
	}
	return used >= l.MaxProjects
}

func (l PlanLimits) ReportQuotaExceeded(used int) bool {
	if l.ReportsPerMonth == 0 {
		return false
	}
	return used >= l.ReportsPerMonth
}

func (l PlanLimits) SeatLimitReached(used int) bool {
	if l.MaxSeats == 0 {
		return false
	}
	return used >= l.MaxSeats
}

func (l PlanLimits) RepoLimitReached(used int) bool {
	if l.MaxReposPerProject == 0 {
		return false
	}
	return used >= l.MaxReposPerProject
}

// planRank orders plans so "needs at least X" checks stay in one place.
func planRank(plan string) int {
	switch NormalizePlan(plan) {
	case "indie":
		return 1
	case "studio":
		return 2
	case "business":
		return 3
	default:
		return 0
	}
}

// PlanAtLeast reports whether plan is min or higher.
func PlanAtLeast(plan, min string) bool {
	return planRank(plan) >= planRank(min)
}

// RequiredPlanForIntegration is the lowest plan that may connect or use a provider
// (pricing update P2, US-64, US-69). Sentry, PostHog, Webhooks and the GitHub App
// stay on every plan.
func RequiredPlanForIntegration(provider string) string {
	switch strings.ToLower(strings.TrimSpace(provider)) {
	case "slack", "github_issues":
		return "indie"
	case "linear", "jira":
		return "studio"
	default:
		return "free"
	}
}

// IntegrationAllowed reports whether plan may connect or use provider.
func IntegrationAllowed(plan, provider string) bool {
	return PlanAtLeast(plan, RequiredPlanForIntegration(provider))
}

// BoardAllowed reports whether plan may publish ideas to the public board (Indie and up).
func BoardAllowed(plan string) bool {
	return PlanAtLeast(plan, "indie")
}

// SelfServePlanAllowed reports whether a plan can be picked from Billing.
// Business is hidden until M6 (D-22); orgs already on Business keep it.
func SelfServePlanAllowed(plan string) bool {
	switch strings.ToLower(strings.TrimSpace(plan)) {
	case "free", "indie", "studio":
		return true
	default:
		return false
	}
}
