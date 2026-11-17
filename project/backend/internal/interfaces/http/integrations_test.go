package httpapi

import (
	"net/http"
	"testing"
)

func TestIntegrations_PutListAndTicketPayload(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")

	code, body := h.do(http.MethodPut, "/api/projects/"+seed.ProjectID+"/integrations/sentry", map[string]any{
		"config": map[string]any{"org": "acme", "project": "web"},
	}, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("put sentry: %d %v", code, body)
	}

	code, body = h.do(http.MethodPut, "/api/projects/"+seed.ProjectID+"/integrations/posthog", map[string]any{
		"config": map[string]any{"host": "https://us.posthog.com", "project_id": "42"},
	}, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("put posthog: %d %v", code, body)
	}

	code, list := h.do(http.MethodGet, "/api/projects/"+seed.ProjectID+"/integrations", nil, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("list: %d %v", code, list)
	}
	items, _ := list["integrations"].([]any)
	if len(items) != 2 {
		t.Fatalf("want 2 integrations, got %v", list)
	}

	ticketID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{
		"type":    "bug",
		"message": "sentry link context",
		"context": map[string]any{
			"sentry_event_id":    "abc123",
			"posthog_session_id": "sess456",
		},
	})

	code, detail := h.do(http.MethodGet, "/api/tickets/"+ticketID, nil, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("ticket: %d %v", code, detail)
	}
	integ, _ := detail["integrations"].([]any)
	if len(integ) != 2 {
		t.Fatalf("ticket missing integrations: %v", detail["integrations"])
	}
}
