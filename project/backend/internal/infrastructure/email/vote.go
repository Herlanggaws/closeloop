package email

import (
	"fmt"
	"html"
	"strings"
)

type VoteVerifyMail struct {
	To           string
	ProjectName  string
	IdeaTitle    string
	ConfirmURL   string
	GreetingName string
	// BadgeURL shows "Powered by Saidloop" in the footer; empty on paid plans (D-20).
	BadgeURL string
}

type VoteReleasedMail struct {
	To           string
	ProjectName  string
	IdeaTitle    string
	ReleaseNote  string
	VoteCount    int
	ReportCount  int
	BoardHost    string
	OpenURL      string
	GreetingName string
	// BadgeURL shows "Powered by Saidloop" in the footer; empty on paid plans (D-20).
	BadgeURL string
}

func VoteVerifySubject(projectName string) string {
	name := strings.TrimSpace(projectName)
	if name == "" {
		name = "the"
	} else {
		name = name + "'s"
	}
	return fmt.Sprintf("Confirm your vote on %s board", name)
}

func VoteReleasedSubject() string {
	return "An idea you voted for just shipped"
}

func RenderVoteVerifyHTML(m VoteVerifyMail) string {
	return applyBadge(renderVoteVerifyHTMLRaw(m), m.BadgeURL)
}

func renderVoteVerifyHTMLRaw(m VoteVerifyMail) string {
	project := html.EscapeString(fallback(m.ProjectName, "the project"))
	idea := html.EscapeString(fallback(m.IdeaTitle, "this idea"))
	url := html.EscapeString(m.ConfirmURL)
	subject := html.EscapeString(VoteVerifySubject(m.ProjectName))
	initial := html.EscapeString(brandInitial(m.ProjectName))

	cta := ""
	if strings.TrimSpace(m.ConfirmURL) != "" {
		cta = fmt.Sprintf(`
              <p style="margin:0 0 20px;">
                <a href="%s" style="display:inline-block;padding:12px 20px;background:#171717;color:#FFFFFF;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;line-height:20px;">Confirm my vote</a>
              </p>`, url)
	}

	return fmt.Sprintf(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>%s</title>
</head>
<body style="margin:0;padding:0;background:#F5F5F5;">
  <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="background:#F5F5F5;padding:64px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:600px;max-width:100%%;background:#FFFFFF;border:1px solid #17171714;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:14px 24px;background:#FAFAFA;border-bottom:1px solid #17171714;">
              <p style="margin:0 0 4px;font-size:14px;line-height:1.4;color:#171717;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">%s</p>
              <p style="margin:0;font-size:12px;line-height:1.4;color:#A3A3A3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">%s via Saidloop</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px;">
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 20px;">
                <tr>
                  <td style="width:28px;height:28px;background:#F59E0B;border-radius:8px;text-align:center;vertical-align:middle;font-size:15px;line-height:28px;color:#FFFFFF;font-weight:800;font-family:Nunito,system-ui,sans-serif;">%s</td>
                  <td style="padding-left:8px;font-size:17px;line-height:1.2;color:#3B2F2F;font-weight:800;font-family:Nunito,system-ui,sans-serif;">%s</td>
                </tr>
              </table>
              <h1 style="margin:0 0 20px;font-size:26px;line-height:1.2;letter-spacing:-0.5px;color:#171717;font-weight:500;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">Confirm your vote</h1>
              <p style="margin:0 0 20px;font-size:15px;line-height:24px;color:#737373;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">You voted for "%s". Confirm it's you so your vote counts and we can tell you when it ships.</p>
              %s
              <p style="margin:0;font-size:13px;line-height:21px;color:#A3A3A3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">This link expires in 24 hours. Didn't vote? Ignore this email.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 40px;border-top:1px solid #17171714;">
              <p style="margin:0 0 6px;font-size:12px;line-height:18px;color:#A3A3A3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">Voters get one email when the idea changes status. Nothing else.</p>
              <p style="margin:0;font-size:12px;line-height:1.4;color:#A3A3A3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">Sent with Saidloop</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`, subject, subject, project, initial, project, idea, cta)
}

func RenderVoteReleasedHTML(m VoteReleasedMail) string {
	return applyBadge(renderVoteReleasedHTMLRaw(m), m.BadgeURL)
}

func renderVoteReleasedHTMLRaw(m VoteReleasedMail) string {
	project := html.EscapeString(fallback(m.ProjectName, "the project"))
	idea := html.EscapeString(fallback(m.IdeaTitle, "Your idea"))
	note := html.EscapeString(fallback(m.ReleaseNote, "It's live now."))
	subject := html.EscapeString(VoteReleasedSubject())
	initial := html.EscapeString(brandInitial(m.ProjectName))
	boardHost := html.EscapeString(strings.TrimSpace(m.BoardHost))

	votes := m.VoteCount
	if votes < 1 {
		votes = 1
	}
	reports := m.ReportCount
	if reports < 0 {
		reports = 0
	}
	votesLine := fmt.Sprintf("%d votes", votes)
	if reports > 0 {
		votesLine = fmt.Sprintf("%d votes · requested in %d reports", votes, reports)
	}
	votesLine = html.EscapeString(votesLine)

	headline := idea
	if !strings.HasSuffix(strings.ToLower(strings.TrimSpace(m.IdeaTitle)), "is live") {
		headline = idea + " is live"
	}

	cta := ""
	if u := strings.TrimSpace(m.OpenURL); u != "" {
		cta = fmt.Sprintf(`
              <p style="margin:0;">
                <a href="%s" style="display:inline-block;padding:12px 20px;background:#171717;color:#FFFFFF;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;line-height:20px;">See what's new</a>
              </p>`, html.EscapeString(u))
	}

	footerReason := fmt.Sprintf("You're getting this because you voted on %s.", project)
	if boardHost != "" {
		footerReason = fmt.Sprintf("You're getting this because you voted on %s.", boardHost)
	}

	return fmt.Sprintf(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>%s</title>
</head>
<body style="margin:0;padding:0;background:#F5F5F5;">
  <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="background:#F5F5F5;padding:64px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:600px;max-width:100%%;background:#FFFFFF;border:1px solid #17171714;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:14px 24px;background:#FAFAFA;border-bottom:1px solid #17171714;">
              <p style="margin:0 0 4px;font-size:14px;line-height:1.4;color:#171717;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">%s</p>
              <p style="margin:0;font-size:12px;line-height:1.4;color:#A3A3A3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">%s via Saidloop</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px;">
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 20px;">
                <tr>
                  <td style="width:28px;height:28px;background:#F59E0B;border-radius:8px;text-align:center;vertical-align:middle;font-size:15px;line-height:28px;color:#FFFFFF;font-weight:800;font-family:Nunito,system-ui,sans-serif;">%s</td>
                  <td style="padding-left:8px;font-size:17px;line-height:1.2;color:#3B2F2F;font-weight:800;font-family:Nunito,system-ui,sans-serif;">%s</td>
                </tr>
              </table>
              <p style="margin:0 0 20px;display:inline-block;padding:2px 8px;border:1px solid #1717171F;border-radius:999px;font-size:11px;line-height:18px;color:#171717;font-weight:500;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
                <span style="display:inline-block;width:6px;height:6px;background:#16A34A;border-radius:50%%;margin-right:6px;vertical-align:middle;"></span>Released
              </p>
              <h1 style="margin:0 0 20px;font-size:26px;line-height:1.2;letter-spacing:-0.5px;color:#171717;font-weight:500;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">%s</h1>
              <p style="margin:0 0 20px;font-size:15px;line-height:24px;color:#737373;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">%s</p>
              <div style="margin:0 0 20px;padding:12px;background:#F5F5F5;border-radius:10px;">
                <p style="margin:0;font-size:13px;line-height:1.4;color:#737373;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">↑ %s</p>
              </div>
              %s
            </td>
          </tr>
          <tr>
            <td style="padding:18px 40px;border-top:1px solid #17171714;">
              <p style="margin:0 0 6px;font-size:12px;line-height:18px;color:#A3A3A3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">%s</p>
              <p style="margin:0;font-size:12px;line-height:1.4;color:#A3A3A3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">Sent with Saidloop</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`, subject, subject, project, initial, project, headline, note, votesLine, cta, footerReason)
}
