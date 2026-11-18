export type ChangelogEntry = {
  date: string;
  title: string;
  body: string;
};

export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    date: "2026-11-18",
    title: "Public board publish + Slack webhooks",
    body: "Publish tickets to a public `/board/[slug]` ideas list, idea detail, and roadmap — visitors can vote and comment with email confirmation (one-level replies), builders can hide comments, see live vote counts, and drag public ideas across roadmap columns on `/app/board`, and confirmed voters get a release email when the idea is marked fixed (togglable in project settings). Mark fixed Email / In-app toggles now control notify channels, and project settings split email vs in-app banner kill switches. “Mask all text inputs” is live — passwords and card fields always blur; other text fields follow the project toggle. Integrations shows the full catalog; Configure opens a modal for Slack, Sentry, and PostHog, and Slack event checkboxes (new bug / idea / status / marked fixed) now persist and gate webhook posts. Same day: app sidebar matches the pen (icons, ⌘K search, Auto PR soon stub, usage progress), Slack status notifications, landing yearly pricing and mobile pricing polish, logged-in visits to /login or /signup now skip straight into the app without a hydration mismatch, widget screenshot uploads send bare base64 JSON (DNSCloud WAF blocks raw images and any body containing the literal image/png), the report form paints the auto-screenshot without a Retake, and the inbox refreshes when a dogfood widget report lands.",
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
