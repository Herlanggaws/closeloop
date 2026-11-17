package httpapi

import (
	"net/http"
	"testing"
)

func TestR_ING_01_CreateBugReport(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")

	ticketID, reportID, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{
		"type": "bug", "message": "Filter does not refresh", "platform": "web",
		"email": "rina@example.com", "user_id": "rina",
		"context": map[string]any{"url": "/transactions", "browser": "Safari 18"},
	})
	if ticketID == "" || reportID == "" {
		t.Fatal("expected ticket and report ids")
	}

	code, list := h.do(http.MethodGet, "/api/projects/"+seed.ProjectID+"/tickets", nil, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("list: %d %v", code, list)
	}
	tickets := list["tickets"].([]any)
	if len(tickets) != 1 {
		t.Fatalf("expected 1 ticket, got %d", len(tickets))
	}
	ticket := tickets[0].(map[string]any)
	if ticket["status"] != "open" || ticket["type"] != "bug" {
		t.Fatalf("unexpected ticket: %v", ticket)
	}
}

func TestR_ING_02_RejectBadKey(t *testing.T) {
	h := newReportHarness(t)
	code, body := h.do(http.MethodPost, "/v1/ingest/reports", map[string]any{
		"type": "bug", "message": "x",
	}, h.keyHeaders("pk_does_not_exist"))
	if code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d %v", code, body)
	}
}

func TestR_ING_03_ReportTypes(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	for _, typ := range []string{"bug", "idea", "question"} {
		_, _, _, _, _ = h.ingestReport(seed.PublicKey, map[string]any{
			"type": typ, "message": "msg-" + typ, "platform": "web",
		})
	}
	code, list := h.do(http.MethodGet, "/api/projects/"+seed.ProjectID+"/tickets", nil, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("list: %d", code)
	}
	tickets := list["tickets"].([]any)
	if len(tickets) != 3 {
		t.Fatalf("expected 3, got %d", len(tickets))
	}
	seen := map[string]bool{}
	for _, raw := range tickets {
		seen[raw.(map[string]any)["type"].(string)] = true
	}
	for _, typ := range []string{"bug", "idea", "question"} {
		if !seen[typ] {
			t.Fatalf("missing type %s", typ)
		}
	}
}

func TestR_ING_04_CompleteUpload(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	ticketID, reportID, attID, _, token := h.ingestReport(seed.PublicKey, map[string]any{
		"type": "bug", "message": "upload me", "platform": "web",
	})
	h.uploadScreenshot(attID, token, []byte("fake-png-bytes"))

	code, body := h.do(http.MethodPost, "/v1/ingest/reports/"+reportID+"/complete", map[string]any{}, h.keyHeaders(seed.PublicKey))
	if code != 200 {
		t.Fatalf("complete: %d %v", code, body)
	}

	code, detail := h.do(http.MethodGet, "/api/tickets/"+ticketID, nil, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("detail: %d %v", code, detail)
	}
	atts := detail["attachments"].([]any)
	if len(atts) == 0 {
		t.Fatal("expected attachment")
	}
	att := atts[0].(map[string]any)
	if att["uploaded"] != true {
		t.Fatalf("expected uploaded=true, got %v", att)
	}
	if att["url"] == nil || att["url"] == "" {
		t.Fatal("expected signed url")
	}
}

func TestR_ING_05_Identify(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	code, body := h.do(http.MethodPost, "/v1/ingest/identify", map[string]any{
		"user_id": "dimas", "email": "dimas@example.com", "app_version": "2.0.0",
	}, h.keyHeaders(seed.PublicKey))
	if code != 200 {
		t.Fatalf("identify: %d %v", code, body)
	}
	if body["reporter_id"] == nil || body["reporter_id"] == "" {
		t.Fatal("expected reporter_id")
	}
}

func TestR_ING_06_ConfigSelectors(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	selectors := []string{".balance", "[data-sensitive]"}
	code, body := h.do(http.MethodPatch, "/api/projects/"+seed.ProjectID, map[string]any{
		"sensitive_selectors": selectors,
	}, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("patch: %d %v", code, body)
	}

	code, cfg := h.do(http.MethodGet, "/v1/ingest/config", nil, h.keyHeaders(seed.PublicKey))
	if code != 200 {
		t.Fatalf("config: %d %v", code, cfg)
	}
	got := cfg["sensitive_selectors"].([]any)
	if len(got) != 2 || got[0] != ".balance" {
		t.Fatalf("selectors=%v", got)
	}
}

func TestR_ING_07_ContextJSON(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	ticketID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{
		"type": "bug", "message": "ctx", "platform": "web",
		"context": map[string]any{"url": "/home", "browser": "Chrome"},
	})
	code, detail := h.do(http.MethodGet, "/api/tickets/"+ticketID, nil, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("detail: %d", code)
	}
	reports := detail["reports"].([]any)
	ctx := reports[0].(map[string]any)["context"].(map[string]any)
	if ctx["url"] != "/home" || ctx["browser"] != "Chrome" {
		t.Fatalf("context=%v", ctx)
	}
}

func TestR_ING_08_PlatformFilter(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	h.ingestReport(seed.PublicKey, map[string]any{"type": "bug", "message": "web one", "platform": "web"})
	h.ingestReport(seed.PublicKey, map[string]any{"type": "bug", "message": "android one", "platform": "android"})

	code, list := h.do(http.MethodGet, "/api/projects/"+seed.ProjectID+"/tickets?platform=web", nil, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("list: %d", code)
	}
	tickets := list["tickets"].([]any)
	if len(tickets) != 1 {
		t.Fatalf("expected 1 web ticket, got %d %v", len(tickets), tickets)
	}
}
