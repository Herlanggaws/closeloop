package githubapp

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"io"
	"net/http"
	"strings"
	"testing"
)

func TestVerifySignature(t *testing.T) {
	secret := "test-secret"
	body := []byte(`{"action":"opened"}`)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	sig := "sha256=" + hex.EncodeToString(mac.Sum(nil))

	if !VerifySignature(secret, body, sig) {
		t.Fatal("expected valid signature")
	}
	if VerifySignature(secret, body, "sha256=deadbeef") {
		t.Fatal("expected invalid signature to fail")
	}
	if VerifySignature("", body, sig) {
		t.Fatal("empty secret must fail")
	}
}

func TestInstallURL(t *testing.T) {
	c := &Client{cfg: Config{Slug: "saidloop-auto-pr"}}
	got := c.InstallURL("proj-1")
	want := "https://github.com/apps/saidloop-auto-pr/installations/new?state=proj-1"
	if got != want {
		t.Fatalf("got %s want %s", got, want)
	}
}

func TestCreatePullRequestHasNoMergeAPI(t *testing.T) {
	// Compile-time policy: Client must not expose Merge.
	var c *Client
	_ = c
	type merger interface {
		Merge(any) error
	}
	if _, ok := any(c).(merger); ok {
		t.Fatal("githubapp.Client must not implement Merge")
	}
}

func TestCreateIssuePostsJSON(t *testing.T) {
	pemBytes := mustTestRSAKey(t)
	var sawPath string
	var sawBody map[string]any
	client := &Client{
		cfg: Config{
			AppID:         "1",
			PrivateKeyPEM: pemBytes,
			HTTP: &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
				if strings.HasSuffix(r.URL.Path, "/access_tokens") {
					return jsonResponse(201, map[string]any{"token": "tok"}), nil
				}
				sawPath = r.URL.Path
				b, _ := io.ReadAll(r.Body)
				_ = json.Unmarshal(b, &sawBody)
				return jsonResponse(201, map[string]any{
					"html_url": "https://github.com/acme/app/issues/7",
					"number":   7,
				}), nil
			})},
		},
	}
	out, err := client.CreateIssue(context.Background(), CreateIssueInput{
		InstallationID: 9,
		Owner:          "acme",
		Repo:           "app",
		Title:          "Broken button",
		Body:           "details",
	})
	if err != nil {
		t.Fatal(err)
	}
	if out.Number != 7 || out.HTMLURL == "" {
		t.Fatalf("result=%+v", out)
	}
	if sawPath != "/repos/acme/app/issues" {
		t.Fatalf("path=%q", sawPath)
	}
	if sawBody["title"] != "Broken button" || sawBody["body"] != "details" {
		t.Fatalf("body=%v", sawBody)
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func jsonResponse(code int, payload any) *http.Response {
	b, _ := json.Marshal(payload)
	return &http.Response{
		StatusCode: code,
		Body:       io.NopCloser(strings.NewReader(string(b))),
		Header:     make(http.Header),
	}
}

func mustTestRSAKey(t *testing.T) []byte {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 1024)
	if err != nil {
		t.Fatal(err)
	}
	return pem.EncodeToMemory(&pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: x509.MarshalPKCS1PrivateKey(key),
	})
}
