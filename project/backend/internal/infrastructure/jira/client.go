package jira

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type Client struct {
	HTTP *http.Client
}

func NewClient() *Client {
	return &Client{HTTP: &http.Client{Timeout: 20 * time.Second}}
}

type CreateIssueInput struct {
	Email     string
	APIToken  string
	Site      string // e.g. acme.atlassian.net
	ProjectKey string
	Title     string
	Body      string
}

type CreateIssueResult struct {
	ID   string
	Key  string
	URL  string
}

func (c *Client) CreateIssue(ctx context.Context, in CreateIssueInput) (CreateIssueResult, error) {
	site := normalizeSite(in.Site)
	if in.Email == "" || in.APIToken == "" || site == "" || in.ProjectKey == "" || in.Title == "" {
		return CreateIssueResult{}, fmt.Errorf("invalid jira create input")
	}
	payload := map[string]any{
		"fields": map[string]any{
			"project":   map[string]any{"key": in.ProjectKey},
			"summary":   in.Title,
			"issuetype": map[string]any{"name": "Task"},
			"description": map[string]any{
				"type":    "doc",
				"version": 1,
				"content": []map[string]any{
					{
						"type": "paragraph",
						"content": []map[string]any{
							{"type": "text", "text": in.Body},
						},
					},
				},
			},
		},
	}
	body, _ := json.Marshal(payload)
	url := fmt.Sprintf("https://%s/rest/api/3/issue", site)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return CreateIssueResult{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Basic "+basicAuth(in.Email, in.APIToken))
	req.Header.Set("Accept", "application/json")

	res, err := c.HTTP.Do(req)
	if err != nil {
		return CreateIssueResult{}, err
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	if res.StatusCode >= 300 {
		return CreateIssueResult{}, fmt.Errorf("jira api %d: %s", res.StatusCode, truncate(string(raw), 200))
	}
	var out struct {
		ID  string `json:"id"`
		Key string `json:"key"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		return CreateIssueResult{}, err
	}
	if out.Key == "" {
		return CreateIssueResult{}, fmt.Errorf("empty jira issue response")
	}
	return CreateIssueResult{
		ID:  out.ID,
		Key: out.Key,
		URL: fmt.Sprintf("https://%s/browse/%s", site, out.Key),
	}, nil
}

func basicAuth(email, token string) string {
	return base64.StdEncoding.EncodeToString([]byte(email + ":" + token))
}

func normalizeSite(site string) string {
	site = strings.TrimSpace(strings.ToLower(site))
	site = strings.TrimPrefix(site, "https://")
	site = strings.TrimPrefix(site, "http://")
	site = strings.TrimSuffix(site, "/")
	return site
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}
