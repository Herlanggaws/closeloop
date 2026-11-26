package httpapi

import (
	"net/http"
	"testing"

	"github.com/closeloop/api/internal/infrastructure/auth"
)

// Downgrade freeze (audit 26 Nov): Indie → Free keeps data but freezes whatever sits
// beyond the Free limits; an upgrade brings it back.

func (h *reportHarness) setOrgPlan(orgID, plan string) {
	h.t.Helper()
	if _, err := h.db.Exec(`UPDATE organizations SET plan=$2 WHERE id=$1`, orgID, plan); err != nil {
		h.t.Fatal(err)
	}
}

// inviteAndRegister sends an invite and registers the invitee; it returns the raw
// invite token and the invitee's access token (not yet accepted).
func (h *reportHarness) inviteAndRegister(owner seededProject, email, role string) (raw, token string) {
	h.t.Helper()
	code, body := h.do(http.MethodPost, "/api/org/invites", map[string]any{
		"emails": []string{email}, "role": role,
	}, h.authHeaders(owner.AccessToken))
	if code != 201 {
		h.t.Fatalf("invite: %d %v", code, body)
	}
	raw = "raw-" + email
	if _, err := h.db.Exec(`UPDATE invites SET token_hash=$1 WHERE email=$2`, auth.SHA256(raw), email); err != nil {
		h.t.Fatal(err)
	}
	code, reg := h.do(http.MethodPost, "/api/auth/register", map[string]any{
		"name": "Invitee", "email": email, "password": "test-test-test",
	}, nil)
	if code != 200 {
		h.t.Fatalf("register: %d %v", code, reg)
	}
	return raw, reg["access_token"].(string)
}

func TestDowngrade_ExtraProjectsStopTakingReports(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	code, proj := h.do(http.MethodPost, "/api/projects", map[string]any{
		"name": "Second", "platforms": []string{"web"},
	}, h.authHeaders(seed.AccessToken))
	if code != 201 {
		t.Fatalf("second project: %d %v", code, proj)
	}
	secondID := proj["project"].(map[string]any)["id"].(string)
	secondKey := proj["public_key"].(string)
	report := map[string]any{"type": "bug", "message": "after downgrade", "platform": "web"}

	h.setOrgPlan(seed.OrgID, "free")
	h.ingestReport(seed.PublicKey, report) // oldest project stays active
	if code, body := h.do(http.MethodPost, "/v1/ingest/reports", report, h.keyHeaders(secondKey)); code != 402 || errCode(body) != "PROJECT_FROZEN" {
		t.Fatalf("frozen project ingest: want 402 PROJECT_FROZEN, got %d %v", code, body)
	}
	_, list := h.do(http.MethodGet, "/api/projects", nil, h.authHeaders(seed.AccessToken))
	for _, raw := range list["projects"].([]any) {
		p := raw.(map[string]any)
		if want := p["id"] == secondID; p["frozen"] != want {
			t.Fatalf("project %v frozen=%v, want %v", p["name"], p["frozen"], want)
		}
	}

	h.setOrgPlan(seed.OrgID, "indie")
	h.ingestReport(secondKey, report)
}

func TestDowngrade_ExtraMembersBecomeViewers(t *testing.T) {
	h := newReportHarness(t)
	owner := h.seedUserProject("indie")
	raw, memberToken := h.inviteAndRegister(owner, "member@test.closeloop", "member")
	if code, body := h.do(http.MethodPost, "/api/invites/"+raw+"/accept", nil, h.authHeaders(memberToken)); code != 200 {
		t.Fatalf("accept: %d %v", code, body)
	}
	ticketID, _, _, _, _ := h.ingestReport(owner.PublicKey, map[string]any{"type": "bug", "message": "seat test"})
	patch := map[string]any{"status": "in_progress"}

	h.setOrgPlan(owner.OrgID, "free")
	if code, body := h.do(http.MethodPatch, "/api/tickets/"+ticketID, patch, h.authHeaders(memberToken)); code != 403 {
		t.Fatalf("seat-locked member patch: want 403, got %d %v", code, body)
	}
	if code, _ := h.do(http.MethodPatch, "/api/tickets/"+ticketID, patch, h.authHeaders(owner.AccessToken)); code != 200 {
		t.Fatalf("owner keeps write access: %d", code)
	}
	_, me := h.do(http.MethodGet, "/api/me", nil, h.authHeaders(memberToken))
	if role, _ := me["role"].(string); role != "viewer" {
		t.Fatalf("me role after downgrade = %q, want viewer", role)
	}
	_, members := h.do(http.MethodGet, "/api/org/members", nil, h.authHeaders(owner.AccessToken))
	locked := 0
	for _, raw := range members["members"].([]any) {
		if m := raw.(map[string]any); m["seat_locked"] == true {
			locked++
			if m["email"] != "member@test.closeloop" {
				t.Fatalf("wrong member locked: %v", m)
			}
		}
	}
	if locked != 1 {
		t.Fatalf("want 1 seat-locked member, got %d: %v", locked, members)
	}

	h.setOrgPlan(owner.OrgID, "indie")
	if code, body := h.do(http.MethodPatch, "/api/tickets/"+ticketID, map[string]any{"status": "open"}, h.authHeaders(memberToken)); code != 200 {
		t.Fatalf("member after upgrade: %d %v", code, body)
	}
}

func TestDowngrade_OldInviteCannotExceedSeats(t *testing.T) {
	h := newReportHarness(t)
	owner := h.seedUserProject("indie")
	raw, token := h.inviteAndRegister(owner, "late@test.closeloop", "member")

	h.setOrgPlan(owner.OrgID, "free")
	if code, body := h.do(http.MethodPost, "/api/invites/"+raw+"/accept", nil, h.authHeaders(token)); code != 403 || errCode(body) != "SEAT_LIMIT" {
		t.Fatalf("accept after downgrade: want 403 SEAT_LIMIT, got %d %v", code, body)
	}
	if n := h.count(`SELECT COUNT(*) FROM memberships WHERE org_id=$1`, owner.OrgID); n != 1 {
		t.Fatalf("memberships = %d, want 1", n)
	}

	h.setOrgPlan(owner.OrgID, "indie")
	if code, body := h.do(http.MethodPost, "/api/invites/"+raw+"/accept", nil, h.authHeaders(token)); code != 200 {
		t.Fatalf("accept after upgrade: %d %v", code, body)
	}
}

func TestDowngrade_ExtraReposStopRoutingWithoutChoosing(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	var lastID, fallbackID string
	for i, p := range []string{"web", "android", "ios", "backend", "shared"} {
		code, body := addRepo(h, seed, map[string]any{
			"full_name": "bear/" + p, "routes": []map[string]any{{"platform": p}},
		})
		if code != 201 {
			t.Fatalf("add %s: %d %v", p, code, body)
		}
		id := repoID(t, body)
		if i == 0 {
			fallbackID = id
		}
		lastID = id
	}
	repoOf := func(ticketID string) any {
		_, d := h.do(http.MethodGet, "/api/tickets/"+ticketID, nil, h.authHeaders(seed.AccessToken))
		return d["ticket"].(map[string]any)["repo_id"]
	}
	shared := map[string]any{"type": "bug", "message": "shared bug", "platform": "shared"}

	h.setOrgPlan(seed.OrgID, "free") // Free allows 3 repos per project
	ticket, _, _, _, _ := h.ingestReport(seed.PublicKey, shared)
	if got := repoOf(ticket); got != fallbackID {
		t.Fatalf("over-limit repo should route to fallback, got %v", got)
	}
	_, repos := h.do(http.MethodGet, "/api/projects/"+seed.ProjectID+"/repos", nil, h.authHeaders(seed.AccessToken))
	paused := 0
	for _, raw := range repos["repos"].([]any) {
		if raw.(map[string]any)["routing_paused"] == true {
			paused++
		}
	}
	if paused != 2 {
		t.Fatalf("want 2 repos paused on Free, got %d: %v", paused, repos)
	}

	h.setOrgPlan(seed.OrgID, "indie")
	ticket, _, _, _, _ = h.ingestReport(seed.PublicKey, shared)
	if got := repoOf(ticket); got != lastID {
		t.Fatalf("after upgrade shared should route to its repo, got %v", got)
	}
}
