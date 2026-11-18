package webhook

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestValidURL(t *testing.T) {
	if !ValidURL("https://example.com/hook") {
		t.Fatal("expected https url valid")
	}
	if ValidURL("http://example.com/hook") {
		t.Fatal("http should be invalid")
	}
	if ValidURL("https://hooks.slack.com/services/T/B/X") {
		t.Fatal("slack hooks should be invalid for outbound")
	}
}

func TestPostSigned(t *testing.T) {
	var gotSig string
	var gotBody map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotSig = r.Header.Get("X-Saidloop-Signature")
		raw, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(raw, &gotBody)
		mac := hmac.New(sha256.New, []byte("sekrit"))
		_, _ = mac.Write(raw)
		want := "sha256=" + hex.EncodeToString(mac.Sum(nil))
		if gotSig != want {
			t.Errorf("sig=%q want %q", gotSig, want)
		}
		w.WriteHeader(204)
	}))
	defer srv.Close()

	// httptest is http — call SignBody directly and Client against rewritten validation
	client := &Client{HTTP: srv.Client()}
	url := "https://example.com/hook"
	payload := map[string]any{"event": "ticket.created", "ticket_id": "t1"}
	raw, _ := json.Marshal(payload)
	sig := SignBody("sekrit", raw)
	if !strings.HasPrefix(sig, "sha256=") {
		t.Fatalf("sig=%s", sig)
	}

	// Post through a transport that rewrites https example → test server
	client.HTTP = &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			req.URL.Scheme = "http"
			req.URL.Host = strings.TrimPrefix(srv.URL, "http://")
			return http.DefaultTransport.RoundTrip(req)
		}),
	}
	if err := client.PostSigned(context.Background(), url, "sekrit", payload); err != nil {
		t.Fatal(err)
	}
	if gotBody["event"] != "ticket.created" {
		t.Fatalf("body=%v", gotBody)
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
