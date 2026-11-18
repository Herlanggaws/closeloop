package githubapp

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
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
