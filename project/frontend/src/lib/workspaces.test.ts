import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { switcherSubtitle, type WorkspaceRow } from "./usage.ts";

const ws = (role: string, plan: string): WorkspaceRow => ({
  id: "o1",
  name: "Herlangga's org",
  plan,
  role,
  active: true,
});

describe("switcherSubtitle", () => {
  it("shows your name on your own workspace", () => {
    assert.equal(switcherSubtitle("Budi", "free", ws("owner", "free")), "Budi · Free");
  });

  it("names the inviter's workspace so its plan is not read as yours", () => {
    assert.equal(switcherSubtitle("Budi", "studio", ws("member", "studio")), "Herlangga's org · Studio");
  });

  it("falls back to the plan when nothing else is known", () => {
    assert.equal(switcherSubtitle("", "indie"), "Indie");
  });
});
