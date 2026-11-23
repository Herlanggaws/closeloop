package application

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/closeloop/api/internal/infrastructure/email"
	"github.com/closeloop/api/internal/infrastructure/slack"
	"github.com/closeloop/api/internal/infrastructure/webhook"
)

const projectRetention = 30 * 24 * time.Hour

type MailSender interface {
	Send(to, subject, html string) error
}

type ProjectFileCleaner interface {
	RemoveProject(projectID string) error
}

type AttachmentFileCleaner interface {
	Delete(key string) error
}

type WorkerDeps struct {
	Mail     MailSender
	Slack    slack.Poster
	Webhook  webhook.Poster
	WebURL   string
	Autopr   AutoprExecutor
}

func RunWorker(ctx context.Context, store *Store, mail MailSender, files ProjectFileCleaner, webURL string, slackPoster slack.Poster, autopr AutoprExecutor) {
	if slackPoster == nil {
		slackPoster = slack.NewClient()
	}
	deps := WorkerDeps{Mail: mail, Slack: slackPoster, Webhook: webhook.NewClient(), WebURL: webURL, Autopr: autopr}
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()
	purgeTicker := time.NewTicker(time.Hour)
	defer purgeTicker.Stop()

	purgeDeletedProjects(ctx, store, files)
	var fileDeleter AttachmentFileCleaner
	if d, ok := files.(AttachmentFileCleaner); ok {
		fileDeleter = d
	}
	purgeExpiredReplays(ctx, store, fileDeleter)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if _, err := ProcessJobsOnce(ctx, store, deps, 5); err != nil {
				slog.Error("process jobs", "err", err)
			}
		case <-purgeTicker.C:
			purgeDeletedProjects(ctx, store, files)
			purgeExpiredReplays(ctx, store, fileDeleter)
		}
	}
}

// ProcessJobsOnce claims up to limit pending jobs and runs them. Used by the worker and tests.
func ProcessJobsOnce(ctx context.Context, store *Store, deps WorkerDeps, limit int) (int, error) {
	jobs, err := store.ClaimJobs(ctx, limit)
	if err != nil {
		return 0, err
	}
	for _, job := range jobs {
		err := handleJob(ctx, store, deps, job.Kind, job.Payload)
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

func purgeExpiredReplays(ctx context.Context, store *Store, files AttachmentFileCleaner) {
	list, err := store.ListExpiredReplays(ctx, 100)
	if err != nil {
		slog.Error("list expired replays", "err", err)
		return
	}
	for _, item := range list {
		if files != nil && item.StorageKey != "" {
			if err := files.Delete(item.StorageKey); err != nil {
				slog.Error("delete replay file", "attachment_id", item.ID, "err", err)
				continue
			}
		}
		if err := store.DeleteAttachment(ctx, item.ID); err != nil {
			slog.Error("delete replay row", "attachment_id", item.ID, "err", err)
			continue
		}
		slog.Info("purged expired replay", "attachment_id", item.ID)
	}
}

// PurgeExpiredReplaysOnce runs retention cleanup (tests + manual ops).
func PurgeExpiredReplaysOnce(ctx context.Context, store *Store, files AttachmentFileCleaner) {
	purgeExpiredReplays(ctx, store, files)
}

func handleJob(ctx context.Context, store *Store, deps WorkerDeps, kind string, payload json.RawMessage) error {
	switch kind {
	case "notify_reporters":
		var p struct {
			TicketID  string   `json:"ticket_id"`
			Platforms []string `json:"platforms"`
			Notify    *struct {
				Email *bool `json:"email"`
				InApp *bool `json:"in_app"`
			} `json:"notify"`
		}
		if err := json.Unmarshal(payload, &p); err != nil {
			return err
		}
		channels := DefaultNotifyChannels()
		if p.Notify != nil {
			if p.Notify.Email != nil {
				channels.Email = *p.Notify.Email
			}
			if p.Notify.InApp != nil {
				channels.InApp = *p.Notify.InApp
			}
		}
		_, mails, err := store.NotifyReporters(ctx, p.TicketID, "", channels.Email, channels.InApp, p.Platforms...)
		if err != nil {
			return err
		}
		for _, m := range mails {
			fixed := email.FixedMail{
				BadgeURL:     store.BadgeURLForTicket(ctx, p.TicketID, deps.WebURL, "email"),
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
			if err := deps.Mail.Send(m.Email, subject, html); err != nil {
				slog.Error("send mail", "err", err, "to", m.Email)
			}
		}
		return nil
	case "notify_slack":
		var p struct {
			TicketID string `json:"ticket_id"`
			Event    string `json:"event"`
			From     string `json:"from"`
			To       string `json:"to"`
			Note     string `json:"note"`
		}
		if err := json.Unmarshal(payload, &p); err != nil {
			return err
		}
		return notifySlack(ctx, store, deps, p.TicketID, p.Event, p.From, p.To, p.Note)
	case "notify_webhook":
		var p struct {
			TicketID string `json:"ticket_id"`
			Event    string `json:"event"`
			From     string `json:"from"`
			To       string `json:"to"`
			Note     string `json:"note"`
		}
		if err := json.Unmarshal(payload, &p); err != nil {
			return err
		}
		return notifyOutboundWebhook(ctx, store, deps, p.TicketID, p.Event, p.From, p.To, p.Note)
	case "notify_vote_verify":
		var p struct {
			TicketID    string `json:"ticket_id"`
			Email       string `json:"email"`
			RawToken    string `json:"raw_token"`
			ProjectName string `json:"project_name"`
			IdeaTitle   string `json:"idea_title"`
			BoardSlug   string `json:"board_slug"`
		}
		if err := json.Unmarshal(payload, &p); err != nil {
			return err
		}
		if deps.Mail == nil || p.Email == "" || p.RawToken == "" {
			return nil
		}
		confirmURL := strings.TrimRight(deps.WebURL, "/") + "/vote/confirm?t=" + p.RawToken
		mail := email.VoteVerifyMail{
			BadgeURL: store.BadgeURLForTicket(ctx, p.TicketID, deps.WebURL, "email"),
			To:           p.Email,
			ProjectName:  p.ProjectName,
			IdeaTitle:    p.IdeaTitle,
			ConfirmURL:   confirmURL,
			GreetingName: email.GreetingFromEmail(p.Email),
		}
		subject := email.VoteVerifySubject(mail.ProjectName)
		html := email.RenderVoteVerifyHTML(mail)
		if err := deps.Mail.Send(p.Email, subject, html); err != nil {
			slog.Error("send vote verify mail", "err", err, "to", p.Email)
		}
		return nil
	case "notify_vote_released":
		var p struct {
			TicketID string `json:"ticket_id"`
		}
		if err := json.Unmarshal(payload, &p); err != nil {
			return err
		}
		if deps.Mail == nil || p.TicketID == "" {
			return nil
		}
		data, err := store.VoteReleasedNotifyData(ctx, p.TicketID)
		if err != nil {
			return err
		}
		if len(data.Emails) == 0 || data.BoardSlug == "" {
			return nil
		}
		base := strings.TrimRight(deps.WebURL, "/")
		openURL := base + "/board/" + data.BoardSlug + "/ideas/" + data.TicketID
		boardHost := ""
		if u := strings.TrimPrefix(strings.TrimPrefix(base, "https://"), "http://"); u != "" {
			boardHost = u + "/board/" + data.BoardSlug
		}
		note := strings.TrimSpace(data.ReleaseNote)
		if note == "" {
			note = "It's live now."
		}
		subject := email.VoteReleasedSubject()
		for _, to := range data.Emails {
			mail := email.VoteReleasedMail{
				BadgeURL: store.BadgeURLForTicket(ctx, data.TicketID, deps.WebURL, "email"),
				To:           to,
				ProjectName:  data.ProjectName,
				IdeaTitle:    data.IdeaTitle,
				ReleaseNote:  note,
				VoteCount:    data.VoteCount,
				ReportCount:  data.ReportCount,
				BoardHost:    boardHost,
				OpenURL:      openURL,
				GreetingName: email.GreetingFromEmail(to),
			}
			html := email.RenderVoteReleasedHTML(mail)
			if err := deps.Mail.Send(to, subject, html); err != nil {
				slog.Error("send vote released mail", "err", err, "to", to)
			}
		}
		return nil
	case "notify_comment_verify":
		var p struct {
			TicketID    string `json:"ticket_id"`
			Email       string `json:"email"`
			RawToken    string `json:"raw_token"`
			ProjectName string `json:"project_name"`
			IdeaTitle   string `json:"idea_title"`
			BoardSlug   string `json:"board_slug"`
		}
		if err := json.Unmarshal(payload, &p); err != nil {
			return err
		}
		if deps.Mail == nil || p.Email == "" || p.RawToken == "" {
			return nil
		}
		confirmURL := strings.TrimRight(deps.WebURL, "/") + "/comment/confirm?t=" + p.RawToken
		mail := email.CommentVerifyMail{
			BadgeURL: store.BadgeURLForTicket(ctx, p.TicketID, deps.WebURL, "email"),
			To:           p.Email,
			ProjectName:  p.ProjectName,
			IdeaTitle:    p.IdeaTitle,
			ConfirmURL:   confirmURL,
			GreetingName: email.GreetingFromEmail(p.Email),
		}
		subject := email.CommentVerifySubject(mail.ProjectName)
		html := email.RenderCommentVerifyHTML(mail)
		if err := deps.Mail.Send(p.Email, subject, html); err != nil {
			slog.Error("send comment verify mail", "err", err, "to", p.Email)
		}
		return nil
	case "notify_suggest_verify":
		var p struct {
			Email       string `json:"email"`
			RawToken    string `json:"raw_token"`
			ProjectName string `json:"project_name"`
			IdeaTitle   string `json:"idea_title"`
			BoardSlug   string `json:"board_slug"`
		}
		if err := json.Unmarshal(payload, &p); err != nil {
			return err
		}
		if deps.Mail == nil || p.Email == "" || p.RawToken == "" {
			return nil
		}
		confirmURL := strings.TrimRight(deps.WebURL, "/") + "/suggest/confirm?t=" + p.RawToken
		mail := email.SuggestVerifyMail{
			BadgeURL:     store.BadgeURLForBoard(ctx, p.BoardSlug, deps.WebURL, "email"),
			To:           p.Email,
			ProjectName:  p.ProjectName,
			IdeaTitle:    p.IdeaTitle,
			ConfirmURL:   confirmURL,
			GreetingName: email.GreetingFromEmail(p.Email),
		}
		subject := email.SuggestVerifySubject(mail.ProjectName)
		html := email.RenderSuggestVerifyHTML(mail)
		if err := deps.Mail.Send(p.Email, subject, html); err != nil {
			slog.Error("send suggest verify mail", "err", err, "to", p.Email)
		}
		return nil
	case "autopr_run":
		var p struct {
			RunID string `json:"run_id"`
		}
		if err := json.Unmarshal(payload, &p); err != nil {
			return err
		}
		return ProcessAutoprRun(ctx, store, deps.Autopr, deps.WebURL, p.RunID)
	default:
		return fmt.Errorf("unknown job %s", kind)
	}
}

func notifySlack(ctx context.Context, store *Store, deps WorkerDeps, ticketID, event, from, to, note string) error {
	if deps.Slack == nil {
		return nil
	}
	if event == "" {
		event = "new_report"
	}
	ticket, err := store.GetTicket(ctx, ticketID)
	if err != nil {
		if err == ErrNotFound || err == ErrPlanRequired || err == ErrQuotaLocked {
			return nil
		}
		return err
	}
	// A downgrade below Indie pauses Slack; the connection stays for the next upgrade.
	if ok, err := store.SlackAllowedForProject(ctx, ticket.ProjectID); err != nil || !ok {
		return err
	}
	webhookURL, err := store.SlackWebhookURL(ctx, ticket.ProjectID)
	if err != nil {
		return err
	}
	if webhookURL == "" {
		return nil
	}
	project, err := store.ProjectByID(ctx, ticket.ProjectID)
	if err != nil {
		if err == ErrNotFound {
			return nil
		}
		return err
	}
	ticketURL := ""
	if base := strings.TrimRight(deps.WebURL, "/"); base != "" {
		ticketURL = base + "/app/tickets/" + ticket.ID
	}
	var body map[string]any
	if event == "status_changed" {
		body = slack.NewStatusPayload(project.Name, ticket.Title, from, to, note, ticketURL)
	} else {
		body = slack.NewReportPayload(project.Name, ticket.Type, ticket.Title, ticketURL)
	}
	return deps.Slack.PostWebhook(ctx, webhookURL, body)
}

func notifyOutboundWebhook(ctx context.Context, store *Store, deps WorkerDeps, ticketID, event, from, to, note string) error {
	if deps.Webhook == nil {
		return nil
	}
	if event == "" {
		event = "ticket.created"
	}
	ticket, err := store.GetTicket(ctx, ticketID)
	if err != nil {
		if err == ErrNotFound || err == ErrPlanRequired || err == ErrQuotaLocked {
			return nil
		}
		return err
	}
	url, secret, err := store.OutboundWebhookConfig(ctx, ticket.ProjectID)
	if err != nil {
		return err
	}
	if url == "" || secret == "" {
		return nil
	}
	ticketURL := ""
	if base := strings.TrimRight(deps.WebURL, "/"); base != "" {
		ticketURL = base + "/app/tickets/" + ticket.ID
	}
	body := map[string]any{
		"event":      event,
		"ticket_id":  ticket.ID,
		"project_id": ticket.ProjectID,
		"type":       ticket.Type,
		"title":      ticket.Title,
		"status":     ticket.Status,
		"url":        ticketURL,
	}
	if from != "" {
		body["from"] = from
	}
	if to != "" {
		body["to"] = to
	}
	if strings.TrimSpace(note) != "" {
		body["note"] = strings.TrimSpace(note)
	}
	return deps.Webhook.PostSigned(ctx, url, secret, body)
}
