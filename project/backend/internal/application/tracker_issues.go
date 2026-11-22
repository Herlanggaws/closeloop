package application

import (
	"context"
	"encoding/json"
	"fmt"
	"slices"
	"strings"
)

const (
	LinearIssueCreatedKind = "linear_issue_created"
	JiraIssueCreatedKind   = "jira_issue_created"
)

type TrackerIssue struct {
	ID       string `json:"id"`
	Key      string `json:"key"`
	URL      string `json:"url"`
	Provider string `json:"provider"`
}

type TrackerIssueResult struct {
	Issue    TrackerIssue `json:"issue"`
	Existing bool         `json:"existing"`
}

type LinearIssueCreator interface {
	CreateLinearIssue(ctx context.Context, apiKey, teamID, title, body string) (TrackerIssue, error)
}

type JiraIssueCreator interface {
	CreateJiraIssue(ctx context.Context, email, apiToken, site, projectKey, title, body string) (TrackerIssue, error)
}

func (s *Store) ExistingTrackerIssue(ctx context.Context, ticketID, kind string) (TrackerIssue, bool, error) {
	events, err := s.ListTicketEvents(ctx, ticketID)
	if err != nil {
		return TrackerIssue{}, false, err
	}
	for _, ev := range slices.Backward(events) {
		if ev.Kind != kind {
			continue
		}
		var payload struct {
			ID  string `json:"id"`
			Key string `json:"key"`
			URL string `json:"url"`
		}
		if err := json.Unmarshal(ev.Payload, &payload); err != nil {
			continue
		}
		if payload.URL == "" {
			continue
		}
		provider := "linear"
		if kind == JiraIssueCreatedKind {
			provider = "jira"
		}
		return TrackerIssue{ID: payload.ID, Key: payload.Key, URL: payload.URL, Provider: provider}, true, nil
	}
	return TrackerIssue{}, false, nil
}

func (s *Store) CreateLinearIssueForTicket(
	ctx context.Context,
	ticketID, webURL string,
	creator LinearIssueCreator,
) (TrackerIssueResult, error) {
	if creator == nil {
		return TrackerIssueResult{}, fmt.Errorf("%w: Linear creator not configured", ErrInvalidInput)
	}
	ticket, err := s.GetTicket(ctx, ticketID)
	if err != nil {
		return TrackerIssueResult{}, err
	}
	if existing, ok, err := s.ExistingTrackerIssue(ctx, ticketID, LinearIssueCreatedKind); err != nil {
		return TrackerIssueResult{}, err
	} else if ok {
		return TrackerIssueResult{Issue: existing, Existing: true}, nil
	}

	raw, err := s.GetIntegrationConfig(ctx, ticket.ProjectID, "linear")
	if err != nil {
		return TrackerIssueResult{}, fmt.Errorf("%w: connect Linear first", ErrInvalidInput)
	}
	var cfg struct {
		APIKey string `json:"api_key"`
		TeamID string `json:"team_id"`
	}
	if err := json.Unmarshal(raw, &cfg); err != nil || strings.TrimSpace(cfg.APIKey) == "" || strings.TrimSpace(cfg.TeamID) == "" {
		return TrackerIssueResult{}, fmt.Errorf("%w: Linear api_key and team_id required", ErrInvalidInput)
	}

	title, body := s.issueCopy(ctx, ticket, webURL)
	issue, err := creator.CreateLinearIssue(ctx, cfg.APIKey, cfg.TeamID, title, body)
	if err != nil {
		return TrackerIssueResult{}, err
	}
	issue.Provider = "linear"
	if _, err := s.DB.ExecContext(ctx, `
		INSERT INTO ticket_events(ticket_id, actor, kind, payload)
		VALUES ($1,'user',$2,$3)`,
		ticketID, LinearIssueCreatedKind, mustJSON(map[string]any{
			"id": issue.ID, "key": issue.Key, "url": issue.URL,
		})); err != nil {
		return TrackerIssueResult{}, err
	}
	return TrackerIssueResult{Issue: issue}, nil
}

func (s *Store) CreateJiraIssueForTicket(
	ctx context.Context,
	ticketID, webURL string,
	creator JiraIssueCreator,
) (TrackerIssueResult, error) {
	if creator == nil {
		return TrackerIssueResult{}, fmt.Errorf("%w: Jira creator not configured", ErrInvalidInput)
	}
	ticket, err := s.GetTicket(ctx, ticketID)
	if err != nil {
		return TrackerIssueResult{}, err
	}
	if existing, ok, err := s.ExistingTrackerIssue(ctx, ticketID, JiraIssueCreatedKind); err != nil {
		return TrackerIssueResult{}, err
	} else if ok {
		return TrackerIssueResult{Issue: existing, Existing: true}, nil
	}

	raw, err := s.GetIntegrationConfig(ctx, ticket.ProjectID, "jira")
	if err != nil {
		return TrackerIssueResult{}, fmt.Errorf("%w: connect Jira first", ErrInvalidInput)
	}
	var cfg struct {
		Email      string `json:"email"`
		APIToken   string `json:"api_token"`
		Site       string `json:"site"`
		ProjectKey string `json:"project_key"`
	}
	if err := json.Unmarshal(raw, &cfg); err != nil ||
		cfg.Email == "" || cfg.APIToken == "" || cfg.Site == "" || cfg.ProjectKey == "" {
		return TrackerIssueResult{}, fmt.Errorf("%w: Jira email, api_token, site, and project_key required", ErrInvalidInput)
	}

	title, body := s.issueCopy(ctx, ticket, webURL)
	issue, err := creator.CreateJiraIssue(ctx, cfg.Email, cfg.APIToken, cfg.Site, cfg.ProjectKey, title, body)
	if err != nil {
		return TrackerIssueResult{}, err
	}
	issue.Provider = "jira"
	if _, err := s.DB.ExecContext(ctx, `
		INSERT INTO ticket_events(ticket_id, actor, kind, payload)
		VALUES ($1,'user',$2,$3)`,
		ticketID, JiraIssueCreatedKind, mustJSON(map[string]any{
			"id": issue.ID, "key": issue.Key, "url": issue.URL,
		})); err != nil {
		return TrackerIssueResult{}, err
	}
	return TrackerIssueResult{Issue: issue}, nil
}

func (s *Store) issueCopy(ctx context.Context, ticket Ticket, webURL string) (title, body string) {
	title = ticket.Title
	message := ticket.Title
	if reports, err := s.TicketReports(ctx, ticket.ID); err == nil && len(reports) > 0 {
		if msg := strings.TrimSpace(reports[0].Message); msg != "" {
			message = msg
		}
	}
	ticketURL := strings.TrimRight(webURL, "/") + "/app/tickets/" + ticket.ID
	body = fmt.Sprintf("%s\n\n---\nCreated from Saidloop ticket %s (%s).", message, ticket.ID, ticketURL)
	return title, body
}

// FindTicketIDByExternalIssue looks up a ticket that was linked to an external issue id/key.
func (s *Store) FindTicketIDByExternalIssue(ctx context.Context, kind, externalID string) (string, error) {
	externalID = strings.TrimSpace(externalID)
	if externalID == "" {
		return "", ErrNotFound
	}
	var ticketID string
	err := s.DB.QueryRowContext(ctx, `
		SELECT ticket_id FROM ticket_events
		WHERE kind = $1
		  AND (
		    payload->>'id' = $2
		    OR payload->>'key' = $2
		  )
		ORDER BY created_at DESC
		LIMIT 1`, kind, externalID).Scan(&ticketID)
	if err != nil {
		return "", ErrNotFound
	}
	return ticketID, nil
}

// SyncTicketFixedFromExternal marks a ticket fixed when an external tracker closes the linked issue.
func (s *Store) SyncTicketFixedFromExternal(ctx context.Context, ticketID, actor string) error {
	ticket, err := s.GetTicket(ctx, ticketID)
	if err != nil {
		return err
	}
	if ticket.Status == "fixed" {
		return nil
	}
	if err := s.UpdateTicketStatus(ctx, ticketID, "fixed", actor, "Closed in external tracker"); err != nil {
		return err
	}
	_ = s.EnqueueNotify(ctx, ticketID, DefaultNotifyChannels())
	_ = s.EnqueueVoteReleased(ctx, ticketID)
	ev := SlackNotifyEvent{
		TicketID: ticketID,
		Event:    "status_changed",
		From:     ticket.Status,
		To:       "fixed",
		Note:     "Closed in external tracker",
	}
	_ = s.EnqueueSlackNotify(ctx, ticket.ProjectID, ev)
	_ = s.EnqueueOutboundWebhook(ctx, ticket.ProjectID, ev)
	return nil
}
