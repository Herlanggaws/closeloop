package httpapi

import (
	"context"
	"net/http"
	"strings"
	"testing"

	"github.com/closeloop/api/internal/application"
)

func addRepo(h *reportHarness, seed seededProject, body map[string]any) (int, map[string]any) {
	return h.do(http.MethodPost, "/api/projects/"+seed.ProjectID+"/repos", body, h.authHeaders(seed.AccessToken))
}

func repoID(t *testing.T, body map[string]any) string {
	t.Helper()
	repo, ok := body["repo"].(map[string]any)
	if !ok {
		t.Fatalf("no repo in %v", body)
	}
	return repo["id"].(string)
}

// D-12/D-13, US-45…US-47: first repo is the fallback, platforms are unique, repos are unique.
func TestRepos_AddFallbackConflicts(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")

	code, web := addRepo(h, seed, map[string]any{
		"installation_id": 1, "account_login": "bear", "full_name": "bear/web",
		"routes": []map[string]any{{"platform": "web"}},
	})
	if code != 201 || !web["repo"].(map[string]any)["is_fallback"].(bool) {
		t.Fatalf("first repo should be fallback: %d %v", code, web)
	}
	code, body := addRepo(h, seed, map[string]any{
		"full_name": "bear/app",
		"routes":    []map[string]any{{"platform": "web"}, {"platform": "ios", "path": "apps/ios"}},
	})
	if code != 409 || errCode(body) != "PLATFORM_CONFLICT" || errField(body, "repo") != "bear/web" {
		t.Fatalf("expected PLATFORM_CONFLICT naming bear/web, got %d %v", code, body)
	}
	if !strings.Contains(errField(body, "message"), "Web already routes to bear/web") {
		t.Fatalf("message: %v", body)
	}
	code, body = addRepo(h, seed, map[string]any{"full_name": "bear/web"})
	if code != 409 {
		t.Fatalf("duplicate repo should 409, got %d %v", code, body)
	}
	code, app := addRepo(h, seed, map[string]any{
		"full_name": "bear/app",
		"routes":    []map[string]any{{"platform": "android", "path": "apps/android"}, {"platform": "ios", "path": "apps/ios"}},
	})
	if code != 201 || app["repo"].(map[string]any)["is_fallback"].(bool) {
		t.Fatalf("second repo: %d %v", code, app)
	}
	code, list := h.do(http.MethodGet, "/api/projects/"+seed.ProjectID+"/repos", nil, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("list: %d", code)
	}
	usage := list["usage"].(map[string]any)
	if usage["used"].(float64) != 2 || usage["limit"].(float64) != 5 {
		t.Fatalf("usage = %v, want 2 of 5", usage)
	}
}

// US-48: Free stops at 3 repos per project with REPO_LIMIT.
func TestRepos_LimitOnFree(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("free")
	for _, name := range []string{"o/a", "o/b", "o/c"} {
		if code, body := addRepo(h, seed, map[string]any{"full_name": name}); code != 201 {
			t.Fatalf("add %s: %d %v", name, code, body)
		}
	}
	code, body := addRepo(h, seed, map[string]any{"full_name": "o/d"})
	if code != 402 || errCode(body) != "REPO_LIMIT" {
		t.Fatalf("expected REPO_LIMIT, got %d %v", code, body)
	}
}

// D-15, US-49/US-50: reports route by platform, else fallback, else none.
func TestRepos_RoutingAndFilter(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	_, web := addRepo(h, seed, map[string]any{"full_name": "bear/web", "routes": []map[string]any{{"platform": "web"}}})
	_, app := addRepo(h, seed, map[string]any{"full_name": "bear/app", "routes": []map[string]any{{"platform": "ios", "path": "composeApp"}}})
	webID, appID := repoID(t, web), repoID(t, app)

	iosTicket, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{"type": "bug", "message": "ios crash", "platform": "ios"})
	androidTicket, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{"type": "bug", "message": "android crash", "platform": "android"})

	_, detail := h.do(http.MethodGet, "/api/tickets/"+iosTicket, nil, h.authHeaders(seed.AccessToken))
	tk := detail["ticket"].(map[string]any)
	if tk["repo"] != "bear/app" || tk["repo_path"] != "composeApp" || tk["repo_id"] != appID {
		t.Fatalf("ios should route to bear/app composeApp: %v", tk)
	}
	routed := false
	for _, raw := range detail["events"].([]any) {
		ev := raw.(map[string]any)
		if ev["kind"] == "ticket_routed" {
			routed = true
		}
	}
	if !routed {
		t.Fatal("expected ticket_routed event")
	}
	_, detail = h.do(http.MethodGet, "/api/tickets/"+androidTicket, nil, h.authHeaders(seed.AccessToken))
	if detail["ticket"].(map[string]any)["repo_id"] != webID {
		t.Fatalf("android has no route, should land on fallback bear/web: %v", detail["ticket"])
	}

	// No fallback: unrouted platform gets no repo.
	if code, body := h.do(http.MethodPatch, "/api/projects/"+seed.ProjectID+"/repos/"+webID,
		map[string]any{"is_fallback": false}, h.authHeaders(seed.AccessToken)); code != 200 {
		t.Fatalf("clear fallback: %d %v", code, body)
	}
	orphan, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{"type": "bug", "message": "android orphan", "platform": "android"})
	_, list := h.do(http.MethodGet, "/api/projects/"+seed.ProjectID+"/tickets?repo=none", nil, h.authHeaders(seed.AccessToken))
	tickets := list["tickets"].([]any)
	if len(tickets) != 1 || tickets[0].(map[string]any)["id"] != orphan {
		t.Fatalf("repo=none should return only the orphan, got %v", tickets)
	}
	_, list = h.do(http.MethodGet, "/api/projects/"+seed.ProjectID+"/tickets?repo="+appID, nil, h.authHeaders(seed.AccessToken))
	if n := len(list["tickets"].([]any)); n != 1 {
		t.Fatalf("repo filter = %d tickets, want 1", n)
	}
}

// US-48: paused repos stop receiving reports; their platforms fall back.
func TestRepos_DowngradePausesRouting(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	_, web := addRepo(h, seed, map[string]any{"full_name": "bear/web", "routes": []map[string]any{{"platform": "web"}}})
	_, app := addRepo(h, seed, map[string]any{"full_name": "bear/app", "routes": []map[string]any{{"platform": "ios"}}})
	webID := repoID(t, web)
	_ = repoID(t, app)
	code, body := h.do(http.MethodPost, "/api/projects/"+seed.ProjectID+"/repos/active",
		map[string]any{"keep": []string{}}, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("set active: %d %v", code, body)
	}
	for _, raw := range body["repos"].([]any) {
		r := raw.(map[string]any)
		if r["full_name"] == "bear/app" && !r["routing_paused"].(bool) {
			t.Fatal("bear/app should be paused")
		}
		if r["full_name"] == "bear/web" && r["routing_paused"].(bool) {
			t.Fatal("fallback stays on")
		}
	}
	ios, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{"type": "bug", "message": "ios after pause", "platform": "ios"})
	_, detail := h.do(http.MethodGet, "/api/tickets/"+ios, nil, h.authHeaders(seed.AccessToken))
	if detail["ticket"].(map[string]any)["repo_id"] != webID {
		t.Fatalf("paused repo should send ios to fallback: %v", detail["ticket"])
	}
}

// D-16 / D-17, US-51/US-52/US-54: reroute from dashboard and MCP; repo-aware listing.
func TestRepos_RerouteAndMCP(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("free")
	_, web := addRepo(h, seed, map[string]any{"full_name": "bear/web", "routes": []map[string]any{{"platform": "web"}}})
	_, api := addRepo(h, seed, map[string]any{"full_name": "bear/api", "routes": []map[string]any{{"platform": "backend"}}})
	_ = repoID(t, web)
	apiID := repoID(t, api)
	ticket, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{"type": "bug", "message": "500 on save", "platform": "web"})

	code, body := h.do(http.MethodPatch, "/api/tickets/"+ticket, map[string]any{"repo_id": apiID, "reason": "API bug"}, h.authHeaders(seed.AccessToken))
	if code != 200 || body["ticket"].(map[string]any)["repo"] != "bear/api" {
		t.Fatalf("dashboard reroute: %d %v", code, body)
	}

	mcpToken, _ := h.createMCPToken(seed.AccessToken, seed.ProjectID)
	_, res := h.mcpCall(mcpToken, "list_open_feedback", map[string]any{"repo": "bear/web"})
	text, isErr := h.mcpResultText(res)
	if isErr || strings.Contains(text, ticket) {
		t.Fatalf("bear/web listing should not include the rerouted ticket: %s", text)
	}
	_, res = h.mcpCall(mcpToken, "list_open_feedback", map[string]any{"repo": "nope/nope"})
	if text, isErr := h.mcpResultText(res); !isErr || !strings.Contains(text, "REPO_NOT_CONNECTED") {
		t.Fatalf("unknown repo should be REPO_NOT_CONNECTED, got %s", text)
	}
	_, res = h.mcpCall(mcpToken, "reroute_feedback", map[string]any{"ticket_id": ticket, "repo": "bear/web"})
	if _, isErr := h.mcpResultText(res); !isErr {
		t.Fatal("reroute without reason must fail")
	}
	_, res = h.mcpCall(mcpToken, "reroute_feedback", map[string]any{"ticket_id": ticket, "repo": "bear/web", "reason": "front-end validation after all"})
	if text, isErr := h.mcpResultText(res); isErr || !strings.Contains(text, "bear/web") {
		t.Fatalf("free agent reroute should work: %s", text)
	}
	_, res = h.mcpCall(mcpToken, "get_feedback_context", map[string]any{"ticket_id": ticket})
	text, _ = h.mcpResultText(res)
	if !strings.Contains(text, `"repo": "bear/web"`) || !strings.Contains(text, `"platform": "web"`) {
		t.Fatalf("context should carry repo + platform: %s", text)
	}
}

// D-18, US-55: mark_fixed warns when reporters sit on a platform the repo does not serve.
func TestRepos_CrossPlatformMarkFixed(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	addRepo(h, seed, map[string]any{"full_name": "bear/web", "routes": []map[string]any{{"platform": "web"}}})
	addRepo(h, seed, map[string]any{"full_name": "bear/app", "routes": []map[string]any{{"platform": "ios"}}})
	parent, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{"type": "bug", "message": "chart broken", "platform": "web"})
	child, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{"type": "bug", "message": "chart broken ios", "platform": "ios"})
	if code, body := h.do(http.MethodPost, "/api/tickets/merge", map[string]any{"parent_id": parent, "child_ids": []string{child}}, h.authHeaders(seed.AccessToken)); code != 200 {
		t.Fatalf("merge: %d %v", code, body)
	}
	_, detail := h.do(http.MethodGet, "/api/tickets/"+parent, nil, h.authHeaders(seed.AccessToken))
	cov := detail["repo_coverage"].(map[string]any)
	if cov["uncovered"].(map[string]any)["ios"].(float64) != 1 || cov["covered"].(map[string]any)["web"].(float64) != 1 {
		t.Fatalf("coverage = %v", cov)
	}

	mcpToken, _ := h.createMCPToken(seed.AccessToken, seed.ProjectID)
	_, res := h.mcpCall(mcpToken, "mark_fixed", map[string]any{"ticket_id": parent})
	text, isErr := h.mcpResultText(res)
	if !isErr || !strings.Contains(text, "CROSS_PLATFORM") || !strings.Contains(text, "ios") {
		t.Fatalf("expected cross-platform warning, got %s", text)
	}
	_, res = h.mcpCall(mcpToken, "mark_fixed", map[string]any{"ticket_id": parent, "confirm": true})
	if text, isErr := h.mcpResultText(res); isErr {
		t.Fatalf("confirm should mark fixed: %s", text)
	}
}

// Dashboard fix with notify_platforms only tells reporters on those platforms (US-55).
func TestRepos_NotifyPlatformsFilter(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	addRepo(h, seed, map[string]any{"full_name": "bear/web", "routes": []map[string]any{{"platform": "web"}}})
	parent, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{"type": "bug", "message": "x", "platform": "web", "email": "web@example.com", "user_id": "w1"})
	child, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{"type": "bug", "message": "x ios", "platform": "ios", "email": "ios@example.com", "user_id": "i1"})
	h.do(http.MethodPost, "/api/tickets/merge", map[string]any{"parent_id": parent, "child_ids": []string{child}}, h.authHeaders(seed.AccessToken))

	n, mails, err := h.store.NotifyReporters(context.Background(), parent, "fixed", true, true, "web")
	if err != nil {
		t.Fatal(err)
	}
	if n != 1 || len(mails) != 1 || mails[0].Email != "web@example.com" {
		t.Fatalf("expected only the web reporter, got n=%d mails=%v", n, mails)
	}
}

type rerouteExec struct{}

func (rerouteExec) Execute(ctx context.Context, req application.AutoprExecRequest) (application.AutoprExecResult, error) {
	return application.AutoprExecResult{NeedsReroute: true, SuggestedRepo: "bear/api", Reason: "the 500 comes from /v1/budgets"}, nil
}

// D-19, US-56/US-57: runs use the ticket repo, refuse tickets with none, and needs_reroute refunds.
func TestRepos_AutoPRNeedsReroute(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	if _, err := h.store.GrantAutoPRCredits(context.Background(), seed.OrgID, 3, "test_seed"); err != nil {
		t.Fatal(err)
	}
	if code, body := h.do(http.MethodPut, "/api/projects/"+seed.ProjectID+"/integrations/github_app", map[string]any{
		"config": map[string]any{"installation_id": 7, "account_login": "bear"},
	}, h.authHeaders(seed.AccessToken)); code != 200 {
		t.Fatalf("github app: %d %v", code, body)
	}
	// No repos yet: the ticket has no repo, so auto PR is refused.
	orphan, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{"type": "bug", "message": "orphan", "platform": "web"})
	code, body := h.do(http.MethodPost, "/api/tickets/"+orphan+"/autopr", map[string]any{}, h.authHeaders(seed.AccessToken))
	if code != 400 || !strings.Contains(errField(body, "message"), "Pick a repo for this ticket first") {
		t.Fatalf("expected pick-a-repo error, got %d %v", code, body)
	}

	addRepo(h, seed, map[string]any{"installation_id": 7, "full_name": "bear/web", "routes": []map[string]any{{"platform": "web"}}})
	ticket, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{"type": "bug", "message": "save fails", "platform": "web"})
	code, body = h.do(http.MethodPost, "/api/tickets/"+ticket+"/autopr", map[string]any{}, h.authHeaders(seed.AccessToken))
	if code != 201 {
		t.Fatalf("start: %d %v", code, body)
	}
	run := body["run"].(map[string]any)
	if run["repo"] != "bear/web" {
		t.Fatalf("run should use ticket repo, got %v", run["repo"])
	}
	before, _ := h.store.OrgAutoPRCredits(context.Background(), seed.OrgID)
	if err := application.ProcessAutoprRun(context.Background(), h.store, rerouteExec{}, "http://web.test", run["id"].(string)); err != nil {
		t.Fatalf("process: %v", err)
	}
	got, _ := h.store.GetAutoprRun(context.Background(), run["id"].(string))
	if got.Status != "needs_reroute" || got.SuggestedRepo != "bear/api" || got.PRURL != "" || got.PRNumber != nil {
		t.Fatalf("run = %+v", got)
	}
	after, _ := h.store.OrgAutoPRCredits(context.Background(), seed.OrgID)
	if after != before+1 {
		t.Fatalf("credit not refunded: before %d after %d", before, after)
	}
}

// D-11: an existing single GitHub App repo becomes the fallback repo.
func TestRepos_LegacyGitHubRepoBecomesFallback(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	if code, body := h.do(http.MethodPut, "/api/projects/"+seed.ProjectID+"/integrations/github_app", map[string]any{
		"config": map[string]any{"installation_id": 9, "account_login": "bear", "repo_full_name": "bear/legacy", "default_branch": "trunk"},
	}, h.authHeaders(seed.AccessToken)); code != 200 {
		t.Fatalf("github app: %d %v", code, body)
	}
	repos, err := h.store.ListProjectRepos(context.Background(), seed.ProjectID)
	if err != nil {
		t.Fatal(err)
	}
	if len(repos) != 1 || repos[0].FullName != "bear/legacy" || !repos[0].IsFallback || repos[0].DefaultBranch != "trunk" {
		t.Fatalf("repos = %+v", repos)
	}
}
