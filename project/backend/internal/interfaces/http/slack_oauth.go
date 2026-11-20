package httpapi

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/closeloop/api/internal/infrastructure/slack"
	"github.com/gin-gonic/gin"
)

// F8 · "Add to Slack": Slack's own channel picker, then the channel's webhook is
// saved on the project's Slack integration. Pasting a webhook URL still works.

const slackStateTTL = 15 * time.Minute

func (s *Server) slackOAuth() slack.OAuth {
	return slack.OAuth{ClientID: s.Cfg.SlackClientID, ClientSecret: s.Cfg.SlackClientSecret, Base: s.Cfg.SlackAPIBase}
}

func (s *Server) slackRedirectURI() string {
	return strings.TrimRight(s.Cfg.APIURL, "/") + "/api/integrations/slack/callback"
}

func (s *Server) slackConfig(c *gin.Context) {
	c.JSON(200, gin.H{"oauth": s.slackOAuth().Enabled()})
}

func (s *Server) slackInstall(c *gin.Context) {
	projectID := strings.TrimSpace(c.Query("project_id"))
	if projectID == "" {
		writeErr(c, 400, "INVALID_INPUT", "project_id required")
		return
	}
	if !s.requireProjectAccess(c, projectID) {
		return
	}
	oauth := s.slackOAuth()
	if !oauth.Enabled() {
		writeErr(c, 503, "NOT_CONFIGURED", "Slack sign-in is not configured on this server. Paste an Incoming Webhook URL instead.")
		return
	}
	if err := s.Store.RequireIntegrationConnect(c.Request.Context(), projectID, "slack"); err != nil {
		s.mapErr(c, err)
		return
	}
	state := s.signSlackState(projectID, c.GetString("userID"), time.Now().Add(slackStateTTL))
	c.JSON(200, gin.H{"url": oauth.AuthorizeURL(s.slackRedirectURI(), state)})
}

// slackCallback has no Bearer token (browser redirect from Slack), so it hands the
// code to the SPA, which finishes with an authenticated POST.
func (s *Server) slackCallback(c *gin.Context) {
	q := url.Values{}
	if e := c.Query("error"); e != "" {
		q.Set("slack_error", e)
	} else {
		q.Set("slack_code", c.Query("code"))
		q.Set("slack_state", c.Query("state"))
	}
	c.Redirect(http.StatusFound, strings.TrimRight(s.Cfg.WebURL, "/")+"/app/settings/integrations?"+q.Encode())
}

func (s *Server) completeSlack(c *gin.Context) {
	projectID := c.Param("id")
	if !s.requireProjectAccess(c, projectID) {
		return
	}
	var body struct {
		Code  string `json:"code"`
		State string `json:"state"`
	}
	if err := c.BindJSON(&body); err != nil || strings.TrimSpace(body.Code) == "" {
		writeErr(c, 400, "INVALID_INPUT", "code required")
		return
	}
	if !s.verifySlackState(body.State, projectID, c.GetString("userID")) {
		writeErr(c, 400, "INVALID_STATE", "This Slack sign-in expired or was for another project. Try Add to Slack again.")
		return
	}
	oauth := s.slackOAuth()
	if !oauth.Enabled() {
		writeErr(c, 503, "NOT_CONFIGURED", "Slack sign-in is not configured on this server")
		return
	}
	if err := s.Store.RequireIntegrationConnect(c.Request.Context(), projectID, "slack"); err != nil {
		s.mapErr(c, err)
		return
	}
	install, err := oauth.Exchange(c.Request.Context(), strings.TrimSpace(body.Code), s.slackRedirectURI())
	if err != nil {
		writeErr(c, 502, "SLACK_ERROR", "Slack did not finish the connection. Try again.")
		return
	}
	config := map[string]any{
		"webhook_url":       install.WebhookURL,
		"channel":           install.Channel,
		"team":              install.Team,
		"configuration_url": install.ConfigurationURL,
	}
	// Reconnecting to another channel keeps the event choices.
	if raw, err := s.Store.GetIntegrationConfig(c.Request.Context(), projectID, "slack"); err == nil {
		var prev map[string]any
		if json.Unmarshal(raw, &prev) == nil && prev["events"] != nil {
			config["events"] = prev["events"]
		}
	}
	item, err := s.Store.UpsertIntegration(c.Request.Context(), projectID, "slack", config)
	if err != nil {
		mapErr(c, err)
		return
	}
	if org, _, err := s.Store.PrimaryOrg(c.Request.Context(), c.GetString("userID")); err == nil {
		s.writeAudit(c, org.ID, "", "integration.upserted", projectID, map[string]any{"provider": "slack", "via": "oauth"})
	}
	c.JSON(200, gin.H{"integration": item})
}

func (s *Server) signSlackState(projectID, userID string, exp time.Time) string {
	payload := projectID + "|" + userID + "|" + strconv.FormatInt(exp.Unix(), 10)
	enc := base64.RawURLEncoding.EncodeToString([]byte(payload))
	return enc + "." + s.slackStateMAC(enc)
}

func (s *Server) verifySlackState(state, projectID, userID string) bool {
	enc, sig, ok := strings.Cut(strings.TrimSpace(state), ".")
	if !ok || !hmac.Equal([]byte(sig), []byte(s.slackStateMAC(enc))) {
		return false
	}
	raw, err := base64.RawURLEncoding.DecodeString(enc)
	if err != nil {
		return false
	}
	parts := strings.Split(string(raw), "|")
	if len(parts) != 3 || parts[0] != projectID || parts[1] != userID {
		return false
	}
	exp, err := strconv.ParseInt(parts[2], 10, 64)
	return err == nil && time.Now().Unix() <= exp
}

func (s *Server) slackStateMAC(enc string) string {
	m := hmac.New(sha256.New, []byte(s.Cfg.JWTSecret))
	m.Write([]byte("slack-oauth:" + enc))
	return base64.RawURLEncoding.EncodeToString(m.Sum(nil))
}
