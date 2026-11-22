package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/closeloop/api/internal/application"
	"github.com/gin-gonic/gin"
)

type mcpReq struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      any             `json:"id"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params"`
}

func (s *Server) mcpHandler(c *gin.Context) {
	if c.Request.Method == http.MethodGet {
		c.JSON(200, gin.H{"ok": true, "transport": "streamable-http"})
		return
	}
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		writeErr(c, 400, "INVALID_INPUT", "bad body")
		return
	}
	var req mcpReq
	if err := json.Unmarshal(body, &req); err != nil {
		c.JSON(200, mcpError(nil, -32700, "parse error"))
		return
	}
	authz := c.GetHeader("Authorization")
	if !strings.HasPrefix(authz, "Bearer ") {
		c.JSON(401, mcpError(req.ID, -32001, "unauthorized"))
		return
	}
	token := strings.TrimPrefix(authz, "Bearer ")
	projectID, scopes, _, err := s.Store.MCPByToken(c.Request.Context(), token)
	if err != nil {
		c.JSON(401, mcpError(req.ID, -32001, "unauthorized"))
		return
	}
	// Every plan gets all MCP tools (US-60); only the token scope decides write access.
	canWrite := contains(scopes, "write")

	switch req.Method {
	case "initialize":
		var initParams struct {
			ClientInfo struct {
				Name    string `json:"name"`
				Version string `json:"version"`
			} `json:"clientInfo"`
		}
		_ = json.Unmarshal(req.Params, &initParams)
		if initParams.ClientInfo.Name != "" {
			s.Store.RecordMCPClient(c.Request.Context(), token, initParams.ClientInfo.Name)
		}
		c.JSON(200, mcpResult(req.ID, map[string]any{
			"protocolVersion": "2024-11-05",
			"capabilities":    map[string]any{"tools": map[string]any{}},
			"serverInfo":      map[string]any{"name": "closeloop", "version": "0.1.0"},
		}))
	case "notifications/initialized", "notifications/cancelled":
		c.Status(202)
	case "tools/list":
		c.JSON(200, mcpResult(req.ID, map[string]any{"tools": mcpTools()}))
	case "tools/call":
		var params struct {
			Name      string         `json:"name"`
			Arguments map[string]any `json:"arguments"`
		}
		_ = json.Unmarshal(req.Params, &params)
		result, callErr := s.callMCPTool(c, projectID, canWrite, params.Name, params.Arguments)
		if errors.Is(callErr, application.ErrRepoNotConnected) {
			b, _ := json.MarshalIndent(map[string]any{"error": map[string]any{
				"code":    "REPO_NOT_CONNECTED",
				"message": "That repo is not connected to this project. Connect it in Integrations, or call without repo.",
			}}, "", "  ")
			c.JSON(200, mcpResult(req.ID, map[string]any{
				"content": []map[string]any{{"type": "text", "text": string(b)}},
				"isError": true,
			}))
			return
		}
		if errors.Is(callErr, application.ErrQuotaLocked) {
			b, _ := json.MarshalIndent(map[string]any{"error": quotaLockedPayload(s.upgradeURL())}, "", "  ")
			c.JSON(200, mcpResult(req.ID, map[string]any{
				"content": []map[string]any{{"type": "text", "text": string(b)}},
				"isError": true,
			}))
			return
		}
		if callErr != nil {
			c.JSON(200, mcpResult(req.ID, map[string]any{
				"content": []map[string]any{{"type": "text", "text": callErr.Error()}},
				"isError": true,
			}))
			return
		}
		b, _ := json.MarshalIndent(result, "", "  ")
		c.JSON(200, mcpResult(req.ID, map[string]any{
			"content": []map[string]any{{"type": "text", "text": string(b)}},
		}))
	case "ping":
		c.JSON(200, mcpResult(req.ID, map[string]any{}))
	default:
		c.JSON(200, mcpError(req.ID, -32601, "method not found"))
	}
}

func mcpTools() []map[string]any {
	return []map[string]any{
		{"name": "list_open_feedback", "description": "List open tickets. Pass repo (owner/name from `git remote get-url origin`) to get only that repo's tickets plus tickets with no repo yet.", "inputSchema": map[string]any{
			"type": "object",
			"properties": map[string]any{
				"type":     map[string]any{"type": "string"},
				"status":   map[string]any{"type": "string"},
				"platform": map[string]any{"type": "string"},
				"repo":     map[string]any{"type": "string", "description": "owner/name of the repo you are running in"},
				"limit":    map[string]any{"type": "number"},
			},
		}},
		{"name": "get_feedback_context", "description": "Get full ticket context", "inputSchema": map[string]any{
			"type":       "object",
			"properties": map[string]any{"ticket_id": map[string]any{"type": "string"}},
			"required":   []string{"ticket_id"},
		}},
		{"name": "update_status", "description": "Update ticket status", "inputSchema": map[string]any{
			"type": "object",
			"properties": map[string]any{
				"ticket_id": map[string]any{"type": "string"},
				"status":    map[string]any{"type": "string"},
			},
			"required": []string{"ticket_id", "status"},
		}},
		{"name": "add_note", "description": "Add internal note", "inputSchema": map[string]any{
			"type": "object",
			"properties": map[string]any{
				"ticket_id": map[string]any{"type": "string"},
				"body":      map[string]any{"type": "string"},
			},
			"required": []string{"ticket_id", "body"},
		}},
		{"name": "mark_fixed", "description": "Mark ticket fixed and notify reporters. If some reporters are on a platform the ticket's repo does not serve, you get a warning and must pass confirm: true.", "inputSchema": map[string]any{
			"type": "object",
			"properties": map[string]any{
				"ticket_id": map[string]any{"type": "string"},
				"note":      map[string]any{"type": "string"},
				"confirm":   map[string]any{"type": "boolean"},
			},
			"required": []string{"ticket_id"},
		}},
		{"name": "reroute_feedback", "description": "Move a ticket to another repo in this project when the root cause lives there", "inputSchema": map[string]any{
			"type": "object",
			"properties": map[string]any{
				"ticket_id": map[string]any{"type": "string"},
				"repo":      map[string]any{"type": "string", "description": "owner/name of a repo connected to this project"},
				"reason":    map[string]any{"type": "string"},
			},
			"required": []string{"ticket_id", "repo", "reason"},
		}},
	}
}

func (s *Server) auditMCP(c *gin.Context, projectID, tool, target string, payload map[string]any) {
	p, err := s.Store.ProjectByID(c.Request.Context(), projectID)
	if err != nil {
		return
	}
	s.writeAudit(c, p.OrgID, "agent:mcp", "mcp."+tool, target, payload)
}

func (s *Server) callMCPTool(c *gin.Context, projectID string, canWrite bool, name string, args map[string]any) (any, error) {
	str := func(k string) string {
		if v, ok := args[k].(string); ok {
			return v
		}
		return ""
	}
	switch name {
	case "list_open_feedback":
		status := str("status")
		if status == "" {
			status = "open"
		}
		filter := application.TicketFilter{Status: status, Type: str("type"), Platform: str("platform")}
		if repo := strings.TrimSpace(str("repo")); repo != "" {
			r, err := s.Store.ProjectRepoByFullName(c.Request.Context(), projectID, repo)
			if err != nil {
				return nil, err
			}
			filter.Repo, filter.RepoOrNone = r.ID, true
		}
		list, err := s.Store.ListTicketsFiltered(c.Request.Context(), projectID, filter)
		if err != nil {
			return nil, err
		}
		return list, nil
	case "get_feedback_context":
		t, err := s.Store.GetTicket(c.Request.Context(), str("ticket_id"))
		if err != nil {
			return nil, err
		}
		if t.ProjectID != projectID {
			return nil, application.ErrForbidden
		}
		reports, _ := s.Store.TicketReports(c.Request.Context(), t.ID)
		atts, _ := s.Store.TicketAttachments(c.Request.Context(), t.ID)
		var urls []string
		for _, a := range atts {
			if a.Uploaded {
				if u, err := s.Files.SignedReadURL(a.StorageKey, 10*time.Minute); err == nil {
					urls = append(urls, u)
				}
			}
		}
		platform := ""
		if len(reports) > 0 {
			platform = reports[0].Platform
		}
		return map[string]any{
			"ticket":          t,
			"reports":         reports,
			"screenshot_urls": urls,
			"repo":            t.RepoFullName,
			"repo_path":       t.RepoPath,
			"platform":        platform,
		}, nil
	case "update_status":
		if !canWrite {
			return nil, application.ErrPlanRequired
		}
		t, err := s.Store.GetTicket(c.Request.Context(), str("ticket_id"))
		if err != nil {
			return nil, err
		}
		if t.ProjectID != projectID {
			return nil, application.ErrForbidden
		}
		fromStatus := t.Status
		toStatus := str("status")
		if err := s.Store.UpdateTicketStatus(c.Request.Context(), t.ID, toStatus, "agent", ""); err != nil {
			return nil, err
		}
		if toStatus == "fixed" {
			_ = s.Store.EnqueueNotify(c.Request.Context(), t.ID, application.DefaultNotifyChannels())
			_ = s.Store.EnqueueVoteReleased(c.Request.Context(), t.ID)
		}
		statusEv := application.SlackNotifyEvent{
			TicketID: t.ID,
			Event:    "status_changed",
			From:     fromStatus,
			To:       toStatus,
		}
		_ = s.Store.EnqueueSlackNotify(c.Request.Context(), t.ProjectID, statusEv)
		_ = s.Store.EnqueueOutboundWebhook(c.Request.Context(), t.ProjectID, statusEv)
		s.auditMCP(c, projectID, "update_status", t.ID, map[string]any{"from": fromStatus, "to": toStatus})
		return s.Store.GetTicket(c.Request.Context(), t.ID)
	case "add_note":
		if !canWrite {
			return nil, application.ErrPlanRequired
		}
		t, err := s.Store.GetTicket(c.Request.Context(), str("ticket_id"))
		if err != nil {
			return nil, err
		}
		if t.ProjectID != projectID {
			return nil, application.ErrForbidden
		}
		if err := s.Store.AddNote(c.Request.Context(), t.ID, "agent", str("body")); err != nil {
			return nil, err
		}
		s.auditMCP(c, projectID, "add_note", t.ID, nil)
		return map[string]any{"ok": true}, nil
	case "mark_fixed":
		if !canWrite {
			return nil, application.ErrPlanRequired
		}
		t, err := s.Store.GetTicket(c.Request.Context(), str("ticket_id"))
		if err != nil {
			return nil, err
		}
		if t.ProjectID != projectID {
			return nil, application.ErrForbidden
		}
		note := str("note")
		// US-55: warn before telling reporters on platforms this repo does not serve.
		if confirmed, _ := args["confirm"].(bool); !confirmed {
			_, uncovered := s.uncoveredPlatforms(c, t)
			if len(uncovered) > 0 {
				platforms := platformList(uncovered)
				return nil, &mcpWarning{payload: map[string]any{
					"warning":              "CROSS_PLATFORM",
					"message":              labelList(platforms) + " reporters may not have the fix yet. This ticket is routed to " + t.RepoFullName + ". Call mark_fixed again with confirm: true to notify everyone.",
					"uncovered_platforms":  platforms,
					"reporters_by_platform": uncovered,
				}}
			}
		}
		fromStatus := t.Status
		if err := s.Store.UpdateTicketStatus(c.Request.Context(), t.ID, "fixed", "agent", note); err != nil {
			return nil, err
		}
		if err := s.Store.EnqueueNotify(c.Request.Context(), t.ID, application.DefaultNotifyChannels()); err != nil {
			return nil, err
		}
		_ = s.Store.EnqueueVoteReleased(c.Request.Context(), t.ID)
		fixedEv := application.SlackNotifyEvent{
			TicketID: t.ID,
			Event:    "status_changed",
			From:     fromStatus,
			To:       "fixed",
			Note:     note,
		}
		_ = s.Store.EnqueueSlackNotify(c.Request.Context(), t.ProjectID, fixedEv)
		_ = s.Store.EnqueueOutboundWebhook(c.Request.Context(), t.ProjectID, fixedEv)
		s.auditMCP(c, projectID, "mark_fixed", t.ID, map[string]any{"from": fromStatus})
		return map[string]any{"queued": true, "ticket_id": t.ID}, nil
	case "reroute_feedback":
		if !canWrite {
			return nil, application.ErrPlanRequired
		}
		reason := strings.TrimSpace(str("reason"))
		if reason == "" {
			return nil, application.ErrInvalidInput
		}
		t, err := s.Store.GetTicket(c.Request.Context(), str("ticket_id"))
		if err != nil {
			return nil, err
		}
		if t.ProjectID != projectID {
			return nil, application.ErrForbidden
		}
		repo, err := s.Store.ProjectRepoByFullName(c.Request.Context(), projectID, str("repo"))
		if err != nil {
			return nil, err
		}
		updated, err := s.Store.RerouteTicket(c.Request.Context(), t.ID, repo.ID, "agent", reason, "agent")
		if err != nil {
			return nil, err
		}
		s.auditMCP(c, projectID, "reroute_feedback", t.ID, map[string]any{"to": repo.FullName})
		return updated, nil
	default:
		return nil, application.ErrNotFound
	}
}

// mcpWarning is returned as a non-fatal tool error whose body is JSON.
type mcpWarning struct{ payload map[string]any }

func (w *mcpWarning) Error() string {
	b, _ := json.MarshalIndent(w.payload, "", "  ")
	return string(b)
}

func mcpResult(id any, result any) map[string]any {
	return map[string]any{"jsonrpc": "2.0", "id": id, "result": result}
}

func mcpError(id any, code int, message string) map[string]any {
	return map[string]any{"jsonrpc": "2.0", "id": id, "error": map[string]any{"code": code, "message": message}}
}

func contains(list []string, v string) bool {
	return slices.Contains(list, v)
}
