package httpapi

import (
	"context"
	"errors"

	"github.com/closeloop/api/internal/application"
	"github.com/closeloop/api/internal/infrastructure/githubapp"
	"github.com/gin-gonic/gin"
)

type githubIssueCreatorAdapter struct {
	client *githubapp.Client
}

func (a githubIssueCreatorAdapter) CreateIssue(
	ctx context.Context,
	installationID int64,
	owner, repo, title, body string,
) (application.ExternalIssue, error) {
	out, err := a.client.CreateIssue(ctx, githubapp.CreateIssueInput{
		InstallationID: installationID,
		Owner:          owner,
		Repo:           repo,
		Title:          title,
		Body:           body,
	})
	if err != nil {
		return application.ExternalIssue{}, err
	}
	return application.ExternalIssue{
		Number:  out.Number,
		HTMLURL: out.HTMLURL,
	}, nil
}

func (s *Server) createGitHubIssue(c *gin.Context) {
	ticketID := c.Param("id")
	t, err := s.Store.GetTicket(c.Request.Context(), ticketID)
	if err != nil {
		mapErr(c, err)
		return
	}
	if !s.requireProjectAccess(c, t.ProjectID) {
		return
	}
	if err := s.Store.RequireIntegrationUse(c.Request.Context(), t.ProjectID, "github_issues", "github_app"); err != nil {
		s.mapErr(c, err)
		return
	}

	var creator application.GitHubIssueCreator
	if s.GitHubIssueCreator != nil {
		creator = s.GitHubIssueCreator
	} else {
		client, err := s.githubAppClient()
		if err != nil {
			writeErr(c, 503, "NOT_CONFIGURED", "GitHub App is not configured on server")
			return
		}
		creator = githubIssueCreatorAdapter{client: client}
	}

	result, err := s.Store.CreateGitHubIssueForTicket(c.Request.Context(), ticketID, s.Cfg.WebURL, creator)
	if err != nil {
		if errors.Is(err, application.ErrInvalidInput) || errors.Is(err, application.ErrNotFound) {
			mapErr(c, err)
			return
		}
		writeErr(c, 502, "UPSTREAM_ERROR", err.Error())
		return
	}
	status := 201
	if result.Existing {
		status = 200
	}
	c.JSON(status, gin.H{"issue": result.Issue, "existing": result.Existing})
}
