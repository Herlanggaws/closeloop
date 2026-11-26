package httpapi

import (
	"net/http"
	"testing"

	"github.com/closeloop/api/internal/infrastructure/auth"
)

func TestTeam_InviteAcceptAndViewerBlocked(t *testing.T) {
	h := newReportHarness(t)
	owner := h.seedUserProject("studio")

	code, body := h.do(http.MethodPost, "/api/org/invites", map[string]any{
		"emails": []string{"viewer@test.closeloop"},
		"role":   "viewer",
	}, h.authHeaders(owner.AccessToken))
	if code != 201 {
		t.Fatalf("invite: %d %v", code, body)
	}

	raw := "test-invite-token-raw-value"
	hash := auth.SHA256(raw)
	if _, err := h.db.Exec(`UPDATE invites SET token_hash=$1 WHERE email=$2`, hash, "viewer@test.closeloop"); err != nil {
		t.Fatalf("set token: %v", err)
	}

	code, peek := h.do(http.MethodGet, "/api/invites/"+raw, nil, nil)
	if code != 200 {
		t.Fatalf("peek: %d %v", code, peek)
	}

	code, reg := h.do(http.MethodPost, "/api/auth/register", map[string]any{
		"name": "Viewer", "email": "viewer@test.closeloop", "password": "test-test-test",
	}, nil)
	if code != 200 {
		t.Fatalf("register viewer: %d %v", code, reg)
	}
	viewerToken, _ := reg["access_token"].(string)

	code, accept := h.do(http.MethodPost, "/api/invites/"+raw+"/accept", nil, h.authHeaders(viewerToken))
	if code != 200 {
		t.Fatalf("accept: %d %v", code, accept)
	}

	ticketID, _, _, _, _ := h.ingestReport(owner.PublicKey, map[string]any{
		"type": "bug", "message": "viewer cannot patch",
	})

	code, patch := h.do(http.MethodPatch, "/api/tickets/"+ticketID, map[string]any{
		"status": "in_progress",
	}, h.authHeaders(viewerToken))
	if code != 403 {
		t.Fatalf("viewer patch want 403 got %d %v", code, patch)
	}

	code, ownerPatch := h.do(http.MethodPatch, "/api/tickets/"+ticketID, map[string]any{
		"status": "in_progress",
	}, h.authHeaders(owner.AccessToken))
	if code != 200 {
		t.Fatalf("owner patch: %d %v", code, ownerPatch)
	}
}

func TestTeam_SeatLimitFree(t *testing.T) {
	h := newReportHarness(t)
	owner := h.seedUserProject("free")

	code, body := h.do(http.MethodPost, "/api/org/invites", map[string]any{
		"emails": []string{"extra@test.closeloop"},
		"role":   "member",
	}, h.authHeaders(owner.AccessToken))
	if code != 403 {
		t.Fatalf("free seat limit want 403 got %d %v", code, body)
	}
}

// US-67: Indie includes 2 seats, so one invite fits and the next is refused.
func TestTeam_IndieTwoSeats(t *testing.T) {
	h := newReportHarness(t)
	owner := h.seedUserProject("indie")
	auth := h.authHeaders(owner.AccessToken)
	code, body := h.do(http.MethodPost, "/api/org/invites", map[string]any{
		"emails": []string{"second@test.closeloop"}, "role": "member",
	}, auth)
	if code != 201 {
		t.Fatalf("second seat invite want 201 got %d %v", code, body)
	}
	code, body = h.do(http.MethodPost, "/api/org/invites", map[string]any{
		"emails": []string{"third@test.closeloop"}, "role": "member",
	}, auth)
	if code != 403 || errCode(body) != "SEAT_LIMIT" {
		t.Fatalf("third seat invite want 403 SEAT_LIMIT got %d %v", code, body)
	}
	code, me := h.do(http.MethodGet, "/api/me", nil, auth)
	if code != 200 {
		t.Fatalf("me: %d", code)
	}
	seats := me["usage"].(map[string]any)["seats"].(map[string]any)
	if seats["limit"].(float64) != 2 || seats["used"].(float64) != 2 {
		t.Fatalf("indie seats = %v, want 2 of 2", seats)
	}
}

// inviteAndAccept invites email into owner's workspace and accepts it as token's user.
func inviteAndAccept(t *testing.T, h *reportHarness, ownerToken, email, role, inviteeToken string) {
	t.Helper()
	code, body := h.do(http.MethodPost, "/api/org/invites", map[string]any{
		"emails": []string{email}, "role": role,
	}, h.authHeaders(ownerToken))
	if code != 201 {
		t.Fatalf("invite %s: %d %v", email, code, body)
	}
	raw := "invite-" + email
	if _, err := h.db.Exec(`UPDATE invites SET token_hash=$1 WHERE email=$2`, auth.SHA256(raw), email); err != nil {
		t.Fatalf("set token: %v", err)
	}
	code, body = h.do(http.MethodPost, "/api/invites/"+raw+"/accept", nil, h.authHeaders(inviteeToken))
	if code != 200 {
		t.Fatalf("accept %s: %d %v", email, code, body)
	}
}

func projectIDs(t *testing.T, h *reportHarness, token string) map[string]bool {
	t.Helper()
	code, body := h.do(http.MethodGet, "/api/projects", nil, h.authHeaders(token))
	if code != 200 {
		t.Fatalf("projects: %d %v", code, body)
	}
	out := map[string]bool{}
	list, _ := body["projects"].([]any)
	for _, p := range list {
		out[p.(map[string]any)["id"].(string)] = true
	}
	return out
}

func meOrg(t *testing.T, h *reportHarness, token string) (orgID, plan, role string, orgs []any) {
	t.Helper()
	code, me := h.do(http.MethodGet, "/api/me", nil, h.authHeaders(token))
	if code != 200 {
		t.Fatalf("me: %d %v", code, me)
	}
	org := me["org"].(map[string]any)
	orgs, _ = me["orgs"].([]any)
	return org["id"].(string), org["plan"].(string), me["role"].(string), orgs
}

// A Free user who already has their own project is invited to a Studio workspace.
// They must land on the inviter's workspace and see its projects on the inviter's plan.
func TestTeam_InvitedFreeUserOpensOwnerProject(t *testing.T) {
	h := newReportHarness(t)
	owner := h.seedUserProject("studio")
	invitee := h.seedUserProject("free")

	inviteAndAccept(t, h, owner.AccessToken, invitee.Email, "member", invitee.AccessToken)

	orgID, plan, role, orgs := meOrg(t, h, invitee.AccessToken)
	if orgID != owner.OrgID || plan != "studio" || role != "member" {
		t.Fatalf("after accept want owner's studio workspace as member, got org=%s plan=%s role=%s", orgID, plan, role)
	}
	if len(orgs) != 2 {
		t.Fatalf("want 2 workspaces (own + invited), got %v", orgs)
	}
	ids := projectIDs(t, h, invitee.AccessToken)
	if !ids[owner.ProjectID] || ids[invitee.ProjectID] {
		t.Fatalf("projects in invited workspace = %v, want only owner's %s", ids, owner.ProjectID)
	}
	code, body := h.do(http.MethodGet, "/api/me?project_id="+owner.ProjectID, nil, h.authHeaders(invitee.AccessToken))
	if code != 200 || body["usage"].(map[string]any)["repos"] == nil {
		t.Fatalf("usage for owner project should resolve: %d %v", code, body)
	}

	// Switching back shows their own Free workspace, untouched.
	code, body = h.do(http.MethodPost, "/api/orgs/active", map[string]any{"org_id": invitee.OrgID}, h.authHeaders(invitee.AccessToken))
	if code != 200 {
		t.Fatalf("switch to own: %d %v", code, body)
	}
	orgID, plan, role, _ = meOrg(t, h, invitee.AccessToken)
	if orgID != invitee.OrgID || plan != "free" || role != "owner" {
		t.Fatalf("own workspace want free owner, got org=%s plan=%s role=%s", orgID, plan, role)
	}
	ids = projectIDs(t, h, invitee.AccessToken)
	if !ids[invitee.ProjectID] || ids[owner.ProjectID] {
		t.Fatalf("own workspace projects = %v", ids)
	}

	// Owner-only billing actions stay owner-only inside the invited workspace.
	h.do(http.MethodPost, "/api/orgs/active", map[string]any{"org_id": owner.OrgID}, h.authHeaders(invitee.AccessToken))
	code, _ = h.do(http.MethodPost, "/api/billing/portal", nil, h.authHeaders(invitee.AccessToken))
	if code != 403 {
		t.Fatalf("member billing portal want 403 got %d", code)
	}
}

// A brand-new user who signs up from an invite keeps a Free workspace of their own.
// The inviter's Studio plan applies only inside the inviter's workspace.
func TestTeam_NewSignupFromInviteKeepsOwnFreePlan(t *testing.T) {
	h := newReportHarness(t)
	owner := h.seedUserProject("studio")

	email := "newbie@test.closeloop"
	code, reg := h.do(http.MethodPost, "/api/auth/register", map[string]any{
		"name": "Newbie", "email": email, "password": "test-test-test",
	}, nil)
	if code != 200 {
		t.Fatalf("register: %d %v", code, reg)
	}
	token := reg["access_token"].(string)
	ownOrgID, _, _, _ := meOrg(t, h, token)

	inviteAndAccept(t, h, owner.AccessToken, email, "member", token)

	var ownPlan string
	if err := h.db.QueryRow(`SELECT plan FROM organizations WHERE id=$1`, ownOrgID).Scan(&ownPlan); err != nil {
		t.Fatalf("own workspace must survive accept: %v", err)
	}
	if ownPlan != "free" {
		t.Fatalf("own plan = %s, want free", ownPlan)
	}
	_, _, _, orgs := meOrg(t, h, token)
	plans := map[string]string{}
	for _, o := range orgs {
		m := o.(map[string]any)
		plans[m["id"].(string)] = m["plan"].(string) + "/" + m["role"].(string)
	}
	if plans[ownOrgID] != "free/owner" || plans[owner.OrgID] != "studio/member" {
		t.Fatalf("workspaces = %v", plans)
	}

	// The invitee's own workspace still has Free limits: 1 project, no extra seats.
	h.do(http.MethodPost, "/api/orgs/active", map[string]any{"org_id": ownOrgID}, h.authHeaders(token))
	code, body := h.do(http.MethodPost, "/api/org/invites", map[string]any{
		"emails": []string{"friend@test.closeloop"}, "role": "member",
	}, h.authHeaders(token))
	if code != 403 {
		t.Fatalf("free own workspace invite want 403 got %d %v", code, body)
	}

	// Seats were taken from the inviter's workspace, not the invitee's.
	var seats int
	if err := h.db.QueryRow(`SELECT COUNT(*) FROM memberships WHERE org_id=$1`, owner.OrgID).Scan(&seats); err != nil || seats != 2 {
		t.Fatalf("owner workspace seats = %d (%v), want 2", seats, err)
	}
}

func TestTeam_CannotSwitchToForeignWorkspace(t *testing.T) {
	h := newReportHarness(t)
	owner := h.seedUserProject("studio")
	stranger := h.seedUserProject("free")
	code, body := h.do(http.MethodPost, "/api/orgs/active", map[string]any{"org_id": owner.OrgID}, h.authHeaders(stranger.AccessToken))
	if code != 404 {
		t.Fatalf("switch to foreign workspace want 404 got %d %v", code, body)
	}
	if ids := projectIDs(t, h, stranger.AccessToken); ids[owner.ProjectID] {
		t.Fatal("stranger must not see owner's project")
	}
	code, _ = h.do(http.MethodPost, "/api/orgs/active", map[string]any{"org_id": "not-a-uuid"}, h.authHeaders(stranger.AccessToken))
	if code != 404 {
		t.Fatalf("bad org id want 404 got %d", code)
	}
}

// An expired invite frees its seat; resending it must fit the plan again.
func TestTeam_ResendExpiredInviteChecksSeats(t *testing.T) {
	h := newReportHarness(t)
	owner := h.seedUserProject("studio")
	auth := h.authHeaders(owner.AccessToken)
	limit := 0
	code, me := h.do(http.MethodGet, "/api/me", nil, auth)
	if code != 200 {
		t.Fatalf("me: %d", code)
	}
	limit = int(me["usage"].(map[string]any)["seats"].(map[string]any)["limit"].(float64))
	if limit < 2 {
		t.Fatalf("studio seat limit %d too small for this test", limit)
	}
	emails := []string{}
	for i := 0; i < limit-1; i++ {
		emails = append(emails, "seat"+string(rune('a'+i))+"@test.closeloop")
	}
	if code, body := h.do(http.MethodPost, "/api/org/invites", map[string]any{"emails": emails, "role": "member"}, auth); code != 201 {
		t.Fatalf("fill seats: %d %v", code, body)
	}
	var expiredID string
	if err := h.db.QueryRow(`UPDATE invites SET expires_at = now() - interval '1 day' WHERE email=$1 RETURNING id`, emails[0]).Scan(&expiredID); err != nil {
		t.Fatalf("expire: %v", err)
	}

	// Room again: resending the expired invite works and takes the seat back.
	if code, body := h.do(http.MethodPost, "/api/org/invites/"+expiredID+"/resend", nil, auth); code != 200 {
		t.Fatalf("resend with room: %d %v", code, body)
	}

	// Expire it again and give its seat to someone else: now resend must be refused.
	if _, err := h.db.Exec(`UPDATE invites SET expires_at = now() - interval '1 day' WHERE id=$1`, expiredID); err != nil {
		t.Fatalf("expire again: %v", err)
	}
	if code, body := h.do(http.MethodPost, "/api/org/invites", map[string]any{"emails": []string{"newcomer@test.closeloop"}, "role": "member"}, auth); code != 201 {
		t.Fatalf("newcomer: %d %v", code, body)
	}
	code, body := h.do(http.MethodPost, "/api/org/invites/"+expiredID+"/resend", nil, auth)
	if code != 403 || errCode(body) != "SEAT_LIMIT" {
		t.Fatalf("resend over limit want 403 SEAT_LIMIT got %d %v", code, body)
	}
}
