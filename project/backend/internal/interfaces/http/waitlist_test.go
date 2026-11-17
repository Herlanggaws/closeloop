package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestW01_WaitlistSendsConfirmationOnce(t *testing.T) {
	h := newReportHarness(t)

	body := `{"email":"Rina.Wait@Example.COM","source":"landing-hero"}`
	req := httptest.NewRequest(http.MethodPost, "/api/waitlist", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.router.ServeHTTP(rec, req)
	if rec.Code != 200 {
		t.Fatalf("first join status=%d body=%s", rec.Code, rec.Body.String())
	}
	var ok map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &ok); err != nil || ok["ok"] != true {
		t.Fatalf("first join response=%s", rec.Body.String())
	}

	sent := h.mailer.Sent()
	if len(sent) != 1 {
		t.Fatalf("want 1 confirmation mail, got %d", len(sent))
	}
	if sent[0].To != "rina.wait@example.com" {
		t.Fatalf("to=%q", sent[0].To)
	}
	if sent[0].Subject != "You're on the Saidloop waitlist" {
		t.Fatalf("subject=%q", sent[0].Subject)
	}
	if !strings.Contains(sent[0].HTML, "you're on the list") {
		t.Fatalf("html missing waitlist copy: %s", sent[0].HTML)
	}

	h.mailer.Reset()
	req2 := httptest.NewRequest(http.MethodPost, "/api/waitlist", bytes.NewBufferString(body))
	req2.Header.Set("Content-Type", "application/json")
	rec2 := httptest.NewRecorder()
	h.router.ServeHTTP(rec2, req2)
	if rec2.Code != 200 {
		t.Fatalf("duplicate join status=%d body=%s", rec2.Code, rec2.Body.String())
	}
	if n := len(h.mailer.Sent()); n != 0 {
		t.Fatalf("duplicate join should not send mail, got %d", n)
	}
}

func TestW02_WaitlistInvalidEmail(t *testing.T) {
	h := newReportHarness(t)
	req := httptest.NewRequest(http.MethodPost, "/api/waitlist", strings.NewReader(`{"email":"not-an-email"}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.router.ServeHTTP(rec, req)
	if rec.Code == 200 {
		t.Fatalf("expected error for invalid email, got 200")
	}
	if len(h.mailer.Sent()) != 0 {
		t.Fatal("should not send mail on invalid input")
	}
}
