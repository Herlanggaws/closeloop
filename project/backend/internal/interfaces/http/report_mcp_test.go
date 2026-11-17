package httpapi

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
)

func TestR_MCP_01_ListOpenFeedback(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	mcpToken, _ := h.createMCPToken(seed.AccessToken, seed.ProjectID)
	openID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{"type": "bug", "message": "open one", "platform": "web"})
	fixedID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{"type": "bug", "message": "fixed one", "platform": "web"})
	h.do(http.MethodPatch, "/api/tickets/"+fixedID, map[string]any{"status": "fixed", "note": "done"}, h.authHeaders(seed.AccessToken))

	code, body := h.mcpCall(mcpToken, "list_open_feedback", map[string]any{})
	if code != 200 {
		t.Fatalf("mcp: %d %v", code, body)
	}
	text, isErr := h.mcpResultText(body)
	if isErr {
		t.Fatalf("error: %s", text)
	}
	mustContain(t, text, openID)
	if strings.Contains(text, fixedID) {
		t.Fatalf("fixed ticket should be excluded: %s", text)
	}
}

func TestR_MCP_02_GetFeedbackContext(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	mcpToken, _ := h.createMCPToken(seed.AccessToken, seed.ProjectID)
	ticketID, _, attID, _, token := h.ingestReport(seed.PublicKey, map[string]any{
		"type": "bug", "message": "need context", "platform": "web",
		"context": map[string]any{"url": "/tx"},
	})
	h.uploadScreenshot(attID, token, []byte("shot"))

	code, body := h.mcpCall(mcpToken, "get_feedback_context", map[string]any{"ticket_id": ticketID})
	if code != 200 {
		t.Fatalf("mcp: %d", code)
	}
	text, isErr := h.mcpResultText(body)
	if isErr {
		t.Fatalf("error: %s", text)
	}
	mustContain(t, text, "need context")
	mustContain(t, text, "/tx")
}

func TestR_MCP_03_UpdateStatusAndAddNote(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	mcpToken, _ := h.createMCPToken(seed.AccessToken, seed.ProjectID)
	ticketID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{
		"type": "bug", "message": "agent work", "platform": "web",
	})

	code, body := h.mcpCall(mcpToken, "update_status", map[string]any{
		"ticket_id": ticketID, "status": "in_progress",
	})
	if code != 200 {
		t.Fatalf("status: %d", code)
	}
	text, isErr := h.mcpResultText(body)
	if isErr {
		t.Fatalf("status err: %s", text)
	}

	code, body = h.mcpCall(mcpToken, "add_note", map[string]any{
		"ticket_id": ticketID, "body": "root cause in filter debounce",
	})
	if code != 200 {
		t.Fatalf("note: %d", code)
	}
	text, isErr = h.mcpResultText(body)
	if isErr {
		t.Fatalf("note err: %s", text)
	}

	code, detail := h.do(http.MethodGet, "/api/tickets/"+ticketID, nil, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("detail: %d", code)
	}
	if detail["ticket"].(map[string]any)["status"] != "in_progress" {
		t.Fatalf("status=%v", detail["ticket"])
	}
	found := false
	for _, raw := range detail["events"].([]any) {
		ev := raw.(map[string]any)
		if ev["kind"] == "note" {
			found = true
		}
	}
	if !found {
		t.Fatal("expected note event")
	}
}

func TestR_MCP_04_BadToken(t *testing.T) {
	h := newReportHarness(t)
	code, body := h.do(http.MethodPost, "/mcp", map[string]any{
		"jsonrpc": "2.0", "id": 1, "method": "tools/list",
	}, map[string]string{"Authorization": "Bearer mcp_garbage"})
	if code != 401 {
		t.Fatalf("expected 401, got %d %v", code, body)
	}
}

func TestR_GOLDEN_SC2_ReportFixNotify(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	mcpToken, _ := h.createMCPToken(seed.AccessToken, seed.ProjectID)

	h.do(http.MethodPost, "/v1/ingest/identify", map[string]any{
		"user_id": "rina", "email": "rina@example.com",
	}, h.keyHeaders(seed.PublicKey))

	ticketID, _, attID, _, uploadToken := h.ingestReport(seed.PublicKey, map[string]any{
		"type": "bug",
		"message": "Transaction filter does not refresh after changing dates",
		"platform": "web",
		"email": "rina@example.com",
		"user_id": "rina",
		"app_version": "2.4.1",
		"context": map[string]any{"url": "/transactions", "browser": "Safari 18"},
	})
	h.uploadScreenshot(attID, uploadToken, []byte("png-bytes"))

	code, list := h.do(http.MethodGet, "/api/projects/"+seed.ProjectID+"/tickets", nil, h.authHeaders(seed.AccessToken))
	if code != 200 || len(list["tickets"].([]any)) != 1 {
		t.Fatalf("inbox: %d %v", code, list)
	}

	code, body := h.mcpCall(mcpToken, "list_open_feedback", map[string]any{})
	if code != 200 {
		t.Fatalf("list_open: %d", code)
	}
	text, isErr := h.mcpResultText(body)
	if isErr || !strings.Contains(text, ticketID) {
		t.Fatalf("list_open: err=%v text=%s", isErr, text)
	}

	code, body = h.mcpCall(mcpToken, "get_feedback_context", map[string]any{"ticket_id": ticketID})
	text, isErr = h.mcpResultText(body)
	if code != 200 || isErr {
		t.Fatalf("context: %d %s", code, text)
	}
	mustContain(t, text, "Transaction filter")

	code, body = h.mcpCall(mcpToken, "mark_fixed", map[string]any{
		"ticket_id": ticketID,
		"note":      "Filter sekarang refresh dengan benar",
	})
	text, isErr = h.mcpResultText(body)
	if code != 200 || isErr {
		t.Fatalf("mark_fixed: %d %s", code, text)
	}

	if h.drainNotifyJobs() < 1 {
		t.Fatal("notify job missing")
	}
	sent := h.mailer.Sent()
	if len(sent) == 0 {
		t.Fatal("expected S-23 email")
	}
	mustContain(t, sent[0].HTML, "Filter sekarang refresh dengan benar")

	code, updates := h.do(http.MethodGet, "/v1/ingest/updates?user_id=rina", nil, h.keyHeaders(seed.PublicKey))
	if code != 200 {
		t.Fatalf("updates: %d", code)
	}
	up, _ := updates["updates"].([]any)
	if len(up) == 0 {
		t.Fatal("expected in-app banner payload")
	}

	code, updates2 := h.do(http.MethodGet, "/v1/ingest/updates?user_id=rina", nil, h.keyHeaders(seed.PublicKey))
	if code != 200 {
		t.Fatalf("updates2: %d", code)
	}
	up2, _ := updates2["updates"].([]any)
	if len(up2) != 0 {
		t.Fatal("second poll should be empty")
	}

	// ensure MCP JSON is valid shape for agent consumers
	var parsed any
	if err := json.Unmarshal([]byte(text), &parsed); err != nil && !strings.Contains(text, "queued") {
		t.Fatalf("mark_fixed payload not useful: %s", text)
	}
}
