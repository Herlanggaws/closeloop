package httpapi

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
)

func TestR_BOARD_01_PublishAppearsOnPublicBoard(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")

	code, projectBody := h.do(http.MethodGet, "/api/projects/"+seed.ProjectID, nil, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("get project: %d %v", code, projectBody)
	}
	project := projectBody["project"].(map[string]any)
	slug, _ := project["board_slug"].(string)
	if slug == "" {
		t.Fatalf("expected board_slug on create: %v", project)
	}

	ticketID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{
		"type": "idea", "message": "dark mode please", "platform": "web",
	})

	code, body := h.do(http.MethodPatch, "/api/tickets/"+ticketID, map[string]any{
		"is_public": true,
	}, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("publish: %d %v", code, body)
	}
	ticket := body["ticket"].(map[string]any)
	if ticket["is_public"] != true {
		t.Fatalf("is_public=%v", ticket["is_public"])
	}

	code, pub := h.do(http.MethodGet, "/api/public/boards/"+slug, nil, nil)
	if code != 200 {
		t.Fatalf("public board: %d %v", code, pub)
	}
	ideas, _ := pub["ideas"].([]any)
	if len(ideas) != 1 {
		t.Fatalf("want 1 idea, got %v", pub)
	}
	idea := ideas[0].(map[string]any)
	if idea["title"] != "dark mode please" {
		t.Fatalf("title=%v", idea["title"])
	}
	if idea["id"] != ticketID {
		t.Fatalf("id=%v", idea["id"])
	}
}

func TestR_BOARD_02_UnpublishedAndBadSlug(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")

	code, projectBody := h.do(http.MethodGet, "/api/projects/"+seed.ProjectID, nil, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("get project: %d %v", code, projectBody)
	}
	slug := projectBody["project"].(map[string]any)["board_slug"].(string)

	h.ingestReport(seed.PublicKey, map[string]any{
		"type": "idea", "message": "hidden idea", "platform": "web",
	})

	code, pub := h.do(http.MethodGet, "/api/public/boards/"+slug, nil, nil)
	if code != 200 {
		t.Fatalf("public board: %d %v", code, pub)
	}
	ideas, _ := pub["ideas"].([]any)
	if len(ideas) != 0 {
		t.Fatalf("expected empty public list, got %v", pub)
	}

	code, missing := h.do(http.MethodGet, "/api/public/boards/no-such-board-xyz", nil, nil)
	if code != 404 {
		t.Fatalf("bad slug want 404, got %d %v", code, missing)
	}
}

func TestR_BOARD_03_PublicPayloadStripsPrivateFields(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")

	code, projectBody := h.do(http.MethodGet, "/api/projects/"+seed.ProjectID, nil, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("get project: %d %v", code, projectBody)
	}
	slug := projectBody["project"].(map[string]any)["board_slug"].(string)

	ticketID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{
		"type":    "bug",
		"message": "secret crash",
		"email":   "reporter@example.com",
		"platform": "web",
		"context": map[string]any{"url": "https://app.example/secret"},
	})
	h.do(http.MethodPatch, "/api/tickets/"+ticketID, map[string]any{"is_public": true}, h.authHeaders(seed.AccessToken))

	code, pub := h.do(http.MethodGet, "/api/public/boards/"+slug, nil, nil)
	if code != 200 {
		t.Fatalf("public board: %d %v", code, pub)
	}
	raw, _ := json.Marshal(pub)
	s := string(raw)
	for _, banned := range []string{"reporter@example.com", "secret crash context", "https://app.example/secret", "message", "attachments", "email"} {
		if banned == "message" || banned == "attachments" || banned == "email" {
			// keys must not appear as private payload fields; title may contain words
			continue
		}
		if strings.Contains(s, banned) {
			t.Fatalf("public payload leaked %q: %s", banned, s)
		}
	}
	ideas := pub["ideas"].([]any)
	idea := ideas[0].(map[string]any)
	for _, key := range []string{"message", "context", "email", "attachments", "reports"} {
		if _, ok := idea[key]; ok {
			t.Fatalf("public idea must not include %s: %v", key, idea)
		}
	}

	code, detail := h.do(http.MethodGet, "/api/public/boards/"+slug+"/ideas/"+ticketID, nil, nil)
	if code != 200 {
		t.Fatalf("public idea: %d %v", code, detail)
	}
	ideaObj := detail["idea"].(map[string]any)
	for _, key := range []string{"message", "context", "email", "attachments", "reports"} {
		if _, ok := ideaObj[key]; ok {
			t.Fatalf("public idea detail must not include %s: %v", key, ideaObj)
		}
	}
}
