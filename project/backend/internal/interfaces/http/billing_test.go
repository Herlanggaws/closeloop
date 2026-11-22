package httpapi

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/closeloop/api/internal/infrastructure/polar"
)

type billingCall struct {
	path, auth string
	body       map[string]any
}

// configureBilling points the server at a fake billing API that answers status/response.
func (h *reportHarness) configureBilling(status int, response string) *[]billingCall {
	h.t.Helper()
	calls := &[]billingCall{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		call := billingCall{path: r.URL.Path, auth: r.Header.Get("Authorization")}
		if err := json.NewDecoder(r.Body).Decode(&call.body); err != nil {
			h.t.Errorf("fake billing API: %v", err)
		}
		*calls = append(*calls, call)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		if _, err := fmt.Fprint(w, response); err != nil {
			h.t.Errorf("fake billing API write: %v", err)
		}
	}))
	h.t.Cleanup(srv.Close)
	h.server.Cfg.PolarAPIBase = srv.URL
	h.server.Cfg.PolarAccessToken = "test-token"
	h.server.Cfg.PolarWebhookSecret = "test-webhook-secret"
	h.server.Cfg.PolarProducts = polar.Products{
		IndieMonthly: "prod-im", IndieYearly: "prod-iy", StudioMonthly: "prod-sm", StudioYearly: "prod-sy",
	}
	return calls
}

func TestBilling_CheckoutEveryPlanAndInterval(t *testing.T) {
	h := newReportHarness(t)
	calls := h.configureBilling(201, `{"url":"https://checkout.test/session"}`)
	seed := h.seedUserProject("free")

	cases := []struct{ plan, interval, product string }{
		{"indie", "month", "prod-im"},
		{"indie", "year", "prod-iy"},
		{"studio", "month", "prod-sm"},
		{"studio", "year", "prod-sy"},
	}
	for i, tc := range cases {
		code, body := h.do(http.MethodPost, "/api/billing/checkout",
			map[string]any{"plan": tc.plan, "interval": tc.interval}, h.authHeaders(seed.AccessToken))
		if code != 200 || body["url"] != "https://checkout.test/session" {
			t.Fatalf("checkout %v: %d %v", tc, code, body)
		}
		got := (*calls)[i]
		if got.path != "/v1/checkouts/" || got.auth != "Bearer test-token" {
			t.Fatalf("request = %+v", got)
		}
		if p := got.body["products"].([]any); len(p) != 1 || p[0] != tc.product {
			t.Fatalf("products = %v want %s", p, tc.product)
		}
		if got.body["customer_email"] != seed.Email || got.body["external_customer_id"] != seed.OrgID ||
			got.body["metadata"].(map[string]any)["org_id"] != seed.OrgID ||
			got.body["success_url"] != "http://web.test/app/settings/billing?checkout=success" {
			t.Fatalf("payload = %v", got.body)
		}
	}
}

func TestBilling_CheckoutRejects(t *testing.T) {
	h := newReportHarness(t)
	calls := h.configureBilling(201, `{"url":"https://checkout.test/session"}`)
	valid := map[string]any{"plan": "indie", "interval": "month"}

	if code, _ := h.do(http.MethodPost, "/api/billing/checkout", valid, nil); code != 401 {
		t.Fatalf("anonymous = %d want 401", code)
	}
	seed := h.seedUserProject("free")
	auth := h.authHeaders(seed.AccessToken)
	for _, bad := range []map[string]any{
		{"plan": "business", "interval": "month"},
		{"plan": "free", "interval": "month"},
		{"plan": "indie", "interval": "week"},
	} {
		if code, body := h.do(http.MethodPost, "/api/billing/checkout", bad, auth); code != 400 {
			t.Fatalf("%v = %d %v want 400", bad, code, body)
		}
	}
	biz := h.seedUserProject("business")
	if code, body := h.do(http.MethodPost, "/api/billing/checkout", valid, h.authHeaders(biz.AccessToken)); code != 409 {
		t.Fatalf("business org = %d %v want 409", code, body)
	}
	for _, role := range []string{"member", "viewer"} {
		if _, err := h.db.Exec(`UPDATE memberships SET role=$2 WHERE org_id=$1`, seed.OrgID, role); err != nil {
			t.Fatal(err)
		}
		for _, path := range []string{"/api/billing/checkout", "/api/billing/portal"} {
			if code, body := h.do(http.MethodPost, path, valid, auth); code != 403 {
				t.Fatalf("%s %s = %d %v want 403", role, path, code, body)
			}
		}
	}
	if len(*calls) != 0 {
		t.Fatalf("rejected requests reached the billing API: %v", *calls)
	}
}

func TestBilling_NotConfigured(t *testing.T) {
	h := newReportHarness(t)
	seed := h.seedUserProject("free")
	auth := h.authHeaders(seed.AccessToken)
	body := map[string]any{"plan": "indie", "interval": "month"}
	for _, path := range []string{"/api/billing/checkout", "/api/billing/portal"} {
		code, res := h.do(http.MethodPost, path, body, auth)
		if code != 503 || errCode(res) != "BILLING_NOT_CONFIGURED" {
			t.Fatalf("%s = %d %v", path, code, res)
		}
	}

	h.configureBilling(201, `{"url":"https://checkout.test/session"}`)
	h.server.Cfg.PolarWebhookSecret = ""
	if code, res := h.do(http.MethodPost, "/api/billing/checkout", body, auth); code != 503 {
		t.Fatalf("no webhook secret must not sell: %d %v", code, res)
	}
}

func TestBilling_Portal(t *testing.T) {
	h := newReportHarness(t)
	calls := h.configureBilling(201, `{"customer_portal_url":"https://portal.test/session"}`)
	seed := h.seedUserProject("indie")
	code, body := h.do(http.MethodPost, "/api/billing/portal", nil, h.authHeaders(seed.AccessToken))
	if code != 200 || body["url"] != "https://portal.test/session" {
		t.Fatalf("portal: %d %v", code, body)
	}
	got := (*calls)[0]
	if got.path != "/v1/customer-sessions/" || got.body["external_customer_id"] != seed.OrgID {
		t.Fatalf("request = %+v", got)
	}
	if _, ok := got.body["customer_id"]; ok {
		t.Fatal("portal must look the customer up by org only")
	}
}

func TestBilling_ProviderErrors(t *testing.T) {
	cases := []struct {
		name, path, response string
		status, want         int
	}{
		{"checkout bad token", "checkout", `{"error":"invalid_token","detail":"Polar token expired"}`, 401, 502},
		{"checkout without url", "checkout", `{}`, 201, 502},
		{"portal missing customer", "portal", `{"detail":[{"loc":["body","external_customer_id"],"msg":"Customer does not exist."}]}`, 422, 409},
		{"portal other validation", "portal", `{"detail":[{"loc":["body","return_url"],"msg":"bad"}]}`, 422, 502},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			h := newReportHarness(t)
			h.configureBilling(tc.status, tc.response)
			seed := h.seedUserProject("free")
			code, body := h.do(http.MethodPost, "/api/billing/"+tc.path,
				map[string]any{"plan": "indie", "interval": "month"}, h.authHeaders(seed.AccessToken))
			if code != tc.want {
				t.Fatalf("= %d %v want %d", code, body, tc.want)
			}
			if strings.Contains(strings.ToLower(fmt.Sprint(body)), "polar") {
				t.Fatalf("provider name leaked: %v", body)
			}
		})
	}
}

// The manual switch must not hand out paid plans once billing is live.
func TestBilling_ManualUpgradeClosedWhenConfigured(t *testing.T) {
	h := newReportHarness(t)
	h.configureBilling(201, `{}`)
	// A broken config still keeps the switch closed.
	h.server.Cfg.PolarAPIBase = ""
	free := h.seedUserProject("free")
	for _, plan := range []string{"indie", "studio", " Studio "} {
		code, body := h.do(http.MethodPatch, "/api/org/plan", map[string]any{"plan": plan}, h.authHeaders(free.AccessToken))
		if code != 402 || errCode(body) != "BILLING_REQUIRED" {
			t.Fatalf("manual %q = %d %v", plan, code, body)
		}
	}
	paid := h.seedUserProject("studio")
	if code, body := h.do(http.MethodPatch, "/api/org/plan", map[string]any{"plan": "free"}, h.authHeaders(paid.AccessToken)); code != 200 {
		t.Fatalf("manual plan to free = %d %v", code, body)
	}
}
