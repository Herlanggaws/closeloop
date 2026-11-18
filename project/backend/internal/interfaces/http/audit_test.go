package httpapi

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestR_AUDIT_01_LoginWritesAndBusinessCanList(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("business")

	code, body := h.do(http.MethodGet, "/api/org/audit-logs?days=30", nil, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("list: %d %v", code, body)
	}
	entries, _ := body["entries"].([]any)
	foundLogin := false
	for _, raw := range entries {
		e := raw.(map[string]any)
		if e["action"] == "auth.login" {
			foundLogin = true
			break
		}
	}
	if !foundLogin {
		t.Fatalf("expected auth.login audit entry, got %v", entries)
	}
}

func TestR_AUDIT_02_NonBusinessForbidden(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")

	code, body := h.do(http.MethodGet, "/api/org/audit-logs", nil, h.authHeaders(seed.AccessToken))
	if code != 403 {
		t.Fatalf("expected 403, got %d %v", code, body)
	}
}

func TestR_AUDIT_03_ExportCSV(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("business")

	req := httptest.NewRequest(http.MethodGet, "/api/org/audit-logs/export?format=csv&days=30", nil)
	req.Header.Set("Authorization", "Bearer "+seed.AccessToken)
	w := httptest.NewRecorder()
	h.router.ServeHTTP(w, req)
	if w.Code != 200 {
		t.Fatalf("export: %d %s", w.Code, w.Body.String())
	}
	ct := w.Header().Get("Content-Type")
	if !strings.Contains(ct, "text/csv") {
		t.Fatalf("expected csv content-type, got %q", ct)
	}
	if !strings.Contains(w.Body.String(), "auth.login") {
		t.Fatalf("expected auth.login in csv, got %s", w.Body.String())
	}
}
