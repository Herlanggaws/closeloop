package email

import (
	"strings"
	"testing"
)

// D-20: reporter-facing emails carry "Powered by Saidloop" on Free only.
func TestBadgeFooterFollowsPlan(t *testing.T) {
	free := RenderFixedHTML(FixedMail{To: "a@b.co", ProjectName: "Bear", TicketTitle: "x", BadgeURL: "https://web.test/?utm_source=badge&utm_campaign=p1&utm_medium=email"})
	if !strings.Contains(free, "Powered by <a href=\"https://web.test/?utm_source=badge&amp;utm_campaign=p1&amp;utm_medium=email\"") {
		t.Fatalf("free email should link the badge: %s", free[strings.LastIndex(free, "Powered")-50:])
	}
	if strings.Contains(free, "Sent with Saidloop") {
		t.Fatal("old footer should be replaced")
	}
	paid := RenderFixedHTML(FixedMail{To: "a@b.co", ProjectName: "Bear", TicketTitle: "x"})
	if strings.Contains(paid, "Saidloop</a>") || strings.Contains(paid, "Sent with Saidloop") || strings.Contains(paid, "Powered by") {
		t.Fatal("paid email must not carry the badge")
	}
	for name, out := range map[string]string{
		"vote":     RenderVoteVerifyHTML(VoteVerifyMail{}),
		"released": RenderVoteReleasedHTML(VoteReleasedMail{}),
		"comment":  RenderCommentVerifyHTML(CommentVerifyMail{}),
		"suggest":  RenderSuggestVerifyHTML(SuggestVerifyMail{}),
	} {
		if strings.Contains(out, "Sent with Saidloop") || strings.Contains(out, "Powered by") {
			t.Fatalf("%s: paid email must not carry the badge", name)
		}
	}
}
