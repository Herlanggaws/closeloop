package httpapi

import (
	"net/http"
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

// Pricing update P1 (US-60, US-62): Free gets every MCP tool, mark_fixed included.
func TestR_FIX_06_FreePlanMCPFullLoop(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("free")
	mcpToken, scopes := h.createMCPToken(seed.AccessToken, seed.ProjectID)
	hasWrite := false
	for _, s := range scopes {
		if s == "write" {
			hasWrite = true
		}
	}
	if !hasWrite {
		t.Fatalf("free plan should get write scope, got %v", scopes)
	}
	ticketID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{
		"type": "bug", "message": "free loop", "platform": "web",
	})
	for _, call := range []struct {
		tool string
		args map[string]any
	}{
		{"update_status", map[string]any{"ticket_id": ticketID, "status": "in_progress"}},
		{"add_note", map[string]any{"ticket_id": ticketID, "body": "found it"}},
		{"mark_fixed", map[string]any{"ticket_id": ticketID, "note": "shipped"}},
	} {
		code, body := h.mcpCall(mcpToken, call.tool, call.args)
		if code != 200 {
			t.Fatalf("%s http: %d %v", call.tool, code, body)
		}
		if text, isErr := h.mcpResultText(body); isErr {
			t.Fatalf("%s on free should work, got %s", call.tool, text)
		}
	}
	code, detail := h.do(http.MethodGet, "/api/tickets/"+ticketID, nil, h.authHeaders(seed.AccessToken))
	if code != 200 || detail["ticket"].(map[string]any)["status"] != "fixed" {
		t.Fatalf("expected fixed, got %d %v", code, detail["ticket"])
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
