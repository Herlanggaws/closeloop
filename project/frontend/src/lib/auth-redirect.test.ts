import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { safePostAuthPath } from "./auth-redirect.ts";

describe("safePostAuthPath", () => {
  it("defaults to inbox when next is missing", () => {
    assert.equal(safePostAuthPath(null), "/app/inbox");
    assert.equal(safePostAuthPath(undefined), "/app/inbox");
    assert.equal(safePostAuthPath(""), "/app/inbox");
  });

  it("allows relative in-app paths", () => {
    assert.equal(safePostAuthPath("/app/inbox"), "/app/inbox");
    assert.equal(safePostAuthPath("/invite/abc"), "/invite/abc");
    assert.equal(safePostAuthPath("/app/onboarding"), "/app/onboarding");
  });

  it("rejects open redirects", () => {
    assert.equal(safePostAuthPath("//evil.example"), "/app/inbox");
    assert.equal(safePostAuthPath("https://evil.example"), "/app/inbox");
    assert.equal(safePostAuthPath("/\\evil.example"), "/app/inbox");
    assert.equal(safePostAuthPath("evil.example"), "/app/inbox");
  });
});
