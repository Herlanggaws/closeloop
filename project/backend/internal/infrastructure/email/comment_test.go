package email

import (
	"strings"
	"testing"
)

func TestCommentVerifySubject(t *testing.T) {
	got := CommentVerifySubject("Bear Budget")
	if got != "Confirm your comment on Bear Budget's board" {
		t.Fatalf("subject=%q", got)
	}
}

func TestRenderCommentVerifyHTML(t *testing.T) {
	html := RenderCommentVerifyHTML(CommentVerifyMail{
		To:          "a@b.co",
		ProjectName: "Bear Budget",
		IdeaTitle:   "Export sheets",
		ConfirmURL:  "https://app.example/comment/confirm?t=abc",
	})
	for _, want := range []string{
		"Confirm your comment",
		"Export sheets",
		"https://app.example/comment/confirm?t=abc",
		"Confirm my comment",
	} {
		if !strings.Contains(html, want) {
			t.Fatalf("missing %q in html", want)
		}
	}
}

func TestRenderCommentVerifyHTMLEscapes(t *testing.T) {
	html := RenderCommentVerifyHTML(CommentVerifyMail{
		ProjectName: `<script>`,
		IdeaTitle:   `"</script>`,
		ConfirmURL:  `https://x.test/"onclick="`,
	})
	if strings.Contains(html, "<script>") {
		t.Fatal("unescaped script in html")
	}
}
