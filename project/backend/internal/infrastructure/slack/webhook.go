package slack

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const webhookPrefix = "https://hooks.slack.com/"

type Poster interface {
	PostWebhook(ctx context.Context, webhookURL string, body map[string]any) error
}

type Client struct {
	HTTP *http.Client
}

func NewClient() *Client {
	return &Client{
		HTTP: &http.Client{Timeout: 8 * time.Second},
	}
}

func ValidWebhookURL(url string) bool {
	return strings.HasPrefix(strings.TrimSpace(url), webhookPrefix)
}

func (c *Client) PostWebhook(ctx context.Context, webhookURL string, body map[string]any) error {
	if !ValidWebhookURL(webhookURL) {
		return fmt.Errorf("invalid slack webhook url")
	}
	payload, err := json.Marshal(body)
	if err != nil {
		return err
	}
	client := c.HTTP
	if client == nil {
		client = &http.Client{Timeout: 8 * time.Second}
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimSpace(webhookURL), bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	res, err := client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		msg, _ := io.ReadAll(io.LimitReader(res.Body, 512))
		return fmt.Errorf("slack webhook status %d: %s", res.StatusCode, strings.TrimSpace(string(msg)))
	}
	return nil
}

func NewReportPayload(projectName, ticketType, title, ticketURL string) map[string]any {
	typeLabel := strings.ToUpper(strings.TrimSpace(ticketType))
	if typeLabel == "" {
		typeLabel = "REPORT"
	}
	text := fmt.Sprintf("New %s in %s: %s", strings.ToLower(typeLabel), projectName, title)
	section := fmt.Sprintf("*%s* · `%s`\n%s", projectName, typeLabel, title)
	return withTicketLink(text, section, ticketURL)
}

func NewStatusPayload(projectName, title, from, to, note, ticketURL string) map[string]any {
	fromLabel := strings.TrimSpace(from)
	toLabel := strings.TrimSpace(to)
	if fromLabel == "" {
		fromLabel = "?"
	}
	if toLabel == "" {
		toLabel = "?"
	}
	text := fmt.Sprintf("Status in %s: %s → %s — %s", projectName, fromLabel, toLabel, title)
	section := fmt.Sprintf("*%s*\n`%s` → `%s`\n%s", projectName, fromLabel, toLabel, title)
	if n := strings.TrimSpace(note); n != "" {
		text = fmt.Sprintf("%s\n%s", text, n)
		section = fmt.Sprintf("%s\n_%s_", section, n)
	}
	return withTicketLink(text, section, ticketURL)
}

func withTicketLink(text, section, ticketURL string) map[string]any {
	blocks := []map[string]any{
		{
			"type": "section",
			"text": map[string]any{
				"type": "mrkdwn",
				"text": section,
			},
		},
	}
	if ticketURL != "" {
		text = fmt.Sprintf("%s\n<%s|Open in Saidloop>", text, ticketURL)
		blocks = append(blocks, map[string]any{
			"type": "actions",
			"elements": []map[string]any{
				{
					"type": "button",
					"text": map[string]any{
						"type": "plain_text",
						"text": "Open ticket",
					},
					"url": ticketURL,
				},
			},
		})
	}
	return map[string]any{
		"text":   text,
		"blocks": blocks,
	}
}
