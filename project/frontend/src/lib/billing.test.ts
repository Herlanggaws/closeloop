import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planAction, planActionLabel, planPriceLabel } from "./billing.ts";
import { planInfo } from "./plans.ts";

describe("Billing change plan (M5)", () => {
  it("sends unpaid workspaces to checkout", () => {
    assert.equal(planAction("free", "indie", false), "checkout");
    assert.equal(planAction("indie", "studio", false), "checkout");
    // Switched manually, not paid for yet.
    assert.equal(planAction("indie", "indie", false), "checkout");
  });

  it("sends subscribers to the portal so nobody pays twice", () => {
    assert.equal(planAction("indie", "studio", true), "portal");
    assert.equal(planAction("studio", "free", true), "portal");
    assert.equal(planAction("studio", "studio", true), "none");
  });

  it("only moves to Free without a payment", () => {
    assert.equal(planAction("indie", "free", false), "manual");
    assert.equal(planAction("free", "free", false), "none");
  });

  it("never sells or replaces Business", () => {
    assert.equal(planAction("free", "business", false), "none");
    assert.equal(planAction("business", "indie", false), "none");
  });

  it("labels each action", () => {
    assert.equal(planActionLabel("free", "indie", "checkout"), "Upgrade");
    assert.equal(planActionLabel("indie", "indie", "checkout"), "Subscribe");
    assert.equal(planActionLabel("studio", "free", "portal"), "Cancel subscription");
  });

  it("shows the annual total on Yearly", () => {
    assert.equal(planPriceLabel(planInfo("indie")!, "month"), "$15");
    assert.equal(planPriceLabel(planInfo("indie")!, "year"), "$150 / year");
    assert.equal(planPriceLabel(planInfo("studio")!, "year"), "$390 / year");
    assert.equal(planPriceLabel(planInfo("free")!, "year"), "$0");
  });
});
