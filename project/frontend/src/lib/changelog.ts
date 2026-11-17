export type ChangelogEntry = {
  date: string;
  title: string;
  body: string;
};

export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    date: "2026-11-17",
    title: "Early access: web widget, inbox, and MCP",
    body: "Builders on the waitlist can install the web widget, triage reports in the inbox, and connect Cursor or Claude Code via the MCP server so agents can read feedback and mark tickets fixed.",
  },
  {
    date: "2026-11-10",
    title: "Landing and waitlist live",
    body: "Saidloop public site is up with how it works, platforms, pricing, and a waitlist. The first 50 builders get Indie free for three months.",
  },
  {
    date: "2026-11-01",
    title: "Saidloop begins",
    body: "Started building feedback your AI agent can close — report in, agent fixes, reporter gets told it's done.",
  },
];
