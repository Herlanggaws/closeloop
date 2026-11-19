import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  fixedNotifyPlan,
  platformOwner,
  repoCounter,
  repoServes,
  repositoriesSubtitle,
  shortRepo,
  type ProjectRepo,
} from "./repos.ts";

function repo(id: string, name: string, routes: string[], fallback = false): ProjectRepo {
  return {
    id,
    project_id: "p",
    installation_id: 1,
    account_login: "bear",
    full_name: name,
    default_branch: "main",
    is_fallback: fallback,
    routing_paused: false,
    routes: routes.map((platform) => ({ platform: platform as never, path: "" })),
    created_at: "",
  };
}

const repos = [repo("w", "bear/web", ["web"], true), repo("a", "bear/app", ["android", "ios"])];

describe("repos (D-12…D-18)", () => {
  it("counts repos against the plan", () => {
    assert.equal(repoCounter(3, 5), "3 of 5 repos");
    assert.equal(repoCounter(3, 0), "3 repos");
  });

  it("switches the subtitle at the Free limit", () => {
    assert.equal(
      repositoriesSubtitle("free", 3, 3),
      "Free includes 3 repos per project. Upgrade to Indie for 5.",
    );
    assert.equal(
      repositoriesSubtitle("indie", 3, 5),
      "Reports route to a repo by platform. Platforms with no repo go to the fallback.",
    );
  });

  it("finds which repo already owns a platform", () => {
    assert.equal(platformOwner(repos, "ios")?.full_name, "bear/app");
    assert.equal(platformOwner(repos, "ios", "a"), undefined);
    assert.equal(platformOwner(repos, "backend"), undefined);
  });

  it("fallback serves unrouted platforms", () => {
    const served = repoServes(repos, "w");
    assert.ok(served.has("web") && served.has("backend"));
    assert.ok(!served.has("ios"));
  });

  it("shortens repo names", () => {
    assert.equal(shortRepo("herlangga/bearbudget-app"), "bearbudget-app");
  });

  it("counts who gets told when marking fixed (S-09 v2)", () => {
    const coverage = { covered: { web: 2 }, uncovered: { ios: 1 } };
    assert.deepEqual(fixedNotifyPlan(coverage, false), {
      hasGap: true,
      notified: 2,
      total: 3,
      platforms: ["web"],
    });
    assert.equal(fixedNotifyPlan(coverage, true).notified, 3);
    assert.deepEqual(fixedNotifyPlan(coverage, true).platforms, []);
    assert.equal(fixedNotifyPlan({ covered: { web: 2 }, uncovered: {} }, false).hasGap, false);
  });
});
