package httpapi

import (
	"encoding/csv"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/closeloop/api/internal/application"
	"github.com/gin-gonic/gin"
)

func (s *Server) writeAudit(c *gin.Context, orgID, actor, action, target string, payload map[string]any) {
	if s.Store == nil || orgID == "" || action == "" {
		return
	}
	if actor == "" {
		if email := c.GetString("email"); email != "" {
			actor = "user:" + email
		} else if uid := c.GetString("userID"); uid != "" {
			actor = "user:" + uid
		} else {
			actor = "system"
		}
	}
	ip := c.ClientIP()
	if err := s.Store.InsertAudit(c.Request.Context(), orgID, actor, action, target, ip, payload); err != nil {
		// Audit must not break the primary action.
		_ = err
	}
}

func (s *Server) writeAuditForUser(c *gin.Context, user application.User, action, target string, payload map[string]any) {
	if s.Store == nil {
		return
	}
	org, _, err := s.Store.PrimaryOrg(c.Request.Context(), user.ID)
	if err != nil {
		return
	}
	s.writeAudit(c, org.ID, "user:"+user.Email, action, target, payload)
}

func (s *Server) requireBusinessOwner(c *gin.Context) (application.Org, bool) {
	org, ok := s.requireOrgOwner(c)
	if !ok {
		return application.Org{}, false
	}
	if application.NormalizePlan(org.Plan) != "business" {
		writeErr(c, 403, "PLAN_REQUIRED", "audit log requires Business plan")
		return application.Org{}, false
	}
	return org, true
}

func (s *Server) listAuditLogs(c *gin.Context) {
	org, ok := s.requireBusinessOwner(c)
	if !ok {
		return
	}
	filter := application.AuditFilter{
		Action: strings.TrimSpace(c.Query("action")),
		Actor:  strings.TrimSpace(c.Query("actor")),
	}
	if days := strings.TrimSpace(c.Query("days")); days != "" {
		n, err := strconv.Atoi(days)
		if err == nil && n > 0 {
			filter.Since = time.Now().UTC().AddDate(0, 0, -n)
		}
	}
	if lim := strings.TrimSpace(c.Query("limit")); lim != "" {
		n, err := strconv.Atoi(lim)
		if err == nil {
			filter.Limit = n
		}
	}
	list, err := s.Store.ListAuditLogs(c.Request.Context(), org.ID, filter)
	if err != nil {
		mapErr(c, err)
		return
	}
	if list == nil {
		list = []application.AuditEntry{}
	}
	c.JSON(200, gin.H{"entries": list})
}

func (s *Server) exportAuditLogs(c *gin.Context) {
	org, ok := s.requireBusinessOwner(c)
	if !ok {
		return
	}
	filter := application.AuditFilter{
		Action: strings.TrimSpace(c.Query("action")),
		Actor:  strings.TrimSpace(c.Query("actor")),
		Limit:  500,
	}
	if days := strings.TrimSpace(c.Query("days")); days != "" {
		n, err := strconv.Atoi(days)
		if err == nil && n > 0 {
			filter.Since = time.Now().UTC().AddDate(0, 0, -n)
		}
	} else {
		filter.Since = time.Now().UTC().AddDate(0, 0, -30)
	}
	list, err := s.Store.ListAuditLogs(c.Request.Context(), org.ID, filter)
	if err != nil {
		mapErr(c, err)
		return
	}
	format := strings.ToLower(strings.TrimSpace(c.Query("format")))
	if format == "json" {
		c.Header("Content-Disposition", `attachment; filename="audit-log.json"`)
		c.JSON(200, gin.H{"entries": list})
		return
	}

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", `attachment; filename="audit-log.csv"`)
	c.Status(http.StatusOK)
	w := csv.NewWriter(c.Writer)
	_ = w.Write([]string{"created_at", "actor", "action", "target", "ip", "payload"})
	for _, e := range list {
		payload := "{}"
		if len(e.Payload) > 0 {
			payload = string(e.Payload)
		}
		_ = w.Write([]string{
			e.CreatedAt.UTC().Format(time.RFC3339),
			e.Actor,
			e.Action,
			e.Target,
			e.IP,
			payload,
		})
	}
	w.Flush()
}
