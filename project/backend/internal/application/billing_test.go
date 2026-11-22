package application

import (
	"errors"
	"testing"
	"time"
)

func TestNextSubscription(t *testing.T) {
	t0 := time.Date(2026, 11, 22, 10, 0, 0, 0, time.UTC)
	later := t0.Add(time.Minute)
	earlier := t0.Add(-time.Minute)
	stored := func(status string) *storedSubscription {
		return &storedSubscription{ProductID: "p", Plan: "studio", Interval: "month", Status: status, UpdatedAt: t0}
	}
	update := func(status string, at time.Time) SubscriptionUpdate {
		return SubscriptionUpdate{ProductID: "p", Plan: "studio", Interval: "month", Status: status, UpdatedAt: at}
	}
	revoke := func(status string, at time.Time) SubscriptionUpdate {
		u := update(status, at)
		u.Revoked = true
		return u
	}
	cases := []struct {
		name   string
		prev   *storedSubscription
		update SubscriptionUpdate
		status string // "" = ignored
	}{
		{"new active", nil, update("active", t0), "active"},
		{"new trial", nil, update("trialing", t0), "trialing"},
		{"first payment pending", nil, update("incomplete", t0), ""},
		{"past due never grants", nil, update("past_due", t0), ""},
		{"past due keeps access", stored("active"), update("past_due", later), "past_due"},
		{"past due does not restore", stored("revoked"), update("past_due", later), ""},
		{"revoked ends a past due one", stored("past_due"), revoke("past_due", later), "revoked"},
		{"revoked ends an active one", stored("active"), revoke("active", t0), "revoked"},
		{"revoked canceled stays final", stored("active"), revoke("canceled", later), "canceled"},
		{"same time cannot restore", stored("revoked"), update("active", t0), ""},
		{"newer payment restores", stored("revoked"), update("active", later), "active"},
		{"older retry ignored", stored("active"), revoke("canceled", earlier), ""},
		{"canceled is final", stored("canceled"), update("active", later), ""},
		{"paused ends access", stored("active"), update("paused", later), "paused"},
	}
	for _, tc := range cases {
		next, ok, err := nextSubscription(tc.prev, tc.update)
		if err != nil || ok != (tc.status != "") || next.Status != tc.status {
			t.Errorf("%s: got %+v ok=%v err=%v", tc.name, next, ok, err)
		}
	}
}

func TestNextSubscriptionUnknownProduct(t *testing.T) {
	now := time.Now()
	unknown := SubscriptionUpdate{ProductID: "new", Status: "active", UpdatedAt: now}
	if _, _, err := nextSubscription(nil, unknown); !errors.Is(err, ErrUnknownProduct) {
		t.Fatalf("live unknown product must fail, got %v", err)
	}
	ended := unknown
	ended.Revoked = true
	if _, ok, err := nextSubscription(nil, ended); !ok || err != nil {
		t.Fatalf("revoking needs no product mapping: ok=%v err=%v", ok, err)
	}
	prev := &storedSubscription{ProductID: "new", Plan: "indie", Interval: "year", Status: "active", UpdatedAt: now.Add(-time.Hour)}
	if next, ok, err := nextSubscription(prev, unknown); !ok || err != nil || next.Plan != "indie" || next.Interval != "year" {
		t.Fatalf("renewal keeps its plan after the env changes: %+v %v", next, err)
	}
}
