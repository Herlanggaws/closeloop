package httpapi

import (
	"net/http"
	"testing"
)

func TestR_MRG_01_MergeToParent(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	parent, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{"type": "bug", "message": "same bug A", "platform": "web"})
	child1, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{"type": "bug", "message": "same bug B", "platform": "web"})
	child2, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{"type": "bug", "message": "same bug C", "platform": "web"})

	code, body := h.do(http.MethodPost, "/api/tickets/merge", map[string]any{
		"parent_id": parent, "child_ids": []string{child1, child2},
	}, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("merge: %d %v", code, body)
	}

	code, detail := h.do(http.MethodGet, "/api/tickets/"+parent, nil, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("detail: %d", code)
	}
	ticket := detail["ticket"].(map[string]any)
	if ticket["status"] != "open" {
		t.Fatalf("parent status=%v", ticket["status"])
	}
	if int(ticket["report_count"].(float64)) < 3 {
		t.Fatalf("report_count=%v", ticket["report_count"])
	}
	reports := detail["reports"].([]any)
	if len(reports) < 3 {
		t.Fatalf("expected >=3 reports under parent, got %d", len(reports))
	}

	code, child := h.do(http.MethodGet, "/api/tickets/"+child1, nil, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("child: %d", code)
	}
	if child["ticket"].(map[string]any)["status"] != "duplicate" {
		t.Fatalf("child status=%v", child["ticket"])
	}
}

func TestR_MRG_02_RejectCrossProject(t *testing.T) {
	h := newReportHarness(t)
	a := h.seedUserProject("indie")
	b := h.seedUserProject("indie")
	parent, _, _, _, _ := h.ingestReport(a.PublicKey, map[string]any{"type": "bug", "message": "a", "platform": "web"})
	child, _, _, _, _ := h.ingestReport(b.PublicKey, map[string]any{"type": "bug", "message": "b", "platform": "web"})

	code, body := h.do(http.MethodPost, "/api/tickets/merge", map[string]any{
		"parent_id": parent, "child_ids": []string{child},
	}, h.authHeaders(a.AccessToken))
	if code < 400 {
		t.Fatalf("expected error, got %d %v", code, body)
	}
}

func TestR_MRG_03_ParentStaysOpen(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	parent, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{"type": "bug", "message": "parent", "platform": "web"})
	child, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{"type": "bug", "message": "child", "platform": "web"})
	code, _ := h.do(http.MethodPost, "/api/tickets/merge", map[string]any{
		"parent_id": parent, "child_ids": []string{child},
	}, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("merge: %d", code)
	}
	code, detail := h.do(http.MethodGet, "/api/tickets/"+parent, nil, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("detail: %d", code)
	}
	ticket := detail["ticket"].(map[string]any)
	if ticket["status"] != "open" {
		t.Fatalf("status=%v", ticket["status"])
	}
	if int(ticket["report_count"].(float64)) < 2 {
		t.Fatalf("report_count=%v", ticket["report_count"])
	}
}
