package httpapi

import (
	"net/http"
	"testing"
)

func TestR_INB_01_ListAfterIngest(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	h.ingestReport(seed.PublicKey, map[string]any{
		"type": "bug", "message": "Visible in inbox", "platform": "web",
	})
	code, list := h.do(http.MethodGet, "/api/projects/"+seed.ProjectID+"/tickets", nil, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("list: %d %v", code, list)
	}
	tickets := list["tickets"].([]any)
	if len(tickets) < 1 {
		t.Fatal("expected tickets")
	}
	title := tickets[0].(map[string]any)["title"].(string)
	mustContain(t, title, "Visible in inbox")
}

func TestR_INB_02_FilterTypeAndStatus(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	bugID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{"type": "bug", "message": "bug open", "platform": "web"})
	h.ingestReport(seed.PublicKey, map[string]any{"type": "idea", "message": "idea open", "platform": "web"})
	code, _ := h.do(http.MethodPatch, "/api/tickets/"+bugID, map[string]any{"status": "fixed", "note": "done"}, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("patch: %d", code)
	}
	// another open bug
	h.ingestReport(seed.PublicKey, map[string]any{"type": "bug", "message": "bug still open", "platform": "web"})

	code, list := h.do(http.MethodGet, "/api/projects/"+seed.ProjectID+"/tickets?type=bug&status=open", nil, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("list: %d", code)
	}
	tickets := list["tickets"].([]any)
	if len(tickets) != 1 {
		t.Fatalf("expected 1 open bug, got %d", len(tickets))
	}
	if tickets[0].(map[string]any)["title"] != "bug still open" {
		t.Fatalf("wrong ticket: %v", tickets[0])
	}
}

func TestR_INB_03_EmptyList(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	code, list := h.do(http.MethodGet, "/api/projects/"+seed.ProjectID+"/tickets", nil, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("list: %d", code)
	}
	tickets, _ := list["tickets"].([]any)
	if len(tickets) != 0 {
		t.Fatalf("expected empty, got %d", len(tickets))
	}
}

func TestR_INB_04_Detail(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	ticketID, _, attID, _, token := h.ingestReport(seed.PublicKey, map[string]any{
		"type": "bug", "message": "detail me", "platform": "web",
		"context": map[string]any{"url": "/pay"},
	})
	h.uploadScreenshot(attID, token, []byte("img"))

	code, detail := h.do(http.MethodGet, "/api/tickets/"+ticketID, nil, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("detail: %d %v", code, detail)
	}
	if detail["ticket"] == nil || detail["reports"] == nil || detail["events"] == nil {
		t.Fatalf("missing fields: %v", detail)
	}
	atts := detail["attachments"].([]any)
	if len(atts) == 0 || atts[0].(map[string]any)["url"] == nil {
		t.Fatalf("expected screenshot url: %v", atts)
	}
}

func TestR_INB_05_AddNote(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	ticketID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{
		"type": "bug", "message": "note me", "platform": "web",
	})
	code, body := h.do(http.MethodPost, "/api/tickets/"+ticketID+"/notes", map[string]any{
		"body": "looking into root cause",
	}, h.authHeaders(seed.AccessToken))
	if code != 201 {
		t.Fatalf("note: %d %v", code, body)
	}
	code, detail := h.do(http.MethodGet, "/api/tickets/"+ticketID, nil, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("detail: %d", code)
	}
	found := false
	for _, raw := range detail["events"].([]any) {
		ev := raw.(map[string]any)
		if ev["kind"] == "note" {
			found = true
			payload := ev["payload"].(map[string]any)
			if payload["body"] != "looking into root cause" {
				t.Fatalf("payload=%v", payload)
			}
		}
	}
	if !found {
		t.Fatal("note event missing")
	}
}

func TestR_INB_06_StatusPatch(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	ticketID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{
		"type": "bug", "message": "progress", "platform": "web",
	})
	code, body := h.do(http.MethodPatch, "/api/tickets/"+ticketID, map[string]any{
		"status": "in_progress",
	}, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("patch: %d %v", code, body)
	}
	ticket := body["ticket"].(map[string]any)
	if ticket["status"] != "in_progress" {
		t.Fatalf("status=%v", ticket["status"])
	}
}

func TestR_INB_07_TestReportPath(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	// Same path Inbox "Send test report" uses: public key ingest without widget UI.
	h.ingestReport(seed.PublicKey, map[string]any{
		"type": "bug", "message": "Test report from inbox", "platform": "web",
		"context": map[string]any{"source": "inbox_test_button"},
	})
	code, list := h.do(http.MethodGet, "/api/projects/"+seed.ProjectID+"/tickets?status=open", nil, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("list: %d", code)
	}
	if len(list["tickets"].([]any)) != 1 {
		t.Fatal("expected open test report in inbox")
	}
}
