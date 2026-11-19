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

  it("Free upsells Studio seats and Indie Slack", () => {
    const items = onboardingChecklist(base);
    const invite = items.find((i) => i.id === "invite")!;
    const slack = items.find((i) => i.id === "slack")!;
    assert.equal(invite.subtitle, "Team seats come with Studio (5 seats)");
    assert.equal(invite.action?.label, "Upgrade to Studio");
    assert.equal(slack.subtitle, "Slack comes with Indie");
    assert.equal(slack.action?.label, "Upgrade to Indie");
  });

  it("Indie connects Slack but still upsells seats", () => {
    const items = onboardingChecklist({ ...base, plan: "indie" });
    assert.equal(items.find((i) => i.id === "slack")!.action?.label, "Connect");
    assert.equal(items.find((i) => i.id === "invite")!.action?.label, "Upgrade to Studio");
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
