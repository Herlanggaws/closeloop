export type ChangelogEntry = {
  date: string;
  title: string;
  body: string;
};

export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    date: "2026-11-17",
    title: "Landing SEO, docs, and Saidloop MCP copy",
    body: "Public site now ships Open Graph/Twitter metadata, robots and sitemap, semantic headings, and FAQ structured data. Also: docs for the web widget and mobile SDKs, plus About, Contact, Privacy, Terms, and DPA — linked from the landing footer. MCP examples use saidloop tool names and mcp.saidloop.com.",
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
