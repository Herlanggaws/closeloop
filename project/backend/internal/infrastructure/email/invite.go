package email

import (
	"fmt"
	"html"
	"strings"
)

type InviteMail struct {
	To           string
	OrgName      string
	InviterName  string
	Role         string
	AcceptURL    string
	GreetingName string
}

func InviteSubject(orgName string) string {
	name := strings.TrimSpace(orgName)
	if name == "" {
		name = "a Saidloop workspace"
	}
	return fmt.Sprintf("You're invited to %s on Saidloop", name)
}

func RenderInviteHTML(m InviteMail) string {
	org := html.EscapeString(fallback(m.OrgName, "a Saidloop workspace"))
	inviter := html.EscapeString(fallback(m.InviterName, "A teammate"))
	role := html.EscapeString(fallback(m.Role, "member"))
	greeting := html.EscapeString(fallback(m.GreetingName, "there"))
	url := html.EscapeString(m.AcceptURL)

	return fmt.Sprintf(`<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#F7F7F7;">
  <div style="max-width:560px;margin:32px auto;padding:28px 24px;background:#fff;border:1px solid #17171714;border-radius:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <p style="margin:0 0 8px;font-size:13px;color:#A3A3A3;">Saidloop</p>
    <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#171717;font-weight:600;">Join %s</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#525252;">Hi %s — %s invited you as a <strong>%s</strong>.</p>
    <p style="margin:0 0 24px;">
      <a href="%s" style="display:inline-block;padding:12px 18px;background:#171717;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500;">Accept invite</a>
    </p>
    <p style="margin:0;font-size:12px;line-height:1.5;color:#A3A3A3;">This link expires in 7 days. If you did not expect this email, you can ignore it.</p>
  </div>
</body></html>`, org, greeting, inviter, role, url)
}
