package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
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
	Cfg    config.Config
	Store  *application.Store
	Files  *storage.FSStore
	Mailer *email.Mailer
}

func New(cfg config.Config, store *application.Store, files *storage.FSStore, mailer *email.Mailer) *Server {
	return &Server{Cfg: cfg, Store: store, Files: files, Mailer: mailer}
}

func (s *Server) Router() *gin.Engine {
	r := gin.Default()
	r.Use(cors(s.Cfg.WebURL))

	r.GET("/healthz", func(c *gin.Context) { c.JSON(200, gin.H{"ok": true}) })

	api := r.Group("/api")
	{
		api.POST("/auth/register", s.register)
		api.POST("/auth/login", s.login)
		api.POST("/auth/refresh", s.refresh)
		api.POST("/auth/logout", s.logout)
		api.GET("/me", s.authRequired(), s.me)
		api.GET("/projects", s.authRequired(), s.listProjects)
		api.POST("/projects", s.authRequired(), s.createProject)
		api.GET("/projects/:id", s.authRequired(), s.getProject)
		api.PATCH("/projects/:id", s.authRequired(), s.patchProject)
		api.GET("/projects/:id/mcp-tokens", s.authRequired(), s.listMCPTokens)
		api.POST("/projects/:id/mcp-tokens", s.authRequired(), s.createMCPToken)
		api.DELETE("/projects/:id/mcp-tokens/:tokenId", s.authRequired(), s.deleteMCPToken)
		api.GET("/projects/:id/tickets", s.authRequired(), s.listTickets)
		api.GET("/tickets/:id", s.authRequired(), s.getTicket)
		api.PATCH("/tickets/:id", s.authRequired(), s.patchTicket)
		api.POST("/tickets/:id/notes", s.authRequired(), s.addNote)
		api.POST("/tickets/merge", s.authRequired(), s.mergeTickets)
	}

	ingest := r.Group("/v1/ingest")
	{
		ingest.POST("/reports", s.ingestReport)
		ingest.PUT("/attachments/:id/upload", s.uploadAttachment)
		ingest.POST("/reports/:id/complete", s.completeReport)
		ingest.GET("/updates", s.ingestUpdates)
		ingest.POST("/identify", s.identify)
	}

	r.GET("/v1/files/:token", s.readFile)
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
	case errors.Is(err, application.ErrPlanRequired):
		writeErr(c, 402, "PLAN_REQUIRED", "Upgrade required for this action")
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
	c.JSON(200, gin.H{"access_token": access, "user": gin.H{"id": user.ID, "email": user.Email, "name": user.Name}})
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
	org, role, err := s.Store.PrimaryOrg(c.Request.Context(), userID)
	if err != nil {
		mapErr(c, err)
		return
	}
	c.JSON(200, gin.H{
		"user": gin.H{"id": userID, "email": c.GetString("email")},
		"org":  gin.H{"id": org.ID, "name": org.Name, "plan": org.Plan},
		"role": role,
	})
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
	c.JSON(200, gin.H{"project": p, "public_key": key})
}

func (s *Server) patchProject(c *gin.Context) {
	id := c.Param("id")
	if !s.requireProjectAccess(c, id) {
		return
	}
	var body struct {
		NotifyEnabled      *bool     `json:"notify_enabled"`
		SensitiveSelectors *[]string `json:"sensitive_selectors"`
	}
	if err := c.BindJSON(&body); err != nil {
		writeErr(c, 400, "INVALID_INPUT", "bad json")
		return
	}
	if err := s.Store.UpdateProjectSettings(c.Request.Context(), id, body.NotifyEnabled, body.SensitiveSelectors); err != nil {
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
	if !s.requireProjectAccess(c, id) {
		return
	}
	org, _, err := s.Store.PrimaryOrg(c.Request.Context(), c.GetString("userID"))
	if err != nil {
		mapErr(c, err)
		return
	}
	write := org.Plan != "free"
	raw, prefix, err := s.Store.CreateMCPToken(c.Request.Context(), id, write)
	if err != nil {
		mapErr(c, err)
		return
	}
	c.JSON(201, gin.H{"token": raw, "prefix": prefix, "scopes": ternary(write, []string{"read", "write"}, []string{"read"})})
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
	c.JSON(200, gin.H{"ok": true})
}

func (s *Server) listTickets(c *gin.Context) {
	id := c.Param("id")
	if !s.requireProjectAccess(c, id) {
		return
	}
	list, err := s.Store.ListTickets(c.Request.Context(), id, c.Query("status"), c.Query("type"), c.Query("platform"))
	if err != nil {
		mapErr(c, err)
		return
	}
	c.JSON(200, gin.H{"tickets": list})
}

func (s *Server) getTicket(c *gin.Context) {
	t, err := s.Store.GetTicket(c.Request.Context(), c.Param("id"))
	if err != nil {
		mapErr(c, err)
		return
	}
	if !s.requireProjectAccess(c, t.ProjectID) {
		return
	}
	reports, _ := s.Store.TicketReports(c.Request.Context(), t.ID)
	events, _ := s.Store.ListTicketEvents(c.Request.Context(), t.ID)
	atts, _ := s.Store.TicketAttachments(c.Request.Context(), t.ID)
	reporterTotal, reporterEmail, _ := s.Store.TicketReporterStats(c.Request.Context(), t.ID)
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
	c.JSON(200, gin.H{
		"ticket":      t,
		"reports":     reports,
		"attachments": attOut,
		"events":      events,
		"reporters": gin.H{
			"total":      reporterTotal,
			"with_email": reporterEmail,
		},
	})
}

func (s *Server) patchTicket(c *gin.Context) {
	var body struct {
		Status string `json:"status"`
		Note   string `json:"note"`
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
	if !s.requireProjectAccess(c, t.ProjectID) {
		return
	}
	if err := s.Store.UpdateTicketStatus(c.Request.Context(), t.ID, body.Status, "user:"+c.GetString("email"), body.Note); err != nil {
		mapErr(c, err)
		return
	}
	if body.Status == "fixed" {
		_ = s.Store.EnqueueNotify(c.Request.Context(), t.ID)
	}
	t, _ = s.Store.GetTicket(c.Request.Context(), t.ID)
	c.JSON(200, gin.H{"ticket": t})
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
	if !s.requireProjectAccess(c, t.ProjectID) {
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
	if !s.requireProjectAccess(c, t.ProjectID) {
		return
	}
	actor := "user:" + c.GetString("email")
	if err := s.Store.MergeTickets(c.Request.Context(), body.ParentID, actor, body.ChildIDs); err != nil {
		mapErr(c, err)
		return
	}
	c.JSON(200, gin.H{"ok": true})
}

func (s *Server) projectFromKey(c *gin.Context) (application.Project, bool) {
	key := c.GetHeader("X-Closeloop-Key")
	if key == "" {
		key = c.Query("key")
	}
	p, err := s.Store.ProjectByPublicKey(c.Request.Context(), key)
	if err != nil {
		mapErr(c, err)
		return application.Project{}, false
	}
	return p, true
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
	c.JSON(201, gin.H{
		"ticket_id":     ticketID,
		"report_id":     reportID,
		"attachment_id": attID,
		"upload_url":    s.Files.UploadURL(attID, token),
		"upload_token":  token,
		"storage_key":   key,
	})
}

func (s *Server) uploadAttachment(c *gin.Context) {
	token := c.Query("token")
	key, err := s.Store.AttachmentForUpload(c.Request.Context(), c.Param("id"), token)
	if err != nil {
		mapErr(c, err)
		return
	}
	n, err := s.Files.Put(key, c.Request.Body)
	if err != nil {
		mapErr(c, err)
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

func mustDecode(data []byte, v any) {
	_ = json.Unmarshal(data, v)
}
