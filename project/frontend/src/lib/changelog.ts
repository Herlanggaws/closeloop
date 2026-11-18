export type ChangelogEntry = {
  date: string;
  title: string;
  body: string;
};

export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    date: "2026-11-18",
    title: "GitHub App, Auto PR, Issues, public board, and pen-aligned UI",
    body: "Connect the Saidloop GitHub App from Integrations, pick a repo, run Auto PR, or create a GitHub Issue from a ticket (Issues deep-link on the ticket). Credits show in the sidebar and Billing; agents open PRs only and never merge. Public `/board/[slug]` now shows idea descriptions with search and Top/Trending/New sorting, plus votes/comments and moderated Suggest an idea. Ticket Linked panel matches the pen (Sentry, session, Auto PR Run, GitHub Issue). Project settings add Widget and Public board domain Studio stubs; same day also shipped voter release email, Webhooks, Slack/Sentry/PostHog, and masking/notify polish.",
  },
  {
    date: "2026-11-17",
    title: "Brand logo, favicon, landing SEO, and docs",
    body: "Saidloop logo and favicon now match Brand Guidelines — open-loop mark plus Geist wordmark in the UI, with refreshed PNG kit and app icons. Same day: Open Graph/Twitter metadata, robots and sitemap, FAQ structured data, docs for the web widget and mobile SDKs, plus About, Contact, Privacy, Terms, and DPA. MCP examples use saidloop tool names and mcp.saidloop.com.",
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
