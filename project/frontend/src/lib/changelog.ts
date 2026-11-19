export type ChangelogEntry = {
  date: string;
  title: string;
  body: string;
};

export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    date: "2026-11-19",
    title: "“Powered by Saidloop” only on Free",
    body: "The widget and the emails your reporters and voters get now show “Powered by Saidloop” only on the Free plan. On Indie and above it is gone everywhere, and it disappears within a minute of upgrading.",
  },
  {
    date: "2026-11-19",
    title: "Indie includes 1 seat",
    body: "Indie is now a solo plan with 1 seat; team seats come with Studio (5 seats). Members who already joined an Indie workspace keep their access, and the Team page explains why a new invite was not sent.",
  },
  {
    date: "2026-11-19",
    title: "Every plan gets the full MCP loop, plus clearer plan limits",
    body: "Free now includes every MCP tool, mark_fixed too; existing Free tokens were upgraded to read and write automatically. Slack and GitHub Issues come with Indie, Linear and Jira with Studio, and publishing ideas to the public board needs Indie. Connections you already had keep working. Pricing and Billing list each plan's limits, the report page shows every reporter with their platform, and quota-locked tickets now tell your agent when they unlock.",
  },
  {
    date: "2026-11-18",
    title: "Install page matches the three-step widget guide",
    body: "The app Install widget screen now follows the S-04 layout: numbered Add / Identify / Mask steps with copyable snippets on the left, and first-report status plus public key on the right—still inside the app sidebar.",
  },
  {
    date: "2026-11-18",
    title: "Coach-mark tours, session replay, and integrations",
    body: "First-visit coach marks guide Inbox, Install, MCP, Project settings, Notify, and onboarding. Tours also register for board, Auto PR, integrations, SSO, and self-host when those pages are reachable. Same day: session replay playback, audit log CSV export, Linear/Jira connect, GitHub App, and public board polish. Fixed GitHub App Save repository staying disabled after connect when installation_id came back as a number.",
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
