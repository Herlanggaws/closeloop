package application

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/closeloop/api/internal/infrastructure/email"
)

const projectRetention = 30 * 24 * time.Hour

type MailSender interface {
	Send(to, subject, html string) error
}

type ProjectFileCleaner interface {
	RemoveProject(projectID string) error
}

func RunWorker(ctx context.Context, store *Store, mail MailSender, files ProjectFileCleaner) {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()
	purgeTicker := time.NewTicker(time.Hour)
	defer purgeTicker.Stop()

	purgeDeletedProjects(ctx, store, files)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if _, err := ProcessJobsOnce(ctx, store, mail, 5); err != nil {
				slog.Error("process jobs", "err", err)
			}
		case <-purgeTicker.C:
			purgeDeletedProjects(ctx, store, files)
		}
	}
}

// ProcessJobsOnce claims up to limit pending jobs and runs them. Used by the worker and tests.
func ProcessJobsOnce(ctx context.Context, store *Store, mail MailSender, limit int) (int, error) {
	jobs, err := store.ClaimJobs(ctx, limit)
	if err != nil {
		return 0, err
	}
	for _, job := range jobs {
		err := handleJob(ctx, store, mail, job.Kind, job.Payload)
		if finErr := store.FinishJob(ctx, job.ID, err); finErr != nil {
			return len(jobs), finErr
		}
	}
	return len(jobs), nil
}

func purgeDeletedProjects(ctx context.Context, store *Store, files ProjectFileCleaner) {
	cutoff := time.Now().Add(-projectRetention)
	ids, err := store.ListProjectsDueForPurge(ctx, cutoff, 50)
	if err != nil {
		slog.Error("list projects due for purge", "err", err)
		return
	}
	for _, id := range ids {
		if files != nil {
			if err := files.RemoveProject(id); err != nil {
				slog.Error("remove project files", "project_id", id, "err", err)
				continue
			}
		}
		if err := store.HardDeleteProject(ctx, id); err != nil {
			slog.Error("hard delete project", "project_id", id, "err", err)
			continue
		}
		slog.Info("purged deleted project", "project_id", id)
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
