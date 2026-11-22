package httpapi

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/closeloop/api/internal/infrastructure/auth"
	"github.com/google/uuid"
)

var billingT0 = time.Date(2026, 11, 22, 10, 0, 0, 0, time.UTC)

type subEvent struct {
	id, typ, sub, product, status, org string
	cancelAtEnd                        bool
	at                                 time.Time
}

func (h *reportHarness) sendWebhook(e subEvent, sentAt time.Time, secret string) int {
	h.t.Helper()
	if e.id == "" {
		e.id = uuid.NewString()
	}
	if e.sub == "" {
		e.sub = "sub-1"
	}
	if e.at.IsZero() {
		e.at = billingT0
	}
	body, err := json.Marshal(map[string]any{
		"type":      e.typ,
		"timestamp": time.Now().UTC(),
		"data": map[string]any{
			"id":                   e.sub,
			"customer_id":          "cus-1",
			"product_id":           e.product,
			"status":               e.status,
			"cancel_at_period_end": e.cancelAtEnd,
			"current_period_end":   billingT0.AddDate(0, 1, 0),
			"created_at":           billingT0.Add(-time.Hour),
			"modified_at":          e.at,
			"metadata":             map[string]any{"org_id": e.org},
		},
	})
	if err != nil {
		h.t.Fatal(err)
	}
	ts := strconv.FormatInt(sentAt.Unix(), 10)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(e.id + "." + ts + "."))
	mac.Write(body)

	req := httptest.NewRequest(http.MethodPost, "/api/webhooks/billing", strings.NewReader(string(body)))
	req.Header.Set("webhook-id", e.id)
	req.Header.Set("webhook-timestamp", ts)
	req.Header.Set("webhook-signature", "v1,"+base64.StdEncoding.EncodeToString(mac.Sum(nil)))
	w := httptest.NewRecorder()
	h.router.ServeHTTP(w, req)
	return w.Code
}

func (h *reportHarness) deliver(e subEvent) {
	h.t.Helper()
	if code := h.sendWebhook(e, time.Now(), h.server.Cfg.PolarWebhookSecret); code != 202 {
		h.t.Fatalf("%s %s = %d want 202", e.typ, e.status, code)
	}
}

func (h *reportHarness) wantBilling(seed seededProject, plan string, subscribed bool) map[string]any {
	h.t.Helper()
	code, body := h.do(http.MethodGet, "/api/me", nil, h.authHeaders(seed.AccessToken))
	if code != 200 {
		h.t.Fatalf("me: %d %v", code, body)
	}
	usage := body["usage"].(map[string]any)
	if usage["plan"] != plan || usage["subscribed"] != subscribed {
		h.t.Fatalf("plan=%v subscribed=%v want %s %v", usage["plan"], usage["subscribed"], plan, subscribed)
	}
	return usage
}

func (h *reportHarness) count(query string, args ...any) int {
	h.t.Helper()
	var n int
	if err := h.db.QueryRow(query, args...).Scan(&n); err != nil {
		h.t.Fatal(err)
	}
	return n
}

func TestBillingWebhook_Signature(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("free")
	e := subEvent{typ: "subscription.active", product: "prod-im", status: "active", org: seed.OrgID}

	if code := h.sendWebhook(e, time.Now(), "x"); code != 503 {
		t.Fatalf("unconfigured = %d want 503", code)
	}
	h.configureBilling(201, `{}`)
	secret := h.server.Cfg.PolarWebhookSecret
	if code := h.sendWebhook(e, time.Now(), "wrong"); code != 403 {
		t.Fatalf("invalid = %d want 403", code)
	}
	if code := h.sendWebhook(e, time.Now().Add(-6*time.Minute), secret); code != 403 {
		t.Fatalf("stale = %d want 403", code)
	}
	h.wantBilling(seed, "free", false)
	h.deliver(e)
	h.wantBilling(seed, "indie", true)
}

func TestBillingWebhook_ProductToPlan(t *testing.T) {
	h := newReportHarness(t)
	h.configureBilling(201, `{}`)
	cases := []struct{ product, plan, interval string }{
		{"prod-im", "indie", "month"},
		{"prod-iy", "indie", "year"},
		{"prod-sm", "studio", "month"},
		{"prod-sy", "studio", "year"},
	}
	for _, tc := range cases {
		seed := h.seedUserProject("free")
		h.deliver(subEvent{typ: "subscription.created", sub: "sub-" + tc.product, product: tc.product, status: "active", org: seed.OrgID})
		usage := h.wantBilling(seed, tc.plan, true)
		if usage["billing_interval"] != tc.interval {
			t.Fatalf("%s interval = %v", tc.product, usage["billing_interval"])
		}
		if usage["auto_pr_credits"].(float64) != 10 {
			t.Fatalf("%s starter credits = %v", tc.product, usage["auto_pr_credits"])
		}
	}
}

func TestBillingWebhook_CancelKeepsPlanThenRevokedDowngrades(t *testing.T) {
	h := newReportHarness(t)
	h.configureBilling(201, `{}`)
	seed := h.seedUserProject("free")
	e := subEvent{typ: "subscription.active", product: "prod-sm", status: "active", org: seed.OrgID}
	h.deliver(e)
	for i := 0; i < 2; i++ {
		var userID string
		if err := h.db.QueryRow(`INSERT INTO users(email, name) VALUES ($1,'Mate') RETURNING id`,
			uuid.NewString()+"@test.closeloop").Scan(&userID); err != nil {
			t.Fatal(err)
		}
		if _, err := h.db.Exec(`INSERT INTO memberships(org_id, user_id, role) VALUES ($1,$2,'member')`, seed.OrgID, userID); err != nil {
			t.Fatal(err)
		}
	}

	e.typ, e.cancelAtEnd, e.at = "subscription.canceled", true, billingT0.Add(time.Minute)
	h.deliver(e)
	canceled := h.wantBilling(seed, "studio", true)
	ends, err := time.Parse(time.RFC3339, fmt.Sprint(canceled["billing_ends_at"]))
	if err != nil || !ends.Equal(billingT0.AddDate(0, 1, 0)) {
		t.Fatalf("billing_ends_at = %v (%v)", canceled["billing_ends_at"], err)
	}
	if h.count(`SELECT COUNT(*) FROM billing_subscriptions WHERE org_id=$1 AND cancel_at_period_end
		AND current_period_end IS NOT NULL AND customer_id='cus-1'`, seed.OrgID) != 1 {
		t.Fatal("cancel at period end was not stored")
	}

	e.typ, e.cancelAtEnd, e.at = "subscription.uncanceled", false, billingT0.Add(2*time.Minute)
	h.deliver(e)
	if _, ok := h.wantBilling(seed, "studio", true)["billing_ends_at"]; ok {
		t.Fatal("uncanceled must clear billing_ends_at")
	}

	e.typ, e.status, e.at = "subscription.revoked", "canceled", billingT0.Add(3*time.Minute)
	h.deliver(e)
	usage := h.wantBilling(seed, "free", false)
	seats := usage["seats"].(map[string]any)
	if seats["used"].(float64) != 3 || seats["limit"].(float64) != 1 {
		t.Fatalf("members must be kept over the limit: %v", seats)
	}
	if h.count(`SELECT COUNT(*) FROM audit_logs WHERE org_id=$1 AND actor='system:billing'`, seed.OrgID) != 2 {
		t.Fatal("want one audit row per plan change")
	}
}

func TestBillingWebhook_IdempotentAndOrdered(t *testing.T) {
	h := newReportHarness(t)
	h.configureBilling(201, `{}`)
	seed := h.seedUserProject("free")
	first := subEvent{id: "evt-1", typ: "subscription.active", product: "prod-im", status: "active", org: seed.OrgID}
	h.deliver(first)

	replay := first
	replay.product, replay.at = "prod-sm", billingT0.Add(time.Minute)
	h.deliver(replay)
	h.wantBilling(seed, "indie", true)

	newer := replay
	newer.id, newer.typ = "evt-2", "subscription.updated"
	h.deliver(newer)
	h.wantBilling(seed, "studio", true)

	late := first
	late.id = "evt-3"
	h.deliver(late)
	h.wantBilling(seed, "studio", true)

	revoked := newer
	revoked.id, revoked.typ, revoked.status, revoked.at = "evt-4", "subscription.revoked", "past_due", billingT0.Add(2*time.Minute)
	h.deliver(revoked)
	h.wantBilling(seed, "free", false)
	same := revoked
	same.id, same.typ = "evt-5", "subscription.updated"
	h.deliver(same)
	h.wantBilling(seed, "free", false)
}

func TestBillingWebhook_UnknownProductRetries(t *testing.T) {
	h := newReportHarness(t)
	h.configureBilling(201, `{}`)
	seed := h.seedUserProject("free")
	e := subEvent{id: "evt-retry", typ: "subscription.active", product: "prod-new", status: "active", org: seed.OrgID}
	if code := h.sendWebhook(e, time.Now(), h.server.Cfg.PolarWebhookSecret); code != 500 {
		t.Fatalf("unknown product = %d want 500", code)
	}
	h.wantBilling(seed, "free", false)

	h.server.Cfg.PolarProducts.IndieMonthly = "prod-new"
	h.deliver(e)
	h.wantBilling(seed, "indie", true)
}

func TestBillingWebhook_LeavesUnrelatedPlansAlone(t *testing.T) {
	h := newReportHarness(t)
	h.configureBilling(201, `{}`)

	manual := h.seedUserProject("studio")
	h.deliver(subEvent{typ: "subscription.created", product: "prod-im", status: "incomplete", org: manual.OrgID})
	h.deliver(subEvent{typ: "subscription.updated", product: "prod-im", status: "incomplete_expired", org: manual.OrgID})
	h.wantBilling(manual, "studio", false)

	biz := h.seedUserProject("business")
	e := subEvent{typ: "subscription.active", sub: "sub-biz", product: "prod-im", status: "active", org: biz.OrgID}
	h.deliver(e)
	e.typ, e.status, e.at = "subscription.revoked", "canceled", billingT0.Add(time.Minute)
	h.deliver(e)
	h.wantBilling(biz, "business", false)

	h.deliver(subEvent{typ: "subscription.active", sub: "sub-x", product: "other", status: "active"})
	h.deliver(subEvent{typ: "subscription.active", sub: "sub-y", product: "prod-im", status: "active", org: uuid.NewString()})
	h.deliver(subEvent{typ: "order.paid", sub: "order", status: "paid", org: manual.OrgID})
	h.wantBilling(manual, "studio", false)
}

func TestBillingWebhook_RevokingOneOfTwoSubscriptions(t *testing.T) {
	h := newReportHarness(t)
	h.configureBilling(201, `{}`)
	seed := h.seedUserProject("free")
	h.deliver(subEvent{typ: "subscription.active", sub: "sub-indie", product: "prod-im", status: "active", org: seed.OrgID})
	studio := subEvent{typ: "subscription.active", sub: "sub-studio", product: "prod-sm", status: "active", org: seed.OrgID}
	h.deliver(studio)
	h.wantBilling(seed, "studio", true)
	studio.typ, studio.status, studio.at = "subscription.revoked", "canceled", billingT0.Add(time.Minute)
	h.deliver(studio)
	h.wantBilling(seed, "indie", true)
}

func TestBilling_SubscriberCannotPayTwiceOrSwitchByHand(t *testing.T) {
	h := newReportHarness(t)
	calls := h.configureBilling(201, `{"url":"https://checkout.test/session"}`)
	seed := h.seedUserProject("free")
	h.deliver(subEvent{typ: "subscription.active", product: "prod-im", status: "active", org: seed.OrgID})
	authz := h.authHeaders(seed.AccessToken)

	code, body := h.do(http.MethodPost, "/api/billing/checkout", map[string]any{"plan": "studio", "interval": "month"}, authz)
	if code != 409 || errCode(body) != "ALREADY_SUBSCRIBED" || len(*calls) != 0 {
		t.Fatalf("second checkout = %d %v", code, body)
	}
	// Free by hand would leave them paying for nothing; applies with billing env removed too.
	h.server.Cfg.PolarAccessToken = ""
	for _, plan := range []string{"free", "studio"} {
		code, body = h.do(http.MethodPatch, "/api/org/plan", map[string]any{"plan": plan}, authz)
		if code != 409 || errCode(body) != "ALREADY_SUBSCRIBED" {
			t.Fatalf("manual %s = %d %v", plan, code, body)
		}
	}
	h.wantBilling(seed, "indie", true)
}

// Accepting an invite drops an empty personal org, but never one that is being paid for.
func TestBilling_AcceptInviteKeepsSubscribedOrg(t *testing.T) {
	h := newReportHarness(t)
	h.configureBilling(201, `{}`)
	inviter := h.seedUserProject("studio")
	email := "payer@test.closeloop"
	code, body := h.do(http.MethodPost, "/api/auth/register", map[string]any{
		"name": "Payer", "email": email, "password": "test-test-test",
	}, nil)
	if code != 200 {
		t.Fatalf("register: %d %v", code, body)
	}
	authz := h.authHeaders(body["access_token"].(string))
	_, me := h.do(http.MethodGet, "/api/me", nil, authz)
	org := me["org"].(map[string]any)["id"].(string)
	h.deliver(subEvent{typ: "subscription.active", product: "prod-im", status: "active", org: org})

	if code, body := h.do(http.MethodPost, "/api/org/invites", map[string]any{
		"emails": []string{email}, "role": "member",
	}, h.authHeaders(inviter.AccessToken)); code != 201 {
		t.Fatalf("invite: %d %v", code, body)
	}
	raw := "billing-invite-token"
	if _, err := h.db.Exec(`UPDATE invites SET token_hash=$1 WHERE email=$2`, auth.SHA256(raw), email); err != nil {
		t.Fatal(err)
	}
	if code, body := h.do(http.MethodPost, "/api/invites/"+raw+"/accept", nil, authz); code != 200 {
		t.Fatalf("accept: %d %v", code, body)
	}
	if h.count(`SELECT COUNT(*) FROM billing_subscriptions WHERE org_id=$1`, org) != 1 {
		t.Fatal("paid org was deleted on invite accept")
	}
}
