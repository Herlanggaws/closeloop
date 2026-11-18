package email

import (
	"fmt"
	"html"
	"strings"
)

type SuggestVerifyMail struct {
	To           string
	ProjectName  string
	IdeaTitle    string
	ConfirmURL   string
	GreetingName string
}

func SuggestVerifySubject(projectName string) string {
	name := strings.TrimSpace(projectName)
	if name == "" {
		name = "the"
	} else {
		name = name + "'s"
	}
	return fmt.Sprintf("Confirm your idea on %s board", name)
}

func RenderSuggestVerifyHTML(m SuggestVerifyMail) string {
	project := html.EscapeString(fallback(m.ProjectName, "the project"))
	idea := html.EscapeString(fallback(m.IdeaTitle, "your idea"))
	url := html.EscapeString(m.ConfirmURL)
	subject := html.EscapeString(SuggestVerifySubject(m.ProjectName))
	initial := html.EscapeString(brandInitial(m.ProjectName))

	cta := ""
	if strings.TrimSpace(m.ConfirmURL) != "" {
		cta = fmt.Sprintf(`
              <p style="margin:0 0 20px;">
                <a href="%s" style="display:inline-block;padding:12px 20px;background:#171717;color:#FFFFFF;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;line-height:20px;">Confirm my idea</a>
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
              <h1 style="margin:0 0 20px;font-size:26px;line-height:1.2;letter-spacing:-0.5px;color:#171717;font-weight:500;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">Confirm your idea</h1>
              <p style="margin:0 0 20px;font-size:15px;line-height:24px;color:#737373;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">You suggested "%s". Confirm it's you — the team will review it before it appears on the public board.</p>
              %s
              <p style="margin:0;font-size:13px;line-height:21px;color:#A3A3A3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">This link expires in 24 hours. Didn't suggest this? Ignore this email.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 40px;border-top:1px solid #17171714;">
              <p style="margin:0 0 6px;font-size:12px;line-height:18px;color:#A3A3A3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">We only email you to confirm this suggestion.</p>
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
