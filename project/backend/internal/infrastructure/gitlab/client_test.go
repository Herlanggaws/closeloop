package gitlab

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestGitLabClient_Validate(t *testing.T) {
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("PRIVATE-TOKEN") != "glpat-test" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		if r.URL.Path == "/api/v4/user" {
			_ = json.NewEncoder(w).Encode(User{
				ID:       42,
				Username: "alex",
				Name:     "Alex Builder",
				WebURL:   "https://gitlab.com/alex",
			})
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer s.Close()

	c, err := New(Config{
		BaseURL: s.URL,
		Token:   "glpat-test",
	})
	if err != nil {
		t.Fatalf("unexpected new error: %v", err)
	}

	u, err := c.Validate(context.Background())
	if err != nil {
		t.Fatalf("unexpected validate error: %v", err)
	}
	if u.Username != "alex" || u.ID != 42 {
		t.Fatalf("got user %+v, want alex/42", u)
	}
}

func TestGitLabClient_CreateMergeRequest(t *testing.T) {
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.EscapedPath()
		switch path {
		case "/api/v4/projects/mygroup%2Fmyproject/repository/branches":
			w.WriteHeader(http.StatusCreated)
			_, _ = w.Write([]byte(`{"name":"saidloop/fix-123"}`))
		case "/api/v4/projects/mygroup%2Fmyproject/repository/commits":
			w.WriteHeader(http.StatusCreated)
			_, _ = w.Write([]byte(`{"id":"abc12345"}`))
		case "/api/v4/projects/mygroup%2Fmyproject/merge_requests":
			w.WriteHeader(http.StatusCreated)
			_, _ = w.Write([]byte(`{"iid":7,"web_url":"https://gitlab.com/mygroup/myproject/-/merge_requests/7"}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer s.Close()

	c, err := New(Config{
		BaseURL: s.URL,
		Token:   "glpat-test",
	})
	if err != nil {
		t.Fatalf("unexpected new error: %v", err)
	}

	res, err := c.CreateMergeRequest(context.Background(), CreateMRInput{
		ProjectPath:   "mygroup/myproject",
		BaseBranch:    "main",
		HeadBranch:    "saidloop/fix-123",
		MRTitle:       "fix: issue in web",
		MRBody:        "Fixes ticket 123",
		CommitMessage: "fix: update via Saidloop",
		Files: []FileChange{
			{Path: ".saidloop/autopr-123.md", Content: "# Auto fix"},
		},
	})
	if err != nil {
		t.Fatalf("unexpected mr error: %v", err)
	}
	if res.IID != 7 || res.WebURL != "https://gitlab.com/mygroup/myproject/-/merge_requests/7" {
		t.Fatalf("got mr result %+v", res)
	}
}
