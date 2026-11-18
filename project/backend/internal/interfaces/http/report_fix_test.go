package httpapi

import (
	"net/http"
	"strings"
	"testing"
)

func TestR_FIX_01_MarkFixedAPI(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	ticketID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{
		"type": "bug", "message": "fix via API", "platform": "web",
		"email": "rina@example.com", "user_id": "rina",
	})
	code, body := h.do(http.MethodPatch, "/api/tickets/"+ticketID, map[string]any{
		"status": "fixed", "note": "Filter now refreshes",
	}, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("patch: %d %v", code, body)
	}
	ticket := body["ticket"].(map[string]any)
	if ticket["status"] != "fixed" {
		t.Fatalf("status=%v", ticket["status"])
	}
	if ticket["fixed_at"] == nil {
		t.Fatal("expected fixed_at")
	}
	if ticket["fixed_note"] != "Filter now refreshes" {
		t.Fatalf("note=%v", ticket["fixed_note"])
	}

	var pending int
	if err := h.db.QueryRow(`SELECT COUNT(*) FROM jobs WHERE kind='notify_reporters' AND status='pending'`).Scan(&pending); err != nil {
		t.Fatalf("jobs: %v", err)
	}
	if pending < 1 {
		t.Fatal("expected notify job enqueued")
	}
}

func TestR_FIX_02_MCPMarkFixed(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	mcpToken, scopes := h.createMCPToken(seed.AccessToken, seed.ProjectID)
	hasWrite := false
	for _, s := range scopes {
		if s == "write" {
			hasWrite = true
		}
	}
	if !hasWrite {
		t.Fatalf("expected write scope on indie plan, got %v", scopes)
	}
	ticketID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{
		"type": "bug", "message": "mcp fix", "platform": "web",
		"email": "rina@example.com", "user_id": "rina",
	})
	code, body := h.mcpCall(mcpToken, "mark_fixed", map[string]any{
		"ticket_id": ticketID, "note": "Fixed via MCP",
	})
	if code != 200 {
		t.Fatalf("mcp: %d %v", code, body)
	}
	text, isErr := h.mcpResultText(body)
	if isErr {
		t.Fatalf("mcp error: %s", text)
	}
	mustContain(t, text, ticketID)

	code, detail := h.do(http.MethodGet, "/api/tickets/"+ticketID, nil, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("detail: %d", code)
	}
	if detail["ticket"].(map[string]any)["status"] != "fixed" {
		t.Fatalf("not fixed: %v", detail["ticket"])
	}
}

func TestR_FIX_03_EmailRendered(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	ticketID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{
		"type": "bug", "message": "email please", "platform": "web",
		"email": "rina@example.com", "user_id": "rina",
	})
	code, _ := h.do(http.MethodPatch, "/api/tickets/"+ticketID, map[string]any{
		"status": "fixed", "note": "Filter sekarang refresh dengan benar",
	}, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("patch: %d", code)
	}
	if n := h.drainNotifyJobs(); n < 1 {
		t.Fatal("expected job processed")
	}
	sent := h.mailer.Sent()
	if len(sent) == 0 {
		t.Fatal("expected email")
	}
	mail := sent[0]
	if mail.To != "rina@example.com" {
		t.Fatalf("to=%s", mail.To)
	}
	mustContain(t, mail.HTML, "Filter sekarang refresh dengan benar")
	mustContain(t, mail.Subject, "email please")
}

func TestR_FIX_04_NotifyKillSwitch(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	off := false
	code, _ := h.do(http.MethodPatch, "/api/projects/"+seed.ProjectID, map[string]any{
		"notify_enabled": off,
	}, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("patch project: %d", code)
	}
	ticketID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{
		"type": "bug", "message": "silent fix", "platform": "web",
		"email": "rina@example.com", "user_id": "rina",
	})
	code, body := h.do(http.MethodPatch, "/api/tickets/"+ticketID, map[string]any{
		"status": "fixed", "note": "fixed quietly",
	}, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("patch: %d %v", code, body)
	}
	if body["ticket"].(map[string]any)["status"] != "fixed" {
		t.Fatal("ticket should still be fixed")
	}
	_ = h.drainNotifyJobs()
	if len(h.mailer.Sent()) != 0 {
		t.Fatalf("expected no email when notify disabled, got %d", len(h.mailer.Sent()))
	}
}

func TestR_FIX_05_InAppUpdates(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	h.do(http.MethodPost, "/v1/ingest/identify", map[string]any{
		"user_id": "rina", "email": "rina@example.com",
	}, h.keyHeaders(seed.PublicKey))
	ticketID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{
		"type": "bug", "message": "banner me", "platform": "web",
		"email": "rina@example.com", "user_id": "rina",
	})
	h.do(http.MethodPatch, "/api/tickets/"+ticketID, map[string]any{
		"status": "fixed", "note": "All good",
	}, h.authHeaders(seed.AccessToken))
	_ = h.drainNotifyJobs()

	code, updates := h.do(http.MethodGet, "/v1/ingest/updates?user_id=rina", nil, h.keyHeaders(seed.PublicKey))
	if code != 200 {
		t.Fatalf("updates: %d %v", code, updates)
	}
	list, _ := updates["updates"].([]any)
	if len(list) < 1 {
		t.Fatal("expected unseen update")
	}

	code, updates2 := h.do(http.MethodGet, "/v1/ingest/updates?user_id=rina", nil, h.keyHeaders(seed.PublicKey))
	if code != 200 {
		t.Fatalf("updates2: %d", code)
	}
	list2, _ := updates2["updates"].([]any)
	if len(list2) != 0 {
		t.Fatalf("expected empty second poll, got %v", list2)
	}
}

func TestR_FIX_06_FreePlanMCPWriteGated(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("free")
	mcpToken, scopes := h.createMCPToken(seed.AccessToken, seed.ProjectID)
	for _, s := range scopes {
		if s == "write" {
			t.Fatalf("free plan should not get write scope, got %v", scopes)
		}
	}
	ticketID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{
		"type": "bug", "message": "free gate", "platform": "web",
	})
	code, body := h.mcpCall(mcpToken, "mark_fixed", map[string]any{
		"ticket_id": ticketID, "note": "should fail",
	})
	if code != 200 {
		t.Fatalf("mcp http: %d %v", code, body)
	}
	text, isErr := h.mcpResultText(body)
	if !isErr {
		t.Fatalf("expected plan gate error, got %s", text)
	}
	if !strings.Contains(strings.ToLower(text), "plan") && !strings.Contains(text, "required") {
		t.Fatalf("unexpected error text: %s", text)
	}
}

func TestR_FIX_07_PerActionChannelToggles(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	h.do(http.MethodPost, "/v1/ingest/identify", map[string]any{
		"user_id": "chan", "email": "chan@example.com",
	}, h.keyHeaders(seed.PublicKey))
	ticketID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{
		"type": "bug", "message": "channel toggle", "platform": "web",
		"email": "chan@example.com", "user_id": "chan",
	})
	code, body := h.do(http.MethodPatch, "/api/tickets/"+ticketID, map[string]any{
		"status": "fixed",
		"note":   "banner only",
		"notify": map[string]any{"email": false, "in_app": true},
	}, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("patch: %d %v", code, body)
	}
	_ = h.drainNotifyJobs()
	if len(h.mailer.Sent()) != 0 {
		t.Fatalf("expected no email when notify.email=false, got %d", len(h.mailer.Sent()))
	}
	code, updates := h.do(http.MethodGet, "/v1/ingest/updates?user_id=chan", nil, h.keyHeaders(seed.PublicKey))
	if code != 200 {
		t.Fatalf("updates: %d %v", code, updates)
	}
	list, _ := updates["updates"].([]any)
	if len(list) < 1 {
		t.Fatal("expected in-app banner when notify.in_app=true")
	}
}

func TestR_FIX_08_BannerKillSwitch(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	off := false
	code, _ := h.do(http.MethodPatch, "/api/projects/"+seed.ProjectID, map[string]any{
		"banner_enabled": off,
	}, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("patch project: %d", code)
	}
	h.do(http.MethodPost, "/v1/ingest/identify", map[string]any{
		"user_id": "banner", "email": "banner@example.com",
	}, h.keyHeaders(seed.PublicKey))
	ticketID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{
		"type": "bug", "message": "no banner", "platform": "web",
		"email": "banner@example.com", "user_id": "banner",
	})
	code, body := h.do(http.MethodPatch, "/api/tickets/"+ticketID, map[string]any{
		"status": "fixed", "note": "email still ok",
	}, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("patch: %d %v", code, body)
	}
	_ = h.drainNotifyJobs()
	if len(h.mailer.Sent()) == 0 {
		t.Fatal("expected email when only banner_enabled=false")
	}
	code, updates := h.do(http.MethodGet, "/v1/ingest/updates?user_id=banner", nil, h.keyHeaders(seed.PublicKey))
	if code != 200 {
		t.Fatalf("updates: %d %v", code, updates)
	}
	list, _ := updates["updates"].([]any)
	if len(list) != 0 {
		t.Fatalf("expected no in-app banner when banner_enabled=false, got %v", list)
	}
}
