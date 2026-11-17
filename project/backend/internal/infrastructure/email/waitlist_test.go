package email

import (
	"strings"
	"testing"
)

func TestWaitlistSubject(t *testing.T) {
	if got := WaitlistSubject(); got != "You're on the Saidloop waitlist" {
		t.Fatalf("subject=%q", got)
	}
}

func TestRenderWaitlistHTML(t *testing.T) {
	html := RenderWaitlistHTML(WaitlistMail{
		To:           "rina@example.com",
		GreetingName: "Rina",
	})
	for _, needle := range []string{
		"You're on the Saidloop waitlist",
		"Hi Rina, you're on the list.",
		"Saidloop",
		"We'll email you when it's your turn",
		"joined the Saidloop waitlist",
		"Sent with Saidloop",
	} {
		if !strings.Contains(html, needle) {
			t.Fatalf("missing %q in html", needle)
		}
	}
	if strings.Contains(html, "<script") {
		t.Fatal("unexpected script tag")
	}
}

func TestRenderWaitlistHTMLEscapes(t *testing.T) {
	html := RenderWaitlistHTML(WaitlistMail{
		GreetingName: `<script>alert(1)</script>`,
	})
	if strings.Contains(html, "<script>") {
		t.Fatalf("unescaped content leaked: %s", html)
	}
	if !strings.Contains(html, "&lt;script&gt;") {
		t.Fatal("expected escaped script")
	}
}
