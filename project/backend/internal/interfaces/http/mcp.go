package httpapi

import (
	"encoding/json"
	"io"
	"net/http"
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
	projectID, scopes, plan, err := s.Store.MCPByToken(c.Request.Context(), token)
	if err != nil {
		c.JSON(401, mcpError(req.ID, -32001, "unauthorized"))
		return
	}
	canWrite := contains(scopes, "write") && plan != "free"

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
		{"name": "list_open_feedback", "description": "List open tickets", "inputSchema": map[string]any{
			"type": "object",
			"properties": map[string]any{
				"type":     map[string]any{"type": "string"},
				"status":   map[string]any{"type": "string"},
				"platform": map[string]any{"type": "string"},
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
		{"name": "mark_fixed", "description": "Mark ticket fixed and notify reporters", "inputSchema": map[string]any{
			"type": "object",
			"properties": map[string]any{
				"ticket_id": map[string]any{"type": "string"},
				"note":      map[string]any{"type": "string"},
			},
			"required": []string{"ticket_id"},
		}},
	}
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
		list, err := s.Store.ListTickets(c.Request.Context(), projectID, status, str("type"), str("platform"))
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
		return map[string]any{"ticket": t, "reports": reports, "screenshot_urls": urls}, nil
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
		if err := s.Store.UpdateTicketStatus(c.Request.Context(), t.ID, str("status"), "agent", ""); err != nil {
			return nil, err
		}
		if str("status") == "fixed" {
			_ = s.Store.EnqueueNotify(c.Request.Context(), t.ID)
		}
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
		if err := s.Store.UpdateTicketStatus(c.Request.Context(), t.ID, "fixed", "agent", note); err != nil {
			return nil, err
		}
		if err := s.Store.EnqueueNotify(c.Request.Context(), t.ID); err != nil {
			return nil, err
		}
		return map[string]any{"queued": true, "ticket_id": t.ID}, nil
	default:
		return nil, application.ErrNotFound
	}
}

func mcpResult(id any, result any) map[string]any {
	return map[string]any{"jsonrpc": "2.0", "id": id, "result": result}
}

func mcpError(id any, code int, message string) map[string]any {
	return map[string]any{"jsonrpc": "2.0", "id": id, "error": map[string]any{"code": code, "message": message}}
}

func contains(list []string, v string) bool {
	for _, x := range list {
		if x == v {
			return true
		}
	}
	return false
}
