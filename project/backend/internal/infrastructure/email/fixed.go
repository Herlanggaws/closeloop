package email

import (
	"fmt"
	"html"
	"strings"
	"time"
)

type FixedMail struct {
	To           string
	ProjectName  string
	TicketTitle  string
	Note         string
	ReportQuote  string
	ReportedAt   time.Time
	AppVersion   string
	GreetingName string
}

func FixedSubject(ticketTitle string) string {
	title := strings.TrimSpace(ticketTitle)
	if title == "" {
		return "Your report was fixed"
	}
	if len(title) > 60 {
		title = title[:57] + "…"
	}
	return fmt.Sprintf("Your report about %s is fixed", title)
}

func GreetingFromEmail(emailAddr string) string {
	local := strings.TrimSpace(emailAddr)
	if at := strings.Index(local, "@"); at > 0 {
		local = local[:at]
	}
	local = strings.Split(local, "+")[0]
	local = strings.ReplaceAll(local, ".", " ")
	local = strings.ReplaceAll(local, "_", " ")
	local = strings.TrimSpace(local)
	if local == "" {
		return "there"
	}
	parts := strings.Fields(local)
	first := parts[0]
	if len(first) == 1 {
		return strings.ToUpper(first)
	}
	return strings.ToUpper(first[:1]) + strings.ToLower(first[1:])
}

func RenderFixedHTML(m FixedMail) string {
	project := html.EscapeString(fallback(m.ProjectName, "your app"))
	note := html.EscapeString(fallback(m.Note, "Your report was fixed."))
	quote := html.EscapeString(m.ReportQuote)
	greeting := html.EscapeString(fallback(m.GreetingName, "there"))
	noteLabel := "What's fixed"
	if v := strings.TrimSpace(m.AppVersion); v != "" {
		noteLabel = "Fixed in " + html.EscapeString(v)
	}

	reportedLine := ""
	if !m.ReportedAt.IsZero() {
		reportedLine = fmt.Sprintf(
			`<p style="margin:0 0 6px;font-size:12px;line-height:1.4;color:#A3A3A3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">You reported on %s</p>`,
			html.EscapeString(m.ReportedAt.Format("Jan 2")),
		)
	}

	quoteBlock := ""
	if quote != "" {
		quoteBlock = fmt.Sprintf(`
          <div style="margin:0;padding:2px 0 2px 14px;border-left:2px solid #1717171F;">
            %s
            <p style="margin:0;font-size:14px;line-height:21px;color:#737373;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">"%s"</p>
          </div>`, reportedLine, quote)
	}

	initial := "C"
	if runes := []rune(strings.TrimSpace(m.ProjectName)); len(runes) > 0 {
		initial = strings.ToUpper(string(runes[0]))
	}
	initial = html.EscapeString(initial)

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
              <h1 style="margin:0 0 20px;font-size:28px;line-height:1.2;letter-spacing:-0.6px;color:#171717;font-weight:500;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">Hi %s, it's fixed.</h1>
              <p style="margin:0 0 20px;font-size:15px;line-height:24px;color:#737373;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">Thanks for reporting a problem in %s. Here's what changed:</p>
              <div style="margin:0 0 20px;padding:18px;background:#F0FDF4;border-radius:10px;">
                <p style="margin:0 0 6px;font-size:12.5px;line-height:1.4;color:#16A34A;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">✓ %s</p>
                <p style="margin:0;font-size:15px;line-height:1.4;color:#171717;font-weight:500;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">%s</p>
              </div>
              %s
            </td>
          </tr>
          <tr>
            <td style="padding:18px 40px;border-top:1px solid #17171714;">
              <p style="margin:0 0 6px;font-size:12px;line-height:18px;color:#A3A3A3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">You're getting this because you reported a problem in %s and left your email.</p>
              <p style="margin:0;font-size:12px;line-height:1.4;color:#A3A3A3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">Sent with Saidloop</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
		html.EscapeString(FixedSubject(m.TicketTitle)),
		html.EscapeString(FixedSubject(m.TicketTitle)),
		project,
		initial,
		project,
		greeting,
		project,
		noteLabel,
		note,
		quoteBlock,
		project,
	)
}

func fallback(value, whenEmpty string) string {
	if strings.TrimSpace(value) == "" {
		return whenEmpty
	}
	return value
}
