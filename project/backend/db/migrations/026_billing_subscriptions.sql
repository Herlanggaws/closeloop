-- +goose Up
-- M5 billing (D-10). One row per subscription at the billing provider; an org can
-- collect several over time. organizations.plan stays the source for entitlements.
CREATE TABLE IF NOT EXISTS billing_subscriptions (
  subscription_id TEXT PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('', 'indie', 'studio')),
  billing_interval TEXT NOT NULL CHECK (billing_interval IN ('', 'month', 'year')),
  status TEXT NOT NULL,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  current_period_end TIMESTAMPTZ,
  -- The provider's modified time, so a late retry cannot overwrite newer state.
  source_updated_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS billing_subscriptions_org_idx ON billing_subscriptions(org_id);

CREATE TABLE IF NOT EXISTS billing_webhook_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- +goose Down
DROP TABLE IF EXISTS billing_webhook_events;
DROP TABLE IF EXISTS billing_subscriptions;
