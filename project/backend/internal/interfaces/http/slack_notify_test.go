package httpapi

import (
	"context"
	"encoding/json"
	"maps"
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
	maps.Copy(copied, body)
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

func (h *reportHarness) putSlackWebhook(accessToken, projectID, webhook string, events ...string) {
	h.t.Helper()
	cfg := map[string]any{"webhook_url": webhook}
	if len(events) > 0 {
		list := make([]any, len(events))
		for i, e := range events {
			list[i] = e
		}
		cfg["events"] = list
	}
	code, body := h.do(http.MethodPut, "/api/projects/"+projectID+"/integrations/slack", map[string]any{
		"config": cfg,
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
	events, _ := cfg["events"].([]any)
	if len(events) != 4 {
		t.Fatalf("expected default all events, got %v", cfg["events"])
	}

	code, body = h.do(http.MethodPut, "/api/projects/"+seed.ProjectID+"/integrations/slack", map[string]any{
		"config": map[string]any{
			"webhook_url": webhook,
			"events":      []any{"new_bug", "nope"},
		},
	}, h.authHeaders(seed.AccessToken))
	if code == 200 {
		t.Fatalf("expected reject invalid event, got %d %v", code, body)
	}
}

func TestR_SLACK_06_EventFiltersGateEnqueue(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	webhook := "https://hooks.slack.com/services/T000/B000/FILTER"

	h.putSlackWebhook(seed.AccessToken, seed.ProjectID, webhook, "new_bug", "marked_fixed")

	poster := &recordingSlackPoster{}
	h.ingestReport(seed.PublicKey, map[string]any{
		"type": "idea", "message": "filtered idea", "platform": "web",
	})
	if n := h.processSlackJobs(poster); n != 0 {
		t.Fatalf("expected no job for disabled new_idea, processed %d", n)
	}
	if len(poster.Posts()) != 0 {
		t.Fatalf("expected no posts for idea, got %v", poster.Posts())
	}

	ticketID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{
		"type": "bug", "message": "allowed bug", "platform": "web",
	})
	if n := h.processSlackJobs(poster); n < 1 {
		t.Fatalf("expected new_bug job, processed %d", n)
	}
	if len(poster.Posts()) != 1 {
		t.Fatalf("want 1 bug post, got %d", len(poster.Posts()))
	}

	poster = &recordingSlackPoster{}
	code, body := h.do(http.MethodPatch, "/api/tickets/"+ticketID, map[string]any{
		"status": "in_progress",
	}, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("patch progress: %d %v", code, body)
	}
	if n := h.processSlackJobs(poster); n != 0 {
		t.Fatalf("expected no job for disabled status_changed, processed %d", n)
	}

	poster = &recordingSlackPoster{}
	code, body = h.do(http.MethodPatch, "/api/tickets/"+ticketID, map[string]any{
		"status": "fixed",
		"note":   "shipped",
	}, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("patch fixed: %d %v", code, body)
	}
	if n := h.processSlackJobs(poster); n < 1 {
		t.Fatalf("expected marked_fixed job, processed %d", n)
	}
	posts := poster.Posts()
	if len(posts) != 1 {
		t.Fatalf("want 1 fixed post, got %d", len(posts))
	}
}

// Audit 23 Nov: Indie → Free pauses Slack posts; the connection stays and posts resume on upgrade.
func TestR_SLACK_07_DowngradePausesSlack(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	if code, body := h.do(http.MethodPut, "/api/projects/"+seed.ProjectID+"/integrations/slack", map[string]any{
		"config": map[string]any{"webhook_url": "https://hooks.slack.com/services/T000/B000/XXXX"},
	}, h.authHeaders(seed.AccessToken)); code != 200 {
		t.Fatalf("put slack: %d %v", code, body)
	}
	setPlan := func(plan string) {
		if _, err := h.db.Exec(`UPDATE organizations SET plan=$2 WHERE id=$1`, seed.OrgID, plan); err != nil {
			t.Fatal(err)
		}
	}
	poster := &recordingSlackPoster{}
	run := func() {
		if _, err := application.ProcessJobsOnce(context.Background(), h.store, application.WorkerDeps{
			Mail: h.mailer, Slack: poster, WebURL: h.server.Cfg.WebURL,
		}, 20); err != nil {
			t.Fatalf("process jobs: %v", err)
		}
	}

	setPlan("free")
	h.ingestReport(seed.PublicKey, map[string]any{"type": "bug", "message": "after downgrade", "platform": "web"})
	run()
	if n := len(poster.Posts()); n != 0 {
		t.Fatalf("free plan should not post to Slack, got %d", n)
	}

	setPlan("indie")
	h.ingestReport(seed.PublicKey, map[string]any{"type": "bug", "message": "after upgrade", "platform": "web"})
	run()
	posts := poster.Posts()
	if len(posts) != 1 {
		t.Fatalf("want 1 post after upgrade, got %d", len(posts))
	}
	if text, _ := posts[0].Body["text"].(string); !strings.Contains(text, "after upgrade") {
		t.Fatalf("unexpected post: %v", posts[0].Body)
	}
}
