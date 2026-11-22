package polar

import (
	"encoding/base64"
	"errors"
	"net/http"
	"strconv"
	"testing"
	"time"
)

// Published test vector from the Standard Webhooks spec.
const (
	specSecret    = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw"
	specID        = "msg_p5jXN8AQM9LWM0D4loKWxJek"
	specTimestamp = 1614265330
	specBody      = `{"test": 2432232314}`
	specSignature = "v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE="
)

func webhookHeaders(id, timestamp, signature string) http.Header {
	h := http.Header{}
	h.Set("webhook-id", id)
	h.Set("webhook-timestamp", timestamp)
	h.Set("webhook-signature", signature)
	return h
}

func TestVerifyWebhook(t *testing.T) {
	now := time.Unix(specTimestamp, 0)
	ts := strconv.Itoa(specTimestamp)
	rawKey := func(secret string) string {
		return "v1," + base64.StdEncoding.EncodeToString(sign([]byte(secret), specID, ts, []byte(specBody)))
	}
	cases := []struct {
		name, secret, id, timestamp, signature, body string
		now                                          time.Time
		want                                         error
	}{
		{"valid spec vector", specSecret, specID, ts, specSignature, specBody, now, nil},
		{"valid legacy whsec secret", "whsec_legacyNotBase64_secret", specID, ts, rawKey("whsec_legacyNotBase64_secret"), specBody, now, nil},
		{"valid hand-typed secret", "plain secret", specID, ts, rawKey("plain secret"), specBody, now, nil},
		{"valid among several", specSecret, specID, ts, "v1a,abc v1,bm9wZQ== " + specSignature, specBody, now, nil},
		{"valid at five minutes", specSecret, specID, ts, specSignature, specBody, now.Add(5 * time.Minute), nil},
		{"invalid body", specSecret, specID, ts, specSignature, `{"test": 1}`, now, ErrInvalidSignature},
		{"invalid id", specSecret, "msg_other", ts, specSignature, specBody, now, ErrInvalidSignature},
		{"invalid secret", "whsec_AAAA", specID, ts, specSignature, specBody, now, ErrInvalidSignature},
		{"invalid version", specSecret, specID, ts, "v2" + specSignature[2:], specBody, now, ErrInvalidSignature},
		{"invalid empty secret", "", specID, ts, rawKey(""), specBody, now, ErrInvalidSignature},
		{"invalid empty key after prefix", "whsec_", specID, ts, rawKey(""), specBody, now, ErrInvalidSignature},
		{"missing id", specSecret, "", ts, specSignature, specBody, now, ErrInvalidSignature},
		{"missing signature", specSecret, specID, ts, "", specBody, now, ErrInvalidSignature},
		{"bad timestamp", specSecret, specID, "soon", specSignature, specBody, now, ErrInvalidSignature},
		{"stale", specSecret, specID, ts, specSignature, specBody, now.Add(5*time.Minute + time.Second), ErrStaleTimestamp},
		{"future", specSecret, specID, ts, specSignature, specBody, now.Add(-5*time.Minute - time.Second), ErrStaleTimestamp},
		{"absurd timestamp", specSecret, specID, "-9223372036854775808", specSignature, specBody, now, ErrStaleTimestamp},
	}
	for _, tc := range cases {
		id, err := VerifyWebhook(tc.secret, webhookHeaders(tc.id, tc.timestamp, tc.signature), []byte(tc.body), tc.now)
		if !errors.Is(err, tc.want) || (err == nil && id != tc.id) {
			t.Errorf("%s: id=%q err=%v want %v", tc.name, id, err, tc.want)
		}
	}
}

func TestParseSubscriptionEvent(t *testing.T) {
	event, err := ParseSubscriptionEvent([]byte(`{
		"type":"subscription.canceled","timestamp":"2026-11-22T10:00:09Z",
		"data":{"id":"sub","customer_id":"cus","product_id":"prod","status":"active",
			"cancel_at_period_end":true,"current_period_end":"2026-12-22T10:00:00Z",
			"created_at":"2026-11-22T09:00:00Z","modified_at":"2026-11-22T10:00:00Z",
			"metadata":{"org_id":"org-from-checkout","n":1},"customer":{"external_id":"org-from-customer"}}}`))
	if err != nil {
		t.Fatal(err)
	}
	if event.OrgID != "org-from-checkout" || !event.CancelAtPeriodEnd || event.CurrentPeriodEnd == nil ||
		event.UpdatedAt.Format(time.RFC3339) != "2026-11-22T10:00:00Z" {
		t.Fatalf("event = %+v", event)
	}

	event, err = ParseSubscriptionEvent([]byte(`{"type":"subscription.created","data":{"id":"sub","status":"active",
		"created_at":"2026-11-22T09:00:00Z","modified_at":null,"metadata":{},"customer":{"external_id":"org-from-customer"}}}`))
	if err != nil || event.OrgID != "org-from-customer" || event.UpdatedAt.Format(time.RFC3339) != "2026-11-22T09:00:00Z" {
		t.Fatalf("fallbacks = %+v, %v", event, err)
	}

	if event, err := ParseSubscriptionEvent([]byte(`{"type":"order.paid","data":{"anything":1}}`)); err != nil || event != nil {
		t.Fatalf("other events are ignored, got %+v %v", event, err)
	}
	for _, bad := range []string{`nope`, `{}`, `{"type":"subscription.active","data":{}}`} {
		if _, err := ParseSubscriptionEvent([]byte(bad)); !errors.Is(err, ErrInvalidEvent) {
			t.Fatalf("%s: err=%v", bad, err)
		}
	}
}
