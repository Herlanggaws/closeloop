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
	if idea["description"] != "dark mode please" {
		t.Fatalf("description=%v", idea["description"])
	}
	if idea["id"] != ticketID {
		t.Fatalf("id=%v", idea["id"])
	}

	code, detail := h.do(http.MethodGet, "/api/public/boards/"+slug+"/ideas/"+ticketID, nil, nil)
	if code != 200 {
		t.Fatalf("public idea detail: %d %v", code, detail)
	}
	detailIdea := detail["idea"].(map[string]any)
	if detailIdea["description"] != "dark mode please" {
		t.Fatalf("detail description=%v", detailIdea["description"])
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

	code, ticketsBody := h.do(http.MethodGet, "/api/projects/"+seed.ProjectID+"/tickets", nil, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("list tickets: %d %v", code, ticketsBody)
	}
	found := false
	for _, raw := range ticketsBody["tickets"].([]any) {
		tkt := raw.(map[string]any)
		if tkt["id"] == ticketID {
			found = true
			if tkt["vote_count"] != float64(1) {
				t.Fatalf("auth ticket vote_count=%v", tkt["vote_count"])
			}
			break
		}
	}
	if !found {
		t.Fatal("voted ticket missing from project list")
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

func TestR_BOARD_07_VoteReleasedOnMarkFixed(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")

	code, projectBody := h.do(http.MethodGet, "/api/projects/"+seed.ProjectID, nil, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("get project: %d %v", code, projectBody)
	}
	slug := projectBody["project"].(map[string]any)["board_slug"].(string)

	hiddenID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{
		"type": "idea", "message": "private ship", "platform": "web",
	})
	h.mailer.Reset()
	code, _ = h.do(http.MethodPatch, "/api/tickets/"+hiddenID, map[string]any{
		"status": "fixed", "note": "shipped private",
	}, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("mark private fixed: %d", code)
	}
	var releasedPending int
	if err := h.db.QueryRow(`SELECT COUNT(*) FROM jobs WHERE kind='notify_vote_released' AND status='pending'`).Scan(&releasedPending); err != nil {
		t.Fatalf("count jobs: %v", err)
	}
	if releasedPending != 0 {
		t.Fatalf("unpublished should not enqueue vote released, got %d", releasedPending)
	}
	h.drainNotifyJobs()

	ticketID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{
		"type": "idea", "message": "public ship idea", "platform": "web",
	})
	h.do(http.MethodPatch, "/api/tickets/"+ticketID, map[string]any{"is_public": true}, h.authHeaders(seed.AccessToken))

	h.mailer.Reset()
	code, _ = h.do(http.MethodPatch, "/api/tickets/"+ticketID, map[string]any{
		"status": "fixed", "note": "no voters yet",
	}, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("mark public fixed no votes: %d", code)
	}
	if err := h.db.QueryRow(`SELECT COUNT(*) FROM jobs WHERE kind='notify_vote_released' AND status='pending'`).Scan(&releasedPending); err != nil {
		t.Fatalf("count jobs: %v", err)
	}
	if releasedPending != 0 {
		t.Fatalf("no confirmed votes should not enqueue, got %d", releasedPending)
	}
	h.drainNotifyJobs()

	ticketID, _, _, _, _ = h.ingestReport(seed.PublicKey, map[string]any{
		"type": "idea", "message": "voted ship idea", "platform": "web",
	})
	h.do(http.MethodPatch, "/api/tickets/"+ticketID, map[string]any{
		"status": "open", "is_public": true,
	}, h.authHeaders(seed.AccessToken))

	h.mailer.Reset()
	code, _ = h.do(http.MethodPost, "/api/public/boards/"+slug+"/ideas/"+ticketID+"/votes", map[string]any{
		"email": "voter-ship@example.com",
	}, nil)
	if code != 202 {
		t.Fatalf("request vote: %d", code)
	}
	if h.drainNotifyJobs() < 1 {
		t.Fatal("expected vote verify job")
	}
	sent := h.mailer.Sent()
	if len(sent) != 1 {
		t.Fatalf("want verify mail, got %d", len(sent))
	}
	token := extractVoteToken(sent[0].HTML)
	code, _ = h.do(http.MethodGet, "/api/public/votes/confirm?t="+token, nil, nil)
	if code != 200 {
		t.Fatalf("confirm: %d", code)
	}

	h.mailer.Reset()
	code, _ = h.do(http.MethodPatch, "/api/tickets/"+ticketID, map[string]any{
		"status": "fixed", "note": "Shipped for voters",
	}, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("mark fixed: %d", code)
	}
	if err := h.db.QueryRow(`SELECT COUNT(*) FROM jobs WHERE kind='notify_vote_released' AND status='pending'`).Scan(&releasedPending); err != nil {
		t.Fatalf("count jobs: %v", err)
	}
	if releasedPending != 1 {
		t.Fatalf("want 1 vote released job, got %d", releasedPending)
	}
	if h.drainNotifyJobs() < 1 {
		t.Fatal("expected jobs to process")
	}
	sent = h.mailer.Sent()
	var released *recordedMail
	for i := range sent {
		if strings.Contains(sent[i].Subject, "An idea you voted for just shipped") {
			released = &sent[i]
			break
		}
	}
	if released == nil {
		t.Fatalf("missing vote released mail in %#v", sent)
	}
	if released.To != "voter-ship@example.com" {
		t.Fatalf("to=%q", released.To)
	}
	if !strings.Contains(released.HTML, "Shipped for voters") {
		t.Fatalf("note missing in html: %s", released.HTML)
	}
	if !strings.Contains(released.HTML, "/board/"+slug+"/ideas/"+ticketID) {
		t.Fatalf("open url missing: %s", released.HTML)
	}
}

func TestR_BOARD_10_VoterNotifyKillSwitch(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")

	off := false
	code, body := h.do(http.MethodPatch, "/api/projects/"+seed.ProjectID, map[string]any{
		"voter_notify_enabled": off,
	}, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("patch project: %d %v", code, body)
	}

	code, projectBody := h.do(http.MethodGet, "/api/projects/"+seed.ProjectID, nil, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("get project: %d %v", code, projectBody)
	}
	slug := projectBody["project"].(map[string]any)["board_slug"].(string)
	if projectBody["project"].(map[string]any)["voter_notify_enabled"] != false {
		t.Fatalf("voter_notify_enabled=%v", projectBody["project"].(map[string]any)["voter_notify_enabled"])
	}

	ticketID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{
		"type": "idea", "message": "killed voter mail", "platform": "web",
	})
	h.do(http.MethodPatch, "/api/tickets/"+ticketID, map[string]any{
		"status": "open", "is_public": true,
	}, h.authHeaders(seed.AccessToken))

	h.mailer.Reset()
	code, _ = h.do(http.MethodPost, "/api/public/boards/"+slug+"/ideas/"+ticketID+"/votes", map[string]any{
		"email": "voter-kill@example.com",
	}, nil)
	if code != 202 {
		t.Fatalf("request vote: %d", code)
	}
	if h.drainNotifyJobs() < 1 {
		t.Fatal("expected vote verify job")
	}
	sent := h.mailer.Sent()
	if len(sent) != 1 {
		t.Fatalf("want verify mail, got %d", len(sent))
	}
	token := extractVoteToken(sent[0].HTML)
	code, _ = h.do(http.MethodGet, "/api/public/votes/confirm?t="+token, nil, nil)
	if code != 200 {
		t.Fatalf("confirm: %d", code)
	}

	h.mailer.Reset()
	code, _ = h.do(http.MethodPatch, "/api/tickets/"+ticketID, map[string]any{
		"status": "fixed", "note": "shipped quietly",
	}, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("mark fixed: %d", code)
	}
	var releasedPending int
	if err := h.db.QueryRow(`SELECT COUNT(*) FROM jobs WHERE kind='notify_vote_released' AND status='pending'`).Scan(&releasedPending); err != nil {
		t.Fatalf("count jobs: %v", err)
	}
	if releasedPending != 0 {
		t.Fatalf("kill switch should skip vote released job, got %d", releasedPending)
	}
	_ = h.drainNotifyJobs()
	for _, mail := range h.mailer.Sent() {
		if strings.Contains(mail.Subject, "An idea you voted for just shipped") {
			t.Fatalf("unexpected vote released mail: %#v", mail)
		}
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

func TestR_BOARD_08_CommentConfirmAndReply(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")

	code, projectBody := h.do(http.MethodGet, "/api/projects/"+seed.ProjectID, nil, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("get project: %d %v", code, projectBody)
	}
	slug := projectBody["project"].(map[string]any)["board_slug"].(string)

	ticketID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{
		"type": "idea", "message": "comment me", "platform": "web",
	})
	h.do(http.MethodPatch, "/api/tickets/"+ticketID, map[string]any{"is_public": true}, h.authHeaders(seed.AccessToken))

	h.mailer.Reset()
	code, post := h.do(http.MethodPost, "/api/public/boards/"+slug+"/ideas/"+ticketID+"/comments", map[string]any{
		"email":        "Commenter@Example.COM",
		"display_name": "Ayu",
		"body":         "Please keep category colors",
	}, nil)
	if code != 202 {
		t.Fatalf("post comment: %d %v", code, post)
	}
	if h.drainNotifyJobs() < 1 {
		t.Fatal("expected comment verify job")
	}
	sent := h.mailer.Sent()
	if len(sent) != 1 || !strings.Contains(sent[0].Subject, "Confirm your comment") {
		t.Fatalf("verify mail=%#v", sent)
	}
	token := extractCommentToken(sent[0].HTML)
	if token == "" {
		t.Fatal("missing comment token")
	}

	code, listed := h.do(http.MethodGet, "/api/public/boards/"+slug+"/ideas/"+ticketID+"/comments", nil, nil)
	if code != 200 {
		t.Fatalf("list before confirm: %d %v", code, listed)
	}
	if comments := listed["comments"].([]any); len(comments) != 0 {
		t.Fatalf("unconfirmed should be hidden, got %v", comments)
	}

	code, confirmed := h.do(http.MethodGet, "/api/public/comments/confirm?t="+token, nil, nil)
	if code != 200 {
		t.Fatalf("confirm: %d %v", code, confirmed)
	}

	code, listed = h.do(http.MethodGet, "/api/public/boards/"+slug+"/ideas/"+ticketID+"/comments", nil, nil)
	if code != 200 {
		t.Fatalf("list after confirm: %d %v", code, listed)
	}
	roots := listed["comments"].([]any)
	if len(roots) != 1 {
		t.Fatalf("want 1 root, got %v", listed)
	}
	root := roots[0].(map[string]any)
	rootID := root["id"].(string)
	if root["display_name"] != "Ayu" || root["body"] != "Please keep category colors" {
		t.Fatalf("root=%v", root)
	}

	h.mailer.Reset()
	code, replyPost := h.do(http.MethodPost, "/api/public/boards/"+slug+"/ideas/"+ticketID+"/comments", map[string]any{
		"email":     "reply@example.com",
		"body":      "Agreed",
		"parent_id": rootID,
	}, nil)
	if code != 202 {
		t.Fatalf("reply: %d %v", code, replyPost)
	}
	h.drainNotifyJobs()
	replyToken := extractCommentToken(h.mailer.Sent()[0].HTML)
	h.do(http.MethodGet, "/api/public/comments/confirm?t="+replyToken, nil, nil)

	code, listed = h.do(http.MethodGet, "/api/public/boards/"+slug+"/ideas/"+ticketID+"/comments", nil, nil)
	if code != 200 {
		t.Fatalf("list with reply: %d %v", code, listed)
	}
	root = listed["comments"].([]any)[0].(map[string]any)
	replies := root["replies"].([]any)
	if len(replies) != 1 {
		t.Fatalf("want 1 reply, got %v", root)
	}

	code, team := h.do(http.MethodPost, "/api/tickets/"+ticketID+"/comments", map[string]any{
		"body": "Planned for 2.6",
	}, h.authHeaders(seed.AccessToken))
	if code != 201 {
		t.Fatalf("team comment: %d %v", code, team)
	}
	teamComment := team["comment"].(map[string]any)
	if teamComment["is_team"] != true {
		t.Fatalf("team flag=%v", teamComment)
	}

	code, mod := h.do(http.MethodGet, "/api/projects/"+seed.ProjectID+"/board-comments?status=visible", nil, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("moderation list: %d %v", code, mod)
	}
	visible := mod["comments"].([]any)
	if len(visible) < 3 {
		t.Fatalf("want >=3 visible, got %d", len(visible))
	}

	code, hide := h.do(http.MethodPatch, "/api/comments/"+rootID, map[string]any{"hidden": true}, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("hide: %d %v", code, hide)
	}
	code, listed = h.do(http.MethodGet, "/api/public/boards/"+slug+"/ideas/"+ticketID+"/comments", nil, nil)
	if code != 200 {
		t.Fatalf("public after hide: %d", code)
	}
	for _, item := range listed["comments"].([]any) {
		if item.(map[string]any)["id"] == rootID {
			t.Fatal("hidden root still public")
		}
	}
}

func TestR_BOARD_09_CommentGuards(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")
	code, projectBody := h.do(http.MethodGet, "/api/projects/"+seed.ProjectID, nil, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("get project: %d %v", code, projectBody)
	}
	slug := projectBody["project"].(map[string]any)["board_slug"].(string)

	hiddenID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{
		"type": "idea", "message": "private comment", "platform": "web",
	})
	code, hidden := h.do(http.MethodPost, "/api/public/boards/"+slug+"/ideas/"+hiddenID+"/comments", map[string]any{
		"email": "a@b.co", "body": "nope",
	}, nil)
	if code != 404 {
		t.Fatalf("unpublished want 404, got %d %v", code, hidden)
	}

	ticketID, _, _, _, _ := h.ingestReport(seed.PublicKey, map[string]any{
		"type": "idea", "message": "public comment target", "platform": "web",
	})
	h.do(http.MethodPatch, "/api/tickets/"+ticketID, map[string]any{"is_public": true}, h.authHeaders(seed.AccessToken))

	code, bad := h.do(http.MethodPost, "/api/public/boards/"+slug+"/ideas/"+ticketID+"/comments", map[string]any{
		"email": "not-an-email", "body": "hi",
	}, nil)
	if code != 400 {
		t.Fatalf("bad email want 400, got %d %v", code, bad)
	}

	code, empty := h.do(http.MethodPost, "/api/public/boards/"+slug+"/ideas/"+ticketID+"/comments", map[string]any{
		"email": "ok@example.com", "body": "   ",
	}, nil)
	if code != 400 {
		t.Fatalf("empty body want 400, got %d %v", code, empty)
	}

	code, badParent := h.do(http.MethodPost, "/api/public/boards/"+slug+"/ideas/"+ticketID+"/comments", map[string]any{
		"email": "ok@example.com", "body": "reply", "parent_id": "00000000-0000-0000-0000-000000000001",
	}, nil)
	if code != 404 && code != 400 {
		t.Fatalf("bad parent want 404/400, got %d %v", code, badParent)
	}
}

func TestR_BOARD_11_SuggestConfirmCreatesPrivateIdea(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")

	code, projectBody := h.do(http.MethodGet, "/api/projects/"+seed.ProjectID, nil, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("get project: %d %v", code, projectBody)
	}
	slug := projectBody["project"].(map[string]any)["board_slug"].(string)

	code, suggest := h.do(http.MethodPost, "/api/public/boards/"+slug+"/ideas/suggest", map[string]any{
		"email": "Suggester@Example.COM",
		"title": "Dark mode for settings",
		"body":  "Please add a toggle in project settings.",
	}, nil)
	if code != 202 {
		t.Fatalf("suggest: %d %v", code, suggest)
	}

	if n := h.drainNotifyJobs(); n < 1 {
		t.Fatalf("expected suggest verify job, processed %d", n)
	}
	sent := h.mailer.Sent()
	if len(sent) != 1 {
		t.Fatalf("want 1 suggest mail, got %d", len(sent))
	}
	if !strings.Contains(sent[0].Subject, "Confirm your idea") {
		t.Fatalf("subject=%q", sent[0].Subject)
	}
	token := extractSuggestToken(sent[0].HTML)
	if token == "" {
		t.Fatalf("no confirm token in mail: %s", sent[0].HTML)
	}

	code, confirmed := h.do(http.MethodGet, "/api/public/ideas/confirm?t="+token, nil, nil)
	if code != 200 {
		t.Fatalf("confirm: %d %v", code, confirmed)
	}
	obj := confirmed["suggestion"].(map[string]any)
	ticketID, _ := obj["idea_id"].(string)
	if ticketID == "" || obj["board_slug"] != slug {
		t.Fatalf("confirm payload=%v", confirmed)
	}
	if obj["email"] != "suggester@example.com" {
		t.Fatalf("email normalized=%v", obj["email"])
	}

	code, again := h.do(http.MethodGet, "/api/public/ideas/confirm?t="+token, nil, nil)
	if code != 409 {
		t.Fatalf("reuse token want 409, got %d %v", code, again)
	}

	code, publicBoard := h.do(http.MethodGet, "/api/public/boards/"+slug, nil, nil)
	if code != 200 {
		t.Fatalf("public board: %d %v", code, publicBoard)
	}
	for _, raw := range publicBoard["ideas"].([]any) {
		idea := raw.(map[string]any)
		if idea["id"] == ticketID {
			t.Fatalf("private suggested idea leaked on public board: %v", idea)
		}
	}

	code, ticketBody := h.do(http.MethodGet, "/api/tickets/"+ticketID, nil, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("get ticket: %d %v", code, ticketBody)
	}
	ticket := ticketBody["ticket"].(map[string]any)
	if ticket["type"] != "idea" || ticket["status"] != "open" {
		t.Fatalf("ticket type/status=%v/%v", ticket["type"], ticket["status"])
	}
	if ticket["is_public"] != false {
		t.Fatalf("want is_public=false, got %v", ticket["is_public"])
	}
	if ticket["title"] != "Dark mode for settings" {
		t.Fatalf("title=%v", ticket["title"])
	}

	code, ticketsBody := h.do(http.MethodGet, "/api/projects/"+seed.ProjectID+"/tickets?type=idea", nil, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("list tickets: %d %v", code, ticketsBody)
	}
	found := false
	for _, raw := range ticketsBody["tickets"].([]any) {
		tkt := raw.(map[string]any)
		if tkt["id"] == ticketID {
			found = true
			break
		}
	}
	if !found {
		t.Fatal("suggested idea missing from builder inbox")
	}
}

func TestR_BOARD_12_SuggestGuards(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("indie")

	code, projectBody := h.do(http.MethodGet, "/api/projects/"+seed.ProjectID, nil, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("get project: %d %v", code, projectBody)
	}
	slug := projectBody["project"].(map[string]any)["board_slug"].(string)

	code, missing := h.do(http.MethodPost, "/api/public/boards/"+slug+"/ideas/suggest", map[string]any{
		"email": "ok@example.com",
		"title": "   ",
	}, nil)
	if code != 400 {
		t.Fatalf("empty title want 400, got %d %v", code, missing)
	}

	code, bad := h.do(http.MethodPost, "/api/public/boards/"+slug+"/ideas/suggest", map[string]any{
		"email": "not-an-email",
		"title": "Valid title",
	}, nil)
	if code != 400 {
		t.Fatalf("bad email want 400, got %d %v", code, bad)
	}

	code, unknown := h.do(http.MethodPost, "/api/public/boards/no-such-board-xyz/ideas/suggest", map[string]any{
		"email": "ok@example.com",
		"title": "Valid title",
	}, nil)
	if code != 404 {
		t.Fatalf("unknown slug want 404, got %d %v", code, unknown)
	}
}

func extractVoteToken(htmlBody string) string {
	return extractTokenMarker(htmlBody, "/vote/confirm?t=")
}

func extractCommentToken(htmlBody string) string {
	return extractTokenMarker(htmlBody, "/comment/confirm?t=")
}

func extractSuggestToken(htmlBody string) string {
	return extractTokenMarker(htmlBody, "/suggest/confirm?t=")
}

func extractTokenMarker(htmlBody, marker string) string {
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
