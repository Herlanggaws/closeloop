package httpapi

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/closeloop/api/internal/application"
)

func TestR_REPLAY_01_StudioIngestOffersReplayUpload(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("studio")

	code, cfg := h.do(http.MethodGet, "/v1/ingest/config", nil, h.keyHeaders(seed.PublicKey))
	if code != 200 {
		t.Fatalf("config: %d %v", code, cfg)
	}
	if cfg["replay_enabled"] != true {
		t.Fatalf("expected replay_enabled=true, got %v", cfg["replay_enabled"])
	}

	code, body := h.do(http.MethodPost, "/v1/ingest/reports", map[string]any{
		"type": "bug", "message": "replay me", "platform": "web",
	}, h.keyHeaders(seed.PublicKey))
	if code != 201 {
		t.Fatalf("ingest: %d %v", code, body)
	}
	replayID, _ := body["replay_attachment_id"].(string)
	replayURL, _ := body["replay_upload_url"].(string)
	replayToken, _ := body["replay_upload_token"].(string)
	if replayID == "" || replayURL == "" || replayToken == "" {
		t.Fatalf("expected replay upload fields, got %v", body)
	}

	h.uploadScreenshotJSON(replayID, replayToken, map[string]string{
		"data": "H4sIAAAAAAAAAytJLSUoAgDJxcd4BQAAAA==",
	})

	ticketID := body["ticket_id"].(string)
	code, detail := h.do(http.MethodGet, "/api/tickets/"+ticketID, nil, h.authHeaders(seed.AccessToken))
	if code != 200 {
		t.Fatalf("detail: %d %v", code, detail)
	}
	atts := detail["attachments"].([]any)
	var foundReplay bool
	for _, raw := range atts {
		att := raw.(map[string]any)
		if att["kind"] == "replay" && att["uploaded"] == true {
			foundReplay = true
			if att["url"] == nil || att["url"] == "" {
				t.Fatal("expected signed replay url")
			}
		}
	}
	if !foundReplay {
		t.Fatalf("expected uploaded replay attachment, got %v", atts)
	}
}

func TestR_REPLAY_02_FreeIngestSkipsReplay(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("free")

	code, cfg := h.do(http.MethodGet, "/v1/ingest/config", nil, h.keyHeaders(seed.PublicKey))
	if code != 200 {
		t.Fatalf("config: %d %v", code, cfg)
	}
	if cfg["replay_enabled"] != false {
		t.Fatalf("expected replay_enabled=false, got %v", cfg["replay_enabled"])
	}

	code, body := h.do(http.MethodPost, "/v1/ingest/reports", map[string]any{
		"type": "bug", "message": "no replay", "platform": "web",
	}, h.keyHeaders(seed.PublicKey))
	if code != 201 {
		t.Fatalf("ingest: %d %v", code, body)
	}
	if body["replay_attachment_id"] != nil {
		t.Fatalf("free plan must not get replay slot: %v", body)
	}
}

func TestR_REPLAY_03_RetentionPurgesExpired(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("studio")

	code, body := h.do(http.MethodPost, "/v1/ingest/reports", map[string]any{
		"type": "bug", "message": "old replay", "platform": "web",
	}, h.keyHeaders(seed.PublicKey))
	if code != 201 {
		t.Fatalf("ingest: %d %v", code, body)
	}
	replayID := body["replay_attachment_id"].(string)
	replayToken := body["replay_upload_token"].(string)
	h.uploadScreenshot(replayID, replayToken, []byte("gzip-replay-bytes"))

	if _, err := h.db.Exec(`UPDATE attachments SET uploaded_at = $2 WHERE id = $1`,
		replayID, time.Now().UTC().Add(-10*24*time.Hour)); err != nil {
		t.Fatalf("backdate: %v", err)
	}

	application.PurgeExpiredReplaysOnce(context.Background(), h.store, h.files)

	var n int
	if err := h.db.QueryRow(`SELECT COUNT(*) FROM attachments WHERE id=$1`, replayID).Scan(&n); err != nil {
		t.Fatalf("count: %v", err)
	}
	if n != 0 {
		t.Fatalf("expected expired replay deleted, still have %d", n)
	}
}
