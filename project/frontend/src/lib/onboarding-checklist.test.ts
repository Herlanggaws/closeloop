import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { onboardingChecklist, type ChecklistState } from "./onboarding-checklist.ts";

const base: ChecklistState = {
  plan: "free",
  projectName: "Bear Budget Web",
  widgetReporting: true,
  agentClient: "Claude Code",
  agentConnected: true,
  teammates: 1,
  slackConnected: false,
  reposConnected: 0,
};

describe("S-06 empty inbox checklist (D-02)", () => {
  it("keeps the five steps in design order", () => {
    const ids = onboardingChecklist(base).map((i) => i.id);
    assert.deepEqual(ids, ["widget", "agent", "invite", "slack", "repos"]);
  });

  it("shows done copy for the widget and agent", () => {
    const [widget, agent] = onboardingChecklist(base);
    assert.equal(widget.subtitle, "Bear Budget Web is reporting");
    assert.equal(agent.subtitle, "Claude Code is connected");
    assert.ok(widget.done && agent.done);
  });

  it("Free upsells Indie seats and Slack", () => {
    const items = onboardingChecklist(base);
    const invite = items.find((i) => i.id === "invite")!;
    const slack = items.find((i) => i.id === "slack")!;
    assert.equal(invite.subtitle, "Team seats start with Indie (2 seats)");
    assert.equal(invite.action?.label, "Upgrade to Indie");
    assert.equal(slack.subtitle, "Slack comes with Indie");
    assert.equal(slack.action?.label, "Upgrade to Indie");
  });

  it("Indie connects Slack and invites a second seat", () => {
    const items = onboardingChecklist({ ...base, plan: "indie" });
    assert.equal(items.find((i) => i.id === "slack")!.action?.label, "Connect");
    assert.equal(items.find((i) => i.id === "invite")!.action?.label, "Invite");
  });

  it("Indie marks the invite step done with a teammate", () => {
    const items = onboardingChecklist({ ...base, plan: "indie", teammates: 2 });
    assert.ok(items.find((i) => i.id === "invite")!.done);
  });

  it("Studio invites", () => {
    const items = onboardingChecklist({ ...base, plan: "studio" });
    assert.equal(items.find((i) => i.id === "invite")!.action?.label, "Invite");
  });

  it("never mentions the old mark_fixed upsell", () => {
    for (const plan of ["free", "indie", "studio"]) {
      const text = JSON.stringify(onboardingChecklist({ ...base, plan }));
      assert.ok(!text.includes("mark_fixed"), plan);
    }
  });

  it("repos step links to integrations", () => {
    const repos = onboardingChecklist(base).find((i) => i.id === "repos")!;
    assert.equal(repos.subtitle, "Route iOS, Android and web reports to the right repo");
    assert.equal(repos.action?.href, "/app/settings/integrations");
  });
});

describe("reporters summary (D-03)", () => {
  it("lists Web before iOS like the S-07 frame", async () => {
    const { reportersSummary } = await import("./tickets.ts");
    assert.equal(
      reportersSummary([], { ios: 1, web: 2 }),
      "3 · Web 2, iOS 1",
    );
  });
});
