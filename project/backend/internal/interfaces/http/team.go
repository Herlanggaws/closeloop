package httpapi

import (
	"strings"

	"github.com/closeloop/api/internal/application"
	"github.com/closeloop/api/internal/infrastructure/email"
	"github.com/gin-gonic/gin"
)

func (s *Server) orgRole(c *gin.Context) (application.Org, string, bool) {
	org, role, err := s.Store.PrimaryOrg(c.Request.Context(), c.GetString("userID"))
	if err != nil {
		mapErr(c, err)
		return application.Org{}, "", false
	}
	return org, role, true
}

func (s *Server) requireOrgOwner(c *gin.Context) (application.Org, bool) {
	org, role, ok := s.orgRole(c)
	if !ok {
		return application.Org{}, false
	}
	if role != "owner" {
		writeErr(c, 403, "FORBIDDEN", "owner role required")
		return application.Org{}, false
	}
	return org, true
}

func (s *Server) requireTicketWrite(c *gin.Context, projectID string) bool {
	if !s.requireProjectAccess(c, projectID) {
		return false
	}
	role, err := s.Store.RoleForProject(c.Request.Context(), c.GetString("userID"), projectID)
	if err != nil {
		mapErr(c, err)
		return false
	}
	if !application.CanWriteTickets(role) {
		writeErr(c, 403, "FORBIDDEN", "viewer cannot modify tickets")
		return false
	}
	return true
}

func (s *Server) listOrgMembers(c *gin.Context) {
	org, _, ok := s.orgRole(c)
	if !ok {
		return
	}
	members, err := s.Store.ListOrgMembers(c.Request.Context(), org.ID)
	if err != nil {
		mapErr(c, err)
		return
	}
	invites, err := s.Store.ListPendingInvites(c.Request.Context(), org.ID)
	if err != nil {
		mapErr(c, err)
		return
	}
	usage, err := s.Store.OrgUsage(c.Request.Context(), org.ID)
	if err != nil {
		mapErr(c, err)
		return
	}
	c.JSON(200, gin.H{
		"members": members,
		"invites": invites,
		"usage":   usage,
	})
}

func (s *Server) createOrgInvites(c *gin.Context) {
	org, ok := s.requireOrgOwner(c)
	if !ok {
		return
	}
	var body struct {
		Emails []string `json:"emails"`
		Role   string   `json:"role"`
	}
	if err := c.BindJSON(&body); err != nil {
		writeErr(c, 400, "INVALID_INPUT", "bad json")
		return
	}
	invites, rawTokens, err := s.Store.CreateInvites(c.Request.Context(), org.ID, c.GetString("userID"), body.Role, body.Emails)
	if err != nil {
		mapErr(c, err)
		return
	}

	user, _ := s.Store.UserByID(c.Request.Context(), c.GetString("userID"))
	inviterName := user.Name
	if inviterName == "" {
		inviterName = user.Email
	}
	for i, inv := range invites {
		url := strings.TrimRight(s.Cfg.WebURL, "/") + "/invite/" + rawTokens[i]
		_ = s.Mailer.Send(
			inv.Email,
			email.InviteSubject(org.Name),
			email.RenderInviteHTML(email.InviteMail{
				To:           inv.Email,
				OrgName:      org.Name,
				InviterName:  inviterName,
				Role:         inv.Role,
				AcceptURL:    url,
				GreetingName: email.GreetingFromEmail(inv.Email),
			}),
		)
	}
	s.writeAudit(c, org.ID, "", "team.invite_created", org.ID, map[string]any{
		"emails": body.Emails, "role": body.Role, "count": len(invites),
	})
	c.JSON(201, gin.H{"invites": invites})
}

func (s *Server) resendOrgInvite(c *gin.Context) {
	org, ok := s.requireOrgOwner(c)
	if !ok {
		return
	}
	inv, raw, err := s.Store.ResendInvite(c.Request.Context(), org.ID, c.Param("id"), c.GetString("userID"))
	if err != nil {
		mapErr(c, err)
		return
	}
	user, _ := s.Store.UserByID(c.Request.Context(), c.GetString("userID"))
	inviterName := user.Name
	if inviterName == "" {
		inviterName = user.Email
	}
	url := strings.TrimRight(s.Cfg.WebURL, "/") + "/invite/" + raw
	_ = s.Mailer.Send(
		inv.Email,
		email.InviteSubject(org.Name),
		email.RenderInviteHTML(email.InviteMail{
			To:           inv.Email,
			OrgName:      org.Name,
			InviterName:  inviterName,
			Role:         inv.Role,
			AcceptURL:    url,
			GreetingName: email.GreetingFromEmail(inv.Email),
		}),
	)
	c.JSON(200, gin.H{"invite": inv})
}

func (s *Server) revokeOrgInvite(c *gin.Context) {
	org, ok := s.requireOrgOwner(c)
	if !ok {
		return
	}
	if err := s.Store.RevokeInvite(c.Request.Context(), org.ID, c.Param("id")); err != nil {
		mapErr(c, err)
		return
	}
	c.Status(204)
}

func (s *Server) patchOrgMember(c *gin.Context) {
	org, role, ok := s.orgRole(c)
	if !ok {
		return
	}
	var body struct {
		Role string `json:"role"`
	}
	if err := c.BindJSON(&body); err != nil {
		writeErr(c, 400, "INVALID_INPUT", "bad json")
		return
	}
	if err := s.Store.UpdateMemberRole(c.Request.Context(), org.ID, c.Param("userId"), body.Role, role); err != nil {
		mapErr(c, err)
		return
	}
	s.writeAudit(c, org.ID, "", "team.role_changed", c.Param("userId"), map[string]any{
		"role": body.Role,
	})
	c.JSON(200, gin.H{"ok": true})
}

func (s *Server) deleteOrgMember(c *gin.Context) {
	org, role, ok := s.orgRole(c)
	if !ok {
		return
	}
	if err := s.Store.RemoveMember(c.Request.Context(), org.ID, c.Param("userId"), c.GetString("userID"), role); err != nil {
		mapErr(c, err)
		return
	}
	c.Status(204)
}

func (s *Server) peekInvite(c *gin.Context) {
	peek, err := s.Store.PeekInvite(c.Request.Context(), c.Param("token"))
	if err != nil {
		mapErr(c, err)
		return
	}
	c.JSON(200, gin.H{"invite": peek})
}

func (s *Server) acceptInvite(c *gin.Context) {
	user, err := s.Store.UserByID(c.Request.Context(), c.GetString("userID"))
	if err != nil {
		mapErr(c, err)
		return
	}
	org, role, err := s.Store.AcceptInvite(c.Request.Context(), c.Param("token"), user.ID, user.Email)
	if err != nil {
		mapErr(c, err)
		return
	}
	c.JSON(200, gin.H{"org": org, "role": role})
}
