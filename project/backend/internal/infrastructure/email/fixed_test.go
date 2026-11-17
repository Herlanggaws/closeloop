package email

import (
	"strings"
	"testing"
	"time"
)

func TestGreetingFromEmail(t *testing.T) {
	cases := map[string]string{
		"rina@example.com":     "Rina",
		"john.doe@example.com": "John",
		"a@b.co":               "A",
		"":                     "there",
	}
	for in, want := range cases {
		if got := GreetingFromEmail(in); got != want {
			t.Fatalf("GreetingFromEmail(%q)=%q want %q", in, got, want)
		}
	}
}

func TestFixedSubject(t *testing.T) {
	if got := FixedSubject("filters"); got != "Your report about filters is fixed" {
		t.Fatalf("subject=%q", got)
	}
	if got := FixedSubject(""); got != "Your report was fixed" {
		t.Fatalf("empty subject=%q", got)
	}
}

func TestRenderFixedHTML(t *testing.T) {
	html := RenderFixedHTML(FixedMail{
		To:           "rina@example.com",
		ProjectName:  "Bear Budget",
		TicketTitle:  "filters",
		Note:         "Filters now refresh when you change the dates.",
		ReportQuote:  `I changed the range to Last 7 days`,
		ReportedAt:   time.Date(2026, 10, 30, 0, 0, 0, 0, time.UTC),
		AppVersion:   "2.4.2",
		GreetingName: "Rina",
		OpenURL:      "https://app.bearbudget.app",
	})
	for _, needle := range []string{
		"Hi Rina, it's fixed.",
		"Bear Budget",
		"Fixed in 2.4.2",
		"Filters now refresh when you change the dates.",
		"You reported on Oct 30",
		"I changed the range to Last 7 days",
		"Your report about filters is fixed",
		"Open Bear Budget",
		"https://app.bearbudget.app",
	} {
		if !strings.Contains(html, needle) {
			t.Fatalf("missing %q in html", needle)
		}
	}
	if strings.Contains(html, "<script") {
		t.Fatal("unexpected script tag")
	}
}

func TestRenderFixedHTMLEscapes(t *testing.T) {
	html := RenderFixedHTML(FixedMail{
		ProjectName: "App<script>",
		Note:        `<img src=x onerror=alert(1)>`,
		ReportQuote: `"</p><script>alert(1)</script>`,
	})
	if strings.Contains(html, "<script>") || strings.Contains(html, "<img src=x") {
		t.Fatalf("unescaped content leaked: %s", html)
	}
	if !strings.Contains(html, "&lt;script&gt;") {
		t.Fatal("expected escaped script")
	}
}
