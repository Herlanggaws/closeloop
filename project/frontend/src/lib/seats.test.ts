import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { memberSummary, seatLimitBanner, seatSubtitle, seatsAtCap } from "./seats.ts";

describe("seats (D-21)", () => {
  it("uses the singular for one seat", () => {
    assert.equal(seatSubtitle("free", { used: 1, limit: 1 }), "Free plan · 1 of 1 seat used");
    assert.equal(seatSubtitle("indie", { used: 1, limit: 2 }), "Indie plan · 1 of 2 seats used");
    assert.equal(seatSubtitle("studio", { used: 2, limit: 5 }), "Studio plan · 2 of 5 seats used");
  });

  it("Indie fits one teammate next to the owner", () => {
    assert.ok(!seatsAtCap({ used: 1, limit: 2 }));
    assert.ok(seatsAtCap({ used: 2, limit: 2 }));
  });

  it("explains a refused invite", () => {
    const b = seatLimitBanner("indie", { used: 2, limit: 2 }, "Rina");
    assert.equal(b.title, "Invite not sent. Indie includes 2 seats.");
    assert.equal(
      b.body,
      "Existing members like Rina keep their access. New invites need Studio, which has 5 seats.",
    );
    assert.equal(b.cta, "Upgrade to Studio");
  });

  it("points Free at Indie for a second seat", () => {
    const b = seatLimitBanner("free", { used: 1, limit: 1 });
    assert.equal(b.body, "New invites need Indie (2 seats) or Studio (5 seats).");
    assert.equal(b.cta, "Upgrade to Indie");
  });

  it("flags orgs over the limit without removing anyone", () => {
    assert.equal(memberSummary("indie", 3, 0, { used: 3, limit: 2 }), "3 active · over the Indie seat limit");
    assert.equal(memberSummary("studio", 2, 1, { used: 3, limit: 5 }), "2 active · 1 pending");
  });
});
