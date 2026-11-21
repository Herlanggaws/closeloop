package slack

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// OAuth runs "Add to Slack" with the incoming-webhook scope: Slack shows its own
// channel picker and hands back a webhook URL for the chosen channel, so posting
// keeps using PostWebhook and no bot token is stored.
type OAuth struct {
	ClientID     string
	ClientSecret string
	Base         string // https://slack.com
	HTTP         *http.Client
}

// Install is what Slack returns for the channel the builder picked.
type Install struct {
	WebhookURL       string
	Channel          string
	ChannelID        string
	Team             string
	ConfigurationURL string
}

func (o OAuth) Enabled() bool {
	return strings.TrimSpace(o.ClientID) != "" && strings.TrimSpace(o.ClientSecret) != ""
}

func (o OAuth) base() string {
	if b := strings.TrimRight(strings.TrimSpace(o.Base), "/"); b != "" {
		return b
	}
	return "https://slack.com"
}

// AuthorizeURL is where the browser goes to pick a workspace and channel.
func (o OAuth) AuthorizeURL(redirectURI, state string) string {
	q := url.Values{}
	q.Set("client_id", o.ClientID)
	q.Set("scope", "incoming-webhook")
	q.Set("redirect_uri", redirectURI)
	q.Set("state", state)
	return o.base() + "/oauth/v2/authorize?" + q.Encode()
}

// Exchange trades the callback code for the channel's webhook.
func (o OAuth) Exchange(ctx context.Context, code, redirectURI string) (Install, error) {
	form := url.Values{}
	form.Set("client_id", o.ClientID)
	form.Set("client_secret", o.ClientSecret)
	form.Set("code", code)
	form.Set("redirect_uri", redirectURI)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, o.base()+"/api/oauth.v2.access", strings.NewReader(form.Encode()))
	if err != nil {
		return Install{}, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	client := o.HTTP
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}
	res, err := client.Do(req)
	if err != nil {
		return Install{}, err
	}
	defer res.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(res.Body, 64<<10))
	if err != nil {
		return Install{}, err
	}
	var body struct {
		OK    bool   `json:"ok"`
		Error string `json:"error"`
		Team  struct {
			Name string `json:"name"`
		} `json:"team"`
		IncomingWebhook struct {
			URL              string `json:"url"`
			Channel          string `json:"channel"`
			ChannelID        string `json:"channel_id"`
			ConfigurationURL string `json:"configuration_url"`
		} `json:"incoming_webhook"`
	}
	if err := json.Unmarshal(raw, &body); err != nil {
		return Install{}, fmt.Errorf("slack oauth: bad response (status %d)", res.StatusCode)
	}
	if !body.OK {
		if body.Error == "" {
			body.Error = fmt.Sprintf("status %d", res.StatusCode)
		}
		return Install{}, fmt.Errorf("slack oauth: %s", body.Error)
	}
	if !ValidWebhookURL(body.IncomingWebhook.URL) {
		return Install{}, fmt.Errorf("slack oauth: no incoming webhook in response")
	}
	return Install{
		WebhookURL:       body.IncomingWebhook.URL,
		Channel:          body.IncomingWebhook.Channel,
		ChannelID:        body.IncomingWebhook.ChannelID,
		Team:             body.Team.Name,
		ConfigurationURL: body.IncomingWebhook.ConfigurationURL,
	}, nil
}
