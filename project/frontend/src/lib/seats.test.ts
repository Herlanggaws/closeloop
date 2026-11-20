import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { memberSummary, seatLimitBanner, seatSubtitle, seatsAtCap } from "./seats.ts";

describe("seats (D-21)", () => {
  it("uses the singular for one seat", () => {
    assert.equal(seatSubtitle("indie", { used: 1, limit: 1 }), "Indie plan · 1 of 1 seat used");
    assert.equal(seatSubtitle("studio", { used: 2, limit: 5 }), "Studio plan · 2 of 5 seats used");
  });

  it("Indie is full with just the owner", () => {
    assert.ok(seatsAtCap({ used: 1, limit: 1 }));
  });

  it("explains a refused invite", () => {
    const b = seatLimitBanner("indie", { used: 2, limit: 1 }, "Rina");
    assert.equal(b.title, "Invite not sent. Indie includes 1 seat.");
    assert.equal(
      b.body,
      "Existing members like Rina keep their access. New invites need Studio, which has 5 seats.",
    );
    assert.equal(b.cta, "Upgrade to Studio");
  });

  it("flags orgs over the limit without removing anyone", () => {
    assert.equal(memberSummary("indie", 3, 0, { used: 3, limit: 1 }), "3 active · over the Indie seat limit");
    assert.equal(memberSummary("studio", 2, 1, { used: 3, limit: 5 }), "2 active · 1 pending");
  });
});
