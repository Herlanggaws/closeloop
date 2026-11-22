package httpapi

import (
	"crypto/subtle"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"strings"

	"github.com/closeloop/api/internal/application"
	"github.com/closeloop/api/internal/infrastructure/gitlab"
	"github.com/gin-gonic/gin"
)

func (s *Server) testGitLabIntegration(c *gin.Context) {
	projectID := c.Param("id")
	if !s.requireProjectAccess(c, projectID) {
		return
	}
	var body struct {
		Token   string `json:"token"`
		BaseURL string `json:"base_url"`
	}
	if err := c.BindJSON(&body); err != nil {
		writeErr(c, 400, "INVALID_INPUT", "bad json")
		return
	}
	token := strings.TrimSpace(body.Token)
	if token == "" {
		writeErr(c, 400, "INVALID_INPUT", "token is required")
		return
	}
	client, err := gitlab.New(gitlab.Config{
		BaseURL: body.BaseURL,
		Token:   token,
	})
	if err != nil {
		writeErr(c, 400, "INVALID_INPUT", err.Error())
		return
	}
	user, err := client.Validate(c.Request.Context())
	if err != nil {
		writeErr(c, 400, "GITLAB_AUTH_FAILED", err.Error())
		return
	}
	c.JSON(200, gin.H{
		"ok":       true,
		"user":     user,
		"username": user.Username,
	})
}

func (s *Server) listGitLabRepos(c *gin.Context) {
	projectID := c.Param("id")
	if !s.requireProjectAccess(c, projectID) {
		return
	}
	raw, err := s.Store.GetIntegrationConfig(c.Request.Context(), projectID, "gitlab")
	if err != nil {
		writeErr(c, 400, "NOT_CONNECTED", "GitLab integration is not configured")
		return
	}
	glCfg, err := application.ParseGitLabConfig(raw)
	if err != nil {
		writeErr(c, 400, "NOT_CONNECTED", err.Error())
		return
	}
	client, err := gitlab.New(gitlab.Config{
		BaseURL: glCfg.BaseURL,
		Token:   glCfg.Token,
	})
	if err != nil {
		writeErr(c, 500, "CLIENT_ERROR", err.Error())
		return
	}
	projects, err := client.ListProjects(c.Request.Context())
	if err != nil {
		writeErr(c, 502, "GITLAB_API_ERROR", err.Error())
		return
	}

	type repoItem struct {
		FullName      string `json:"full_name"`
		DefaultBranch string `json:"default_branch"`
		WebURL        string `json:"web_url"`
	}
	out := make([]repoItem, 0, len(projects))
	for _, p := range projects {
		branch := p.DefaultBranch
		if branch == "" {
			branch = "main"
		}
		out = append(out, repoItem{
			FullName:      p.PathWithNamespace,
			DefaultBranch: branch,
			WebURL:        p.WebURL,
		})
	}
	c.JSON(200, gin.H{"repos": out})
}

func (s *Server) gitlabWebhook(c *gin.Context) {
	headerToken := strings.TrimSpace(c.GetHeader("X-Gitlab-Token"))
	envSecret := strings.TrimSpace(os.Getenv("GITLAB_WEBHOOK_SECRET"))
	if envSecret != "" {
		if subtle.ConstantTimeCompare([]byte(headerToken), []byte(envSecret)) != 1 {
			writeErr(c, http.StatusUnauthorized, "INVALID_SIGNATURE", "invalid gitlab webhook token")
			return
		}
	}

	body, err := io.ReadAll(io.LimitReader(c.Request.Body, 1<<20))
	if err != nil {
		c.Status(http.StatusBadRequest)
		return
	}

	var payload struct {
		ObjectKind string `json:"object_kind"`
		Project    struct {
			ID                int64  `json:"id"`
			PathWithNamespace string `json:"path_with_namespace"`
			WebURL            string `json:"web_url"`
		} `json:"project"`
		ObjectAttributes struct {
			IID    int    `json:"iid"`
			Action string `json:"action"`
			State  string `json:"state"`
			URL    string `json:"url"`
			Title  string `json:"title"`
		} `json:"object_attributes"`
	}

	if err := json.Unmarshal(body, &payload); err != nil {
		c.JSON(200, gin.H{"ok": true})
		return
	}

	if payload.ObjectKind == "merge_request" {
		isMerged := payload.ObjectAttributes.Action == "merge" || payload.ObjectAttributes.State == "merged"
		if isMerged {
			repoPath := payload.Project.PathWithNamespace
			mrNumber := payload.ObjectAttributes.IID
			mrURL := payload.ObjectAttributes.URL

			run, err := s.Store.FindAutoprRunByPR(c.Request.Context(), repoPath, mrNumber)
			if err == nil {
				repo, repoErr := s.Store.ProjectRepoByFullName(c.Request.Context(), run.ProjectID, repoPath)
				if repoErr != nil || repo.Provider != "gitlab" {
					writeErr(c, http.StatusBadRequest, "PROVIDER_MISMATCH", "repository is not configured for GitLab")
					return
				}
				raw, cfgErr := s.Store.GetIntegrationConfig(c.Request.Context(), run.ProjectID, "gitlab")
				if cfgErr != nil {
					writeErr(c, http.StatusUnauthorized, "NOT_CONFIGURED", "gitlab integration is not configured")
					return
				}
				var glMap map[string]any
				if err := json.Unmarshal(raw, &glMap); err != nil {
					writeErr(c, http.StatusUnauthorized, "NOT_CONFIGURED", "invalid gitlab integration config")
					return
				}
				projSecret, _ := glMap["webhook_secret"].(string)
				projSecret = strings.TrimSpace(projSecret)
				if envSecret == "" && projSecret == "" {
					writeErr(c, http.StatusUnauthorized, "WEBHOOK_SECRET_REQUIRED", "gitlab webhook secret is not configured")
					return
				}
				if projSecret != "" && subtle.ConstantTimeCompare([]byte(headerToken), []byte(projSecret)) != 1 {
					writeErr(c, http.StatusUnauthorized, "INVALID_SIGNATURE", "invalid gitlab webhook token")
					return
				}
				if glCfg, pErr := application.ParseGitLabConfig(raw); pErr == nil && glCfg.BaseURL != "" {
					expectedPrefix := strings.TrimRight(glCfg.BaseURL, "/") + "/"
					if (mrURL != "" && !strings.HasPrefix(mrURL, expectedPrefix)) ||
						(payload.Project.WebURL != "" && !strings.HasPrefix(payload.Project.WebURL, expectedPrefix)) {
						writeErr(c, http.StatusBadRequest, "INSTANCE_MISMATCH", "gitlab webhook URL does not match configured GitLab instance")
						return
					}
				}
				run.Status = "succeeded"
				if run.PRURL == "" {
					run.PRURL = mrURL
				}
				_ = s.Store.UpdateAutoprRun(c.Request.Context(), run)

				ticket, err := s.Store.GetTicket(c.Request.Context(), run.TicketID)
				if err == nil && ticket.Status != "fixed" {
					note := "GitLab MR merged: " + mrURL
					_ = s.Store.UpdateTicketStatus(c.Request.Context(), ticket.ID, "fixed", "gitlab", note)
					_ = s.Store.EnqueueNotify(c.Request.Context(), ticket.ID, application.DefaultNotifyChannels())
				}
			}
		}
	}

	c.JSON(200, gin.H{"ok": true})
}
