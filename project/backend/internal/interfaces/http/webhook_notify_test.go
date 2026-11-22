package httpapi

import (
	"context"
	"encoding/json"
	"maps"
	"net/http"
	"sync"
	"testing"

	"github.com/closeloop/api/internal/application"
)

type recordingWebhookPoster struct {
	mu    sync.Mutex
	posts []recordedWebhookPost
}

type recordedWebhookPost struct {
	URL    string
	Secret string
	Body   map[string]any
}

func (r *recordingWebhookPoster) PostSigned(_ context.Context, url, secret string, body map[string]any) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	copied := map[string]any{}
	maps.Copy(copied, body)
	r.posts = append(r.posts, recordedWebhookPost{URL: url, Secret: secret, Body: copied})
	return nil
}

func (r *recordingWebhookPoster) Posts() []recordedWebhookPost {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]recordedWebhookPost, len(r.posts))
	copy(out, r.posts)
	return out
}

func (h *reportHarness) processWebhookJobs(poster *recordingWebhookPoster) int {
	h.t.Helper()
	n, err := application.ProcessJobsOnce(context.Background(), h.store, application.WorkerDeps{
		Mail:    h.mailer,
		Webhook: poster,
		WebURL:  h.server.Cfg.WebURL,
	}, 20)
	if err != nil {
		h.t.Fatalf("process jobs: %v", err)
	}
	return n
}

func TestR_HOOK_01_NewReportPostsSignedWebhook(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	endpoint := "https://example.com/saidloop-hook"

	code, body := h.do(http.MethodPut, "/api/projects/"+seed.ProjectID+"/integrations/webhooks", map[string]any{
		"config": map[string]any{
			"url":    endpoint,
			"secret": "test-secret",
			"events": []any{"ticket.created", "ticket.status_changed", "ticket.fixed"},
		},
	}, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("put webhooks: %d %v", code, body)
	}
	integ, _ := body["integration"].(map[string]any)
	rawCfg, _ := json.Marshal(integ["config"])
	var cfg map[string]any
	_ = json.Unmarshal(rawCfg, &cfg)
	if cfg["secret"] != "test-secret" {
		t.Fatalf("secret=%v", cfg["secret"])
	}

	poster := &recordingWebhookPoster{}
	ticketID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{
		"type": "bug", "message": "hook me", "platform": "web",
	})
	if n := h.processWebhookJobs(poster); n < 1 {
		t.Fatalf("expected notify_webhook job, processed %d", n)
	}
	posts := poster.Posts()
	if len(posts) != 1 {
		t.Fatalf("want 1 post, got %d", len(posts))
	}
	if posts[0].URL != endpoint || posts[0].Secret != "test-secret" {
		t.Fatalf("post meta=%+v", posts[0])
	}
	if posts[0].Body["event"] != "ticket.created" {
		t.Fatalf("event=%v", posts[0].Body["event"])
	}
	if posts[0].Body["ticket_id"] != ticketID {
		t.Fatalf("ticket_id=%v", posts[0].Body["ticket_id"])
	}
}

func TestR_HOOK_02_EventFilterAndAutoSecret(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	endpoint := "https://hooks.example.com/out"

	code, body := h.do(http.MethodPut, "/api/projects/"+seed.ProjectID+"/integrations/webhooks", map[string]any{
		"config": map[string]any{
			"url":    endpoint,
			"events": []any{"ticket.fixed"},
		},
	}, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("put: %d %v", code, body)
	}
	integ, _ := body["integration"].(map[string]any)
	rawCfg, _ := json.Marshal(integ["config"])
	var cfg map[string]any
	_ = json.Unmarshal(rawCfg, &cfg)
	secret, _ := cfg["secret"].(string)
	if len(secret) < 32 {
		t.Fatalf("expected auto secret, got %q", secret)
	}

	poster := &recordingWebhookPoster{}
	ticketID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{
		"type": "idea", "message": "filtered create", "platform": "web",
	})
	if n := h.processWebhookJobs(poster); n != 0 {
		t.Fatalf("create should be filtered, processed %d", n)
	}
	if len(poster.Posts()) != 0 {
		t.Fatalf("unexpected posts: %v", poster.Posts())
	}

	code, _ = h.do(http.MethodPatch, "/api/tickets/"+ticketID, map[string]any{
		"status": "fixed", "note": "done",
	}, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("patch: %d", code)
	}
	if n := h.processWebhookJobs(poster); n < 1 {
		t.Fatalf("expected fixed webhook, processed %d", n)
	}
	posts := poster.Posts()
	if len(posts) != 1 || posts[0].Body["event"] != "ticket.fixed" {
		t.Fatalf("posts=%v", posts)
	}
	if posts[0].Secret != secret {
		t.Fatalf("secret mismatch")
	}
}

func TestR_HOOK_03_RejectNonHTTPS(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	code, _ := h.do(http.MethodPut, "/api/projects/"+seed.ProjectID+"/integrations/webhooks", map[string]any{
		"config": map[string]any{"url": "http://example.com/hook"},
	}, h.authHeaders(seed.AccessToken))
	if code == 200 {
		t.Fatalf("expected reject http url, got %d", code)
	}
}
