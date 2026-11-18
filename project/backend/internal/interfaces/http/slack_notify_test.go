package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"sync"
	"testing"

	"github.com/closeloop/api/internal/application"
)

type recordingSlackPoster struct {
	mu    sync.Mutex
	posts []recordedSlackPost
}

type recordedSlackPost struct {
	URL  string
	Body map[string]any
}

func (r *recordingSlackPoster) PostWebhook(_ context.Context, webhookURL string, body map[string]any) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	copied := map[string]any{}
	for k, v := range body {
		copied[k] = v
	}
	r.posts = append(r.posts, recordedSlackPost{URL: webhookURL, Body: copied})
	return nil
}

func (r *recordingSlackPoster) Posts() []recordedSlackPost {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]recordedSlackPost, len(r.posts))
	copy(out, r.posts)
	return out
}

func TestR_SLACK_01_NewReportPostsWebhook(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	webhook := "https://hooks.slack.com/services/T000/B000/XXXX"

	code, body := h.do(http.MethodPut, "/api/projects/"+seed.ProjectID+"/integrations/slack", map[string]any{
		"config": map[string]any{"webhook_url": webhook},
	}, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("put slack: %d %v", code, body)
	}

	poster := &recordingSlackPoster{}
	ticketID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{
		"type":    "bug",
		"message": "checkout button broken",
		"platform": "web",
	})

	n, err := application.ProcessJobsOnce(context.Background(), h.store, application.WorkerDeps{
		Mail:   h.mailer,
		Slack:  poster,
		WebURL: h.server.Cfg.WebURL,
	}, 20)
	if err != nil {
		t.Fatalf("process jobs: %v", err)
	}
	if n < 1 {
		t.Fatalf("expected notify_slack job, processed %d", n)
	}

	posts := poster.Posts()
	if len(posts) != 1 {
		t.Fatalf("want 1 slack post, got %d", len(posts))
	}
	if posts[0].URL != webhook {
		t.Fatalf("webhook url: got %q", posts[0].URL)
	}
	text, _ := posts[0].Body["text"].(string)
	if !strings.Contains(text, "checkout button broken") {
		t.Fatalf("payload missing title: %v", posts[0].Body)
	}
	if !strings.Contains(text, "/app/tickets/"+ticketID) {
		t.Fatalf("payload missing ticket link: %v", posts[0].Body)
	}
}

func TestR_SLACK_02_NoIntegrationSkipsPost(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	poster := &recordingSlackPoster{}

	h.ingestReport(seed.PublicKey, map[string]any{
		"type":    "idea",
		"message": "dark mode",
		"platform": "web",
	})

	n, err := application.ProcessJobsOnce(context.Background(), h.store, application.WorkerDeps{
		Mail:   h.mailer,
		Slack:  poster,
		WebURL: h.server.Cfg.WebURL,
	}, 20)
	if err != nil {
		t.Fatalf("process jobs: %v", err)
	}
	if n != 0 {
		t.Fatalf("expected no slack jobs without integration, processed %d", n)
	}
	if len(poster.Posts()) != 0 {
		t.Fatalf("expected no slack posts, got %v", poster.Posts())
	}
}

func TestIntegrations_SlackWebhookValidation(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")

	code, body := h.do(http.MethodPut, "/api/projects/"+seed.ProjectID+"/integrations/slack", map[string]any{
		"config": map[string]any{"webhook_url": "https://example.com/hook"},
	}, h.authHeaders(seed.AccessToken))
	if code == 200 {
		t.Fatalf("expected reject non-hooks url, got %d %v", code, body)
	}

	code, body = h.do(http.MethodPut, "/api/projects/"+seed.ProjectID+"/integrations/github", map[string]any{
		"config": map[string]any{"token": "x"},
	}, h.authHeaders(seed.AccessToken))
	if code == 200 {
		t.Fatalf("expected reject unknown provider, got %d %v", code, body)
	}

	webhook := "https://hooks.slack.com/services/T000/B000/OK"
	code, body = h.do(http.MethodPut, "/api/projects/"+seed.ProjectID+"/integrations/slack", map[string]any{
		"config": map[string]any{"webhook_url": webhook, "extra": "drop-me"},
	}, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("put slack: %d %v", code, body)
	}
	integ, _ := body["integration"].(map[string]any)
	rawCfg, _ := json.Marshal(integ["config"])
	var cfg map[string]any
	_ = json.Unmarshal(rawCfg, &cfg)
	if cfg["webhook_url"] != webhook {
		t.Fatalf("config webhook: %v", cfg)
	}
	if _, ok := cfg["extra"]; ok {
		t.Fatalf("expected extra keys stripped: %v", cfg)
	}
}
