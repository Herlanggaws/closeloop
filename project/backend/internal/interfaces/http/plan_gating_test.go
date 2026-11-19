package httpapi

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// US-63: an MCP read on a ticket whose reports are all quota-locked returns QUOTA_LOCKED
// with the reset date and an upgrade link, not PLAN_REQUIRED.
func TestPlan_QuotaLockedMCPAndAPI(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("free")
	mcpToken, _ := h.createMCPToken(seed.AccessToken, seed.ProjectID)
	ticketID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{
		"type": "bug", "message": "over quota", "platform": "web",
	})
	if _, err := h.db.Exec(`UPDATE reports SET quota_locked=true WHERE ticket_id=$1`, ticketID); err != nil {
		t.Fatal(err)
	}
	for _, tool := range []string{"get_feedback_context", "update_status", "mark_fixed"} {
		args := map[string]any{"ticket_id": ticketID, "status": "in_progress"}
		code, body := h.mcpCall(mcpToken, tool, args)
		if code != 200 {
			t.Fatalf("%s http: %d", tool, code)
		}
		text, isErr := h.mcpResultText(body)
		if !isErr || !strings.Contains(text, "QUOTA_LOCKED") || !strings.Contains(text, "reset_at") || !strings.Contains(text, "upgrade_url") {
			t.Fatalf("%s: expected QUOTA_LOCKED with reset_at + upgrade_url, got %s", tool, text)
		}
	}
	code, body := h.do(http.MethodGet, "/api/tickets/"+ticketID, nil, h.authHeaders(seed.AccessToken))
	if code != 402 || errCode(body) != "QUOTA_LOCKED" {
		t.Fatalf("dashboard: expected 402 QUOTA_LOCKED, got %d %v", code, body)
	}
}

// US-61: the migration gives active Free tokens the write scope and logs one audit row per org.
func TestPlan_FreeTokenMigration(t *testing.T) {
	h := newReportHarness(t)
	free := h.seedUserProject("free")
	paid := h.seedUserProject("indie")
	_, _ = h.createMCPToken(free.AccessToken, free.ProjectID)
	_, _ = h.createMCPToken(paid.AccessToken, paid.ProjectID)
	// Simulate tokens minted before the change.
	if _, err := h.db.Exec(`UPDATE mcp_tokens SET scopes='{read}'`); err != nil {
		t.Fatal(err)
	}
	body, err := os.ReadFile(filepath.Join("..", "..", "..", "db", "migrations", "021_free_mcp_write.sql"))
	if err != nil {
		t.Fatal(err)
	}
	up := strings.ReplaceAll(strings.Split(string(body), "-- +goose Down")[0], "-- +goose Up", "")
	if _, err := h.db.Exec(up); err != nil {
		t.Fatalf("migration: %v", err)
	}
	var freeWrite, paidWrite bool
	_ = h.db.QueryRow(`SELECT 'write' = ANY(scopes) FROM mcp_tokens WHERE project_id=$1`, free.ProjectID).Scan(&freeWrite)
	_ = h.db.QueryRow(`SELECT 'write' = ANY(scopes) FROM mcp_tokens WHERE project_id=$1`, paid.ProjectID).Scan(&paidWrite)
	if !freeWrite {
		t.Fatal("free token should be upgraded to write")
	}
	if paidWrite {
		t.Fatal("migration only targets Free orgs")
	}
	var audits int
	_ = h.db.QueryRow(`SELECT COUNT(*) FROM audit_logs WHERE org_id=$1 AND actor='system' AND action='mcp.token.scope_upgraded'`, free.OrgID).Scan(&audits)
	if audits != 1 {
		t.Fatalf("expected 1 audit row, got %d", audits)
	}
}

// US-64, US-69: Slack needs Indie, Linear/Jira need Studio; webhooks stay on Free.
func TestPlan_IntegrationConnectGating(t *testing.T) {
	h := newReportHarness(t)
	free := h.seedUserProject("free")
	indie := h.seedUserProject("indie")
	slack := map[string]any{"config": map[string]any{"webhook_url": "https://hooks.slack.com/services/T/B/x"}}
	linear := map[string]any{"config": map[string]any{"api_key": "lin_api_x", "team_id": "team"}}

	code, body := h.do(http.MethodPut, "/api/projects/"+free.ProjectID+"/integrations/slack", slack, h.authHeaders(free.AccessToken))
	if code != 402 || errCode(body) != "PREMIUM_REQUIRED" || errField(body, "required_plan") != "indie" {
		t.Fatalf("free slack: expected 402 PREMIUM_REQUIRED indie, got %d %v", code, body)
	}
	code, body = h.do(http.MethodPut, "/api/projects/"+indie.ProjectID+"/integrations/slack", slack, h.authHeaders(indie.AccessToken))
	if code != 200 {
		t.Fatalf("indie slack: %d %v", code, body)
	}
	code, body = h.do(http.MethodPut, "/api/projects/"+indie.ProjectID+"/integrations/linear", linear, h.authHeaders(indie.AccessToken))
	if code != 402 || errField(body, "required_plan") != "studio" {
		t.Fatalf("indie linear: expected 402 studio, got %d %v", code, body)
	}
	code, body = h.do(http.MethodPut, "/api/projects/"+free.ProjectID+"/integrations/webhooks",
		map[string]any{"config": map[string]any{"url": "https://example.com/hook"}}, h.authHeaders(free.AccessToken))
	if code == 402 {
		t.Fatalf("webhooks must stay on Free, got %v", body)
	}
}

// Connections made before gating keep working after a downgrade (grandfathered).
func TestPlan_GrandfatheredIntegrationKeepsWorking(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	slack := map[string]any{"config": map[string]any{"webhook_url": "https://hooks.slack.com/services/T/B/x"}}
	if code, body := h.do(http.MethodPut, "/api/projects/"+seed.ProjectID+"/integrations/slack", slack, h.authHeaders(seed.AccessToken)); code != 200 {
		t.Fatalf("connect: %d %v", code, body)
	}
	if _, err := h.db.Exec(`UPDATE organizations SET plan='free' WHERE id=$1`, seed.OrgID); err != nil {
		t.Fatal(err)
	}
	// Editing an existing connection stays allowed even below the plan.
	if code, body := h.do(http.MethodPut, "/api/projects/"+seed.ProjectID+"/integrations/slack", slack, h.authHeaders(seed.AccessToken)); code != 200 {
		t.Fatalf("edit existing on free: %d %v", code, body)
	}
}

// Free cannot create GitHub issues unless the GitHub App connection predates gating.
func TestPlan_GitHubIssueNeedsIndie(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("free")
	ticketID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{
		"type": "bug", "message": "issue gate", "platform": "web",
	})
	code, body := h.do(http.MethodPost, "/api/tickets/"+ticketID+"/github-issue", nil, h.authHeaders(seed.AccessToken))
	if code != 402 || errCode(body) != "PREMIUM_REQUIRED" {
		t.Fatalf("expected 402 PREMIUM_REQUIRED, got %d %v", code, body)
	}
}

// Publishing to the public board needs Indie; unpublishing is always allowed.
func TestPlan_BoardPublishNeedsIndie(t *testing.T) {
	h := newReportHarness(t)
	free := h.seedUserProject("free")
	ticketID, _, _, _, _ := h.ingestReport(free.PublicKey, map[string]any{
		"type": "idea", "message": "dark mode", "platform": "web",
	})
	code, body := h.do(http.MethodPatch, "/api/tickets/"+ticketID, map[string]any{"is_public": true}, h.authHeaders(free.AccessToken))
	if code != 402 || errCode(body) != "PREMIUM_REQUIRED" {
		t.Fatalf("free publish: expected 402, got %d %v", code, body)
	}
	if _, err := h.db.Exec(`UPDATE tickets SET is_public=true WHERE id=$1`, ticketID); err != nil {
		t.Fatal(err)
	}
	code, body = h.do(http.MethodPatch, "/api/tickets/"+ticketID, map[string]any{"is_public": false}, h.authHeaders(free.AccessToken))
	if code != 200 {
		t.Fatalf("free unpublish should work: %d %v", code, body)
	}

	indie := h.seedUserProject("indie")
	ticket2, _, _, _, _ := h.ingestReport(indie.PublicKey, map[string]any{
		"type": "idea", "message": "export csv", "platform": "web",
	})
	code, body = h.do(http.MethodPatch, "/api/tickets/"+ticket2, map[string]any{"is_public": true}, h.authHeaders(indie.AccessToken))
	if code != 200 {
		t.Fatalf("indie publish: %d %v", code, body)
	}
}

// D-22: Business cannot be picked self-serve; orgs already on Business are untouched.
func TestPlan_BusinessNotSelfServe(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("free")
	code, body := h.do(http.MethodPatch, "/api/org/plan", map[string]any{"plan": "business"}, h.authHeaders(seed.AccessToken))
	if code != 400 || !strings.Contains(errField(body, "message"), "Business is not available yet.") {
		t.Fatalf("expected Business rejection, got %d %v", code, body)
	}
	code, body = h.do(http.MethodPatch, "/api/org/plan", map[string]any{"plan": "studio"}, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("studio should be self-serve: %d %v", code, body)
	}

	biz := h.seedUserProject("business")
	code, body = h.do(http.MethodGet, "/api/me", nil, h.authHeaders(biz.AccessToken))
	if code != 200 || body["org"].(map[string]any)["plan"] != "business" {
		t.Fatalf("existing business org should load: %d %v", code, body)
	}
}

// D-09: /api/me?project_id returns repos {used, limit} for that project.
func TestPlan_UsageRepos(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("free")
	code, body := h.do(http.MethodGet, "/api/me?project_id="+seed.ProjectID, nil, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("me: %d %v", code, body)
	}
	usage := body["usage"].(map[string]any)
	repos, ok := usage["repos"].(map[string]any)
	if !ok {
		t.Fatalf("expected usage.repos, got %v", usage)
	}
	if repos["limit"].(float64) != 3 || repos["used"].(float64) != 0 {
		t.Fatalf("free repos = %v, want 0 of 3", repos)
	}
	code, body = h.do(http.MethodGet, "/api/me", nil, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("me without project: %d", code)
	}
	if _, has := body["usage"].(map[string]any)["repos"]; has {
		t.Fatal("repos should be omitted without project_id")
	}
}


func errField(body map[string]any, key string) string {
	e, _ := body["error"].(map[string]any)
	v, _ := e[key].(string)
	return v
}

// D-03: ticket detail lists every reporter with their platform, merged across platforms.
func TestTicketDetailListsReporters(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	ticketID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{
		"type": "bug", "message": "chart broken", "platform": "web",
		"reporter": map[string]any{"email": "rina@example.com", "user_id": "rina"},
	})
	other, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{
		"type": "bug", "message": "chart broken on phone", "platform": "ios",
	})
	code, body := h.do(http.MethodPost, "/api/tickets/merge", map[string]any{
		"parent_id": ticketID, "child_ids": []string{other},
	}, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("merge: %d %v", code, body)
	}
	code, detail := h.do(http.MethodGet, "/api/tickets/"+ticketID, nil, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("detail: %d %v", code, detail)
	}
	rep := detail["reporters"].(map[string]any)
	items := rep["items"].([]any)
	if len(items) != 2 {
		t.Fatalf("expected 2 reporters, got %v", items)
	}
	by := rep["by_platform"].(map[string]any)
	if by["web"].(float64) != 1 || by["ios"].(float64) != 1 {
		t.Fatalf("by_platform = %v", by)
	}
}
