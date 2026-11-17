package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/closeloop/api/internal/config"
)

func TestIngestConfig_MissingKey(t *testing.T) {
	s := &Server{Cfg: config.Config{WebURL: "http://localhost:3000"}}
	r := s.Router()

	req := httptest.NewRequest(http.MethodGet, "/v1/ingest/config", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401, got %d body=%s", w.Code, w.Body.String())
	}

	var body struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body.Error.Code != "MISSING_KEY" {
		t.Fatalf("expected MISSING_KEY, got %q", body.Error.Code)
	}
}

func TestIngestConfig_RouteRegistered(t *testing.T) {
	s := &Server{Cfg: config.Config{WebURL: "http://localhost:3000"}}
	r := s.Router()

	found := false
	for _, route := range r.Routes() {
		if route.Path == "/v1/ingest/config" && route.Method == http.MethodGet {
			found = true
			break
		}
	}
	if !found {
		t.Fatal("GET /v1/ingest/config not registered")
	}
}
