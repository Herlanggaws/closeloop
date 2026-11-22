package httpapi

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/closeloop/api/internal/application"
	"github.com/closeloop/api/internal/config"
	"github.com/closeloop/api/internal/infrastructure/auth"
	"github.com/closeloop/api/internal/infrastructure/email"
	"github.com/closeloop/api/internal/infrastructure/storage"
	"github.com/gin-gonic/gin"
)

type Server struct {
	Cfg                config.Config
	Store              *application.Store
	Files              *storage.FSStore
	Mailer             application.MailSender
	GitHubIssueCreator application.GitHubIssueCreator
}

func New(cfg config.Config, store *application.Store, files *storage.FSStore, mailer application.MailSender) *Server {
	return &Server{Cfg: cfg, Store: store, Files: files, Mailer: mailer}
}

func (s *Server) Router() *gin.Engine {
	r := gin.Default()
	r.Use(cors(s.Cfg.WebURL))

	r.GET("/healthz", func(c *gin.Context) { c.JSON(200, gin.H{"ok": true}) })

	api := r.Group("/api")
	{
		api.POST("/waitlist", s.joinWaitlist)
		api.POST("/waitlist/resend", s.resendWaitlist)
		api.POST("/auth/register", s.register)
		api.POST("/auth/login", s.login)
		api.GET("/auth/google", s.googleLogin)
		api.GET("/auth/google/callback", s.googleCallback)
		api.GET("/auth/google/config", s.googleConfig)
		api.POST("/auth/google/one-tap", s.googleOneTap)
		api.POST("/auth/refresh", s.refresh)
		api.POST("/auth/logout", s.logout)
		api.GET("/me", s.authRequired(), s.me)
		api.PATCH("/org/plan", s.authRequired(), s.patchOrgPlan)
		api.POST("/billing/checkout", s.authRequired(), s.createBillingCheckout)
		api.POST("/billing/portal", s.authRequired(), s.createBillingPortal)
		api.POST("/webhooks/billing", s.billingWebhook)
		api.GET("/org/audit-logs", s.authRequired(), s.listAuditLogs)
		api.GET("/org/audit-logs/export", s.authRequired(), s.exportAuditLogs)
		api.GET("/org/members", s.authRequired(), s.listOrgMembers)
		api.POST("/org/invites", s.authRequired(), s.createOrgInvites)
		api.POST("/org/invites/:id/resend", s.authRequired(), s.resendOrgInvite)
		api.DELETE("/org/invites/:id", s.authRequired(), s.revokeOrgInvite)
		api.PATCH("/org/members/:userId", s.authRequired(), s.patchOrgMember)
		api.DELETE("/org/members/:userId", s.authRequired(), s.deleteOrgMember)
		api.GET("/invites/:token", s.peekInvite)
		api.POST("/invites/:token/accept", s.authRequired(), s.acceptInvite)
		api.GET("/projects", s.authRequired(), s.listProjects)
		api.POST("/projects", s.authRequired(), s.createProject)
		api.GET("/projects/:id", s.authRequired(), s.getProject)
		api.PATCH("/projects/:id", s.authRequired(), s.patchProject)
		api.DELETE("/projects/:id", s.authRequired(), s.deleteProject)
		api.PATCH("/projects/:id/widget", s.authRequired(), s.patchProjectWidget)
		api.GET("/projects/:id/mcp-tokens", s.authRequired(), s.listMCPTokens)
		api.POST("/projects/:id/mcp-tokens", s.authRequired(), s.createMCPToken)
		api.DELETE("/projects/:id/mcp-tokens/:tokenId", s.authRequired(), s.deleteMCPToken)
		api.GET("/projects/:id/tickets", s.authRequired(), s.listTickets)
		api.GET("/projects/:id/repos", s.authRequired(), s.listProjectRepos)
		api.POST("/projects/:id/repos", s.authRequired(), s.addProjectRepo)
		api.POST("/projects/:id/repos/active", s.authRequired(), s.setActiveProjectRepos)
		api.PATCH("/projects/:id/repos/settings", s.authRequired(), s.patchRepoSettings)
		api.PATCH("/projects/:id/repos/:repoId", s.authRequired(), s.patchProjectRepo)
		api.DELETE("/projects/:id/repos/:repoId", s.authRequired(), s.deleteProjectRepo)
		api.GET("/projects/:id/integrations", s.authRequired(), s.listIntegrations)
		api.PUT("/projects/:id/integrations/:provider", s.authRequired(), s.putIntegration)
		api.DELETE("/projects/:id/integrations/:provider", s.authRequired(), s.deleteIntegration)
		api.GET("/integrations/slack/config", s.slackConfig)
		api.GET("/integrations/slack/install", s.authRequired(), s.slackInstall)
		api.GET("/integrations/slack/callback", s.slackCallback)
		api.POST("/projects/:id/integrations/slack/complete", s.authRequired(), s.completeSlack)
		api.GET("/integrations/github/install", s.authRequired(), s.githubInstall)
		api.GET("/integrations/github/callback", s.githubSetupCallback)
		api.POST("/projects/:id/integrations/github_app/complete", s.authRequired(), s.completeGitHubApp)
		api.GET("/projects/:id/integrations/github_app/repos", s.authRequired(), s.listGitHubRepos)
		api.POST("/projects/:id/integrations/gitlab/test", s.authRequired(), s.testGitLabIntegration)
		api.GET("/projects/:id/integrations/gitlab/repos", s.authRequired(), s.listGitLabRepos)
		api.GET("/projects/:id/autopr/runs", s.authRequired(), s.listAutoprRuns)
		api.GET("/org/credits", s.authRequired(), s.listOrgCredits)
		api.GET("/tickets/:id", s.authRequired(), s.getTicket)
		api.PATCH("/tickets/:id", s.authRequired(), s.patchTicket)
		api.POST("/tickets/:id/notes", s.authRequired(), s.addNote)
		api.POST("/tickets/:id/autopr", s.authRequired(), s.startAutoprRun)
		api.GET("/tickets/:id/autopr", s.authRequired(), s.listTicketAutoprRuns)
		api.POST("/tickets/:id/github-issue", s.authRequired(), s.createGitHubIssue)
		api.POST("/tickets/:id/linear-issue", s.authRequired(), s.createLinearIssue)
		api.POST("/tickets/:id/jira-issue", s.authRequired(), s.createJiraIssue)
		api.POST("/tickets/:id/comments", s.authRequired(), s.createTeamComment)
		api.POST("/tickets/merge", s.authRequired(), s.mergeTickets)
		api.GET("/projects/:id/board-comments", s.authRequired(), s.listBoardComments)
		api.PATCH("/comments/:id", s.authRequired(), s.patchComment)

		api.GET("/public/boards/:slug", s.getPublicBoard)
		api.GET("/public/boards/:slug/ideas/:id", s.getPublicIdea)
		api.GET("/public/boards/:slug/ideas/:id/comments", s.listPublicComments)
		api.POST("/public/boards/:slug/ideas/:id/comments", s.requestPublicComment)
		api.POST("/public/boards/:slug/ideas/:id/votes", s.requestPublicVote)
		api.POST("/public/boards/:slug/ideas/suggest", s.requestPublicSuggest)
		api.GET("/public/votes/confirm", s.confirmPublicVote)
		api.GET("/public/comments/confirm", s.confirmPublicComment)
		api.GET("/public/ideas/confirm", s.confirmPublicSuggest)
	}

	ingest := r.Group("/v1/ingest")
	{
		ingest.GET("/config", s.ingestConfig)
		ingest.POST("/reports", s.ingestReport)
		ingest.PUT("/attachments/:id/upload", s.uploadAttachment)
		ingest.POST("/reports/:id/complete", s.completeReport)
		ingest.GET("/updates", s.ingestUpdates)
		ingest.POST("/identify", s.identify)
	}

	r.GET("/v1/files/:token", s.readFile)
	r.POST("/webhooks/github", s.githubWebhook)
	r.POST("/webhooks/gitlab", s.gitlabWebhook)
	r.POST("/webhooks/linear", s.linearWebhook)
	r.POST("/webhooks/jira", s.jiraWebhook)
	r.Any("/mcp", s.mcpHandler)
	r.Any("/mcp/*path", s.mcpHandler)
	return r
}

func cors(webURL string) gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin == "" {
			origin = "*"
		}
		if strings.HasPrefix(c.Request.URL.Path, "/v1/ingest") || strings.HasPrefix(c.Request.URL.Path, "/v1/files") {
			c.Header("Access-Control-Allow-Origin", "*")
		} else if origin == webURL || strings.HasPrefix(origin, "http://localhost") {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Access-Control-Allow-Credentials", "true")
		}
		c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Closeloop-Key")
		c.Header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	}
}

func writeErr(c *gin.Context, status int, code, message string) {
	c.JSON(status, gin.H{"error": gin.H{"code": code, "message": message}})
}

func (s *Server) upgradeURL() string {
	return strings.TrimRight(s.Cfg.WebURL, "/") + "/app/settings/billing"
}

// quotaLockedPayload is the QUOTA_LOCKED error body (US-63): reset date + upgrade link.
func quotaLockedPayload(upgradeURL string) gin.H {
	return gin.H{
		"code":        "QUOTA_LOCKED",
		"message":     "This ticket's reports are over this month's report quota. Upgrade or wait for the reset to read them.",
		"reset_at":    application.QuotaResetAt(time.Now()).Format(time.RFC3339),
		"upgrade_url": upgradeURL,
	}
}

func (s *Server) mapErr(c *gin.Context, err error) {
	var premium *application.PremiumRequiredError
	switch {
	case errors.As(err, &premium):
		c.JSON(402, gin.H{"error": gin.H{
			"code":          "PREMIUM_REQUIRED",
			"message":       premium.Error(),
			"required_plan": premium.RequiredPlan,
			"upgrade_url":   s.upgradeURL(),
		}})
		return
	case errors.Is(err, application.ErrQuotaLocked):
		c.JSON(402, gin.H{"error": quotaLockedPayload(s.upgradeURL())})
		return
	case errors.Is(err, application.ErrBusinessNotAvailable):
		writeErr(c, 400, "INVALID_INPUT", err.Error())
		return
	}
	mapErr(c, err)
}

func mapErr(c *gin.Context, err error) {
	switch {
	case errors.Is(err, application.ErrNotFound):
		writeErr(c, 404, "NOT_FOUND", err.Error())
	case errors.Is(err, application.ErrUnauthorized):
		writeErr(c, 401, "UNAUTHORIZED", err.Error())
	case errors.Is(err, application.ErrForbidden):
		writeErr(c, 403, "FORBIDDEN", err.Error())
	case errors.Is(err, application.ErrConflict):
		writeErr(c, 409, "CONFLICT", err.Error())
	case errors.Is(err, application.ErrQuotaLocked):
		writeErr(c, 402, "QUOTA_LOCKED", "This ticket's reports are over this month's report quota.")
	case errors.Is(err, application.ErrBusinessNotAvailable):
		writeErr(c, 400, "INVALID_INPUT", err.Error())
	case errors.Is(err, application.ErrPlanRequired):
		writeErr(c, 402, "PLAN_REQUIRED", "Upgrade required for this action")
	case errors.Is(err, application.ErrSeatLimit):
		writeErr(c, 403, "SEAT_LIMIT", "Seat limit reached for your plan")
	case errors.Is(err, application.ErrInvalidInput):
		writeErr(c, 400, "INVALID_INPUT", err.Error())
	default:
		writeErr(c, 500, "INTERNAL", err.Error())
	}
}

func (s *Server) authRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		h := c.GetHeader("Authorization")
		if !strings.HasPrefix(h, "Bearer ") {
			writeErr(c, 401, "UNAUTHORIZED", "missing token")
			c.Abort()
			return
		}
		claims, err := auth.ParseAccess(s.Cfg.JWTSecret, strings.TrimPrefix(h, "Bearer "))
		if err != nil {
			writeErr(c, 401, "UNAUTHORIZED", "invalid token")
			c.Abort()
			return
		}
		c.Set("userID", claims.UserID)
		c.Set("email", claims.Email)
		c.Next()
	}
}

func (s *Server) issueSession(c *gin.Context, user application.User) {
	access, err := auth.IssueAccess(s.Cfg.JWTSecret, user.ID, user.Email, 15*time.Minute)
	if err != nil {
		mapErr(c, err)
		return
	}
	refresh, err := auth.RandomToken(32)
	if err != nil {
		mapErr(c, err)
		return
	}
	if err := s.Store.SaveRefresh(c.Request.Context(), user.ID, refresh, time.Now().Add(30*24*time.Hour)); err != nil {
		mapErr(c, err)
		return
	}
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "refresh_token",
		Value:    refresh,
		Path:     "/",
		MaxAge:   int((30 * 24 * time.Hour).Seconds()),
		HttpOnly: true,
		Secure:   false,
		SameSite: http.SameSiteLaxMode,
	})
	s.writeAuditForUser(c, user, "auth.login", user.ID, nil)
	c.JSON(200, gin.H{"access_token": access, "user": gin.H{"id": user.ID, "email": user.Email, "name": user.Name, "avatar_url": user.AvatarURL}})
}

func (s *Server) sendWaitlistConfirmation(addr string) {
	if s.Mailer == nil {
		return
	}
	mail := email.WaitlistMail{
		To:           addr,
		GreetingName: email.GreetingFromEmail(addr),
	}
	if sendErr := s.Mailer.Send(addr, email.WaitlistSubject(), email.RenderWaitlistHTML(mail)); sendErr != nil {
		slog.Error("waitlist confirmation email", "err", sendErr, "to", addr)
	}
}

func (s *Server) joinWaitlist(c *gin.Context) {
	var body struct {
		Email  string `json:"email"`
		Source string `json:"source"`
	}
	if err := c.BindJSON(&body); err != nil {
		writeErr(c, 400, "INVALID_INPUT", "bad json")
		return
	}
	inserted, createdAt, err := s.Store.AddWaitlist(c.Request.Context(), body.Email, body.Source)
	if err != nil {
		mapErr(c, err)
		return
	}
	addr := strings.ToLower(strings.TrimSpace(body.Email))
	if inserted {
		s.sendWaitlistConfirmation(addr)
	}
	c.JSON(200, gin.H{
		"ok":         true,
		"inserted":   inserted,
		"email":      addr,
		"created_at": createdAt.UTC().Format(time.RFC3339),
	})
}

func (s *Server) resendWaitlist(c *gin.Context) {
	var body struct {
		Email string `json:"email"`
	}
	if err := c.BindJSON(&body); err != nil {
		writeErr(c, 400, "INVALID_INPUT", "bad json")
		return
	}
	addr, _, err := s.Store.GetWaitlist(c.Request.Context(), body.Email)
	if err != nil {
		mapErr(c, err)
		return
	}
	s.sendWaitlistConfirmation(addr)
	c.JSON(200, gin.H{"ok": true, "email": addr})
}

func (s *Server) register(c *gin.Context) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		Name     string `json:"name"`
	}
	if err := c.BindJSON(&body); err != nil {
		writeErr(c, 400, "INVALID_INPUT", "bad json")
		return
	}
	user, _, err := s.Store.Register(c.Request.Context(), body.Email, body.Password, body.Name)
	if err != nil {
		mapErr(c, err)
		return
	}
	s.issueSession(c, user)
}

func (s *Server) login(c *gin.Context) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := c.BindJSON(&body); err != nil {
		writeErr(c, 400, "INVALID_INPUT", "bad json")
		return
	}
	user, err := s.Store.Login(c.Request.Context(), body.Email, body.Password)
	if err != nil {
		mapErr(c, err)
		return
	}
	s.issueSession(c, user)
}

func (s *Server) googleLogin(c *gin.Context) {
	if s.Cfg.GoogleClientID == "" || s.Cfg.GoogleClientSecret == "" {
		redirectErr := fmt.Sprintf("%s/login?error=%s", s.Cfg.WebURL, url.QueryEscape("Google OAuth is not configured on server"))
		c.Redirect(http.StatusTemporaryRedirect, redirectErr)
		return
	}
	state, err := auth.RandomToken(16)
	if err != nil {
		mapErr(c, err)
		return
	}
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "oauth_state",
		Value:    state,
		Path:     "/",
		MaxAge:   300,
		HttpOnly: true,
		Secure:   false,
		SameSite: http.SameSiteLaxMode,
	})

	redirectURI := s.Cfg.APIURL + "/api/auth/google/callback"
	u, _ := url.Parse("https://accounts.google.com/o/oauth2/v2/auth")
	q := u.Query()
	q.Set("client_id", s.Cfg.GoogleClientID)
	q.Set("redirect_uri", redirectURI)
	q.Set("response_type", "code")
	q.Set("scope", "openid email profile")
	q.Set("state", state)
	q.Set("prompt", "select_account")
	u.RawQuery = q.Encode()

	c.Redirect(http.StatusTemporaryRedirect, u.String())
}

func (s *Server) googleCallback(c *gin.Context) {
	fail := func(reason string) {
		c.Redirect(http.StatusTemporaryRedirect, fmt.Sprintf("%s/login?error=%s", s.Cfg.WebURL, url.QueryEscape(reason)))
	}

	if s.Cfg.GoogleClientID == "" || s.Cfg.GoogleClientSecret == "" {
		fail("Google OAuth is not configured on server")
		return
	}

	if errParam := c.Query("error"); errParam != "" {
		fail(fmt.Sprintf("Google sign in cancelled: %s", errParam))
		return
	}

	state := c.Query("state")
	cookieState, err := c.Cookie("oauth_state")
	if err != nil || state == "" || state != cookieState {
		fail("Invalid or expired OAuth state")
		return
	}
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "oauth_state",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   false,
		SameSite: http.SameSiteLaxMode,
	})

	code := c.Query("code")
	if code == "" {
		fail("Missing authorization code")
		return
	}

	redirectURI := s.Cfg.APIURL + "/api/auth/google/callback"
	tokenURL := "https://oauth2.googleapis.com/token"
	form := url.Values{
		"code":          {code},
		"client_id":     {s.Cfg.GoogleClientID},
		"client_secret": {s.Cfg.GoogleClientSecret},
		"redirect_uri":  {redirectURI},
		"grant_type":    {"authorization_code"},
	}

	resp, err := http.PostForm(tokenURL, form)
	if err != nil {
		slog.Error("google token exchange failed", "err", err)
		fail("Failed to exchange code with Google")
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var tokenErr map[string]any
		_ = json.NewDecoder(resp.Body).Decode(&tokenErr)
		slog.Error("google token status error", "status", resp.StatusCode, "body", tokenErr)
		fail("Google rejected authorization code")
		return
	}

	var tokenRes struct {
		AccessToken string `json:"access_token"`
		IDToken     string `json:"id_token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tokenRes); err != nil {
		fail("Failed to parse Google token response")
		return
	}

	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, "https://www.googleapis.com/oauth2/v3/userinfo", nil)
	if err != nil {
		fail("Failed to create userinfo request")
		return
	}
	req.Header.Set("Authorization", "Bearer "+tokenRes.AccessToken)

	userinfoResp, err := http.DefaultClient.Do(req)
	if err != nil {
		fail("Failed to fetch userinfo from Google")
		return
	}
	defer userinfoResp.Body.Close()

	if userinfoResp.StatusCode != http.StatusOK {
		fail("Google userinfo returned error")
		return
	}

	var gUser struct {
		Sub           string `json:"sub"`
		Email         string `json:"email"`
		EmailVerified bool   `json:"email_verified"`
		Name          string `json:"name"`
		Picture       string `json:"picture"`
	}
	if err := json.NewDecoder(userinfoResp.Body).Decode(&gUser); err != nil {
		fail("Failed to parse Google userinfo")
		return
	}
	if gUser.Email == "" || gUser.Sub == "" {
		fail("Google account missing email or identifier")
		return
	}

	user, _, isNew, err := s.Store.UpsertGoogleUser(c.Request.Context(), gUser.Email, gUser.Name, gUser.Sub, gUser.Picture)
	if err != nil {
		slog.Error("upsert google user failed", "err", err)
		fail("Database error saving user")
		return
	}

	access, err := auth.IssueAccess(s.Cfg.JWTSecret, user.ID, user.Email, 15*time.Minute)
	if err != nil {
		fail("Failed to issue access token")
		return
	}
	refresh, err := auth.RandomToken(32)
	if err != nil {
		fail("Failed to generate refresh token")
		return
	}
	if err := s.Store.SaveRefresh(c.Request.Context(), user.ID, refresh, time.Now().Add(30*24*time.Hour)); err != nil {
		fail("Failed to save refresh token")
		return
	}

	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "refresh_token",
		Value:    refresh,
		Path:     "/",
		MaxAge:   int((30 * 24 * time.Hour).Seconds()),
		HttpOnly: true,
		Secure:   false,
		SameSite: http.SameSiteLaxMode,
	})

	isNewParam := "0"
	if isNew {
		isNewParam = "1"
	}
	targetURL := fmt.Sprintf("%s/auth/callback?access_token=%s&new=%s", s.Cfg.WebURL, url.QueryEscape(access), isNewParam)
	c.Redirect(http.StatusTemporaryRedirect, targetURL)
}

func (s *Server) googleConfig(c *gin.Context) {
	c.JSON(200, gin.H{"client_id": s.Cfg.GoogleClientID})
}

func (s *Server) googleOneTap(c *gin.Context) {
	if s.Cfg.GoogleClientID == "" {
		writeErr(c, 503, "NOT_CONFIGURED", "Google OAuth is not configured on server")
		return
	}

	var body struct {
		Credential string `json:"credential"`
	}
	if err := c.BindJSON(&body); err != nil || body.Credential == "" {
		writeErr(c, 400, "INVALID_INPUT", "missing credential")
		return
	}

	tokenInfoURL := "https://oauth2.googleapis.com/tokeninfo?id_token=" + url.QueryEscape(body.Credential)
	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, tokenInfoURL, nil)
	if err != nil {
		writeErr(c, 500, "INTERNAL", "failed to create verification request")
		return
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		slog.Error("google tokeninfo request failed", "err", err)
		writeErr(c, 502, "UPSTREAM_ERROR", "failed to verify token with Google")
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		writeErr(c, 401, "UNAUTHORIZED", "invalid Google credential")
		return
	}

	var claims struct {
		Aud           string `json:"aud"`
		Sub           string `json:"sub"`
		Email         string `json:"email"`
		EmailVerified string `json:"email_verified"`
		Name          string `json:"name"`
		Picture       string `json:"picture"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&claims); err != nil {
		writeErr(c, 500, "INTERNAL", "failed to parse Google token claims")
		return
	}

	if claims.Aud != s.Cfg.GoogleClientID {
		writeErr(c, 401, "UNAUTHORIZED", "token audience mismatch")
		return
	}
	if claims.Sub == "" || claims.Email == "" {
		writeErr(c, 400, "INVALID_INPUT", "missing subject or email in token")
		return
	}

	user, _, isNew, err := s.Store.UpsertGoogleUser(c.Request.Context(), claims.Email, claims.Name, claims.Sub, claims.Picture)
	if err != nil {
		mapErr(c, err)
		return
	}

	access, err := auth.IssueAccess(s.Cfg.JWTSecret, user.ID, user.Email, 15*time.Minute)
	if err != nil {
		mapErr(c, err)
		return
	}
	refresh, err := auth.RandomToken(32)
	if err != nil {
		mapErr(c, err)
		return
	}
	if err := s.Store.SaveRefresh(c.Request.Context(), user.ID, refresh, time.Now().Add(30*24*time.Hour)); err != nil {
		mapErr(c, err)
		return
	}

	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "refresh_token",
		Value:    refresh,
		Path:     "/",
		MaxAge:   int((30 * 24 * time.Hour).Seconds()),
		HttpOnly: true,
		Secure:   false,
		SameSite: http.SameSiteLaxMode,
	})

	c.JSON(200, gin.H{
		"access_token": access,
		"user": gin.H{
			"id":         user.ID,
			"email":      user.Email,
			"name":       user.Name,
			"avatar_url": user.AvatarURL,
		},
		"is_new": isNew,
	})
}

func (s *Server) refresh(c *gin.Context) {
	raw, err := c.Cookie("refresh_token")
	if err != nil || raw == "" {
		writeErr(c, 401, "UNAUTHORIZED", "missing refresh")
		return
	}
	user, err := s.Store.UserByRefresh(c.Request.Context(), raw)
	if err != nil {
		mapErr(c, err)
		return
	}
	s.issueSession(c, user)
}

func (s *Server) logout(c *gin.Context) {
	raw, _ := c.Cookie("refresh_token")
	_ = s.Store.RevokeRefresh(c.Request.Context(), raw)
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "refresh_token",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   false,
		SameSite: http.SameSiteLaxMode,
	})
	c.JSON(200, gin.H{"ok": true})
}

func (s *Server) me(c *gin.Context) {
	userID := c.GetString("userID")
	user, err := s.Store.UserByID(c.Request.Context(), userID)
	if err != nil {
		mapErr(c, err)
		return
	}
	org, role, err := s.Store.PrimaryOrg(c.Request.Context(), userID)
	if err != nil {
		mapErr(c, err)
		return
	}
	usage, err := s.Store.OrgUsageForProject(c.Request.Context(), org.ID, c.Query("project_id"))
	if err != nil {
		mapErr(c, err)
		return
	}
	c.JSON(200, gin.H{
		"user": gin.H{
			"id":         userID,
			"email":      user.Email,
			"name":       user.Name,
			"avatar_url": user.AvatarURL,
		},
		"org": gin.H{
			"id":   org.ID,
			"name": org.Name,
			"plan": usage.Plan,
		},
		"role":  role,
		"usage": usage,
	})
}

func (s *Server) patchOrgPlan(c *gin.Context) {
	var body struct {
		Plan string `json:"plan"`
	}
	if err := c.BindJSON(&body); err != nil {
		writeErr(c, 400, "INVALID_INPUT", "bad json")
		return
	}
	org, role, err := s.Store.PrimaryOrg(c.Request.Context(), c.GetString("userID"))
	if err != nil {
		mapErr(c, err)
		return
	}
	if role == "owner" {
		subscribed, err := s.Store.OrgSubscribed(c.Request.Context(), org.ID)
		if err != nil {
			mapErr(c, err)
			return
		}
		if subscribed {
			writeAlreadySubscribed(c)
			return
		}
		if s.paidPlanNeedsCheckout(org.Plan, body.Plan) {
			writeErr(c, 402, "BILLING_REQUIRED", "Subscribe from Billing to move to a paid plan.")
			return
		}
	}
	updated, err := s.Store.UpdateOrgPlan(c.Request.Context(), org.ID, body.Plan, role)
	if err != nil {
		s.mapErr(c, err)
		return
	}
	usage, err := s.Store.OrgUsageForProject(c.Request.Context(), updated.ID, c.Query("project_id"))
	if err != nil {
		mapErr(c, err)
		return
	}
	s.writeAudit(c, org.ID, "", "org.plan_changed", org.ID, map[string]any{
		"from": org.Plan, "to": updated.Plan,
	})
	c.JSON(200, gin.H{"org": updated, "usage": usage})
}

func (s *Server) listProjects(c *gin.Context) {
	org, _, err := s.Store.PrimaryOrg(c.Request.Context(), c.GetString("userID"))
	if err != nil {
		mapErr(c, err)
		return
	}
	list, err := s.Store.ListProjects(c.Request.Context(), org.ID)
	if err != nil {
		mapErr(c, err)
		return
	}
	c.JSON(200, gin.H{"projects": list})
}

func (s *Server) createProject(c *gin.Context) {
	var body struct {
		Name      string   `json:"name"`
		Platforms []string `json:"platforms"`
	}
	if err := c.BindJSON(&body); err != nil {
		writeErr(c, 400, "INVALID_INPUT", "bad json")
		return
	}
	org, _, err := s.Store.PrimaryOrg(c.Request.Context(), c.GetString("userID"))
	if err != nil {
		mapErr(c, err)
		return
	}
	p, key, err := s.Store.CreateProject(c.Request.Context(), org.ID, body.Name, body.Platforms)
	if err != nil {
		mapErr(c, err)
		return
	}
	c.JSON(201, gin.H{"project": p, "public_key": key})
}

func (s *Server) requireProjectAccess(c *gin.Context, projectID string) bool {
	ok, err := s.Store.UserCanAccessProject(c.Request.Context(), c.GetString("userID"), projectID)
	if err != nil {
		mapErr(c, err)
		return false
	}
	if !ok {
		writeErr(c, 403, "FORBIDDEN", "no access")
		return false
	}
	return true
}

func (s *Server) getProject(c *gin.Context) {
	id := c.Param("id")
	if !s.requireProjectAccess(c, id) {
		return
	}
	p, err := s.Store.ProjectByID(c.Request.Context(), id)
	if err != nil {
		mapErr(c, err)
		return
	}
	key, _ := s.Store.PublicKeyForProject(c.Request.Context(), id)
	widget, _ := s.Store.WidgetSettings(c.Request.Context(), id)
	c.JSON(200, gin.H{"project": p, "public_key": key, "widget": widget})
}

// patchProjectWidget saves the S-12 Widget section; a custom accent needs Studio.
func (s *Server) patchProjectWidget(c *gin.Context) {
	id := c.Param("id")
	if !s.requireTicketWrite(c, id) {
		return
	}
	var body application.WidgetSettingsInput
	if err := c.BindJSON(&body); err != nil {
		writeErr(c, 400, "INVALID_INPUT", "bad json")
		return
	}
	widget, err := s.Store.UpdateWidgetSettings(c.Request.Context(), id, body)
	if err != nil {
		s.mapErr(c, err)
		return
	}
	c.JSON(200, gin.H{"widget": widget})
}

func (s *Server) patchProject(c *gin.Context) {
	id := c.Param("id")
	if !s.requireProjectAccess(c, id) {
		return
	}
	var body struct {
		Name               *string   `json:"name"`
		Platforms          *[]string `json:"platforms"`
		NotifyEnabled      *bool     `json:"notify_enabled"`
		BannerEnabled      *bool     `json:"banner_enabled"`
		MaskTextInputs     *bool     `json:"mask_text_inputs"`
		VoterNotifyEnabled *bool     `json:"voter_notify_enabled"`
		SensitiveSelectors *[]string `json:"sensitive_selectors"`
		BoardSlug          *string   `json:"board_slug"`
	}
	if err := c.BindJSON(&body); err != nil {
		writeErr(c, 400, "INVALID_INPUT", "bad json")
		return
	}
	if body.Name != nil {
		trimmed := strings.TrimSpace(*body.Name)
		if trimmed == "" {
			writeErr(c, 400, "INVALID_INPUT", "name is required")
			return
		}
		body.Name = &trimmed
	}
	if body.Platforms != nil {
		if len(*body.Platforms) == 0 {
			writeErr(c, 400, "INVALID_INPUT", "at least one platform is required")
			return
		}
		allowed := map[string]struct{}{"web": {}, "android": {}, "ios": {}}
		for _, platform := range *body.Platforms {
			if _, ok := allowed[platform]; !ok {
				writeErr(c, 400, "INVALID_INPUT", "invalid platform")
				return
			}
		}
	}
	if body.BoardSlug != nil {
		trimmed := strings.TrimSpace(*body.BoardSlug)
		body.BoardSlug = &trimmed
	}
	if err := s.Store.UpdateProjectSettings(c.Request.Context(), id, body.Name, body.Platforms, body.NotifyEnabled, body.BannerEnabled, body.MaskTextInputs, body.VoterNotifyEnabled, body.SensitiveSelectors, body.BoardSlug); err != nil {
		mapErr(c, err)
		return
	}
	p, err := s.Store.ProjectByID(c.Request.Context(), id)
	if err != nil {
		mapErr(c, err)
		return
	}
	c.JSON(200, gin.H{"project": p})
}

func (s *Server) deleteProject(c *gin.Context) {
	id := c.Param("id")
	if !s.requireProjectAccess(c, id) {
		return
	}
	owner, err := s.Store.UserIsProjectOwner(c.Request.Context(), c.GetString("userID"), id)
	if err != nil {
		mapErr(c, err)
		return
	}
	if !owner {
		writeErr(c, 403, "FORBIDDEN", "only owners can delete a project")
		return
	}
	if err := s.Store.SoftDeleteProject(c.Request.Context(), id); err != nil {
		mapErr(c, err)
		return
	}
	c.Status(204)
}

func (s *Server) listMCPTokens(c *gin.Context) {
	id := c.Param("id")
	if !s.requireProjectAccess(c, id) {
		return
	}
	list, err := s.Store.ListMCPTokens(c.Request.Context(), id)
	if err != nil {
		mapErr(c, err)
		return
	}
	c.JSON(200, gin.H{"tokens": list})
}

func (s *Server) createMCPToken(c *gin.Context) {
	id := c.Param("id")
	if !s.requireTicketWrite(c, id) {
		return
	}
	org, _, err := s.Store.PrimaryOrg(c.Request.Context(), c.GetString("userID"))
	if err != nil {
		mapErr(c, err)
		return
	}
	// Every plan gets all MCP tools (pricing update P1, US-60).
	raw, prefix, err := s.Store.CreateMCPToken(c.Request.Context(), id, true)
	if err != nil {
		mapErr(c, err)
		return
	}
	s.writeAudit(c, org.ID, "", "mcp.token_created", id, map[string]any{"prefix": prefix})
	c.JSON(201, gin.H{"token": raw, "prefix": prefix, "scopes": []string{"read", "write"}})
}

func (s *Server) deleteMCPToken(c *gin.Context) {
	projectID := c.Param("id")
	tokenID := c.Param("tokenId")
	if !s.requireProjectAccess(c, projectID) {
		return
	}
	if err := s.Store.DeleteMCPToken(c.Request.Context(), projectID, tokenID); err != nil {
		mapErr(c, err)
		return
	}
	if org, _, err := s.Store.PrimaryOrg(c.Request.Context(), c.GetString("userID")); err == nil {
		s.writeAudit(c, org.ID, "", "mcp.token_revoked", tokenID, map[string]any{"project_id": projectID})
	}
	c.JSON(200, gin.H{"ok": true})
}

func (s *Server) listTickets(c *gin.Context) {
	id := c.Param("id")
	if !s.requireProjectAccess(c, id) {
		return
	}
	list, err := s.Store.ListTicketsFiltered(c.Request.Context(), id, application.TicketFilter{
		Status:   c.Query("status"),
		Type:     c.Query("type"),
		Platform: c.Query("platform"),
		Repo:     c.Query("repo"),
	})
	if err != nil {
		mapErr(c, err)
		return
	}
	c.JSON(200, gin.H{"tickets": list})
}

func (s *Server) listIntegrations(c *gin.Context) {
	id := c.Param("id")
	if !s.requireProjectAccess(c, id) {
		return
	}
	list, err := s.Store.ListIntegrations(c.Request.Context(), id)
	if err != nil {
		mapErr(c, err)
		return
	}
	c.JSON(200, gin.H{"integrations": list})
}

func (s *Server) putIntegration(c *gin.Context) {
	id := c.Param("id")
	if !s.requireProjectAccess(c, id) {
		return
	}
	var body struct {
		Config map[string]any `json:"config"`
	}
	if err := c.BindJSON(&body); err != nil {
		writeErr(c, 400, "INVALID_INPUT", "bad json")
		return
	}
	provider := strings.ToLower(strings.TrimSpace(c.Param("provider")))
	if err := s.Store.RequireIntegrationConnect(c.Request.Context(), id, provider); err != nil {
		s.mapErr(c, err)
		return
	}
	item, err := s.Store.UpsertIntegration(c.Request.Context(), id, c.Param("provider"), body.Config)
	if err != nil {
		mapErr(c, err)
		return
	}
	if provider == "github_app" {
		_ = s.Store.SyncLegacyGitHubRepo(c.Request.Context(), id, item.Config)
	}
	if org, _, err := s.Store.PrimaryOrg(c.Request.Context(), c.GetString("userID")); err == nil {
		s.writeAudit(c, org.ID, "", "integration.upserted", id, map[string]any{"provider": c.Param("provider")})
	}
	c.JSON(200, gin.H{"integration": item})
}

func (s *Server) deleteIntegration(c *gin.Context) {
	id := c.Param("id")
	if !s.requireProjectAccess(c, id) {
		return
	}
	if err := s.Store.DeleteIntegration(c.Request.Context(), id, c.Param("provider")); err != nil {
		mapErr(c, err)
		return
	}
	if org, _, err := s.Store.PrimaryOrg(c.Request.Context(), c.GetString("userID")); err == nil {
		s.writeAudit(c, org.ID, "", "integration.deleted", id, map[string]any{"provider": c.Param("provider")})
	}
	c.Status(204)
}

func (s *Server) getTicket(c *gin.Context) {
	t, err := s.Store.GetTicket(c.Request.Context(), c.Param("id"))
	if err != nil {
		s.mapErr(c, err)
		return
	}
	if !s.requireProjectAccess(c, t.ProjectID) {
		return
	}
	reports, _ := s.Store.TicketReports(c.Request.Context(), t.ID)
	events, _ := s.Store.ListTicketEvents(c.Request.Context(), t.ID)
	atts, _ := s.Store.TicketAttachments(c.Request.Context(), t.ID)
	reporterTotal, reporterEmail, _ := s.Store.TicketReporterStats(c.Request.Context(), t.ID)
	reporterItems, reporterByPlatform, _ := s.Store.TicketReporterList(c.Request.Context(), t.ID)
	if reporterItems == nil {
		reporterItems = []application.TicketReporter{}
	}
	if reporterByPlatform == nil {
		reporterByPlatform = map[string]int{}
	}
	integrations, _ := s.Store.ListIntegrations(c.Request.Context(), t.ProjectID)
	attOut := make([]gin.H, 0, len(atts))
	for _, a := range atts {
		item := gin.H{"id": a.ID, "report_id": a.ReportID, "kind": a.Kind, "uploaded": a.Uploaded}
		if a.Uploaded {
			if url, err := s.Files.SignedReadURL(a.StorageKey, 10*time.Minute); err == nil {
				item["url"] = url
			}
		}
		attOut = append(attOut, item)
	}
	if events == nil {
		events = []application.TicketEvent{}
	}
	if reports == nil {
		reports = []application.Report{}
	}
	if integrations == nil {
		integrations = []application.Integration{}
	}
	c.JSON(200, gin.H{
		"ticket":        t,
		"reports":       reports,
		"attachments":   attOut,
		"events":        events,
		"integrations":  integrations,
		"reporters": gin.H{
			"total":       reporterTotal,
			"with_email":  reporterEmail,
			"items":       reporterItems,
			"by_platform": reporterByPlatform,
		},
		"repo_coverage": repoCoverage(s, c, t),
	})
}

// repoCoverage tells S-09 which reporter platforms the ticket's repo serves (US-55).
func repoCoverage(s *Server, c *gin.Context, t application.Ticket) gin.H {
	covered, uncovered := s.uncoveredPlatforms(c, t)
	return gin.H{"covered": covered, "uncovered": uncovered}
}

func (s *Server) patchTicket(c *gin.Context) {
	var body struct {
		Status   *string `json:"status"`
		Note     string  `json:"note"`
		IsPublic *bool   `json:"is_public"`
		RepoID   *string `json:"repo_id"`
		Reason   string  `json:"reason"`
		// NotifyPlatforms limits fixed notifications to these platforms (US-55); empty = all.
		NotifyPlatforms []string `json:"notify_platforms"`
		Notify          *struct {
			Email *bool `json:"email"`
			InApp *bool `json:"in_app"`
		} `json:"notify"`
	}
	if err := c.BindJSON(&body); err != nil {
		writeErr(c, 400, "INVALID_INPUT", "bad json")
		return
	}
	if body.Status == nil && body.IsPublic == nil && body.RepoID == nil {
		writeErr(c, 400, "INVALID_INPUT", "status, is_public or repo_id required")
		return
	}
	t, err := s.Store.GetTicket(c.Request.Context(), c.Param("id"))
	if err != nil {
		mapErr(c, err)
		return
	}
	if !s.requireTicketWrite(c, t.ProjectID) {
		return
	}
	actor := "user:" + c.GetString("email")
	if body.RepoID != nil {
		// Builder reroute (US-51); logged as ticket_rerouted with source builder.
		if _, err := s.Store.RerouteTicket(c.Request.Context(), t.ID, strings.TrimSpace(*body.RepoID), actor, body.Reason, "builder"); err != nil {
			s.mapRepoErr(c, err)
			return
		}
	}
	if body.IsPublic != nil {
		// Publishing to the public board needs Indie; unpublishing is always allowed.
		if *body.IsPublic && !t.IsPublic {
			if err := s.Store.RequireBoardPublish(c.Request.Context(), t.ProjectID); err != nil {
				s.mapErr(c, err)
				return
			}
		}
		if err := s.Store.SetTicketPublic(c.Request.Context(), t.ID, *body.IsPublic, actor); err != nil {
			mapErr(c, err)
			return
		}
	}
	if body.Status != nil {
		status := strings.TrimSpace(*body.Status)
		if status == "" {
			writeErr(c, 400, "INVALID_INPUT", "status is required")
			return
		}
		fromStatus := t.Status
		if err := s.Store.UpdateTicketStatus(c.Request.Context(), t.ID, status, actor, body.Note); err != nil {
			mapErr(c, err)
			return
		}
		if status == "fixed" {
			channels := application.DefaultNotifyChannels()
			if body.Notify != nil {
				if body.Notify.Email != nil {
					channels.Email = *body.Notify.Email
				}
				if body.Notify.InApp != nil {
					channels.InApp = *body.Notify.InApp
				}
			}
			channels.Platforms = body.NotifyPlatforms
			_ = s.Store.EnqueueNotify(c.Request.Context(), t.ID, channels)
			_ = s.Store.EnqueueVoteReleased(c.Request.Context(), t.ID)
		}
		slackEv := application.SlackNotifyEvent{
			TicketID: t.ID,
			Event:    "status_changed",
			From:     fromStatus,
			To:       status,
			Note:     body.Note,
		}
		_ = s.Store.EnqueueSlackNotify(c.Request.Context(), t.ProjectID, slackEv)
		_ = s.Store.EnqueueOutboundWebhook(c.Request.Context(), t.ProjectID, slackEv)
		if org, _, err := s.Store.PrimaryOrg(c.Request.Context(), c.GetString("userID")); err == nil {
			action := "ticket.status_changed"
			if status == "fixed" {
				action = "ticket.mark_fixed"
			}
			s.writeAudit(c, org.ID, actor, action, t.ID, map[string]any{
				"from": fromStatus, "to": status,
			})
		}
	}
	t, _ = s.Store.GetTicket(c.Request.Context(), t.ID)
	c.JSON(200, gin.H{"ticket": t})
}

func (s *Server) getPublicBoard(c *gin.Context) {
	board, ideas, err := s.Store.PublicBoardBySlug(c.Request.Context(), c.Param("slug"))
	if err != nil {
		mapErr(c, err)
		return
	}
	c.JSON(200, gin.H{"project": board, "ideas": ideas})
}

func (s *Server) getPublicIdea(c *gin.Context) {
	board, idea, err := s.Store.PublicIdeaBySlug(c.Request.Context(), c.Param("slug"), c.Param("id"))
	if err != nil {
		mapErr(c, err)
		return
	}
	c.JSON(200, gin.H{"project": board, "idea": idea})
}

func (s *Server) requestPublicVote(c *gin.Context) {
	var body struct {
		Email string `json:"email"`
	}
	if err := c.BindJSON(&body); err != nil {
		writeErr(c, 400, "INVALID_INPUT", "bad json")
		return
	}
	req, err := s.Store.RequestIdeaVote(c.Request.Context(), c.Param("slug"), c.Param("id"), body.Email)
	if err != nil {
		mapErr(c, err)
		return
	}
	if req.SendEmail {
		_ = s.Store.EnqueueVoteVerify(
			c.Request.Context(),
			req.TicketID,
			req.Email,
			req.RawToken,
			req.ProjectName,
			req.IdeaTitle,
			req.BoardSlug,
		)
	}
	c.JSON(202, gin.H{"ok": true, "message": "Check your email to confirm your vote."})
}

func (s *Server) confirmPublicVote(c *gin.Context) {
	result, err := s.Store.ConfirmIdeaVote(c.Request.Context(), c.Query("t"))
	if err != nil {
		switch {
		case errors.Is(err, application.ErrNotFound):
			writeErr(c, 404, "NOT_FOUND", "invalid vote link")
		case errors.Is(err, application.ErrConflict):
			writeErr(c, 409, "ALREADY_USED", "this vote link was already used")
		case errors.Is(err, application.ErrGone):
			writeErr(c, 410, "EXPIRED", "this vote link has expired")
		default:
			mapErr(c, err)
		}
		return
	}
	c.JSON(200, gin.H{"vote": result})
}

func (s *Server) listPublicComments(c *gin.Context) {
	comments, err := s.Store.ListPublicComments(c.Request.Context(), c.Param("slug"), c.Param("id"))
	if err != nil {
		mapErr(c, err)
		return
	}
	c.JSON(200, gin.H{"comments": comments})
}

func (s *Server) requestPublicComment(c *gin.Context) {
	var body struct {
		Email       string `json:"email"`
		Body        string `json:"body"`
		DisplayName string `json:"display_name"`
		ParentID    string `json:"parent_id"`
	}
	if err := c.BindJSON(&body); err != nil {
		writeErr(c, 400, "INVALID_INPUT", "bad json")
		return
	}
	req, err := s.Store.RequestIdeaComment(
		c.Request.Context(),
		c.Param("slug"),
		c.Param("id"),
		body.Email,
		body.DisplayName,
		body.Body,
		body.ParentID,
	)
	if err != nil {
		mapErr(c, err)
		return
	}
	if req.SendEmail {
		_ = s.Store.EnqueueCommentVerify(
			c.Request.Context(),
			req.TicketID,
			req.Email,
			req.RawToken,
			req.ProjectName,
			req.IdeaTitle,
			req.BoardSlug,
		)
	}
	c.JSON(202, gin.H{"ok": true, "message": "Check your email to confirm your comment."})
}

func (s *Server) requestPublicSuggest(c *gin.Context) {
	var body struct {
		Email string `json:"email"`
		Title string `json:"title"`
		Body  string `json:"body"`
	}
	if err := c.BindJSON(&body); err != nil {
		writeErr(c, 400, "INVALID_INPUT", "bad json")
		return
	}
	req, err := s.Store.RequestIdeaSuggest(
		c.Request.Context(),
		c.Param("slug"),
		body.Email,
		body.Title,
		body.Body,
	)
	if err != nil {
		mapErr(c, err)
		return
	}
	if req.SendEmail {
		_ = s.Store.EnqueueSuggestVerify(
			c.Request.Context(),
			req.Email,
			req.RawToken,
			req.ProjectName,
			req.IdeaTitle,
			req.BoardSlug,
		)
	}
	c.JSON(202, gin.H{
		"ok":      true,
		"message": "Check your email to confirm — we'll show it after the team publishes.",
	})
}

func (s *Server) confirmPublicSuggest(c *gin.Context) {
	result, err := s.Store.ConfirmIdeaSuggest(c.Request.Context(), c.Query("t"))
	if err != nil {
		switch {
		case errors.Is(err, application.ErrNotFound):
			writeErr(c, 404, "NOT_FOUND", "invalid suggestion link")
		case errors.Is(err, application.ErrConflict):
			writeErr(c, 409, "ALREADY_USED", "this suggestion link was already used")
		case errors.Is(err, application.ErrGone):
			writeErr(c, 410, "EXPIRED", "this suggestion link has expired")
		default:
			mapErr(c, err)
		}
		return
	}
	createdEv := application.SlackNotifyEvent{
		TicketID: result.TicketID,
		Event:    "new_report",
	}
	_ = s.Store.EnqueueSlackNotify(c.Request.Context(), result.ProjectID, createdEv)
	_ = s.Store.EnqueueOutboundWebhook(c.Request.Context(), result.ProjectID, createdEv)
	c.JSON(200, gin.H{"suggestion": result})
}

func (s *Server) confirmPublicComment(c *gin.Context) {
	result, err := s.Store.ConfirmIdeaComment(c.Request.Context(), c.Query("t"))
	if err != nil {
		switch {
		case errors.Is(err, application.ErrNotFound):
			writeErr(c, 404, "NOT_FOUND", "invalid comment link")
		case errors.Is(err, application.ErrConflict):
			writeErr(c, 409, "ALREADY_USED", "this comment link was already used")
		case errors.Is(err, application.ErrGone):
			writeErr(c, 410, "EXPIRED", "this comment link has expired")
		default:
			mapErr(c, err)
		}
		return
	}
	c.JSON(200, gin.H{"comment": result})
}

func (s *Server) createTeamComment(c *gin.Context) {
	var body struct {
		Body     string `json:"body"`
		ParentID string `json:"parent_id"`
	}
	if err := c.BindJSON(&body); err != nil {
		writeErr(c, 400, "INVALID_INPUT", "bad json")
		return
	}
	t, err := s.Store.GetTicket(c.Request.Context(), c.Param("id"))
	if err != nil {
		mapErr(c, err)
		return
	}
	if !s.requireTicketWrite(c, t.ProjectID) {
		return
	}
	comment, err := s.Store.CreateTeamComment(
		c.Request.Context(),
		t.ID,
		c.GetString("email"),
		body.Body,
		body.ParentID,
	)
	if err != nil {
		mapErr(c, err)
		return
	}
	c.JSON(201, gin.H{"comment": comment})
}

func (s *Server) listBoardComments(c *gin.Context) {
	projectID := c.Param("id")
	if !s.requireProjectAccess(c, projectID) {
		return
	}
	comments, pending, err := s.Store.ListBoardComments(c.Request.Context(), projectID, c.Query("status"))
	if err != nil {
		mapErr(c, err)
		return
	}
	c.JSON(200, gin.H{"comments": comments, "pending_count": pending})
}

func (s *Server) patchComment(c *gin.Context) {
	var body struct {
		Hidden *bool `json:"hidden"`
	}
	if err := c.BindJSON(&body); err != nil || body.Hidden == nil {
		writeErr(c, 400, "INVALID_INPUT", "hidden required")
		return
	}
	var projectID string
	err := s.Store.DB.QueryRowContext(c.Request.Context(), `
		SELECT t.project_id
		FROM idea_comments c
		JOIN tickets t ON t.id=c.ticket_id
		WHERE c.id=$1`, c.Param("id")).Scan(&projectID)
	if errors.Is(err, sql.ErrNoRows) {
		mapErr(c, application.ErrNotFound)
		return
	}
	if err != nil {
		mapErr(c, err)
		return
	}
	if !s.requireTicketWrite(c, projectID) {
		return
	}
	if err := s.Store.SetCommentHidden(c.Request.Context(), c.Param("id"), projectID, *body.Hidden); err != nil {
		mapErr(c, err)
		return
	}
	c.JSON(200, gin.H{"ok": true})
}

func (s *Server) addNote(c *gin.Context) {
	var body struct {
		Body string `json:"body"`
	}
	if err := c.BindJSON(&body); err != nil {
		writeErr(c, 400, "INVALID_INPUT", "bad json")
		return
	}
	t, err := s.Store.GetTicket(c.Request.Context(), c.Param("id"))
	if err != nil {
		mapErr(c, err)
		return
	}
	if !s.requireTicketWrite(c, t.ProjectID) {
		return
	}
	if err := s.Store.AddNote(c.Request.Context(), t.ID, "user:"+c.GetString("email"), body.Body); err != nil {
		mapErr(c, err)
		return
	}
	c.JSON(201, gin.H{"ok": true})
}

func (s *Server) mergeTickets(c *gin.Context) {
	var body struct {
		ParentID string   `json:"parent_id"`
		ChildIDs []string `json:"child_ids"`
	}
	if err := c.BindJSON(&body); err != nil {
		writeErr(c, 400, "INVALID_INPUT", "bad json")
		return
	}
	if body.ParentID == "" || len(body.ChildIDs) == 0 {
		writeErr(c, 400, "INVALID_INPUT", "parent_id and child_ids required")
		return
	}
	t, err := s.Store.GetTicket(c.Request.Context(), body.ParentID)
	if err != nil {
		mapErr(c, err)
		return
	}
	if !s.requireTicketWrite(c, t.ProjectID) {
		return
	}
	actor := "user:" + c.GetString("email")
	if err := s.Store.MergeTickets(c.Request.Context(), body.ParentID, actor, body.ChildIDs); err != nil {
		mapErr(c, err)
		return
	}
	if org, _, err := s.Store.PrimaryOrg(c.Request.Context(), c.GetString("userID")); err == nil {
		s.writeAudit(c, org.ID, actor, "ticket.merge", body.ParentID, map[string]any{
			"child_ids": body.ChildIDs,
		})
	}
	c.JSON(200, gin.H{"ok": true})
}

func (s *Server) projectFromKey(c *gin.Context) (application.Project, bool) {
	key := c.GetHeader("X-Closeloop-Key")
	if key == "" {
		key = c.Query("key")
	}
	if key == "" {
		writeErr(c, 401, "MISSING_KEY", "missing X-Closeloop-Key")
		return application.Project{}, false
	}
	p, err := s.Store.ProjectByPublicKey(c.Request.Context(), key)
	if err != nil {
		mapErr(c, err)
		return application.Project{}, false
	}
	return p, true
}

func (s *Server) ingestConfig(c *gin.Context) {
	p, ok := s.projectFromKey(c)
	if !ok {
		return
	}
	selectors := p.SensitiveSelectors
	if selectors == nil {
		selectors = []string{}
	}
	plan, err := s.Store.OrgPlan(c.Request.Context(), p.OrgID)
	if err != nil {
		mapErr(c, err)
		return
	}
	widget, err := s.Store.EffectiveWidgetSettings(c.Request.Context(), p.ID, plan)
	if err != nil {
		mapErr(c, err)
		return
	}
	c.JSON(200, gin.H{
		"sensitive_selectors": selectors,
		"mask_text_inputs":    p.MaskTextInputs,
		"replay_enabled":      application.ReplayAllowed(plan),
		"widget":              widget,
		// D-20: "Powered by Saidloop" on Free only; the widget adds utm_medium per surface.
		"badge":     application.BadgeShown(plan),
		"badge_url": ternary(application.BadgeShown(plan), application.BadgeLink(s.Cfg.WebURL, p.ID), ""),
	})
}

func (s *Server) ingestReport(c *gin.Context) {
	p, ok := s.projectFromKey(c)
	if !ok {
		return
	}
	var body struct {
		Type       string         `json:"type"`
		Message    string         `json:"message"`
		Platform   string         `json:"platform"`
		Context    map[string]any `json:"context"`
		AppVersion string         `json:"app_version"`
		Email      string         `json:"email"`
		UserID     string         `json:"user_id"`
	}
	if err := c.BindJSON(&body); err != nil {
		writeErr(c, 400, "INVALID_INPUT", "bad json")
		return
	}
	ticketID, reportID, attID, token, key, err := s.Store.CreateReport(c.Request.Context(), p, application.CreateReportInput{
		Type: body.Type, Message: body.Message, Platform: body.Platform, Context: body.Context,
		AppVersion: body.AppVersion, Email: body.Email, ExternalID: body.UserID,
	})
	if err != nil {
		mapErr(c, err)
		return
	}
	createdEv := application.SlackNotifyEvent{
		TicketID: ticketID,
		Event:    "new_report",
	}
	_ = s.Store.EnqueueSlackNotify(c.Request.Context(), p.ID, createdEv)
	_ = s.Store.EnqueueOutboundWebhook(c.Request.Context(), p.ID, createdEv)

	out := gin.H{
		"ticket_id":     ticketID,
		"report_id":     reportID,
		"attachment_id": attID,
		"upload_url":    s.Files.UploadURL(attID, token),
		"upload_token":  token,
		"storage_key":   key,
	}

	plan, planErr := s.Store.OrgPlan(c.Request.Context(), p.OrgID)
	if planErr == nil && application.ReplayAllowed(plan) {
		replayID, replayToken, replayKey, replayErr := s.Store.CreateReplayAttachment(c.Request.Context(), p.ID, reportID)
		if replayErr != nil {
			slog.Error("create replay attachment", "err", replayErr, "report_id", reportID)
		} else {
			out["replay_attachment_id"] = replayID
			out["replay_upload_url"] = s.Files.UploadURL(replayID, replayToken)
			out["replay_upload_token"] = replayToken
			out["replay_storage_key"] = replayKey
		}
	}

	c.JSON(201, out)
}

func (s *Server) uploadAttachment(c *gin.Context) {
	token := c.Query("token")
	key, err := s.Store.AttachmentForUpload(c.Request.Context(), c.Param("id"), token)
	if err != nil {
		mapErr(c, err)
		return
	}
	body, size, err := decodeAttachmentBody(c.GetHeader("Content-Type"), c.Request.Body)
	if err != nil {
		mapErr(c, err)
		return
	}
	n, err := s.Files.Put(key, body)
	if err != nil {
		mapErr(c, err)
		return
	}
	if n != size {
		writeErr(c, 500, "INTERNAL", "upload size mismatch")
		return
	}
	if err := s.Store.CompleteUpload(c.Request.Context(), c.Param("id"), token, n); err != nil {
		mapErr(c, err)
		return
	}
	c.JSON(200, gin.H{"ok": true, "size_bytes": n})
}

func (s *Server) completeReport(c *gin.Context) {
	c.JSON(200, gin.H{"ok": true, "report_id": c.Param("id")})
}

func (s *Server) ingestUpdates(c *gin.Context) {
	p, ok := s.projectFromKey(c)
	if !ok {
		return
	}
	list, err := s.Store.UnseenUpdates(c.Request.Context(), p.ID, c.Query("user_id"), c.Query("email"))
	if err != nil {
		mapErr(c, err)
		return
	}
	c.JSON(200, gin.H{"updates": list})
}

func (s *Server) identify(c *gin.Context) {
	p, ok := s.projectFromKey(c)
	if !ok {
		return
	}
	var body struct {
		UserID     string `json:"user_id"`
		Email      string `json:"email"`
		AppVersion string `json:"app_version"`
	}
	if err := c.BindJSON(&body); err != nil {
		writeErr(c, 400, "INVALID_INPUT", "bad json")
		return
	}
	id, err := s.Store.EnsureReporter(c.Request.Context(), p.ID, body.UserID, body.Email)
	if err != nil {
		mapErr(c, err)
		return
	}
	c.JSON(200, gin.H{"reporter_id": id})
}

func (s *Server) readFile(c *gin.Context) {
	key, err := s.Files.ResolveReadToken(c.Param("token"))
	if err != nil {
		writeErr(c, 404, "NOT_FOUND", "file not found")
		return
	}
	f, err := s.Files.Open(key)
	if err != nil {
		writeErr(c, 404, "NOT_FOUND", "file not found")
		return
	}
	defer f.Close()
	c.Header("Content-Type", "application/octet-stream")
	_, _ = io.Copy(c.Writer, f)
}

func ternary[T any](cond bool, a, b T) T {
	if cond {
		return a
	}
	return b
}
