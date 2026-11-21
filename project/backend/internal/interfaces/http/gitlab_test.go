package httpapi

import (
	"context"
	"net/http"
	"testing"
)

func TestR_GITLAB_01_ConnectAndWebhookCloses(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("studio")

	// 1. Connect GitLab integration
	code, body := h.do(http.MethodPut, "/api/projects/"+seed.ProjectID+"/integrations/gitlab", map[string]any{
		"config": map[string]any{
			"token":    "glpat-sample-token",
			"base_url": "https://gitlab.com",
			"username": "alex",
		},
	}, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("connect gitlab: %d %v", code, body)
	}

	// 2. Add GitLab repo to project
	code, repoBody := h.do(http.MethodPost, "/api/projects/"+seed.ProjectID+"/repos", map[string]any{
		"full_name":      "alex/web-app",
		"default_branch": "main",
		"provider":       "gitlab",
		"routes": []map[string]any{
			{"platform": "web", "path": ""},
		},
	}, h.authHeaders(seed.AccessToken))
	if code != 201 {
		t.Fatalf("add gitlab repo: %d %v", code, repoBody)
	}

	// 3. Ingest a report for web -> should be routed to alex/web-app
	ticketID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{
		"type": "bug", "message": "button broken on gitlab app", "platform": "web",
	})

	ticket, err := h.store.GetTicket(context.Background(), ticketID)
	if err != nil {
		t.Fatalf("get ticket: %v", err)
	}
	if ticket.RepoFullName != "alex/web-app" {
		t.Fatalf("expected repo alex/web-app, got %q", ticket.RepoFullName)
	}

	// 4. Start Auto PR
	code, aprBody := h.do(http.MethodPost, "/api/tickets/"+ticketID+"/autopr", nil, h.authHeaders(seed.AccessToken))
	if code != 201 {
		t.Fatalf("start autopr: %d %v", code, aprBody)
	}
	run := aprBody["run"].(map[string]any)
	runID := run["id"].(string)

	// Simulate run having opened MR #14
	r, err := h.store.GetAutoprRun(context.Background(), runID)
	if err != nil {
		t.Fatalf("get run: %v", err)
	}
	mrNumber := 14
	r.PRNumber = &mrNumber
	r.PRURL = "https://gitlab.com/alex/web-app/-/merge_requests/14"
	r.Status = "running"
	if err := h.store.UpdateAutoprRun(context.Background(), r); err != nil {
		t.Fatalf("update run: %v", err)
	}

	// 5. GitLab Webhook sends Merge Request merged event
	whCode, _ := h.do(http.MethodPost, "/webhooks/gitlab", map[string]any{
		"object_kind": "merge_request",
		"project": map[string]any{
			"path_with_namespace": "alex/web-app",
			"web_url":             "https://gitlab.com/alex/web-app",
		},
		"object_attributes": map[string]any{
			"iid":    14,
			"action": "merge",
			"state":  "merged",
			"url":    "https://gitlab.com/alex/web-app/-/merge_requests/14",
		},
	}, nil)
	if whCode != 200 {
		t.Fatalf("gitlab webhook: %d", whCode)
	}

	// 6. Verify ticket is now fixed!
	ticketAfter, err := h.store.GetTicket(context.Background(), ticketID)
	if err != nil {
		t.Fatalf("get ticket after: %v", err)
	}
	if ticketAfter.Status != "fixed" {
		t.Fatalf("expected status fixed, got %s", ticketAfter.Status)
	}

	runAfter, err := h.store.GetAutoprRun(context.Background(), runID)
	if err != nil {
		t.Fatalf("get run after: %v", err)
	}
	if runAfter.Status != "succeeded" {
		t.Fatalf("expected run succeeded, got %s", runAfter.Status)
	}
}
