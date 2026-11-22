package application

import "testing"

func TestReplayAllowedAndRetention(t *testing.T) {
	cases := []struct {
		plan      string
		allowed   bool
		retention int
	}{
		{"free", false, 0},
		{"indie", false, 0},
		{"studio", true, 7},
		{"business", true, 30},
		{"STUDIO", true, 7},
	}
	for _, tc := range cases {
		if got := ReplayAllowed(tc.plan); got != tc.allowed {
			t.Fatalf("ReplayAllowed(%q)=%v want %v", tc.plan, got, tc.allowed)
		}
		if got := ReplayRetentionDays(tc.plan); got != tc.retention {
			t.Fatalf("ReplayRetentionDays(%q)=%d want %d", tc.plan, got, tc.retention)
		}
	}
}

// US-69: the plan gating table from the pricing update, one row per feature.
func TestIntegrationAndBoardGatingPerPlan(t *testing.T) {
	type row struct {
		feature string
		check   func(plan string) bool
		want    map[string]bool
	}
	integ := func(provider string) func(string) bool {
		return func(plan string) bool { return IntegrationAllowed(plan, provider) }
	}
	all := map[string]bool{"free": true, "indie": true, "studio": true, "business": true}
	indieUp := map[string]bool{"free": false, "indie": true, "studio": true, "business": true}
	studioUp := map[string]bool{"free": false, "indie": false, "studio": true, "business": true}
	rows := []row{
		{"slack", integ("slack"), indieUp},
		{"github_issues", integ("github_issues"), indieUp},
		{"linear", integ("linear"), studioUp},
		{"jira", integ("jira"), studioUp},
		{"board", BoardAllowed, indieUp},
		{"sentry", integ("sentry"), all},
		{"posthog", integ("posthog"), all},
		{"webhooks", integ("webhooks"), all},
		{"github_app", integ("github_app"), all},
	}
	for _, r := range rows {
		for plan, want := range r.want {
			if got := r.check(plan); got != want {
				t.Fatalf("%s on %s = %v, want %v", r.feature, plan, got, want)
			}
		}
	}
	if IntegrationAllowed("unknown-plan", "slack") {
		t.Fatal("unknown plans must fall back to Free")
	}
}

func TestMaxReposPerProject(t *testing.T) {
	cases := map[string]int{"free": 3, "indie": 5, "studio": 10, "business": 0}
	for plan, want := range cases {
		if got := LimitsForPlan(plan).MaxReposPerProject; got != want {
			t.Fatalf("MaxReposPerProject(%s)=%d want %d", plan, got, want)
		}
	}
	if !LimitsForPlan("free").RepoLimitReached(3) || LimitsForPlan("free").RepoLimitReached(2) {
		t.Fatal("free repo limit should trip at 3")
	}
	if LimitsForPlan("business").RepoLimitReached(1000) {
		t.Fatal("business has no repo limit")
	}
}

func TestMaxSeats(t *testing.T) {
	cases := map[string]int{"free": 1, "indie": 2, "studio": 5, "business": 0}
	for plan, want := range cases {
		if got := LimitsForPlan(plan).MaxSeats; got != want {
			t.Fatalf("MaxSeats(%s)=%d want %d", plan, got, want)
		}
	}
}

func TestSelfServePlanAllowedHidesBusiness(t *testing.T) {
	for _, p := range []string{"free", "indie", "studio"} {
		if !SelfServePlanAllowed(p) {
			t.Fatalf("%s should be self-serve", p)
		}
	}
	if SelfServePlanAllowed("business") {
		t.Fatal("business must not be self-serve until M6")
	}
	if !ValidPlan("business") {
		t.Fatal("ValidPlan must still accept business")
	}
}
