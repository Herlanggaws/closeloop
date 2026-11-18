package webhook

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type Poster interface {
	PostSigned(ctx context.Context, url, secret string, body map[string]any) error
}

type Client struct {
	HTTP *http.Client
}

func NewClient() *Client {
	return &Client{HTTP: &http.Client{Timeout: 8 * time.Second}}
}

func ValidURL(url string) bool {
	u := strings.TrimSpace(url)
	return strings.HasPrefix(u, "https://") && !strings.HasPrefix(u, "https://hooks.slack.com/")
}

func SignBody(secret string, payload []byte) string {
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write(payload)
	return "sha256=" + hex.EncodeToString(mac.Sum(nil))
}

func (c *Client) PostSigned(ctx context.Context, url, secret string, body map[string]any) error {
	if !ValidURL(url) {
		return fmt.Errorf("invalid webhook url")
	}
	if strings.TrimSpace(secret) == "" {
		return fmt.Errorf("missing webhook secret")
	}
	payload, err := json.Marshal(body)
	if err != nil {
		return err
	}
	client := c.HTTP
	if client == nil {
		client = &http.Client{Timeout: 8 * time.Second}
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimSpace(url), bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Saidloop-Signature", SignBody(secret, payload))
	req.Header.Set("User-Agent", "Saidloop-Webhooks/1.0")
	res, err := client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		msg, _ := io.ReadAll(io.LimitReader(res.Body, 512))
		return fmt.Errorf("webhook status %d: %s", res.StatusCode, strings.TrimSpace(string(msg)))
	}
	return nil
}
