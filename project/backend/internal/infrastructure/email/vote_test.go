package email

import (
	"html"
	"strings"
	"testing"
)

func TestVoteVerifySubject(t *testing.T) {
	if got := VoteVerifySubject("Bear Budget"); got != "Confirm your vote on Bear Budget's board" {
		t.Fatalf("subject=%q", got)
	}
	if got := VoteVerifySubject(""); got != "Confirm your vote on the board" {
		t.Fatalf("empty subject=%q", got)
	}
}

func TestVoteReleasedSubject(t *testing.T) {
	if got := VoteReleasedSubject(); got != "An idea you voted for just shipped" {
		t.Fatalf("subject=%q", got)
	}
}

func TestRenderVoteVerifyHTML(t *testing.T) {
	body := RenderVoteVerifyHTML(VoteVerifyMail{
		ProjectName: "Bear Budget",
		IdeaTitle:   "Export budgets to Google Sheets",
		ConfirmURL:  "https://saidloop.dev/vote/confirm?t=abc",
	})
	for _, needle := range []string{
		html.EscapeString("Confirm your vote on Bear Budget's board"),
		"Confirm your vote",
		"Export budgets to Google Sheets",
		"Confirm my vote",
		"https://saidloop.dev/vote/confirm?t=abc",
		"expires in 24 hours",
		"Bear Budget",
	} {
		if !strings.Contains(body, needle) {
			t.Fatalf("missing %q in html", needle)
		}
	}
}

func TestRenderVoteReleasedHTML(t *testing.T) {
	html := RenderVoteReleasedHTML(VoteReleasedMail{
		ProjectName: "Bear Budget",
		IdeaTitle:   "Export to Google Sheets",
		ReleaseNote: "Open Settings → Export to send any budget straight to a Google Sheet.",
		VoteCount:   128,
		ReportCount: 12,
		BoardHost:   "feedback.bearbudget.app",
		OpenURL:     "https://feedback.bearbudget.app/ideas/1",
	})
	for _, needle := range []string{
		"An idea you voted for just shipped",
		"Released",
		"Export to Google Sheets is live",
		"128 votes · requested in 12 reports",
		"See what's new",
		"https://feedback.bearbudget.app/ideas/1",
		"feedback.bearbudget.app",
	} {
		if !strings.Contains(html, needle) {
			t.Fatalf("missing %q in html", needle)
		}
	}
}

func TestRenderVoteHTMLEscapes(t *testing.T) {
	verify := RenderVoteVerifyHTML(VoteVerifyMail{
		ProjectName: `App<script>`,
		IdeaTitle:   `"</p><script>x</script>`,
		ConfirmURL:  `https://x.test/"onclick="alert(1)`,
	})
	if strings.Contains(verify, "<script>") {
		t.Fatal("verify leaked script")
	}
	released := RenderVoteReleasedHTML(VoteReleasedMail{
		ProjectName: `App<script>`,
		IdeaTitle:   `<img src=x>`,
		ReleaseNote: `<script>alert(1)</script>`,
		OpenURL:     `https://x.test/"onclick="alert(1)`,
		BoardHost:   `<script>`,
	})
	if strings.Contains(released, "<script>") || strings.Contains(released, "<img src=x>") {
		t.Fatal("released leaked markup")
	}
}
