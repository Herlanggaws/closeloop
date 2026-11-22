package polar

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const (
	signatureTolerance = 5 * time.Minute
	secretPrefix       = "whsec_"
)

var (
	ErrInvalidSignature = errors.New("invalid webhook signature")
	ErrStaleTimestamp   = errors.New("webhook timestamp outside tolerance")
	ErrInvalidEvent     = errors.New("invalid webhook event")
)

// signingKeys returns the keys a secret may sign with. Which one applies depends on
// when the secret was generated, which we cannot see, so both are accepted:
//   - before 2026-09-08, or a secret typed in by hand: the bytes of the whole string
//   - since 2026-09-08 (Standard Webhooks): the base64 value after "whsec_"
//
// Both come from the same secret, so accepting both does not widen who can sign.
func signingKeys(secret string) [][]byte {
	if secret == "" {
		return nil
	}
	keys := [][]byte{[]byte(secret)}
	if encoded, ok := strings.CutPrefix(secret, secretPrefix); ok {
		key, err := base64.RawStdEncoding.DecodeString(strings.TrimRight(encoded, "="))
		// An empty key would let anyone sign.
		if err == nil && len(key) > 0 {
			keys = append(keys, key)
		}
	}
	return keys
}

func sign(key []byte, id, timestamp string, body []byte) []byte {
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(id + "." + timestamp + "."))
	mac.Write(body)
	return mac.Sum(nil)
}

// VerifyWebhook checks a Standard Webhooks delivery over the raw body and returns its ID.
func VerifyWebhook(secret string, headers http.Header, body []byte, now time.Time) (string, error) {
	id := headers.Get("webhook-id")
	timestamp := headers.Get("webhook-timestamp")
	signatures := strings.Fields(headers.Get("webhook-signature"))
	if id == "" || len(signatures) == 0 {
		return "", ErrInvalidSignature
	}
	sentAt, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil {
		return "", ErrInvalidSignature
	}
	// Compared in seconds: time.Duration overflows on absurd timestamps.
	tolerance := int64(signatureTolerance / time.Second)
	if sentAt < now.Unix()-tolerance || sentAt > now.Unix()+tolerance {
		return "", ErrStaleTimestamp
	}
	for _, key := range signingKeys(secret) {
		want := sign(key, id, timestamp, body)
		for _, signature := range signatures {
			version, value, ok := strings.Cut(signature, ",")
			if !ok || version != "v1" {
				continue
			}
			got, err := base64.StdEncoding.DecodeString(value)
			if err == nil && hmac.Equal(got, want) {
				return id, nil
			}
		}
	}
	return "", ErrInvalidSignature
}

// SubscriptionEvent is the part of a subscription.* delivery that decides a plan.
type SubscriptionEvent struct {
	Type              string
	SubscriptionID    string
	CustomerID        string
	ProductID         string
	OrgID             string // empty when the subscription did not come from our checkout
	Status            string
	CancelAtPeriodEnd bool
	CurrentPeriodEnd  *time.Time
	UpdatedAt         time.Time
}

var subscriptionEvents = map[string]bool{
	"subscription.created":    true,
	"subscription.active":     true,
	"subscription.updated":    true,
	"subscription.uncanceled": true,
	"subscription.canceled":   true,
	"subscription.revoked":    true,
}

// ParseSubscriptionEvent returns nil for event types we do not act on.
func ParseSubscriptionEvent(body []byte) (*SubscriptionEvent, error) {
	var envelope struct {
		Type      string          `json:"type"`
		Timestamp *time.Time      `json:"timestamp"`
		Data      json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(body, &envelope); err != nil || envelope.Type == "" {
		return nil, ErrInvalidEvent
	}
	if !subscriptionEvents[envelope.Type] {
		return nil, nil
	}
	var sub struct {
		ID                string         `json:"id"`
		CustomerID        string         `json:"customer_id"`
		ProductID         string         `json:"product_id"`
		Status            string         `json:"status"`
		CancelAtPeriodEnd bool           `json:"cancel_at_period_end"`
		CurrentPeriodEnd  *time.Time     `json:"current_period_end"`
		CreatedAt         *time.Time     `json:"created_at"`
		ModifiedAt        *time.Time     `json:"modified_at"`
		Metadata          map[string]any `json:"metadata"`
		Customer          struct {
			ExternalID string `json:"external_id"`
		} `json:"customer"`
	}
	if err := json.Unmarshal(envelope.Data, &sub); err != nil || sub.ID == "" || sub.Status == "" {
		return nil, ErrInvalidEvent
	}
	event := &SubscriptionEvent{
		Type:              envelope.Type,
		SubscriptionID:    sub.ID,
		CustomerID:        sub.CustomerID,
		ProductID:         sub.ProductID,
		OrgID:             sub.Customer.ExternalID,
		Status:            sub.Status,
		CancelAtPeriodEnd: sub.CancelAtPeriodEnd,
		CurrentPeriodEnd:  sub.CurrentPeriodEnd,
	}
	// Our checkout's metadata wins: one customer (email) can pay for several orgs.
	if org, ok := sub.Metadata[MetadataOrgID].(string); ok && org != "" {
		event.OrgID = org
	}
	// The envelope time is the send time, so it is only the last resort for ordering.
	for _, t := range []*time.Time{sub.ModifiedAt, sub.CreatedAt, envelope.Timestamp} {
		if t != nil {
			event.UpdatedAt = t.UTC()
			return event, nil
		}
	}
	return nil, ErrInvalidEvent
}
