package gitlab

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

type Config struct {
	BaseURL string
	Token   string
	HTTP    *http.Client
}

type Client struct {
	baseURL string
	token   string
	http    *http.Client
}

func isDisallowedIP(ip net.IP) bool {
	if ip == nil {
		return true
	}
	if ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsUnspecified() || ip.IsMulticast() {
		return true
	}
	if ip.IsLoopback() {
		return os.Getenv("GIN_MODE") == "release" || os.Getenv("APP_ENV") == "production"
	}
	return false
}

func validateBaseURL(raw string) (string, error) {
	base := strings.TrimSpace(raw)
	if base == "" {
		base = "https://gitlab.com"
	}
	base = strings.TrimRight(base, "/")
	u, err := url.Parse(base)
	if err != nil || u.Host == "" {
		return "", fmt.Errorf("invalid gitlab base_url")
	}
	if u.User != nil || u.RawQuery != "" || u.Fragment != "" {
		return "", fmt.Errorf("invalid gitlab base_url")
	}
	host := strings.ToLower(u.Hostname())
	if host == "localhost" || strings.HasSuffix(host, ".localhost") || strings.HasSuffix(host, ".local") || strings.HasSuffix(host, ".internal") {
		return "", fmt.Errorf("gitlab base_url cannot target local or internal hosts")
	}
	if ip := net.ParseIP(host); ip != nil {
		if isDisallowedIP(ip) {
			return "", fmt.Errorf("gitlab base_url cannot target private, loopback, or link-local addresses")
		}
		if ip.IsLoopback() {
			if u.Scheme != "http" && u.Scheme != "https" {
				return "", fmt.Errorf("gitlab base_url must use https")
			}
			return base, nil
		}
	}
	if u.Scheme != "https" {
		return "", fmt.Errorf("gitlab base_url must use https")
	}
	return base, nil
}

func newSafeHTTPClient() *http.Client {
	dialer := &net.Dialer{Timeout: 10 * time.Second}
	transport := &http.Transport{
		DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
			host, port, err := net.SplitHostPort(addr)
			if err != nil {
				return nil, err
			}
			ips, err := net.DefaultResolver.LookupIPAddr(ctx, host)
			if err != nil {
				return nil, err
			}
			if len(ips) == 0 {
				return nil, fmt.Errorf("no IP addresses found for host %q", host)
			}
			for _, ipAddr := range ips {
				if isDisallowedIP(ipAddr.IP) {
					return nil, fmt.Errorf("gitlab request blocked: host %q resolved to disallowed IP %s", host, ipAddr.IP.String())
				}
			}
			return dialer.DialContext(ctx, network, net.JoinHostPort(ips[0].IP.String(), port))
		},
	}
	return &http.Client{
		Timeout:   30 * time.Second,
		Transport: transport,
		CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
}

func New(cfg Config) (*Client, error) {
	token := strings.TrimSpace(cfg.Token)
	if token == "" {
		return nil, fmt.Errorf("gitlab token required")
	}
	base, err := validateBaseURL(cfg.BaseURL)
	if err != nil {
		return nil, err
	}

	httpClient := cfg.HTTP
	if httpClient == nil {
		httpClient = newSafeHTTPClient()
	}

	return &Client{
		baseURL: base,
		token:   token,
		http:    httpClient,
	}, nil
}

type User struct {
	ID       int64  `json:"id"`
	Username string `json:"username"`
	Name     string `json:"name"`
	WebURL   string `json:"web_url"`
}

type Project struct {
	ID                int64  `json:"id"`
	PathWithNamespace string `json:"path_with_namespace"`
	DefaultBranch     string `json:"default_branch"`
	WebURL            string `json:"web_url"`
}

type FileChange struct {
	Path    string
	Content string
}

type CreateMRInput struct {
	ProjectPath   string // e.g. "group/project"
	BaseBranch    string
	HeadBranch    string
	CommitMessage string
	MRTitle       string
	MRBody        string
	Files         []FileChange
}

type CreateMRResult struct {
	WebURL string
	IID    int
	Branch string
}

type CreateIssueInput struct {
	ProjectPath string
	Title       string
	Description string
}

type CreateIssueResult struct {
	WebURL string
	IID    int
}

func (c *Client) request(ctx context.Context, method, endpoint string, body any) (int, []byte, error) {
	var bodyReader io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			return 0, nil, err
		}
		bodyReader = bytes.NewReader(raw)
	}

	fullURL := fmt.Sprintf("%s/api/v4%s", c.baseURL, endpoint)
	req, err := http.NewRequestWithContext(ctx, method, fullURL, bodyReader)
	if err != nil {
		return 0, nil, err
	}

	req.Header.Set("PRIVATE-TOKEN", c.token)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	res, err := c.http.Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer res.Body.Close()

	respBytes, err := io.ReadAll(io.LimitReader(res.Body, 4<<20))
	if err != nil {
		return res.StatusCode, nil, err
	}

	return res.StatusCode, respBytes, nil
}

// Validate checks token validity and returns user information.
func (c *Client) Validate(ctx context.Context) (User, error) {
	statusCode, body, err := c.request(ctx, http.MethodGet, "/user", nil)
	if err != nil {
		return User{}, err
	}
	if statusCode >= 300 {
		return User{}, fmt.Errorf("gitlab auth status %d: %s", statusCode, strings.TrimSpace(string(body)))
	}
	var u User
	if err := json.Unmarshal(body, &u); err != nil {
		return User{}, err
	}
	return u, nil
}

// ListProjects lists projects accessible by the authenticated token across pages.
func (c *Client) ListProjects(ctx context.Context) ([]Project, error) {
	const perPage = 100
	const maxPages = 5
	var all []Project
	for page := 1; page <= maxPages; page++ {
		endpoint := fmt.Sprintf("/projects?membership=true&simple=true&per_page=%d&page=%d&order_by=last_activity_at", perPage, page)
		statusCode, body, err := c.request(ctx, http.MethodGet, endpoint, nil)
		if err != nil {
			return nil, err
		}
		if statusCode >= 300 {
			return nil, fmt.Errorf("gitlab list projects status %d: %s", statusCode, strings.TrimSpace(string(body)))
		}
		var list []Project
		if err := json.Unmarshal(body, &list); err != nil {
			return nil, err
		}
		all = append(all, list...)
		if len(list) < perPage {
			break
		}
	}
	return all, nil
}

// CreateMergeRequest creates a branch, commits changes, and opens a Merge Request.
func (c *Client) CreateMergeRequest(ctx context.Context, in CreateMRInput) (CreateMRResult, error) {
	projectPath := strings.TrimSpace(in.ProjectPath)
	if projectPath == "" {
		return CreateMRResult{}, fmt.Errorf("project_path required")
	}
	encodedPath := url.PathEscape(projectPath)

	baseBranch := strings.TrimSpace(in.BaseBranch)
	if baseBranch == "" {
		baseBranch = "main"
	}
	headBranch := strings.TrimSpace(in.HeadBranch)
	if headBranch == "" {
		headBranch = fmt.Sprintf("saidloop/fix-%d", time.Now().Unix())
	}

	// 1. Create branch
	branchBody := map[string]string{
		"branch": headBranch,
		"ref":    baseBranch,
	}
	statusCode, bBody, err := c.request(ctx, http.MethodPost, fmt.Sprintf("/projects/%s/repository/branches", encodedPath), branchBody)
	if err != nil {
		return CreateMRResult{}, fmt.Errorf("create branch: %w", err)
	}
	if statusCode >= 300 && statusCode != http.StatusBadRequest { // ignore if branch already exists
		return CreateMRResult{}, fmt.Errorf("gitlab create branch %d: %s", statusCode, strings.TrimSpace(string(bBody)))
	}

	// 2. Commit files
	if len(in.Files) > 0 {
		type commitAction struct {
			Action   string `json:"action"`
			FilePath string `json:"file_path"`
			Content  string `json:"content"`
		}
		actions := make([]commitAction, 0, len(in.Files))
		for _, f := range in.Files {
			actions = append(actions, commitAction{
				Action:   "create",
				FilePath: f.Path,
				Content:  f.Content,
			})
		}
		commitMsg := strings.TrimSpace(in.CommitMessage)
		if commitMsg == "" {
			commitMsg = "fix: update via Saidloop"
		}
		commitPayload := map[string]any{
			"branch":         headBranch,
			"commit_message": commitMsg,
			"actions":        actions,
		}
		cStatus, cBody, err := c.request(ctx, http.MethodPost, fmt.Sprintf("/projects/%s/repository/commits", encodedPath), commitPayload)
		if err != nil {
			return CreateMRResult{}, fmt.Errorf("commit files: %w", err)
		}
		if cStatus >= 300 {
			// If file already exists, retry with action: "update"
			if strings.Contains(string(cBody), "already exists") {
				for i := range actions {
					actions[i].Action = "update"
				}
				commitPayload["actions"] = actions
				cStatus, cBody, err = c.request(ctx, http.MethodPost, fmt.Sprintf("/projects/%s/repository/commits", encodedPath), commitPayload)
				if err != nil || cStatus >= 300 {
					return CreateMRResult{}, fmt.Errorf("gitlab commit retry %d: %s", cStatus, strings.TrimSpace(string(cBody)))
				}
			} else {
				return CreateMRResult{}, fmt.Errorf("gitlab commit %d: %s", cStatus, strings.TrimSpace(string(cBody)))
			}
		}
	}

	// 3. Create Merge Request
	mrPayload := map[string]any{
		"source_branch":        headBranch,
		"target_branch":        baseBranch,
		"title":                in.MRTitle,
		"description":          in.MRBody,
		"remove_source_branch": true,
	}
	mrStatus, mrBody, err := c.request(ctx, http.MethodPost, fmt.Sprintf("/projects/%s/merge_requests", encodedPath), mrPayload)
	if err != nil {
		return CreateMRResult{}, fmt.Errorf("create merge request: %w", err)
	}
	if mrStatus >= 300 {
		return CreateMRResult{}, fmt.Errorf("gitlab merge request %d: %s", mrStatus, strings.TrimSpace(string(mrBody)))
	}

	var mr struct {
		IID    int    `json:"iid"`
		WebURL string `json:"web_url"`
	}
	if err := json.Unmarshal(mrBody, &mr); err != nil {
		return CreateMRResult{}, err
	}

	return CreateMRResult{
		WebURL: mr.WebURL,
		IID:    mr.IID,
		Branch: headBranch,
	}, nil
}

// CreateIssue opens an issue in a GitLab project.
func (c *Client) CreateIssue(ctx context.Context, in CreateIssueInput) (CreateIssueResult, error) {
	projectPath := strings.TrimSpace(in.ProjectPath)
	if projectPath == "" || strings.TrimSpace(in.Title) == "" {
		return CreateIssueResult{}, fmt.Errorf("project_path and title required")
	}
	encodedPath := url.PathEscape(projectPath)

	payload := map[string]any{
		"title":       in.Title,
		"description": in.Description,
	}
	statusCode, body, err := c.request(ctx, http.MethodPost, fmt.Sprintf("/projects/%s/issues", encodedPath), payload)
	if err != nil {
		return CreateIssueResult{}, err
	}
	if statusCode >= 300 {
		return CreateIssueResult{}, fmt.Errorf("gitlab issue %d: %s", statusCode, strings.TrimSpace(string(body)))
	}

	var issue struct {
		IID    int    `json:"iid"`
		WebURL string `json:"web_url"`
	}
	if err := json.Unmarshal(body, &issue); err != nil {
		return CreateIssueResult{}, err
	}

	return CreateIssueResult{
		WebURL: issue.WebURL,
		IID:    issue.IID,
	}, nil
}
