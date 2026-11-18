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

func (h *reportHarness) putSlackWebhook(accessToken, projectID, webhook string) {
	h.t.Helper()
	code, body := h.do(http.MethodPut, "/api/projects/"+projectID+"/integrations/slack", map[string]any{
		"config": map[string]any{"webhook_url": webhook},
	}, h.authHeaders(accessToken))
	if code != 200 {
		h.t.Fatalf("put slack: %d %v", code, body)
	}
}

func (h *reportHarness) processSlackJobs(poster *recordingSlackPoster) int {
	h.t.Helper()
	n, err := application.ProcessJobsOnce(context.Background(), h.store, application.WorkerDeps{
		Mail:   h.mailer,
		Slack:  poster,
		WebURL: h.server.Cfg.WebURL,
	}, 20)
	if err != nil {
		h.t.Fatalf("process jobs: %v", err)
	}
	return n
}

func TestR_SLACK_03_StatusChangePostsWebhook(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	webhook := "https://hooks.slack.com/services/T000/B000/STATUS"
	h.putSlackWebhook(seed.AccessToken, seed.ProjectID, webhook)

	poster := &recordingSlackPoster{}
	ticketID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{
		"type": "bug", "message": "filter lag", "platform": "web",
	})
	h.processSlackJobs(poster) // drain new_report
	poster = &recordingSlackPoster{}

	code, body := h.do(http.MethodPatch, "/api/tickets/"+ticketID, map[string]any{
		"status": "in_progress",
	}, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("patch: %d %v", code, body)
	}

	n := h.processSlackJobs(poster)
	if n < 1 {
		t.Fatalf("expected status slack job, processed %d", n)
	}
	posts := poster.Posts()
	if len(posts) != 1 {
		t.Fatalf("want 1 status post, got %d", len(posts))
	}
	text, _ := posts[0].Body["text"].(string)
	if !strings.Contains(text, "open") || !strings.Contains(text, "in_progress") {
		t.Fatalf("missing from/to in payload: %s", text)
	}
	if !strings.Contains(text, "filter lag") {
		t.Fatalf("missing title: %s", text)
	}
}

func TestR_SLACK_04_MarkFixedIncludesNote(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	h.putSlackWebhook(seed.AccessToken, seed.ProjectID, "https://hooks.slack.com/services/T000/B000/FIXED")
	mcpToken, _ := h.createMCPToken(seed.AccessToken, seed.ProjectID)

	poster := &recordingSlackPoster{}
	ticketID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{
		"type": "bug", "message": "null crash", "platform": "web",
	})
	h.processSlackJobs(poster)
	poster = &recordingSlackPoster{}

	code, body := h.mcpCall(mcpToken, "mark_fixed", map[string]any{
		"ticket_id": ticketID,
		"note":      "Shipped in 1.4",
	})
	if code != 200 {
		t.Fatalf("mark_fixed: %d %v", code, body)
	}

	h.processSlackJobs(poster)
	posts := poster.Posts()
	if len(posts) != 1 {
		t.Fatalf("want 1 fixed post, got %d (%v)", len(posts), posts)
	}
	text, _ := posts[0].Body["text"].(string)
	if !strings.Contains(text, "fixed") {
		t.Fatalf("missing fixed status: %s", text)
	}
	if !strings.Contains(text, "Shipped in 1.4") {
		t.Fatalf("missing note: %s", text)
	}
}

func TestR_SLACK_05_SameStatusSkipsPost(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	h.putSlackWebhook(seed.AccessToken, seed.ProjectID, "https://hooks.slack.com/services/T000/B000/SAME")

	poster := &recordingSlackPoster{}
	ticketID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{
		"type": "idea", "message": "export csv", "platform": "web",
	})
	h.processSlackJobs(poster)
	poster = &recordingSlackPoster{}

	code, body := h.do(http.MethodPatch, "/api/tickets/"+ticketID, map[string]any{
		"status": "open",
	}, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("patch same status: %d %v", code, body)
	}

	n := h.processSlackJobs(poster)
	if n != 0 {
		t.Fatalf("expected no slack job for same status, processed %d", n)
	}
	if len(poster.Posts()) != 0 {
		t.Fatalf("expected no posts, got %v", poster.Posts())
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
