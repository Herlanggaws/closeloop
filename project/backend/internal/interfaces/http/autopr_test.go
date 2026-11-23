package httpapi

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/closeloop/api/internal/application"
)

func TestGitHubWebhook_RejectsBadSignature(t *testing.T) {
	h := newReportHarness(t)
	h.server.Cfg.GitHubAppWebhookSecret = "whsec-test"

	req := httptest.NewRequest(http.MethodPost, "/webhooks/github", strings.NewReader(`{"action":"opened"}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Hub-Signature-256", "sha256=deadbeef")
	req.Header.Set("X-GitHub-Event", "pull_request")
	rec := httptest.NewRecorder()
	h.router.ServeHTTP(rec, req)
	if rec.Code != 401 {
		t.Fatalf("want 401, got %d %s", rec.Code, rec.Body.String())
	}
}

func TestGitHubWebhook_AcceptsValidSignature(t *testing.T) {
	h := newReportHarness(t)
	secret := "whsec-test"
	h.server.Cfg.GitHubAppWebhookSecret = secret
	body := []byte(`{"action":"opened","pull_request":{"merged":false}}`)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	sig := "sha256=" + hex.EncodeToString(mac.Sum(nil))

	req := httptest.NewRequest(http.MethodPost, "/webhooks/github", strings.NewReader(string(body)))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Hub-Signature-256", sig)
	req.Header.Set("X-GitHub-Event", "pull_request")
	rec := httptest.NewRecorder()
	h.router.ServeHTTP(rec, req)
	if rec.Code != 200 {
		t.Fatalf("want 200, got %d %s", rec.Code, rec.Body.String())
	}
}

func TestAutopr_ConnectDebitAndEnqueue(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")

	// Seed credits (plan was created as indie — grant manually if seed left 0).
	if _, err := h.store.GrantAutoPRCredits(t.Context(), seed.OrgID, 5, "test_seed"); err != nil {
		t.Fatalf("grant credits: %v", err)
	}

	code, body := h.do(http.MethodPut, "/api/projects/"+seed.ProjectID+"/integrations/github_app", map[string]any{
		"config": map[string]any{
			"installation_id": 183297175,
			"account_login":   "Herlanggaws",
			"repo_full_name":  "Herlanggaws/closeloop",
			"default_branch":  "main",
		},
	}, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("put github_app: %d %v", code, body)
	}

	ticketID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{
		"type":    "bug",
		"message": "auto pr please",
	})

	code, runBody := h.do(http.MethodPost, "/api/tickets/"+ticketID+"/autopr", map[string]any{}, h.authHeaders(seed.AccessToken))
	if code != 201 {
		t.Fatalf("start autopr: %d %v", code, runBody)
	}
	run, _ := runBody["run"].(map[string]any)
	if run["status"] != "queued" {
		t.Fatalf("want queued, got %v", run)
	}

	code, credits := h.do(http.MethodGet, "/api/org/credits", nil, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("credits: %d %v", code, credits)
	}
	if int(credits["credits"].(float64)) != 4 {
		t.Fatalf("want 4 credits left, got %v", credits)
	}

	code, list := h.do(http.MethodGet, "/api/projects/"+seed.ProjectID+"/autopr/runs", nil, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("list runs: %d %v", code, list)
	}
	runs, _ := list["runs"].([]any)
	if len(runs) < 1 {
		t.Fatalf("expected runs, got %v", list)
	}
}

func TestAutopr_FreePlanBlocked(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("free")

	_, _ = h.do(http.MethodPut, "/api/projects/"+seed.ProjectID+"/integrations/github_app", map[string]any{
		"config": map[string]any{
			"installation_id": 1,
			"repo_full_name":  "acme/app",
			"default_branch":  "main",
		},
	}, h.authHeaders(seed.AccessToken))

	ticketID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{
		"type":    "bug",
		"message": "blocked",
	})
	code, body := h.do(http.MethodPost, "/api/tickets/"+ticketID+"/autopr", map[string]any{}, h.authHeaders(seed.AccessToken))
	if code != 403 {
		t.Fatalf("want 403 for free plan, got %d %v", code, body)
	}
}

func TestAutopr_InsufficientCredits(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")

	_, _ = h.do(http.MethodPut, "/api/projects/"+seed.ProjectID+"/integrations/github_app", map[string]any{
		"config": map[string]any{
			"installation_id": 1,
			"repo_full_name":  "acme/app",
			"default_branch":  "main",
		},
	}, h.authHeaders(seed.AccessToken))

	ticketID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{
		"type":    "bug",
		"message": "no credits",
	})
	code, body := h.do(http.MethodPost, "/api/tickets/"+ticketID+"/autopr", map[string]any{}, h.authHeaders(seed.AccessToken))
	if code != 403 {
		t.Fatalf("want 403 without credits, got %d %v", code, body)
	}
}

func TestAutopr_InstallURLJSON(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	h.server.Cfg.GitHubAppID = "5816046"
	h.server.Cfg.GitHubAppSlug = "saidloop-auto-pr"
	h.server.Cfg.GitHubAppPrivateKey = "dummy-private-key-material"

	code, body := h.do(http.MethodGet, "/api/integrations/github/install?project_id="+seed.ProjectID, nil, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("install: %d %v", code, body)
	}
	url, _ := body["url"].(string)
	if !strings.Contains(url, "github.com/apps/saidloop-auto-pr/installations/new") {
		t.Fatalf("unexpected install url %q", url)
	}
}

func TestAutoprExecutor_NoMergeSurface(t *testing.T) {
	var exec application.AutoprExecutor = &application.GitHubAutoprExecutor{}
	_ = exec
	type merger interface{ Merge() }
	if _, ok := any(&application.GitHubAutoprExecutor{}).(merger); ok {
		t.Fatal("executor must not expose Merge")
	}
}

func TestMeIncludesAutoPRCredits(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	if _, err := h.store.GrantAutoPRCredits(t.Context(), seed.OrgID, 3, "test"); err != nil {
		t.Fatal(err)
	}
	code, me := h.do(http.MethodGet, "/api/me", nil, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("me: %d %v", code, me)
	}
	usage, _ := me["usage"].(map[string]any)
	if int(usage["auto_pr_credits"].(float64)) != 3 {
		b, _ := json.Marshal(me)
		t.Fatalf("want auto_pr_credits 3, got %s", b)
	}
}

// Auto PR is off by default until the runner writes real fixes: the API refuses the run
// before any credit is spent.
func TestAutopr_DisabledByDefault(t *testing.T) {
	h := newReportHarness(t)
	h.server.Cfg.AutoPREnabled = false
	h.router = h.server.Router()
	seed := h.seedUserProject("indie")
	if _, err := h.store.GrantAutoPRCredits(t.Context(), seed.OrgID, 3, "test_seed"); err != nil {
		t.Fatalf("grant credits: %v", err)
	}
	_, _ = h.do(http.MethodPut, "/api/projects/"+seed.ProjectID+"/integrations/github_app", map[string]any{
		"config": map[string]any{
			"installation_id": 1,
			"repo_full_name":  "acme/app",
			"default_branch":  "main",
		},
	}, h.authHeaders(seed.AccessToken))
	ticketID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{
		"type":    "bug",
		"message": "not yet",
	})

	code, body := h.do(http.MethodPost, "/api/tickets/"+ticketID+"/autopr", map[string]any{}, h.authHeaders(seed.AccessToken))
	if code != 409 {
		t.Fatalf("want 409 while auto PR is off, got %d %v", code, body)
	}
	code, credits := h.do(http.MethodGet, "/api/org/credits", nil, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("credits: %d %v", code, credits)
	}
	if got := int(credits["credits"].(float64)); got < 3 {
		t.Fatalf("credits spent while disabled: %v", credits)
	}
}
