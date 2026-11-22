import { planAtLeast } from "@/lib/plans";

// S-06 empty inbox "Get the most out of Saidloop" checklist (D-02, frame c1NiLS).

export type ChecklistState = {
  plan: string;
  projectName: string;
  widgetReporting: boolean;
  /** Name of the MCP client that last connected, e.g. "Claude Code"; empty if none. */
  agentClient: string;
  agentConnected: boolean;
  teammates: number;
  slackConnected: boolean;
  reposConnected: number;
};

export type ChecklistItem = {
  id: "widget" | "agent" | "invite" | "slack" | "repos";
  title: string;
  subtitle: string;
  done: boolean;
  action?: { label: string; href: string };
};

const BILLING = "/app/settings/billing";

export function onboardingChecklist(s: ChecklistState): ChecklistItem[] {
  const indie = planAtLeast(s.plan, "indie");
  return [
    {
      id: "widget",
      title: "Install the widget",
      subtitle: s.widgetReporting
        ? `${s.projectName} is reporting`
        : "Drop the snippet so users can report",
      done: s.widgetReporting,
      action: s.widgetReporting ? undefined : { label: "Install", href: "/app/install" },
    },
    {
      id: "agent",
      title: "Connect your coding agent",
      subtitle: s.agentConnected
        ? `${s.agentClient || "Your agent"} is connected`
        : "MCP token for Cursor or Claude Code",
      done: s.agentConnected,
      action: s.agentConnected ? undefined : { label: "Connect", href: "/app/mcp" },
    },
    {
      id: "invite",
      title: "Invite a teammate",
      subtitle: indie ? "Triage reports together" : "Team seats start with Indie (2 seats)",
      done: indie && s.teammates > 1,
      action: indie
        ? { label: "Invite", href: "/app/settings/team" }
        : { label: "Upgrade to Indie", href: BILLING },
    },
    {
      id: "slack",
      title: "Send new reports to Slack",
      subtitle: indie ? "Get pinged in your team channel" : "Slack comes with Indie",
      done: indie && s.slackConnected,
      action: indie
        ? { label: "Connect", href: "/app/settings/integrations" }
        : { label: "Upgrade to Indie", href: BILLING },
    },
    {
      id: "repos",
      title: "Connect your repos",
      subtitle: "Route iOS, Android and web reports to the right repo",
      done: s.reposConnected > 0,
      action: { label: "Set up", href: "/app/settings/integrations" },
    },
  ];
}
