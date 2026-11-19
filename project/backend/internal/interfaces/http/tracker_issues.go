package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"strings"

	"github.com/closeloop/api/internal/application"
	"github.com/closeloop/api/internal/infrastructure/jira"
	"github.com/closeloop/api/internal/infrastructure/linear"
	"github.com/gin-gonic/gin"
)

type linearCreatorAdapter struct {
	client *linear.Client
}

func (a linearCreatorAdapter) CreateLinearIssue(
	ctx context.Context, apiKey, teamID, title, body string,
) (application.TrackerIssue, error) {
	out, err := a.client.CreateIssue(ctx, linear.CreateIssueInput{
		APIKey: apiKey, TeamID: teamID, Title: title, Body: body,
	})
	if err != nil {
		return application.TrackerIssue{}, err
	}
	return application.TrackerIssue{ID: out.ID, Key: out.Identifier, URL: out.URL, Provider: "linear"}, nil
}

type jiraCreatorAdapter struct {
	client *jira.Client
}

func (a jiraCreatorAdapter) CreateJiraIssue(
	ctx context.Context, email, apiToken, site, projectKey, title, body string,
) (application.TrackerIssue, error) {
	out, err := a.client.CreateIssue(ctx, jira.CreateIssueInput{
		Email: email, APIToken: apiToken, Site: site, ProjectKey: projectKey, Title: title, Body: body,
	})
	if err != nil {
		return application.TrackerIssue{}, err
	}
	return application.TrackerIssue{ID: out.ID, Key: out.Key, URL: out.URL, Provider: "jira"}, nil
}

func (s *Server) createLinearIssue(c *gin.Context) {
	s.createTrackerIssue(c, "linear")
}

func (s *Server) createJiraIssue(c *gin.Context) {
	s.createTrackerIssue(c, "jira")
}

func (s *Server) createTrackerIssue(c *gin.Context, provider string) {
	ticketID := c.Param("id")
	t, err := s.Store.GetTicket(c.Request.Context(), ticketID)
	if err != nil {
		mapErr(c, err)
		return
	}
	if !s.requireTicketWrite(c, t.ProjectID) {
		return
	}
	if err := s.Store.RequireIntegrationUse(c.Request.Context(), t.ProjectID, provider, provider); err != nil {
		s.mapErr(c, err)
		return
	}

	var result application.TrackerIssueResult
	switch provider {
	case "linear":
		result, err = s.Store.CreateLinearIssueForTicket(
			c.Request.Context(), ticketID, s.Cfg.WebURL, linearCreatorAdapter{client: linear.NewClient()},
		)
	case "jira":
		result, err = s.Store.CreateJiraIssueForTicket(
			c.Request.Context(), ticketID, s.Cfg.WebURL, jiraCreatorAdapter{client: jira.NewClient()},
		)
	default:
		writeErr(c, 400, "INVALID_INPUT", "unknown provider")
		return
	}
	if err != nil {
		if errors.Is(err, application.ErrInvalidInput) || errors.Is(err, application.ErrNotFound) {
			mapErr(c, err)
			return
		}
		writeErr(c, 502, "UPSTREAM_ERROR", err.Error())
		return
	}
	if org, _, err := s.Store.PrimaryOrg(c.Request.Context(), c.GetString("userID")); err == nil {
		s.writeAudit(c, org.ID, "", provider+".issue_created", ticketID, map[string]any{
			"url": result.Issue.URL, "key": result.Issue.Key,
		})
	}
	status := 201
	if result.Existing {
		status = 200
	}
	c.JSON(status, gin.H{"issue": result.Issue, "existing": result.Existing})
}

func (s *Server) linearWebhook(c *gin.Context) {
	raw, err := io.ReadAll(c.Request.Body)
	if err != nil {
		writeErr(c, 400, "INVALID_INPUT", "bad body")
		return
	}
	var payload struct {
		Action string `json:"action"`
		Type   string `json:"type"`
		Data   struct {
			ID    string `json:"id"`
			State struct {
				Type string `json:"type"`
				Name string `json:"name"`
			} `json:"state"`
		} `json:"data"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil {
		writeErr(c, 400, "INVALID_INPUT", "bad json")
		return
	}
	stateType := strings.ToLower(payload.Data.State.Type)
	stateName := strings.ToLower(payload.Data.State.Name)
	closed := stateType == "completed" || stateType == "canceled" ||
		stateName == "done" || stateName == "canceled" || stateName == "cancelled"
	if !closed || payload.Data.ID == "" {
		c.JSON(200, gin.H{"ok": true, "ignored": true})
		return
	}
	ticketID, err := s.Store.FindTicketIDByExternalIssue(c.Request.Context(), application.LinearIssueCreatedKind, payload.Data.ID)
	if err != nil {
		c.JSON(200, gin.H{"ok": true, "ignored": true})
		return
	}
	if err := s.Store.SyncTicketFixedFromExternal(c.Request.Context(), ticketID, "linear"); err != nil {
		mapErr(c, err)
		return
	}
	c.JSON(200, gin.H{"ok": true, "ticket_id": ticketID})
}

func (s *Server) jiraWebhook(c *gin.Context) {
	raw, err := io.ReadAll(c.Request.Body)
	if err != nil {
		writeErr(c, 400, "INVALID_INPUT", "bad body")
		return
	}
	var payload struct {
		WebhookEvent string `json:"webhookEvent"`
		Issue        struct {
			ID  string `json:"id"`
			Key string `json:"key"`
		} `json:"issue"`
		Changelog struct {
			Items []struct {
				Field string `json:"field"`
				ToString string `json:"toString"`
			} `json:"items"`
		} `json:"changelog"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil {
		writeErr(c, 400, "INVALID_INPUT", "bad json")
		return
	}
	closed := false
	for _, item := range payload.Changelog.Items {
		if !strings.EqualFold(item.Field, "status") {
			continue
		}
		to := strings.ToLower(strings.TrimSpace(item.ToString))
		if to == "done" || to == "closed" || to == "resolved" || to == "complete" || to == "completed" {
			closed = true
			break
		}
	}
	if !closed {
		c.JSON(200, gin.H{"ok": true, "ignored": true})
		return
	}
	ext := payload.Issue.Key
	if ext == "" {
		ext = payload.Issue.ID
	}
	ticketID, err := s.Store.FindTicketIDByExternalIssue(c.Request.Context(), application.JiraIssueCreatedKind, ext)
	if err != nil && payload.Issue.ID != "" && payload.Issue.ID != ext {
		ticketID, err = s.Store.FindTicketIDByExternalIssue(c.Request.Context(), application.JiraIssueCreatedKind, payload.Issue.ID)
	}
	if err != nil {
		c.JSON(200, gin.H{"ok": true, "ignored": true})
		return
	}
	if err := s.Store.SyncTicketFixedFromExternal(c.Request.Context(), ticketID, "jira"); err != nil {
		mapErr(c, err)
		return
	}
	c.JSON(200, gin.H{"ok": true, "ticket_id": ticketID})
}
