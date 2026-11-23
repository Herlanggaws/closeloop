export type ChangelogEntry = {
  date: string;
  title: string;
  body: string;
};

export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    date: "2026-11-23",
    title: "Moving back to Free pauses Slack and the public board",
    body: "If a workspace drops below Indie, Slack posts pause and the public board goes private. Your Slack connection, ideas, votes and comments are kept, and everything comes back as soon as you upgrade again.",
  },
  {
    date: "2026-11-23",
    title: "No Saidloop branding on paid plans",
    body: "On Indie and up the Report button no longer flips to \"Feedback by Saidloop\" on hover, and your public board no longer shows the \"Powered by Saidloop\" footer. Free keeps both, alongside the badge in the form and emails.",
  },
  {
    date: "2026-11-23",
    title: "Auto PR marked as coming soon",
    body: "Auto PR is not part of Indie or Studio yet. The agent that writes the fix is still being built, so the landing page, Billing and the ticket page now show it as coming soon and you can no longer start a run. Nothing changes for the MCP loop or GitHub issues.",
  },
  {
    date: "2026-11-22",
    title: "Indie with 2 seats, monthly or yearly billing",
    body: "Indie is $15 a month or $150 a year and now has room for you and one teammate; Studio stays $39 a month or $390 a year with 5 seats. Workspace owners can pick monthly or yearly in Billing and pay on a secure checkout. The plan switches on once payment is confirmed, and canceling keeps it until the end of the paid period, with the end date shown in Billing.",
  },
  {
    date: "2026-11-22",
    title: "Landing page fills wide screens",
    body: "On wide monitors the landing page no longer sits in a boxed column: the banner, navigation, sections and footer now span the full width while the content stays centred. The hero Join the waitlist button is no longer greyed out before you type an email.",
  },
  {
    date: "2026-11-20",
    title: "Add to Slack",
    body: "Connect Slack by picking a workspace and channel in Slack itself instead of pasting a webhook URL. Saidloop shows which channel it posts to, and changing the channel keeps your event choices. Pasting an Incoming Webhook URL still works.",
  },
  {
    date: "2026-11-20",
    title: "Connect GitHub once, add as many repos as your plan allows",
    body: "Connecting the GitHub App no longer asks you to pick a single repo. If the install covers one repo it is added for you; otherwise Add repository opens so you can choose each repo and which platform it serves. GitHub issues for tickets with no repo yet go to your fallback repo.",
  },
  {
    date: "2026-11-20",
    title: "Android, iOS, Flutter and React Native SDKs",
    body: "Native report sheets for Android and iOS, plus a Flutter package that wraps them: users shake the phone or you call Saidloop.show(), the current screen is attached with sensitive views hidden, and reports made offline are sent as soon as the connection returns.",
  },
  {
    date: "2026-11-20",
    title: "Customize the Report button",
    body: "Project settings now let you rename the Report button and move it to the bottom left, or hide it and open the form with Saidloop.show(). On Studio you can also pick the button's accent colour.",
  },
  {
    date: "2026-11-19",
    title: "Several repos per project, routed by platform",
    body: "Connect your web, Android, iOS and backend repos to one project and reports go to the right one automatically, with a fallback for the rest. Filter the inbox by repo, move a ticket to another repo, and tell your agent which repo it is in so it only sees its own reports. Marking a ticket fixed now warns you when some reporters are on a platform that repo does not cover, and auto PR runs in the ticket's repo, with a refund when the fix belongs elsewhere.",
  },
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
