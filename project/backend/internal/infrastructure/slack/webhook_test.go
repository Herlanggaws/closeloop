package slack

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestValidWebhookURL(t *testing.T) {
	if !ValidWebhookURL("https://hooks.slack.com/services/T/B/X") {
		t.Fatal("expected valid")
	}
	if ValidWebhookURL("https://example.com/hooks") {
		t.Fatal("expected invalid")
	}
}

func TestNewReportPayload(t *testing.T) {
	body := NewReportPayload("Bear Budget", "bug", "paywall crash", "http://web.test/app/tickets/abc")
	text, _ := body["text"].(string)
	if !strings.Contains(text, "paywall crash") || !strings.Contains(text, "Bear Budget") {
		t.Fatalf("text: %s", text)
	}
	blocks, ok := body["blocks"].([]map[string]any)
	if !ok || len(blocks) < 2 {
		t.Fatalf("blocks: %v", body["blocks"])
	}
}

func TestClientPostWebhook(t *testing.T) {
	var got map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer r.Body.Close()
		_ = json.NewDecoder(r.Body).Decode(&got)
		w.WriteHeader(200)
		_, _ = w.Write([]byte("ok"))
	}))
	defer srv.Close()

	// httptest URL is not hooks.slack.com — call through Client with overridden validation path
	// by posting to a hooks-prefixed URL redirected via custom Transport is heavy; instead
	// unit-test status handling with a client that hits our server after prefix check bypass.
	client := NewClient()
	err := client.PostWebhook(context.Background(), "https://example.com/nope", map[string]any{"text": "x"})
	if err == nil {
		t.Fatal("expected invalid url error")
	}

	// Use a real hooks-looking URL with a custom RoundTripper pointing at srv.
	client.HTTP = &http.Client{Transport: rewriteTransport{target: srv.URL}}
	err = client.PostWebhook(context.Background(), "https://hooks.slack.com/services/T/B/X", map[string]any{"text": "hello"})
	if err != nil {
		t.Fatalf("post: %v", err)
	}
	if got["text"] != "hello" {
		t.Fatalf("body: %v", got)
	}
}

type rewriteTransport struct {
	target string
}

func (r rewriteTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	u := *req.URL
	targetReq, err := http.NewRequestWithContext(req.Context(), req.Method, r.target, req.Body)
	if err != nil {
		return nil, err
	}
	targetReq.Header = req.Header.Clone()
	_ = u
	return http.DefaultTransport.RoundTrip(targetReq)
}
