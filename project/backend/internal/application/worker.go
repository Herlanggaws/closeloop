package application

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/closeloop/api/internal/infrastructure/email"
)

type MailSender interface {
	Send(to, subject, html string) error
}

func RunWorker(ctx context.Context, store *Store, mail MailSender) {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			jobs, err := store.ClaimJobs(ctx, 5)
			if err != nil {
				slog.Error("claim jobs", "err", err)
				continue
			}
			for _, job := range jobs {
				err := handleJob(ctx, store, mail, job.Kind, job.Payload)
				if finErr := store.FinishJob(ctx, job.ID, err); finErr != nil {
					slog.Error("finish job", "err", finErr)
				}
			}
		}
	}
}

func handleJob(ctx context.Context, store *Store, mail MailSender, kind string, payload json.RawMessage) error {
	switch kind {
	case "notify_reporters":
		var p struct {
			TicketID string `json:"ticket_id"`
		}
		if err := json.Unmarshal(payload, &p); err != nil {
			return err
		}
		_, mails, err := store.NotifyReporters(ctx, p.TicketID, "")
		if err != nil {
			return err
		}
		for _, m := range mails {
			fixed := email.FixedMail{
				To:           m.Email,
				ProjectName:  m.ProjectName,
				TicketTitle:  m.TicketTitle,
				Note:         m.Body,
				ReportQuote:  m.ReportQuote,
				ReportedAt:   m.ReportedAt,
				AppVersion:   m.AppVersion,
				GreetingName: email.GreetingFromEmail(m.Email),
			}
			subject := email.FixedSubject(fixed.TicketTitle)
			html := email.RenderFixedHTML(fixed)
			if err := mail.Send(m.Email, subject, html); err != nil {
				slog.Error("send mail", "err", err, "to", m.Email)
			}
		}
		return nil
	default:
		return fmt.Errorf("unknown job %s", kind)
	}
}
