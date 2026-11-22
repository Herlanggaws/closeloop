import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BUSINESS_PLAN_VISIBLE,
  PLANS,
  businessSurfacesVisible,
  planAtLeast,
  visiblePlans,
} from "./plans.ts";
import { getTour } from "./tours.ts";

describe("plans (D-05, D-06, D-22)", () => {
  it("prices Indie at $15 or $150 a year, Studio at $39 or $390 a year", () => {
    const prices = Object.fromEntries(PLANS.map((p) => [p.id, [p.price, p.yearlyPrice]]));
    assert.deepEqual(prices.indie, ["$15", "$150"]);
    assert.deepEqual(prices.studio, ["$39", "$390"]);
  });

  it("hides Business until M6", () => {
    assert.equal(BUSINESS_PLAN_VISIBLE, false);
    assert.deepEqual(
      visiblePlans().map((p) => p.id),
      ["free", "indie", "studio"],
    );
  });

  it("keeps Business surfaces for orgs already on Business", () => {
    assert.equal(businessSurfacesVisible("free"), false);
    assert.equal(businessSurfacesVisible("studio"), false);
    assert.equal(businessSurfacesVisible("business"), true);
  });

  it("matches the Billing limit lines from the brief", () => {
    const lines = Object.fromEntries(PLANS.map((p) => [p.id, p.billingLimits]));
    assert.equal(lines.free, "1 project · 50 reports / mo · 3 repos / project · 1 seat");
    assert.equal(lines.indie, "3 projects · 1,000 reports / mo · 5 repos / project · 2 seats");
    assert.equal(lines.studio, "Unlimited projects · 10,000 reports / mo · 10 repos / project · 5 seats");
  });

  it("drops the old read-only MCP copy", () => {
    const text = JSON.stringify(PLANS);
    assert.ok(!text.includes("read-only"));
    assert.ok(!text.includes("MCP read-only tools"));
    assert.ok(!text.includes("All MCP tools, including mark_fixed"));
  });

  it("Studio card never points at Business", () => {
    const studio = PLANS.find((p) => p.id === "studio")!;
    assert.ok(!JSON.stringify(studio).includes("Business"));
  });

  it("orders plans for gating", () => {
    assert.ok(planAtLeast("studio", "indie"));
    assert.ok(!planAtLeast("free", "indie"));
    assert.ok(!planAtLeast("indie", "studio"));
  });

  it("skips the SSO and self-host tours until M6", () => {
    assert.equal(getTour("sso"), undefined);
    assert.equal(getTour("self-host"), undefined);
    assert.ok(getTour("mcp"));
  });
});
