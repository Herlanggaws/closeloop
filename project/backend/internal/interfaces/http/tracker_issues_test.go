package httpapi

import (
	"context"
	"net/http"
	"testing"

	"github.com/closeloop/api/internal/application"
)

type fakeLinearCreator struct {
	calls int
}

func (f *fakeLinearCreator) CreateLinearIssue(
	ctx context.Context, apiKey, teamID, title, body string,
) (application.TrackerIssue, error) {
	f.calls++
	return application.TrackerIssue{
		ID: "lin_1", Key: "ENG-1", URL: "https://linear.app/acme/issue/ENG-1", Provider: "linear",
	}, nil
}

type fakeJiraCreator struct {
	calls int
}

func (f *fakeJiraCreator) CreateJiraIssue(
	ctx context.Context, email, apiToken, site, projectKey, title, body string,
) (application.TrackerIssue, error) {
	f.calls++
	return application.TrackerIssue{
		ID: "10001", Key: "ENG-9", URL: "https://acme.atlassian.net/browse/ENG-9", Provider: "jira",
	}, nil
}

func TestR_TRACK_01_LinearCreateAndWebhookCloses(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("studio")

	code, body := h.do(http.MethodPut, "/api/projects/"+seed.ProjectID+"/integrations/linear", map[string]any{
		"config": map[string]any{"api_key": "lin_key", "team_id": "team_1"},
	}, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("connect linear: %d %v", code, body)
	}

	ticketID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{
		"type": "bug", "message": "linear sync", "platform": "web",
	})

	fake := &fakeLinearCreator{}
	result, err := h.store.CreateLinearIssueForTicket(context.Background(), ticketID, "http://web.test", fake)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if result.Issue.URL == "" || fake.calls != 1 {
		t.Fatalf("unexpected result %#v calls=%d", result, fake.calls)
	}

	code, wh := h.do(http.MethodPost, "/webhooks/linear", map[string]any{
		"action": "update",
		"type":   "Issue",
		"data": map[string]any{
			"id": "lin_1",
			"state": map[string]any{"type": "completed", "name": "Done"},
		},
	}, nil)
	if code != 200 {
		t.Fatalf("webhook: %d %v", code, wh)
	}

	code, detail := h.do(http.MethodGet, "/api/tickets/"+ticketID, nil, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("detail: %d %v", code, detail)
	}
	ticket := detail["ticket"].(map[string]any)
	if ticket["status"] != "fixed" {
		t.Fatalf("expected fixed, got %v", ticket["status"])
	}
}

func TestR_TRACK_02_JiraCreateAndWebhookCloses(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("studio")

	code, body := h.do(http.MethodPut, "/api/projects/"+seed.ProjectID+"/integrations/jira", map[string]any{
		"config": map[string]any{
			"email": "dev@acme.com", "api_token": "tok", "site": "acme.atlassian.net", "project_key": "ENG",
		},
	}, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("connect jira: %d %v", code, body)
	}

	ticketID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{
		"type": "bug", "message": "jira sync", "platform": "web",
	})

	fake := &fakeJiraCreator{}
	result, err := h.store.CreateJiraIssueForTicket(context.Background(), ticketID, "http://web.test", fake)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if result.Issue.Key != "ENG-9" {
		t.Fatalf("unexpected %#v", result)
	}

	code, wh := h.do(http.MethodPost, "/webhooks/jira", map[string]any{
		"webhookEvent": "jira:issue_updated",
		"issue":        map[string]any{"id": "10001", "key": "ENG-9"},
		"changelog": map[string]any{
			"items": []map[string]any{{"field": "status", "toString": "Done"}},
		},
	}, nil)
	if code != 200 {
		t.Fatalf("webhook: %d %v", code, wh)
	}

	code, detail := h.do(http.MethodGet, "/api/tickets/"+ticketID, nil, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("detail: %d", code)
	}
	if detail["ticket"].(map[string]any)["status"] != "fixed" {
		t.Fatalf("expected fixed, got %v", detail["ticket"])
	}
}

func TestR_TRACK_03_LinearRequiresConfig(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("studio")
	ticketID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{
		"type": "bug", "message": "no linear", "platform": "web",
	})
	_, err := h.store.CreateLinearIssueForTicket(context.Background(), ticketID, "http://web.test", &fakeLinearCreator{})
	if err == nil {
		t.Fatal("expected error without linear integration")
	}
}
