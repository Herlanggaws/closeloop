package email

import (
	"fmt"
	"html"
	"strings"
)

type WaitlistMail struct {
	To           string
	GreetingName string
}

func WaitlistSubject() string {
	return "You're on the Saidloop waitlist"
}

func RenderWaitlistHTML(m WaitlistMail) string {
	greeting := html.EscapeString(fallback(m.GreetingName, "there"))
	subject := html.EscapeString(WaitlistSubject())

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
              <p style="margin:0;font-size:12px;line-height:1.4;color:#A3A3A3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">Saidloop &lt;noreply@saidloop.com&gt;</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px;">
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 20px;">
                <tr>
                  <td style="width:28px;height:28px;background:#F59E0B;border-radius:8px;text-align:center;vertical-align:middle;font-size:15px;line-height:28px;color:#FFFFFF;font-weight:800;font-family:Nunito,system-ui,sans-serif;">S</td>
                  <td style="padding-left:8px;font-size:17px;line-height:1.2;color:#3B2F2F;font-weight:800;font-family:Nunito,system-ui,sans-serif;">Saidloop</td>
                </tr>
              </table>
              <h1 style="margin:0 0 20px;font-size:26px;line-height:1.2;letter-spacing:-0.5px;color:#171717;font-weight:500;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">Hi %s, you're on the list.</h1>
              <p style="margin:0 0 20px;font-size:15px;line-height:24px;color:#737373;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">Thanks for signing up. We'll email you when it's your turn to try Saidloop — close the loop between users and your product.</p>
              <p style="margin:0;font-size:13px;line-height:21px;color:#A3A3A3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">No spam. Just one note when a spot opens.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 40px;border-top:1px solid #17171714;">
              <p style="margin:0 0 6px;font-size:12px;line-height:18px;color:#A3A3A3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">You're getting this because you joined the Saidloop waitlist.</p>
              <p style="margin:0;font-size:12px;line-height:1.4;color:#A3A3A3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">Sent with Saidloop</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`, subject, subject, greeting)
}

func brandInitial(name string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		return "S"
	}
	return strings.ToUpper(string([]rune(name)[0]))
}
