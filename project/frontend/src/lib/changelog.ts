export type ChangelogEntry = {
  date: string;
  title: string;
  body: string;
};

export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    date: "2026-11-18",
    title: "Public board publish + Slack webhooks",
    body: "Publish tickets to a public `/board/[slug]` ideas list, idea detail, and roadmap — visitors can vote and comment with email confirmation (one-level replies), builders can hide comments, and confirmed voters get a release email when the idea is marked fixed. Integrations shows the full catalog; Configure opens a modal for Slack, Sentry, and PostHog. Same day: Slack status notifications, landing yearly pricing and mobile pricing polish, logged-in visits to /login or /signup now skip straight into the app, and widget screenshot uploads use JSON base64 so they clear the DNSCloud WAF (raw image/png PUT was 403).",
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
