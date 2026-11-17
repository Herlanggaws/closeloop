package httpapi

import (
	"net/http"
	"testing"

	"github.com/closeloop/api/internal/infrastructure/auth"
)

func TestTeam_InviteAcceptAndViewerBlocked(t *testing.T) {
	h := newReportHarness(t)
	owner := h.seedUserProject("indie")

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
