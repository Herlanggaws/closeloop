package httpapi

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/closeloop/api/internal/config"
	"github.com/gin-gonic/gin"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func TestGoogleLogin_NotConfigured(t *testing.T) {
	cfg := config.Config{
		WebURL: "http://localhost:3000",
		APIURL: "http://localhost:8080",
	}
	s := &Server{Cfg: cfg}
	r := s.Router()

	req := httptest.NewRequest(http.MethodGet, "/api/auth/google", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusTemporaryRedirect {
		t.Fatalf("expected status 307, got %d", w.Code)
	}

	loc := w.Header().Get("Location")
	if loc != "http://localhost:3000/login?error=Google+OAuth+is+not+configured+on+server" {
		t.Fatalf("unexpected location: %s", loc)
	}
}

func TestGoogleLogin_Configured(t *testing.T) {
	cfg := config.Config{
		WebURL:             "http://localhost:3000",
		APIURL:             "http://localhost:8080",
		GoogleClientID:     "test-client-id",
		GoogleClientSecret: "test-client-secret",
	}
	s := &Server{Cfg: cfg}
	r := s.Router()

	req := httptest.NewRequest(http.MethodGet, "/api/auth/google", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusTemporaryRedirect {
		t.Fatalf("expected status 307, got %d", w.Code)
	}

	loc := w.Header().Get("Location")
	u, err := url.Parse(loc)
	if err != nil {
		t.Fatalf("failed to parse redirect url: %v", err)
	}

	if u.Host != "accounts.google.com" {
		t.Fatalf("expected accounts.google.com, got %s", u.Host)
	}
	q := u.Query()
	if q.Get("client_id") != "test-client-id" {
		t.Fatalf("expected client_id test-client-id, got %s", q.Get("client_id"))
	}
	if q.Get("response_type") != "code" {
		t.Fatalf("expected response_type code, got %s", q.Get("response_type"))
	}
	if q.Get("redirect_uri") != "http://localhost:8080/api/auth/google/callback" {
		t.Fatalf("unexpected redirect_uri: %s", q.Get("redirect_uri"))
	}

	state := q.Get("state")
	if state == "" {
		t.Fatal("expected non-empty state")
	}

	// Verify cookie
	cookies := w.Result().Cookies()
	var stateCookie *http.Cookie
	for _, c := range cookies {
		if c.Name == "oauth_state" {
			stateCookie = c
			break
		}
	}
	if stateCookie == nil || stateCookie.Value != state {
		t.Fatalf("expected state cookie to match query state %q, got %+v", state, stateCookie)
	}
}

func TestGoogleCallback_InvalidState(t *testing.T) {
	cfg := config.Config{
		WebURL:             "http://localhost:3000",
		APIURL:             "http://localhost:8080",
		GoogleClientID:     "test-client-id",
		GoogleClientSecret: "test-client-secret",
	}
	s := &Server{Cfg: cfg}
	r := s.Router()

	req := httptest.NewRequest(http.MethodGet, "/api/auth/google/callback?code=123&state=badstate", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusTemporaryRedirect {
		t.Fatalf("expected status 307, got %d", w.Code)
	}

	loc := w.Header().Get("Location")
	if loc != "http://localhost:3000/login?error=Invalid+or+expired+OAuth+state" {
		t.Fatalf("unexpected redirect on bad state: %s", loc)
	}
}

func TestGoogleCallback_Cancelled(t *testing.T) {
	cfg := config.Config{
		WebURL:             "http://localhost:3000",
		APIURL:             "http://localhost:8080",
		GoogleClientID:     "test-client-id",
		GoogleClientSecret: "test-client-secret",
	}
	s := &Server{Cfg: cfg}
	r := s.Router()

	req := httptest.NewRequest(http.MethodGet, "/api/auth/google/callback?error=access_denied", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusTemporaryRedirect {
		t.Fatalf("expected status 307, got %d", w.Code)
	}

	loc := w.Header().Get("Location")
	if loc != "http://localhost:3000/login?error=Google+sign+in+cancelled%3A+access_denied" {
		t.Fatalf("unexpected redirect on error param: %s", loc)
	}
}

func TestGoogleConfig(t *testing.T) {
	cfg := config.Config{
		GoogleClientID: "test-client-id",
	}
	s := &Server{Cfg: cfg}
	r := s.Router()

	req := httptest.NewRequest(http.MethodGet, "/api/auth/google/config", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", w.Code)
	}
	if w.Body.String() != `{"client_id":"test-client-id"}` {
		t.Fatalf("unexpected body: %s", w.Body.String())
	}
}

func TestGoogleOneTap_MissingConfig(t *testing.T) {
	s := &Server{Cfg: config.Config{}}
	r := s.Router()

	req := httptest.NewRequest(http.MethodPost, "/api/auth/google/one-tap", strings.NewReader(`{"credential":"xyz"}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status 503, got %d", w.Code)
	}
}

func TestGoogleOneTap_MissingCredential(t *testing.T) {
	s := &Server{Cfg: config.Config{GoogleClientID: "test-id"}}
	r := s.Router()

	req := httptest.NewRequest(http.MethodPost, "/api/auth/google/one-tap", strings.NewReader(`{}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", w.Code)
	}
}
