package httpapi

import (
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/closeloop/api/internal/application"
	"github.com/closeloop/api/internal/infrastructure/auth"
	"github.com/closeloop/api/internal/infrastructure/githubapp"
	"github.com/gin-gonic/gin"
)

func (s *Server) githubAppClient() (*githubapp.Client, error) {
	pemBytes, err := githubapp.LoadPrivateKey([]byte(s.Cfg.GitHubAppPrivateKey), s.Cfg.GitHubAppPrivateKeyPath)
	if err != nil {
		return nil, err
	}
	return githubapp.New(githubapp.Config{
		AppID:         s.Cfg.GitHubAppID,
		Slug:          s.Cfg.GitHubAppSlug,
		WebhookSecret: s.Cfg.GitHubAppWebhookSecret,
		PrivateKeyPEM: pemBytes,
	})
}

func (s *Server) githubInstall(c *gin.Context) {
	projectID := strings.TrimSpace(c.Query("project_id"))
	if projectID == "" {
		writeErr(c, 400, "INVALID_INPUT", "project_id required")
		return
	}
	if !s.requireProjectAccess(c, projectID) {
		return
	}
	client, err := s.githubAppClient()
	if err != nil {
		writeErr(c, 503, "NOT_CONFIGURED", "GitHub App is not configured on server")
		return
	}
	state, err := auth.RandomToken(16)
	if err != nil {
		writeErr(c, 500, "INTERNAL", "failed to create state")
		return
	}
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "github_install_state",
		Value:    state + ":" + projectID,
		Path:     "/",
		MaxAge:   600,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
	url := client.InstallURL(state + ":" + projectID)
	// SPA calls with Bearer and then navigates; browser redirect cannot send Authorization.
	if c.Query("browser") == "1" {
		c.Redirect(http.StatusFound, url)
		return
	}
	c.JSON(200, gin.H{"url": url, "state": state + ":" + projectID})
}

func (s *Server) githubSetupCallback(c *gin.Context) {
	// Browser has no Bearer token on GitHub redirect — hand off to the SPA to finish PUT.
	q := c.Request.URL.RawQuery
	redirect := strings.TrimRight(s.Cfg.WebURL, "/") + "/app/settings/integrations"
	if q != "" {
		redirect += "?" + q
	}
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "github_install_state",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
	})
	c.Redirect(http.StatusFound, redirect)
}

func (s *Server) completeGitHubApp(c *gin.Context) {
	projectID := c.Param("id")
	if !s.requireProjectAccess(c, projectID) {
		return
	}
	var body struct {
		InstallationID int64  `json:"installation_id"`
		RepoFullName   string `json:"repo_full_name"`
		DefaultBranch  string `json:"default_branch"`
		AccountLogin   string `json:"account_login"`
	}
	if err := c.BindJSON(&body); err != nil || body.InstallationID == 0 {
		writeErr(c, 400, "INVALID_INPUT", "installation_id required")
		return
	}
	account := strings.TrimSpace(body.AccountLogin)
	repo := strings.TrimSpace(body.RepoFullName)
	branch := strings.TrimSpace(body.DefaultBranch)
	if branch == "" {
		branch = "main"
	}
	if repo == "" {
		if client, err := s.githubAppClient(); err == nil {
			if repos, err := client.ListInstallationRepos(c.Request.Context(), body.InstallationID); err == nil && len(repos) > 0 {
				repo = repos[0].FullName
				if repos[0].DefaultBranch != "" {
					branch = repos[0].DefaultBranch
				}
			}
		}
	}
	if account == "" && repo != "" {
		if i := strings.IndexByte(repo, '/'); i > 0 {
			account = repo[:i]
		}
	}
	item, err := s.Store.UpsertIntegration(c.Request.Context(), projectID, "github_app", map[string]any{
		"installation_id": body.InstallationID,
		"account_login":   account,
		"repo_full_name":  repo,
		"default_branch":  branch,
	})
	if err != nil {
		mapErr(c, err)
		return
	}
	c.JSON(200, gin.H{"integration": item})
}

func (s *Server) listGitHubRepos(c *gin.Context) {
	projectID := c.Param("id")
	if !s.requireProjectAccess(c, projectID) {
		return
	}
	installationID, _ := strconv.ParseInt(c.Query("installation_id"), 10, 64)
	var selected application.GitHubAppConfig
	if raw, err := s.Store.GetIntegrationConfig(c.Request.Context(), projectID, "github_app"); err == nil {
		if cfg, err := application.ParseGitHubAppConfig(raw); err == nil {
			selected = cfg
			if installationID == 0 {
				installationID = cfg.InstallationID
			}
		}
	}
	if installationID == 0 {
		writeErr(c, 400, "INVALID_INPUT", "installation_id required")
		return
	}
	client, err := s.githubAppClient()
	if err != nil {
		writeErr(c, 503, "NOT_CONFIGURED", "GitHub App is not configured on server")
		return
	}
	repos, err := client.ListInstallationRepos(c.Request.Context(), installationID)
	if err != nil {
		writeErr(c, 502, "UPSTREAM_ERROR", err.Error())
		return
	}
	c.JSON(200, gin.H{"repos": repos, "selected": selected})
}

func (s *Server) githubWebhook(c *gin.Context) {
	body, err := io.ReadAll(io.LimitReader(c.Request.Body, 2<<20))
	if err != nil {
		writeErr(c, 400, "INVALID_INPUT", "bad body")
		return
	}
	sig := c.GetHeader("X-Hub-Signature-256")
	if !githubapp.VerifySignature(s.Cfg.GitHubAppWebhookSecret, body, sig) {
		writeErr(c, 401, "UNAUTHORIZED", "invalid signature")
		return
	}

	event := c.GetHeader("X-GitHub-Event")
	switch event {
	case "installation", "installation_repositories":
		s.handleGitHubInstallationEvent(c, body)
	case "pull_request":
		s.handleGitHubPullRequestEvent(c, body)
	default:
		c.JSON(200, gin.H{"ok": true})
	}
}

func (s *Server) handleGitHubInstallationEvent(c *gin.Context, body []byte) {
	installationID, account, err := githubapp.ParseInstallationID(body)
	if err != nil || installationID == 0 {
		c.JSON(200, gin.H{"ok": true})
		return
	}
	var payload struct {
		Action            string `json:"action"`
		Repositories      []struct {
			FullName      string `json:"full_name"`
			DefaultBranch string `json:"default_branch"`
		} `json:"repositories"`
		RepositoriesAdded []struct {
			FullName      string `json:"full_name"`
			DefaultBranch string `json:"default_branch"`
		} `json:"repositories_added"`
	}
	_ = json.Unmarshal(body, &payload)

	projectID, err := s.Store.ProjectIDForInstallation(c.Request.Context(), installationID)
	if err != nil {
		// Not linked yet — setup callback will create the row.
		c.JSON(200, gin.H{"ok": true})
		return
	}
	if payload.Action == "deleted" || payload.Action == "suspend" {
		_ = s.Store.DeleteIntegration(c.Request.Context(), projectID, "github_app")
		c.JSON(200, gin.H{"ok": true})
		return
	}

	repo := ""
	branch := "main"
	if len(payload.RepositoriesAdded) > 0 {
		repo = payload.RepositoriesAdded[0].FullName
		if payload.RepositoriesAdded[0].DefaultBranch != "" {
			branch = payload.RepositoriesAdded[0].DefaultBranch
		}
	} else if len(payload.Repositories) > 0 {
		repo = payload.Repositories[0].FullName
		if payload.Repositories[0].DefaultBranch != "" {
			branch = payload.Repositories[0].DefaultBranch
		}
	} else if raw, err := s.Store.GetIntegrationConfig(c.Request.Context(), projectID, "github_app"); err == nil {
		if cfg, err := application.ParseGitHubAppConfig(raw); err == nil {
			repo = cfg.RepoFullName
			branch = cfg.DefaultBranch
		}
	}
	_, _ = s.Store.UpsertIntegration(c.Request.Context(), projectID, "github_app", map[string]any{
		"installation_id": installationID,
		"account_login":   account,
		"repo_full_name":  repo,
		"default_branch":  branch,
	})
	c.JSON(200, gin.H{"ok": true})
}

func (s *Server) handleGitHubPullRequestEvent(c *gin.Context, body []byte) {
	var payload struct {
		Action      string `json:"action"`
		PullRequest struct {
			Number int    `json:"number"`
			Merged bool   `json:"merged"`
			HTMLURL string `json:"html_url"`
		} `json:"pull_request"`
		Repository struct {
			FullName string `json:"full_name"`
		} `json:"repository"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		c.JSON(200, gin.H{"ok": true})
		return
	}
	if payload.Action != "closed" || !payload.PullRequest.Merged {
		c.JSON(200, gin.H{"ok": true})
		return
	}
	run, err := s.Store.FindAutoprRunByPR(c.Request.Context(), payload.Repository.FullName, payload.PullRequest.Number)
	if err != nil {
		c.JSON(200, gin.H{"ok": true})
		return
	}
	run.Status = "succeeded"
	if run.PRURL == "" {
		run.PRURL = payload.PullRequest.HTMLURL
	}
	_ = s.Store.UpdateAutoprRun(c.Request.Context(), run)

	ticket, err := s.Store.GetTicket(c.Request.Context(), run.TicketID)
	if err == nil && ticket.Status != "fixed" {
		note := "Auto PR merged: " + payload.PullRequest.HTMLURL
		_ = s.Store.UpdateTicketStatus(c.Request.Context(), ticket.ID, "fixed", "github", note)
		_ = s.Store.EnqueueNotify(c.Request.Context(), ticket.ID, application.DefaultNotifyChannels())
	}
	c.JSON(200, gin.H{"ok": true})
}

func (s *Server) listAutoprRuns(c *gin.Context) {
	projectID := c.Param("id")
	if !s.requireProjectAccess(c, projectID) {
		return
	}
	runs, err := s.Store.ListAutoprRuns(c.Request.Context(), projectID, 50)
	if err != nil {
		mapErr(c, err)
		return
	}
	if runs == nil {
		runs = []application.AutoprRun{}
	}
	c.JSON(200, gin.H{"runs": runs})
}

func (s *Server) startAutoprRun(c *gin.Context) {
	ticketID := c.Param("id")
	ticket, err := s.Store.GetTicket(c.Request.Context(), ticketID)
	if err != nil {
		mapErr(c, err)
		return
	}
	role, ok := s.requireProjectAccessRole(c, ticket.ProjectID)
	if !ok {
		return
	}
	run, err := s.Store.StartAutoprRun(c.Request.Context(), ticket.ProjectID, ticketID, role)
	if err != nil {
		mapErr(c, err)
		return
	}
	if org, _, err := s.Store.PrimaryOrg(c.Request.Context(), c.GetString("userID")); err == nil {
		s.writeAudit(c, org.ID, "", "autopr.started", ticketID, map[string]any{
			"run_id": run.ID, "project_id": ticket.ProjectID,
		})
	}
	c.JSON(201, gin.H{"run": run})
}

func (s *Server) listTicketAutoprRuns(c *gin.Context) {
	ticketID := c.Param("id")
	ticket, err := s.Store.GetTicket(c.Request.Context(), ticketID)
	if err != nil {
		mapErr(c, err)
		return
	}
	if !s.requireProjectAccess(c, ticket.ProjectID) {
		return
	}
	runs, err := s.Store.ListAutoprRunsForTicket(c.Request.Context(), ticketID, 10)
	if err != nil {
		mapErr(c, err)
		return
	}
	if runs == nil {
		runs = []application.AutoprRun{}
	}
	c.JSON(200, gin.H{"runs": runs})
}

func (s *Server) listOrgCredits(c *gin.Context) {
	org, _, ok := s.orgRole(c)
	if !ok {
		return
	}
	credits, err := s.Store.OrgAutoPRCredits(c.Request.Context(), org.ID)
	if err != nil {
		mapErr(c, err)
		return
	}
	ledger, err := s.Store.ListCreditLedger(c.Request.Context(), org.ID, 20)
	if err != nil {
		mapErr(c, err)
		return
	}
	if ledger == nil {
		ledger = []application.CreditLedgerEntry{}
	}
	c.JSON(200, gin.H{"credits": credits, "ledger": ledger})
}

func (s *Server) requireProjectAccessRole(c *gin.Context, projectID string) (string, bool) {
	if !s.requireProjectAccess(c, projectID) {
		return "", false
	}
	role, err := s.Store.RoleForProject(c.Request.Context(), c.GetString("userID"), projectID)
	if err != nil {
		mapErr(c, err)
		return "", false
	}
	return role, true
}
