package application

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"
)

// M5 billing (D-10): subscription state from webhooks decides organizations.plan.

// ErrUnknownProduct means a live subscription uses a product that is not configured.
// The delivery fails so the provider retries after the config is fixed.
var ErrUnknownProduct = errors.New("subscription product is not mapped to a plan")

const (
	subscriptionActive     = "active"
	subscriptionTrialing   = "trialing"
	subscriptionPastDue    = "past_due"
	subscriptionCanceled   = "canceled"
	subscriptionIncomplete = "incomplete"
	// subscriptionRevoked is ours: access ended while the provider still reports a live status.
	subscriptionRevoked = "revoked"

	// entitledSQL must match subscriptionEntitled.
	entitledSQL = `status IN ('active', 'trialing', 'past_due')`
)

// subscriptionEntitled: past_due keeps access while the failed payment is retried.
// A cancel at period end stays active until the provider revokes it.
func subscriptionEntitled(status string) bool {
	switch status {
	case subscriptionActive, subscriptionTrialing, subscriptionPastDue:
		return true
	default:
		return false
	}
}

// SubscriptionUpdate is one verified webhook delivery. Plan and Interval are empty
// when the product is not configured.
type SubscriptionUpdate struct {
	EventID           string
	EventType         string
	Revoked           bool
	SubscriptionID    string
	OrgID             string
	CustomerID        string
	ProductID         string
	Plan              string
	Interval          string
	Status            string
	CancelAtPeriodEnd bool
	CurrentPeriodEnd  *time.Time
	UpdatedAt         time.Time
}

type storedSubscription struct {
	ProductID string
	Plan      string
	Interval  string
	Status    string
	UpdatedAt time.Time
}

// nextSubscription decides what to store for an update; ok=false means ignore it.
func nextSubscription(prev *storedSubscription, u SubscriptionUpdate) (next storedSubscription, ok bool, err error) {
	// Postgres keeps microseconds; compare at the same precision.
	at := u.UpdatedAt.UTC().Truncate(time.Microsecond)
	status := u.Status
	if u.Revoked && status != subscriptionCanceled {
		status = subscriptionRevoked
	}
	wasEntitled := prev != nil && subscriptionEntitled(prev.Status)

	if prev != nil {
		// canceled is final for a subscription; buying again creates a new one.
		if prev.Status == subscriptionCanceled || at.Before(prev.UpdatedAt) {
			return next, false, nil
		}
		// revoked and updated share a timestamp, so only a newer change restores access.
		if !wasEntitled && subscriptionEntitled(status) && !at.After(prev.UpdatedAt) {
			return next, false, nil
		}
	}
	// Neither an unpaid first payment nor a failed renewal may switch a plan on.
	if status == subscriptionIncomplete || (status == subscriptionPastDue && !wasEntitled) {
		return next, false, nil
	}

	next = storedSubscription{ProductID: u.ProductID, Plan: u.Plan, Interval: u.Interval, Status: status, UpdatedAt: at}
	if next.Plan == "" && prev != nil && prev.ProductID == u.ProductID {
		next.Plan, next.Interval = prev.Plan, prev.Interval
	}
	if next.Plan == "" && subscriptionEntitled(status) {
		return next, false, ErrUnknownProduct
	}
	return next, true, nil
}

// SubscriptionResult says what a delivery changed.
type SubscriptionResult struct {
	OrgID        string
	Applied      bool
	PreviousPlan string
	Plan         string
}

// ApplySubscriptionUpdate is idempotent by event ID. The event ID is saved in the same
// transaction as the change, so a failed delivery can be retried.
func (s *Store) ApplySubscriptionUpdate(ctx context.Context, u SubscriptionUpdate) (SubscriptionResult, error) {
	var result SubscriptionResult
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return result, err
	}
	defer func() { _ = tx.Rollback() }() // no-op once committed

	res, err := tx.ExecContext(ctx, `
		INSERT INTO billing_webhook_events(id, event_type) VALUES ($1,$2)
		ON CONFLICT (id) DO NOTHING`, u.EventID, u.EventType)
	if err != nil {
		return result, err
	}
	if n, err := res.RowsAffected(); err != nil || n == 0 {
		return result, err
	}

	// A subscription never moves to another org, whatever later metadata says.
	orgID := u.OrgID
	var known string
	err = tx.QueryRowContext(ctx, `
		SELECT org_id FROM billing_subscriptions WHERE subscription_id=$1`, u.SubscriptionID).Scan(&known)
	switch {
	case err == nil:
		orgID = known
	case !errors.Is(err, sql.ErrNoRows):
		return result, err
	}
	if _, err := uuid.Parse(orgID); err != nil {
		return result, tx.Commit() // not from our checkout
	}

	// The org row lock serializes deliveries for the same workspace.
	var orgPlan string
	var credits int
	err = tx.QueryRowContext(ctx, `
		SELECT plan, auto_pr_credits FROM organizations WHERE id=$1 FOR UPDATE`, orgID).Scan(&orgPlan, &credits)
	if errors.Is(err, sql.ErrNoRows) {
		return result, tx.Commit()
	}
	if err != nil {
		return result, err
	}

	var prev *storedSubscription
	var row storedSubscription
	err = tx.QueryRowContext(ctx, `
		SELECT product_id, plan, billing_interval, status, source_updated_at
		FROM billing_subscriptions WHERE subscription_id=$1`, u.SubscriptionID).
		Scan(&row.ProductID, &row.Plan, &row.Interval, &row.Status, &row.UpdatedAt)
	switch {
	case err == nil:
		prev = &row
	case !errors.Is(err, sql.ErrNoRows):
		return result, err
	}

	result.OrgID = orgID
	result.PreviousPlan, result.Plan = orgPlan, orgPlan

	next, ok, err := nextSubscription(prev, u)
	if err != nil {
		return result, err
	}
	if !ok {
		return result, tx.Commit()
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO billing_subscriptions(
			subscription_id, org_id, customer_id, product_id, plan, billing_interval,
			status, cancel_at_period_end, current_period_end, source_updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		ON CONFLICT (subscription_id) DO UPDATE SET
			customer_id=EXCLUDED.customer_id,
			product_id=EXCLUDED.product_id,
			plan=EXCLUDED.plan,
			billing_interval=EXCLUDED.billing_interval,
			status=EXCLUDED.status,
			cancel_at_period_end=EXCLUDED.cancel_at_period_end,
			current_period_end=EXCLUDED.current_period_end,
			source_updated_at=EXCLUDED.source_updated_at,
			updated_at=now()`,
		u.SubscriptionID, orgID, u.CustomerID, next.ProductID, next.Plan, next.Interval,
		next.Status, u.CancelAtPeriodEnd, u.CurrentPeriodEnd, next.UpdatedAt); err != nil {
		return result, err
	}
	result.Applied = true

	plan, _, err := liveSubscription(ctx, tx, orgID)
	if err != nil {
		return result, err
	}
	if plan == "" {
		// Only the end of a subscription that granted access downgrades. An abandoned
		// first payment must not take away a plan that was switched on by hand.
		ended := (prev != nil && subscriptionEntitled(prev.Status)) || (prev == nil && u.Revoked)
		if ended {
			plan = "free"
		} else {
			plan = orgPlan
		}
	}
	// Business is set by hand (D-22); billing never changes it.
	if plan != orgPlan && orgPlan != "business" {
		if err := setOrgPlan(ctx, tx, orgID, plan, orgPlan, credits); err != nil {
			return result, err
		}
		result.Plan = plan
	}
	return result, tx.Commit()
}

type rowQuerier interface {
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

// liveSubscription returns the best plan an org is paying for, or "" when it is not subscribed.
func liveSubscription(ctx context.Context, q rowQuerier, orgID string) (plan, interval string, err error) {
	err = q.QueryRowContext(ctx, `
		SELECT plan, billing_interval FROM billing_subscriptions
		WHERE org_id=$1 AND `+entitledSQL+`
		ORDER BY plan='studio' DESC, source_updated_at DESC
		LIMIT 1`, orgID).Scan(&plan, &interval)
	if errors.Is(err, sql.ErrNoRows) {
		return "", "", nil
	}
	return plan, interval, err
}

// OrgSubscribed reports whether an org has a live subscription.
func (s *Store) OrgSubscribed(ctx context.Context, orgID string) (bool, error) {
	plan, _, err := liveSubscription(ctx, s.DB, orgID)
	return plan != "", err
}
