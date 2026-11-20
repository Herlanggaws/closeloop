package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

func TestF8_SlackOAuthSavesPickedChannel(t *testing.T) {
	h := newReportHarness(t)
	var gotCode, gotRedirect string
	fake := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = r.ParseForm()
		gotCode, gotRedirect = r.Form.Get("code"), r.Form.Get("redirect_uri")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":   true,
			"team": map[string]any{"name": "Bear Co"},
			"incoming_webhook": map[string]any{
				"url":               "https://hooks.slack.com/services/T1/B1/xyz",
				"channel":           "#bugs",
				"configuration_url": "https://bear.slack.com/services/B1",
			},
		})
	}))
	defer fake.Close()
	h.server.Cfg.SlackClientID = "cid"
	h.server.Cfg.SlackClientSecret = "secret"
	h.server.Cfg.SlackAPIBase = fake.URL
	h.router = h.server.Router()

	seed := h.seedUserProject("indie")
	auth := h.authHeaders(seed.AccessToken)

	code, cfg := h.do(http.MethodGet, "/api/integrations/slack/config", nil, nil)
	if code != 200 || cfg["oauth"] != true {
		t.Fatalf("config: %d %v", code, cfg)
	}
	code, body := h.do(http.MethodGet, "/api/integrations/slack/install?project_id="+seed.ProjectID, nil, auth)
	if code != 200 {
		t.Fatalf("install: %d %v", code, body)
	}
	authorize, _ := url.Parse(body["url"].(string))
	if authorize.Query().Get("scope") != "incoming-webhook" || authorize.Query().Get("client_id") != "cid" {
		t.Fatalf("authorize url: %s", authorize)
	}
	state := authorize.Query().Get("state")

	// Callback hands the code to the SPA.
	req := httptest.NewRequest(http.MethodGet, "/api/integrations/slack/callback?code=abc&state="+url.QueryEscape(state), nil)
	rec := httptest.NewRecorder()
	h.router.ServeHTTP(rec, req)
	if rec.Code != http.StatusFound || !strings.Contains(rec.Header().Get("Location"), "slack_code=abc") {
		t.Fatalf("callback: %d %s", rec.Code, rec.Header().Get("Location"))
	}

	// A state for another project is rejected.
	other := h.seedUserProject("indie")
	code, _ = h.do(http.MethodPost, "/api/projects/"+other.ProjectID+"/integrations/slack/complete",
		map[string]any{"code": "abc", "state": state}, h.authHeaders(other.AccessToken))
	if code != 400 {
		t.Fatalf("foreign state: want 400, got %d", code)
	}

	code, body = h.do(http.MethodPost, "/api/projects/"+seed.ProjectID+"/integrations/slack/complete",
		map[string]any{"code": "abc", "state": state}, auth)
	if code != 200 {
		t.Fatalf("complete: %d %v", code, body)
	}
	if gotCode != "abc" || gotRedirect != "http://report.test/api/integrations/slack/callback" {
		t.Fatalf("exchange got code=%q redirect=%q", gotCode, gotRedirect)
	}
	url, err := h.store.SlackWebhookURL(t.Context(), seed.ProjectID)
	if err != nil || url != "https://hooks.slack.com/services/T1/B1/xyz" {
		t.Fatalf("webhook saved: %q %v", url, err)
	}
	item := body["integration"].(map[string]any)
	saved, _ := json.Marshal(item["config"])
	if !strings.Contains(string(saved), "#bugs") || !strings.Contains(string(saved), "Bear Co") {
		t.Fatalf("channel/team not kept: %s", saved)
	}
}

func TestF8_SlackOAuthNeedsIndie(t *testing.T) {
	h := newReportHarness(t)
	h.server.Cfg.SlackClientID = "cid"
	h.server.Cfg.SlackClientSecret = "secret"
	h.router = h.server.Router()
	seed := h.seedUserProject("free")
	code, body := h.do(http.MethodGet, "/api/integrations/slack/install?project_id="+seed.ProjectID, nil, h.authHeaders(seed.AccessToken))
	if code != 402 {
		t.Fatalf("free install: want 402, got %d %v", code, body)
	}
}

func TestF8_SlackOAuthNotConfigured(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	code, cfg := h.do(http.MethodGet, "/api/integrations/slack/config", nil, nil)
	if code != 200 || cfg["oauth"] != false {
		t.Fatalf("config: %d %v", code, cfg)
	}
	code, _ = h.do(http.MethodGet, "/api/integrations/slack/install?project_id="+seed.ProjectID, nil, h.authHeaders(seed.AccessToken))
	if code != 503 {
		t.Fatalf("install without client id: want 503, got %d", code)
	}
}
