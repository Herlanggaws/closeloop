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

func TestR_BOARD_04_PublicIdeaDetailNotFound(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")

	code, projectBody := h.do(http.MethodGet, "/api/projects/"+seed.ProjectID, nil, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("get project: %d %v", code, projectBody)
	}
	slug := projectBody["project"].(map[string]any)["board_slug"].(string)

	hiddenID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{
		"type": "idea", "message": "still private", "platform": "web",
	})

	code, unpublished := h.do(http.MethodGet, "/api/public/boards/"+slug+"/ideas/"+hiddenID, nil, nil)
	if code != 404 {
		t.Fatalf("unpublished idea want 404, got %d %v", code, unpublished)
	}

	code, badID := h.do(http.MethodGet, "/api/public/boards/"+slug+"/ideas/00000000-0000-0000-0000-000000000000", nil, nil)
	if code != 404 {
		t.Fatalf("unknown idea id want 404, got %d %v", code, badID)
	}

	publishedID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{
		"type": "idea", "message": "public elsewhere", "platform": "web",
	})
	h.do(http.MethodPatch, "/api/tickets/"+publishedID, map[string]any{"is_public": true}, h.authHeaders(seed.AccessToken))

	code, badSlug := h.do(http.MethodGet, "/api/public/boards/no-such-board-xyz/ideas/"+publishedID, nil, nil)
	if code != 404 {
		t.Fatalf("wrong slug want 404, got %d %v", code, badSlug)
	}
}

func TestR_BOARD_05_VoteConfirmIncrementsCount(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")

	code, projectBody := h.do(http.MethodGet, "/api/projects/"+seed.ProjectID, nil, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("get project: %d %v", code, projectBody)
	}
	slug := projectBody["project"].(map[string]any)["board_slug"].(string)

	ticketID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{
		"type": "idea", "message": "vote me please", "platform": "web",
	})
	h.do(http.MethodPatch, "/api/tickets/"+ticketID, map[string]any{"is_public": true}, h.authHeaders(seed.AccessToken))

	code, vote := h.do(http.MethodPost, "/api/public/boards/"+slug+"/ideas/"+ticketID+"/votes", map[string]any{
		"email": "Voter@Example.COM",
	}, nil)
	if code != 202 {
		t.Fatalf("request vote: %d %v", code, vote)
	}

	if n := h.drainNotifyJobs(); n < 1 {
		t.Fatalf("expected vote verify job, processed %d", n)
	}
	sent := h.mailer.Sent()
	if len(sent) != 1 {
		t.Fatalf("want 1 vote mail, got %d", len(sent))
	}
	if !strings.Contains(sent[0].Subject, "Confirm your vote") {
		t.Fatalf("subject=%q", sent[0].Subject)
	}
	token := extractVoteToken(sent[0].HTML)
	if token == "" {
		t.Fatalf("no confirm token in mail: %s", sent[0].HTML)
	}

	code, confirmed := h.do(http.MethodGet, "/api/public/votes/confirm?t="+token, nil, nil)
	if code != 200 {
		t.Fatalf("confirm: %d %v", code, confirmed)
	}
	voteObj := confirmed["vote"].(map[string]any)
	if voteObj["idea_id"] != ticketID || voteObj["board_slug"] != slug {
		t.Fatalf("confirm payload=%v", confirmed)
	}
	if voteObj["email"] != "voter@example.com" {
		t.Fatalf("email normalized=%v", voteObj["email"])
	}

	code, detail := h.do(http.MethodGet, "/api/public/boards/"+slug+"/ideas/"+ticketID, nil, nil)
	if code != 200 {
		t.Fatalf("detail: %d %v", code, detail)
	}
	idea := detail["idea"].(map[string]any)
	if idea["vote_count"] != float64(1) {
		t.Fatalf("vote_count=%v", idea["vote_count"])
	}

	code, again := h.do(http.MethodGet, "/api/public/votes/confirm?t="+token, nil, nil)
	if code != 409 {
		t.Fatalf("reuse token want 409, got %d %v", code, again)
	}

	h.mailer.Reset()
	code, dup := h.do(http.MethodPost, "/api/public/boards/"+slug+"/ideas/"+ticketID+"/votes", map[string]any{
		"email": "voter@example.com",
	}, nil)
	if code != 202 {
		t.Fatalf("duplicate request: %d %v", code, dup)
	}
	h.drainNotifyJobs()
	if len(h.mailer.Sent()) != 0 {
		t.Fatalf("should not re-email confirmed voter, got %d", len(h.mailer.Sent()))
	}
}

func TestR_BOARD_06_VoteUnpublishedAndBadEmail(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")

	code, projectBody := h.do(http.MethodGet, "/api/projects/"+seed.ProjectID, nil, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("get project: %d %v", code, projectBody)
	}
	slug := projectBody["project"].(map[string]any)["board_slug"].(string)

	hiddenID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{
		"type": "idea", "message": "private vote", "platform": "web",
	})
	code, hidden := h.do(http.MethodPost, "/api/public/boards/"+slug+"/ideas/"+hiddenID+"/votes", map[string]any{
		"email": "a@b.co",
	}, nil)
	if code != 404 {
		t.Fatalf("unpublished want 404, got %d %v", code, hidden)
	}

	ticketID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{
		"type": "idea", "message": "public vote target", "platform": "web",
	})
	h.do(http.MethodPatch, "/api/tickets/"+ticketID, map[string]any{"is_public": true}, h.authHeaders(seed.AccessToken))

	code, bad := h.do(http.MethodPost, "/api/public/boards/"+slug+"/ideas/"+ticketID+"/votes", map[string]any{
		"email": "not-an-email",
	}, nil)
	if code != 400 {
		t.Fatalf("bad email want 400, got %d %v", code, bad)
	}
}

func extractVoteToken(htmlBody string) string {
	const marker = "/vote/confirm?t="
	i := strings.Index(htmlBody, marker)
	if i < 0 {
		return ""
	}
	rest := htmlBody[i+len(marker):]
	end := strings.IndexAny(rest, `"'<> `)
	if end < 0 {
		return rest
	}
	return rest[:end]
}
