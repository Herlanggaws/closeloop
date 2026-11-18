package httpapi

import (
	"context"
	"net/http"
	"testing"

	"github.com/closeloop/api/internal/application"
)

type fakeIssueCreator struct {
	calls int
	issue application.ExternalIssue
	err   error
}

func (f *fakeIssueCreator) CreateIssue(
	ctx context.Context,
	installationID int64,
	owner, repo, title, body string,
) (application.ExternalIssue, error) {
	f.calls++
	if f.err != nil {
		return application.ExternalIssue{}, f.err
	}
	out := f.issue
	if out.Number == 0 {
		out.Number = 42
	}
	if out.HTMLURL == "" {
		out.HTMLURL = "https://github.com/" + owner + "/" + repo + "/issues/42"
	}
	return out, nil
}

func TestR_GHISSUE_01_RequiresGitHubApp(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	h.server.GitHubIssueCreator = &fakeIssueCreator{}

	ticketID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{
		"type": "bug", "message": "needs issue", "platform": "web",
	})

	code, body := h.do(http.MethodPost, "/api/tickets/"+ticketID+"/github-issue", map[string]any{}, h.authHeaders(seed.AccessToken))
	if code != 400 {
		t.Fatalf("want 400 without github_app, got %d %v", code, body)
	}
}

func TestR_GHISSUE_02_CreateAndIdempotent(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	fake := &fakeIssueCreator{}
	h.server.GitHubIssueCreator = fake

	code, put := h.do(http.MethodPut, "/api/projects/"+seed.ProjectID+"/integrations/github_app", map[string]any{
		"config": map[string]any{
			"installation_id": 99,
			"account_login":   "acme",
			"repo_full_name":  "acme/app",
			"default_branch":  "main",
		},
	}, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("put github_app: %d %v", code, put)
	}

	ticketID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{
		"type": "bug", "message": "button broken on checkout", "platform": "web",
	})

	code, created := h.do(http.MethodPost, "/api/tickets/"+ticketID+"/github-issue", map[string]any{}, h.authHeaders(seed.AccessToken))
	if code != 201 {
		t.Fatalf("create: %d %v", code, created)
	}
	issue, _ := created["issue"].(map[string]any)
	if issue["number"] != float64(42) || issue["html_url"] == "" {
		t.Fatalf("issue payload=%v", created)
	}
	if issue["repo"] != "acme/app" {
		t.Fatalf("repo=%v", issue["repo"])
	}
	if fake.calls != 1 {
		t.Fatalf("want 1 create call, got %d", fake.calls)
	}

	code, again := h.do(http.MethodPost, "/api/tickets/"+ticketID+"/github-issue", map[string]any{}, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("idempotent want 200, got %d %v", code, again)
	}
	if again["existing"] != true {
		t.Fatalf("want existing=true, got %v", again)
	}
	if fake.calls != 1 {
		t.Fatalf("idempotent must not recreate, calls=%d", fake.calls)
	}

	code, detail := h.do(http.MethodGet, "/api/tickets/"+ticketID, nil, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("detail: %d %v", code, detail)
	}
	found := false
	for _, raw := range detail["events"].([]any) {
		ev := raw.(map[string]any)
		if ev["kind"] == "github_issue_created" {
			found = true
			break
		}
	}
	if !found {
		t.Fatal("missing github_issue_created event")
	}
}

func TestR_GHISSUE_03_UpstreamError(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	h.server.GitHubIssueCreator = &fakeIssueCreator{err: context.DeadlineExceeded}

	_, _ = h.do(http.MethodPut, "/api/projects/"+seed.ProjectID+"/integrations/github_app", map[string]any{
		"config": map[string]any{
			"installation_id": 1,
			"repo_full_name":  "acme/app",
			"default_branch":  "main",
		},
	}, h.authHeaders(seed.AccessToken))

	ticketID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{
		"type": "bug", "message": "fail upstream", "platform": "web",
	})
	code, body := h.do(http.MethodPost, "/api/tickets/"+ticketID+"/github-issue", map[string]any{}, h.authHeaders(seed.AccessToken))
	if code != 502 {
		t.Fatalf("want 502, got %d %v", code, body)
	}
}
