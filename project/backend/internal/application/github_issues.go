package application

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
)

const githubIssueCreatedKind = "github_issue_created"

type ExternalIssue struct {
	Number  int    `json:"number"`
	HTMLURL string `json:"html_url"`
	Repo    string `json:"repo"`
}

type GitHubIssueCreator interface {
	CreateIssue(ctx context.Context, installationID int64, owner, repo, title, body string) (ExternalIssue, error)
}

type GitHubIssueResult struct {
	Issue    ExternalIssue `json:"issue"`
	Existing bool          `json:"existing"`
}

func (s *Store) ExistingGitHubIssue(ctx context.Context, ticketID string) (ExternalIssue, bool, error) {
	events, err := s.ListTicketEvents(ctx, ticketID)
	if err != nil {
		return ExternalIssue{}, false, err
	}
	for i := len(events) - 1; i >= 0; i-- {
		if events[i].Kind != githubIssueCreatedKind {
			continue
		}
		var payload struct {
			Number  int    `json:"number"`
			HTMLURL string `json:"html_url"`
			Repo    string `json:"repo"`
		}
		if err := json.Unmarshal(events[i].Payload, &payload); err != nil {
			continue
		}
		if payload.HTMLURL == "" || payload.Number == 0 {
			continue
		}
		return ExternalIssue{
			Number:  payload.Number,
			HTMLURL: payload.HTMLURL,
			Repo:    payload.Repo,
		}, true, nil
	}
	return ExternalIssue{}, false, nil
}

func (s *Store) CreateGitHubIssueForTicket(
	ctx context.Context,
	ticketID, webURL string,
	creator GitHubIssueCreator,
) (GitHubIssueResult, error) {
	if creator == nil {
		return GitHubIssueResult{}, fmt.Errorf("%w: GitHub Issues creator not configured", ErrInvalidInput)
	}
	ticket, err := s.GetTicket(ctx, ticketID)
	if err != nil {
		return GitHubIssueResult{}, err
	}
	if existing, ok, err := s.ExistingGitHubIssue(ctx, ticketID); err != nil {
		return GitHubIssueResult{}, err
	} else if ok {
		return GitHubIssueResult{Issue: existing, Existing: true}, nil
	}

	raw, err := s.GetIntegrationConfig(ctx, ticket.ProjectID, "github_app")
	if err != nil {
		return GitHubIssueResult{}, fmt.Errorf("%w: connect GitHub App first", ErrInvalidInput)
	}
	ghCfg, err := ParseGitHubAppConfig(raw)
	if err != nil || ghCfg.InstallationID == 0 || strings.TrimSpace(ghCfg.RepoFullName) == "" {
		return GitHubIssueResult{}, fmt.Errorf("%w: select a repository for GitHub App", ErrInvalidInput)
	}
	parts := strings.SplitN(ghCfg.RepoFullName, "/", 2)
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return GitHubIssueResult{}, fmt.Errorf("%w: invalid GitHub App repository", ErrInvalidInput)
	}
	owner, repo := parts[0], parts[1]

	message := ticket.Title
	if reports, err := s.TicketReports(ctx, ticketID); err == nil && len(reports) > 0 {
		if msg := strings.TrimSpace(reports[0].Message); msg != "" {
			message = msg
		}
	}
	ticketURL := strings.TrimRight(webURL, "/") + "/app/tickets/" + ticket.ID
	body := fmt.Sprintf(`## %s

%s

---
Created from Saidloop ticket [%s](%s).
`, ticket.Title, message, ticket.ID, ticketURL)

	issue, err := creator.CreateIssue(ctx, ghCfg.InstallationID, owner, repo, ticket.Title, body)
	if err != nil {
		return GitHubIssueResult{}, err
	}
	issue.Repo = ghCfg.RepoFullName

	if _, err := s.DB.ExecContext(ctx, `
		INSERT INTO ticket_events(ticket_id, actor, kind, payload)
		VALUES ($1,'user',$2,$3)`,
		ticketID, githubIssueCreatedKind, mustJSON(map[string]any{
			"number":   issue.Number,
			"html_url": issue.HTMLURL,
			"repo":     issue.Repo,
		})); err != nil {
		return GitHubIssueResult{}, err
	}
	return GitHubIssueResult{Issue: issue, Existing: false}, nil
}
