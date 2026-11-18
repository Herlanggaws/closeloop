package httpapi

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"

	"github.com/closeloop/api/internal/application"
	"github.com/closeloop/api/internal/config"
	"github.com/closeloop/api/internal/infrastructure/db"
	"github.com/closeloop/api/internal/infrastructure/storage"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// Serializes DB-backed report tests — they share closeloop_test.
var reportDBMu sync.Mutex

type recordedMail struct {
	To      string
	Subject string
	HTML    string
}

type memMailer struct {
	mu   sync.Mutex
	sent []recordedMail
}

func (m *memMailer) Send(to, subject, html string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.sent = append(m.sent, recordedMail{To: to, Subject: subject, HTML: html})
	return nil
}

func (m *memMailer) Sent() []recordedMail {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]recordedMail, len(m.sent))
	copy(out, m.sent)
	return out
}

func (m *memMailer) Reset() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.sent = nil
}

type reportHarness struct {
	t       *testing.T
	db      *sql.DB
	store   *application.Store
	files   *storage.FSStore
	mailer  *memMailer
	server  *Server
	router  http.Handler
	tmpRoot string
}

func newReportHarness(t *testing.T) *reportHarness {
	t.Helper()
	reportDBMu.Lock()

	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		user := os.Getenv("USER")
		if user == "" {
			user = "postgres"
		}
		dsn = fmt.Sprintf("postgres://%s@localhost:5432/closeloop_test?sslmode=disable", user)
	}

	sqlDB, err := db.Open(dsn)
	if err != nil {
		reportDBMu.Unlock()
		t.Skipf("closeloop_test unavailable (%v); create with scripts/test-reports.sh", err)
	}

	migrations := filepath.Join("db", "migrations")
	if _, err := os.Stat(migrations); err != nil {
		migrations = filepath.Join("..", "..", "..", "db", "migrations")
	}
	if err := db.Migrate(sqlDB, migrations); err != nil {
		_ = sqlDB.Close()
		reportDBMu.Unlock()
		t.Fatalf("migrate: %v", err)
	}

	tmpRoot := t.TempDir()
	cfg := config.Config{
		DatabaseURL: dsn,
		JWTSecret:   "test-jwt-secret-report-suite",
		StorageRoot: tmpRoot,
		APIURL:      "http://report.test",
		WebURL:      "http://web.test",
		APIAddr:     ":0",
		EmailFrom:   "Saidloop <test@saidloop.dev>",
	}

	store := &application.Store{DB: sqlDB}
	files := storage.NewFS(cfg.StorageRoot, cfg.APIURL)
	mail := &memMailer{}
	srv := New(cfg, store, files, mail)

	h := &reportHarness{
		t:       t,
		db:      sqlDB,
		store:   store,
		files:   files,
		mailer:  mail,
		server:  srv,
		router:  srv.Router(),
		tmpRoot: tmpRoot,
	}
	t.Cleanup(func() {
		h.truncate()
		_ = sqlDB.Close()
		reportDBMu.Unlock()
	})
	h.truncate()
	return h
}

func (h *reportHarness) truncate() {
	if _, err := h.db.Exec(`
		TRUNCATE TABLE
			jobs, notifications, ticket_events, attachments, reports, tickets,
			reporters, mcp_tokens, integrations, invites, project_keys, projects, memberships,
			refresh_tokens, waitlist, users, organizations
		RESTART IDENTITY CASCADE`); err != nil {
		h.t.Fatalf("truncate: %v", err)
	}
	h.mailer.Reset()
}

func (h *reportHarness) do(method, path string, body any, headers map[string]string) (int, map[string]any) {
	h.t.Helper()
	var reader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			h.t.Fatalf("marshal: %v", err)
		}
		reader = bytes.NewReader(b)
	}
	req := httptest.NewRequest(method, path, reader)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	w := httptest.NewRecorder()
	h.router.ServeHTTP(w, req)

	var out map[string]any
	if w.Body.Len() > 0 {
		if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil {
			h.t.Fatalf("decode %s %s (%d): %v body=%s", method, path, w.Code, err, w.Body.String())
		}
	}
	return w.Code, out
}

func (h *reportHarness) authHeaders(token string) map[string]string {
	return map[string]string{"Authorization": "Bearer " + token}
}

func (h *reportHarness) keyHeaders(publicKey string) map[string]string {
	return map[string]string{"X-Closeloop-Key": publicKey}
}

type seededProject struct {
	AccessToken string
	OrgID       string
	ProjectID   string
	PublicKey   string
	Email       string
}

func (h *reportHarness) seedUserProject(plan string) seededProject {
	h.t.Helper()
	email := fmt.Sprintf("r-%s@test.closeloop", uuid.NewString()[:8])
	code, body := h.do(http.MethodPost, "/api/auth/register", map[string]any{
		"name": "Report Tester", "email": email, "password": "test-test-test",
	}, nil)
	if code != 200 {
		h.t.Fatalf("register: %d %v", code, body)
	}
	token, _ := body["access_token"].(string)
	if token == "" {
		h.t.Fatal("missing access_token")
	}

	code, me := h.do(http.MethodGet, "/api/me", nil, h.authHeaders(token))
	if code != 200 {
		h.t.Fatalf("me: %d %v", code, me)
	}
	org := me["org"].(map[string]any)
	orgID := org["id"].(string)

	if plan != "" && plan != "free" {
		if _, err := h.db.Exec(`UPDATE organizations SET plan=$2 WHERE id=$1`, orgID, plan); err != nil {
			h.t.Fatalf("set plan: %v", err)
		}
	}

	code, proj := h.do(http.MethodPost, "/api/projects", map[string]any{
		"name": "Report Project", "platforms": []string{"web"},
	}, h.authHeaders(token))
	if code != 201 {
		h.t.Fatalf("create project: %d %v", code, proj)
	}
	project := proj["project"].(map[string]any)
	return seededProject{
		AccessToken: token,
		OrgID:       orgID,
		ProjectID:   project["id"].(string),
		PublicKey:   proj["public_key"].(string),
		Email:       email,
	}
}

func (h *reportHarness) createMCPToken(accessToken, projectID string) (raw string, scopes []any) {
	h.t.Helper()
	code, body := h.do(http.MethodPost, "/api/projects/"+projectID+"/mcp-tokens", nil, h.authHeaders(accessToken))
	if code != 201 {
		h.t.Fatalf("mcp token: %d %v", code, body)
	}
	raw, _ = body["token"].(string)
	if s, ok := body["scopes"].([]any); ok {
		scopes = s
	}
	return raw, scopes
}

func (h *reportHarness) ingestReport(publicKey string, payload map[string]any) (ticketID, reportID, attachmentID, uploadURL, uploadToken string) {
	h.t.Helper()
	code, body := h.do(http.MethodPost, "/v1/ingest/reports", payload, h.keyHeaders(publicKey))
	if code != 201 {
		h.t.Fatalf("ingest: %d %v", code, body)
	}
	return body["ticket_id"].(string), body["report_id"].(string), body["attachment_id"].(string),
		body["upload_url"].(string), body["upload_token"].(string)
}

func (h *reportHarness) uploadScreenshot(attachmentID, uploadToken string, data []byte) {
	h.t.Helper()
	path := fmt.Sprintf("/v1/ingest/attachments/%s/upload?token=%s", attachmentID, uploadToken)
	req := httptest.NewRequest(http.MethodPut, path, bytes.NewReader(data))
	w := httptest.NewRecorder()
	h.router.ServeHTTP(w, req)
	if w.Code != 200 {
		h.t.Fatalf("upload: %d %s", w.Code, w.Body.String())
	}
}

func (h *reportHarness) drainNotifyJobs() int {
	h.t.Helper()
	n, err := application.ProcessJobsOnce(context.Background(), h.store, application.WorkerDeps{
		Mail:   h.mailer,
		WebURL: h.server.Cfg.WebURL,
	}, 20)
	if err != nil {
		h.t.Fatalf("process jobs: %v", err)
	}
	return n
}

func (h *reportHarness) mcpCall(token, name string, args map[string]any) (int, map[string]any) {
	h.t.Helper()
	payload := map[string]any{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  "tools/call",
		"params": map[string]any{
			"name":      name,
			"arguments": args,
		},
	}
	return h.do(http.MethodPost, "/mcp", payload, map[string]string{
		"Authorization": "Bearer " + token,
		"Content-Type":  "application/json",
	})
}

func (h *reportHarness) mcpResultText(body map[string]any) (text string, isError bool) {
	h.t.Helper()
	result, _ := body["result"].(map[string]any)
	if result == nil {
		h.t.Fatalf("missing result: %v", body)
	}
	isError, _ = result["isError"].(bool)
	content, _ := result["content"].([]any)
	if len(content) == 0 {
		return "", isError
	}
	item, _ := content[0].(map[string]any)
	text, _ = item["text"].(string)
	return text, isError
}

func errCode(body map[string]any) string {
	if body == nil {
		return ""
	}
	if e, ok := body["error"].(map[string]any); ok {
		if c, ok := e["code"].(string); ok {
			return c
		}
	}
	return ""
}

func mustContain(t *testing.T, haystack, needle string) {
	t.Helper()
	if !strings.Contains(haystack, needle) {
		t.Fatalf("expected %q in %q", needle, haystack)
	}
}
