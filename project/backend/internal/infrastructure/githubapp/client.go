package githubapp

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const apiBase = "https://api.github.com"

type Config struct {
	AppID         string
	Slug          string
	WebhookSecret string
	PrivateKeyPEM []byte
	HTTP          *http.Client
}

type Client struct {
	cfg Config
}

func LoadPrivateKey(pemBytes []byte, path string) ([]byte, error) {
	if len(bytes.TrimSpace(pemBytes)) > 0 {
		return pemBytes, nil
	}
	path = strings.TrimSpace(path)
	if path == "" {
		return nil, fmt.Errorf("github app private key not configured")
	}
	return os.ReadFile(path)
}

func New(cfg Config) (*Client, error) {
	if strings.TrimSpace(cfg.AppID) == "" {
		return nil, fmt.Errorf("GITHUB_APP_ID required")
	}
	if len(bytes.TrimSpace(cfg.PrivateKeyPEM)) == 0 {
		return nil, fmt.Errorf("GITHUB_APP_PRIVATE_KEY required")
	}
	if cfg.HTTP == nil {
		cfg.HTTP = &http.Client{Timeout: 30 * time.Second}
	}
	return &Client{cfg: cfg}, nil
}

func (c *Client) InstallURL(state string) string {
	slug := strings.TrimSpace(c.cfg.Slug)
	if slug == "" {
		slug = "saidloop-auto-pr"
	}
	u := fmt.Sprintf("https://github.com/apps/%s/installations/new", slug)
	if state != "" {
		u += "?state=" + state
	}
	return u
}

func (c *Client) WebhookSecret() string {
	return c.cfg.WebhookSecret
}

func VerifySignature(secret string, body []byte, signatureHeader string) bool {
	secret = strings.TrimSpace(secret)
	if secret == "" || signatureHeader == "" {
		return false
	}
	const prefix = "sha256="
	if !strings.HasPrefix(signatureHeader, prefix) {
		return false
	}
	want, err := hex.DecodeString(strings.TrimPrefix(signatureHeader, prefix))
	if err != nil {
		return false
	}
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write(body)
	return hmac.Equal(mac.Sum(nil), want)
}

func (c *Client) AppJWT() (string, error) {
	block, _ := pem.Decode(c.cfg.PrivateKeyPEM)
	if block == nil {
		return "", fmt.Errorf("invalid PEM private key")
	}
	var key *rsa.PrivateKey
	var err error
	switch block.Type {
	case "RSA PRIVATE KEY":
		key, err = x509.ParsePKCS1PrivateKey(block.Bytes)
	case "PRIVATE KEY":
		parsed, e := x509.ParsePKCS8PrivateKey(block.Bytes)
		if e != nil {
			return "", e
		}
		var ok bool
		key, ok = parsed.(*rsa.PrivateKey)
		if !ok {
			return "", fmt.Errorf("not an RSA private key")
		}
	default:
		return "", fmt.Errorf("unsupported PEM type %s", block.Type)
	}
	if err != nil {
		return "", err
	}
	now := time.Now()
	claims := jwt.MapClaims{
		"iat": now.Add(-30 * time.Second).Unix(),
		"exp": now.Add(9 * time.Minute).Unix(),
		"iss": c.cfg.AppID,
	}
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	return token.SignedString(key)
}

func (c *Client) InstallationToken(ctx context.Context, installationID int64) (string, error) {
	jwtToken, err := c.AppJWT()
	if err != nil {
		return "", err
	}
	url := fmt.Sprintf("%s/app/installations/%d/access_tokens", apiBase, installationID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+jwtToken)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	res, err := c.cfg.HTTP.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if res.StatusCode >= 300 {
		return "", fmt.Errorf("installation token status %d: %s", res.StatusCode, strings.TrimSpace(string(body)))
	}
	var out struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(body, &out); err != nil {
		return "", err
	}
	if out.Token == "" {
		return "", fmt.Errorf("empty installation token")
	}
	return out.Token, nil
}

type Repo struct {
	FullName      string `json:"full_name"`
	DefaultBranch string `json:"default_branch"`
	Private       bool   `json:"private"`
}

func (c *Client) ListInstallationRepos(ctx context.Context, installationID int64) ([]Repo, error) {
	token, err := c.InstallationToken(ctx, installationID)
	if err != nil {
		return nil, err
	}
	url := fmt.Sprintf("%s/installation/repositories?per_page=100", apiBase)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	res, err := c.cfg.HTTP.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(res.Body, 4<<20))
	if res.StatusCode >= 300 {
		return nil, fmt.Errorf("list repos status %d: %s", res.StatusCode, strings.TrimSpace(string(body)))
	}
	var out struct {
		Repositories []Repo `json:"repositories"`
	}
	if err := json.Unmarshal(body, &out); err != nil {
		return nil, err
	}
	return out.Repositories, nil
}

type FileChange struct {
	Path    string
	Content string
}

type CreatePRInput struct {
	InstallationID int64
	Owner          string
	Repo           string
	BaseBranch     string
	HeadBranch     string
	CommitMessage  string
	PRTitle        string
	PRBody         string
	Files          []FileChange
}

type CreatePRResult struct {
	HTMLURL string
	Number  int
	Branch  string
}

// CreatePullRequest commits files on a new branch and opens a PR.
// Intentionally has no Merge method — Auto PR never merges.
func (c *Client) CreatePullRequest(ctx context.Context, in CreatePRInput) (CreatePRResult, error) {
	if in.InstallationID == 0 || in.Owner == "" || in.Repo == "" || len(in.Files) == 0 {
		return CreatePRResult{}, fmt.Errorf("invalid create PR input")
	}
	token, err := c.InstallationToken(ctx, in.InstallationID)
	if err != nil {
		return CreatePRResult{}, err
	}
	base := strings.TrimSpace(in.BaseBranch)
	if base == "" {
		base = "main"
	}
	head := strings.TrimSpace(in.HeadBranch)
	if head == "" {
		head = "saidloop/autopr-" + randomSuffix()
	}

	ref, err := c.getRef(ctx, token, in.Owner, in.Repo, "heads/"+base)
	if err != nil {
		return CreatePRResult{}, err
	}
	baseSHA := ref.Object.SHA
	baseCommit, err := c.getCommit(ctx, token, in.Owner, in.Repo, baseSHA)
	if err != nil {
		return CreatePRResult{}, err
	}
	treeSHA := baseCommit.Tree.SHA

	entries := make([]map[string]any, 0, len(in.Files))
	for _, f := range in.Files {
		blob, err := c.createBlob(ctx, token, in.Owner, in.Repo, f.Content)
		if err != nil {
			return CreatePRResult{}, err
		}
		entries = append(entries, map[string]any{
			"path": f.Path,
			"mode": "100644",
			"type": "blob",
			"sha":  blob,
		})
	}
	newTree, err := c.createTree(ctx, token, in.Owner, in.Repo, treeSHA, entries)
	if err != nil {
		return CreatePRResult{}, err
	}
	newCommit, err := c.createCommit(ctx, token, in.Owner, in.Repo, in.CommitMessage, newTree, baseSHA)
	if err != nil {
		return CreatePRResult{}, err
	}
	if err := c.createRef(ctx, token, in.Owner, in.Repo, "refs/heads/"+head, newCommit); err != nil {
		return CreatePRResult{}, err
	}
	pr, err := c.openPR(ctx, token, in.Owner, in.Repo, in.PRTitle, in.PRBody, head, base)
	if err != nil {
		return CreatePRResult{}, err
	}
	return CreatePRResult{HTMLURL: pr.HTMLURL, Number: pr.Number, Branch: head}, nil
}

func randomSuffix() string {
	b := make([]byte, 4)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

type ghRef struct {
	Object struct {
		SHA string `json:"sha"`
	} `json:"object"`
}

func (c *Client) getRef(ctx context.Context, token, owner, repo, ref string) (ghRef, error) {
	var out ghRef
	err := c.doJSON(ctx, token, http.MethodGet, fmt.Sprintf("/repos/%s/%s/git/ref/%s", owner, repo, ref), nil, &out)
	return out, err
}

type ghCommit struct {
	Tree struct {
		SHA string `json:"sha"`
	} `json:"tree"`
}

func (c *Client) getCommit(ctx context.Context, token, owner, repo, sha string) (ghCommit, error) {
	var out ghCommit
	err := c.doJSON(ctx, token, http.MethodGet, fmt.Sprintf("/repos/%s/%s/git/commits/%s", owner, repo, sha), nil, &out)
	return out, err
}

func (c *Client) createBlob(ctx context.Context, token, owner, repo, content string) (string, error) {
	var out struct {
		SHA string `json:"sha"`
	}
	body := map[string]any{
		"content":  base64.StdEncoding.EncodeToString([]byte(content)),
		"encoding": "base64",
	}
	err := c.doJSON(ctx, token, http.MethodPost, fmt.Sprintf("/repos/%s/%s/git/blobs", owner, repo), body, &out)
	return out.SHA, err
}

func (c *Client) createTree(ctx context.Context, token, owner, repo, baseTree string, entries []map[string]any) (string, error) {
	var out struct {
		SHA string `json:"sha"`
	}
	body := map[string]any{"base_tree": baseTree, "tree": entries}
	err := c.doJSON(ctx, token, http.MethodPost, fmt.Sprintf("/repos/%s/%s/git/trees", owner, repo), body, &out)
	return out.SHA, err
}

func (c *Client) createCommit(ctx context.Context, token, owner, repo, message, tree, parent string) (string, error) {
	var out struct {
		SHA string `json:"sha"`
	}
	body := map[string]any{
		"message": message,
		"tree":    tree,
		"parents": []string{parent},
	}
	err := c.doJSON(ctx, token, http.MethodPost, fmt.Sprintf("/repos/%s/%s/git/commits", owner, repo), body, &out)
	return out.SHA, err
}

func (c *Client) createRef(ctx context.Context, token, owner, repo, ref, sha string) error {
	body := map[string]any{"ref": ref, "sha": sha}
	return c.doJSON(ctx, token, http.MethodPost, fmt.Sprintf("/repos/%s/%s/git/refs", owner, repo), body, nil)
}

type ghPR struct {
	HTMLURL string `json:"html_url"`
	Number  int    `json:"number"`
}

func (c *Client) openPR(ctx context.Context, token, owner, repo, title, body, head, base string) (ghPR, error) {
	var out ghPR
	payload := map[string]any{
		"title": title,
		"body":  body,
		"head":  head,
		"base":  base,
	}
	err := c.doJSON(ctx, token, http.MethodPost, fmt.Sprintf("/repos/%s/%s/pulls", owner, repo), payload, &out)
	return out, err
}

func (c *Client) doJSON(ctx context.Context, token, method, path string, payload any, out any) error {
	var reader io.Reader
	if payload != nil {
		b, err := json.Marshal(payload)
		if err != nil {
			return err
		}
		reader = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, apiBase+path, reader)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	res, err := c.cfg.HTTP.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(res.Body, 4<<20))
	if res.StatusCode >= 300 {
		return fmt.Errorf("github %s %s: %d %s", method, path, res.StatusCode, strings.TrimSpace(string(body)))
	}
	if out == nil || len(body) == 0 {
		return nil
	}
	return json.Unmarshal(body, out)
}

// ParseInstallationID reads installation id from common webhook payloads.
func ParseInstallationID(raw json.RawMessage) (int64, string, error) {
	var envelope struct {
		Installation struct {
			ID      int64 `json:"id"`
			Account struct {
				Login string `json:"login"`
			} `json:"account"`
		} `json:"installation"`
		Repositories []struct {
			FullName      string `json:"full_name"`
			DefaultBranch string `json:"default_branch"`
		} `json:"repositories"`
		RepositoriesAdded []struct {
			FullName      string `json:"full_name"`
			DefaultBranch string `json:"default_branch"`
		} `json:"repositories_added"`
	}
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return 0, "", err
	}
	return envelope.Installation.ID, envelope.Installation.Account.Login, nil
}

func ParseInstallationIDString(s string) (int64, error) {
	return strconv.ParseInt(strings.TrimSpace(s), 10, 64)
}
