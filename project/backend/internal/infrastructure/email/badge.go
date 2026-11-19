package email

import (
	"html"
	"strings"
)

const sentWithLine = `>Sent with Saidloop</p>`

// applyBadge swaps the old "Sent with Saidloop" footer for the plan-aware badge (D-20):
// a "Powered by Saidloop" link on Free, nothing on paid plans.
func applyBadge(out, badgeURL string) string {
	if badgeURL == "" {
		i := strings.Index(out, sentWithLine)
		if i < 0 {
			return out
		}
		start := strings.LastIndex(out[:i], "<p ")
		if start < 0 {
			return out
		}
		return out[:start] + out[i+len(sentWithLine):]
	}
	link := `>Powered by <a href="` + html.EscapeString(badgeURL) + `" style="color:#737373;text-decoration:none;font-weight:500;">Saidloop</a></p>`
	return strings.Replace(out, sentWithLine, link, 1)
}
