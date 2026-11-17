package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
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
	var first map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &first); err != nil {
		t.Fatalf("first join response=%s", rec.Body.String())
	}
	if first["ok"] != true {
		t.Fatalf("first join ok=%v", first["ok"])
	}
	if first["inserted"] != true {
		t.Fatalf("first join inserted=%v", first["inserted"])
	}
	if first["email"] != "rina.wait@example.com" {
		t.Fatalf("first join email=%v", first["email"])
	}
	createdAt, _ := first["created_at"].(string)
	if _, err := time.Parse(time.RFC3339, createdAt); err != nil {
		t.Fatalf("first join created_at=%q err=%v", createdAt, err)
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
	var second map[string]any
	if err := json.Unmarshal(rec2.Body.Bytes(), &second); err != nil {
		t.Fatalf("duplicate join response=%s", rec2.Body.String())
	}
	if second["inserted"] != false {
		t.Fatalf("duplicate join inserted=%v", second["inserted"])
	}
	if second["created_at"] != createdAt {
		t.Fatalf("duplicate created_at=%v want %v", second["created_at"], createdAt)
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

func TestW03_WaitlistResend(t *testing.T) {
	h := newReportHarness(t)

	join := httptest.NewRequest(http.MethodPost, "/api/waitlist", strings.NewReader(`{"email":"resend@example.com"}`))
	join.Header.Set("Content-Type", "application/json")
	joinRec := httptest.NewRecorder()
	h.router.ServeHTTP(joinRec, join)
	if joinRec.Code != 200 {
		t.Fatalf("join status=%d body=%s", joinRec.Code, joinRec.Body.String())
	}
	h.mailer.Reset()

	req := httptest.NewRequest(http.MethodPost, "/api/waitlist/resend", strings.NewReader(`{"email":"Resend@Example.COM"}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.router.ServeHTTP(rec, req)
	if rec.Code != 200 {
		t.Fatalf("resend status=%d body=%s", rec.Code, rec.Body.String())
	}
	var ok map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &ok); err != nil || ok["ok"] != true {
		t.Fatalf("resend response=%s", rec.Body.String())
	}
	if ok["email"] != "resend@example.com" {
		t.Fatalf("resend email=%v", ok["email"])
	}
	sent := h.mailer.Sent()
	if len(sent) != 1 {
		t.Fatalf("want 1 resend mail, got %d", len(sent))
	}
	if sent[0].To != "resend@example.com" {
		t.Fatalf("to=%q", sent[0].To)
	}
	if !strings.Contains(sent[0].HTML, "you're on the list") {
		t.Fatalf("html missing waitlist copy: %s", sent[0].HTML)
	}

	h.mailer.Reset()
	missing := httptest.NewRequest(http.MethodPost, "/api/waitlist/resend", strings.NewReader(`{"email":"missing@example.com"}`))
	missing.Header.Set("Content-Type", "application/json")
	missingRec := httptest.NewRecorder()
	h.router.ServeHTTP(missingRec, missing)
	if missingRec.Code != 404 {
		t.Fatalf("missing resend status=%d body=%s", missingRec.Code, missingRec.Body.String())
	}
	if len(h.mailer.Sent()) != 0 {
		t.Fatal("should not send mail for unknown email")
	}
}
