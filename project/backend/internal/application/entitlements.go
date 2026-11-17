package application

import "strings"

// PlanLimits mirrors PRD pricing: Free 1/50, Indie 3/1000, Studio ∞/10000, Business ∞/∞.
// Zero means unlimited.
type PlanLimits struct {
	MaxProjects      int
	ReportsPerMonth  int
}

func LimitsForPlan(plan string) PlanLimits {
	switch strings.ToLower(strings.TrimSpace(plan)) {
	case "indie":
		return PlanLimits{MaxProjects: 3, ReportsPerMonth: 1000}
	case "studio":
		return PlanLimits{MaxProjects: 0, ReportsPerMonth: 10000}
	case "business":
		return PlanLimits{MaxProjects: 0, ReportsPerMonth: 0}
	default:
		return PlanLimits{MaxProjects: 1, ReportsPerMonth: 50}
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
