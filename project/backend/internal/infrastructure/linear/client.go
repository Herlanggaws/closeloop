package linear

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

type Client struct {
	HTTP *http.Client
	URL  string
}

func NewClient() *Client {
	return &Client{
		HTTP: &http.Client{Timeout: 20 * time.Second},
		URL:  "https://api.linear.app/graphql",
	}
}

type CreateIssueInput struct {
	APIKey string
	TeamID string
	Title  string
	Body   string
}

type CreateIssueResult struct {
	ID         string
	Identifier string
	URL        string
}

func (c *Client) CreateIssue(ctx context.Context, in CreateIssueInput) (CreateIssueResult, error) {
	if strings.TrimSpace(in.APIKey) == "" || strings.TrimSpace(in.TeamID) == "" || strings.TrimSpace(in.Title) == "" {
		return CreateIssueResult{}, fmt.Errorf("invalid linear create input")
	}
	query := `mutation IssueCreate($input: IssueCreateInput!) {
  issueCreate(input: $input) {
    success
    issue { id identifier url }
  }
}`
	payload := map[string]any{
		"query": query,
		"variables": map[string]any{
			"input": map[string]any{
				"teamId":      in.TeamID,
				"title":       in.Title,
				"description": in.Body,
			},
		},
	}
	body, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.URL, bytes.NewReader(body))
	if err != nil {
		return CreateIssueResult{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", in.APIKey)

	res, err := c.HTTP.Do(req)
	if err != nil {
		return CreateIssueResult{}, err
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	if res.StatusCode >= 300 {
		return CreateIssueResult{}, fmt.Errorf("linear api %d: %s", res.StatusCode, truncate(string(raw), 200))
	}
	var out struct {
		Data struct {
			IssueCreate struct {
				Success bool `json:"success"`
				Issue   struct {
					ID         string `json:"id"`
					Identifier string `json:"identifier"`
					URL        string `json:"url"`
				} `json:"issue"`
			} `json:"issueCreate"`
		} `json:"data"`
		Errors []struct {
			Message string `json:"message"`
		} `json:"errors"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		return CreateIssueResult{}, err
	}
	if len(out.Errors) > 0 {
		return CreateIssueResult{}, fmt.Errorf("linear: %s", out.Errors[0].Message)
	}
	if !out.Data.IssueCreate.Success || out.Data.IssueCreate.Issue.ID == "" {
		return CreateIssueResult{}, fmt.Errorf("linear issue create failed")
	}
	return CreateIssueResult{
		ID:         out.Data.IssueCreate.Issue.ID,
		Identifier: out.Data.IssueCreate.Issue.Identifier,
		URL:        out.Data.IssueCreate.Issue.URL,
	}, nil
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}
