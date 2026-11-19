package httpapi

import (
	"net/http"
	"testing"

	"github.com/closeloop/api/internal/infrastructure/auth"
)

func TestTeam_InviteAcceptAndViewerBlocked(t *testing.T) {
	h := newReportHarness(t)
	// Indie has 1 seat (D-21); invites need Studio.
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

// D-21 / US-67: Indie includes 1 seat. Invites are refused; existing members keep access.
func TestTeam_IndieOneSeat(t *testing.T) {
	h := newReportHarness(t)
	owner := h.seedUserProject("indie")
	code, body := h.do(http.MethodPost, "/api/org/invites", map[string]any{
		"emails": []string{"second@test.closeloop"}, "role": "member",
	}, h.authHeaders(owner.AccessToken))
	if code != 403 || errCode(body) != "SEAT_LIMIT" {
		t.Fatalf("indie invite want 403 SEAT_LIMIT got %d %v", code, body)
	}
	code, me := h.do(http.MethodGet, "/api/me", nil, h.authHeaders(owner.AccessToken))
	if code != 200 {
		t.Fatalf("me: %d", code)
	}
	seats := me["usage"].(map[string]any)["seats"].(map[string]any)
	if seats["limit"].(float64) != 1 || seats["used"].(float64) != 1 {
		t.Fatalf("indie seats = %v, want 1 of 1", seats)
	}
}
