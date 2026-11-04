#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

/** @type {{ route: string; component: string; title: string; height?: number | "auto"; public?: boolean }[]} */
const routes = [
  { route: "app/onboarding", component: "CreateProject", title: "Create project" },
  { route: "app/install", component: "InstallWidget", title: "Install widget" },
  { route: "app/mcp", component: "ConnectMCP", title: "Connect MCP" },
  { route: "app/inbox", component: "Inbox", title: "Inbox" },
  { route: "app/inbox/empty", component: "InboxEmpty", title: "Inbox · Empty" },
  { route: "app/inbox/merge", component: "MergeDuplicates", title: "Merge duplicates" },
  { route: "app/tickets/[id]", component: "ReportDetail", title: "Report detail" },
  { route: "app/tickets/[id]/fixed", component: "MarkFixed", title: "Mark fixed" },
  { route: "app/auto-pr", component: "AutoPR", title: "Auto PR runs" },
  { route: "app/board", component: "PublicBoard", title: "Public board" },
  { route: "app/settings", component: "ProjectSettings", title: "Project settings", height: "auto" },
  { route: "app/settings/integrations", component: "Integrations", title: "Integrations" },
  { route: "app/settings/team", component: "Team", title: "Team" },
  { route: "app/settings/billing", component: "Billing", title: "Billing" },
  { route: "app/settings/sso", component: "SSO", title: "SSO & audit" },
  { route: "app/settings/self-host", component: "SelfHost", title: "Self-host" },
  { route: "preview/widget", component: "WidgetLauncher", title: "Widget launcher", public: true },
  { route: "preview/widget/report", component: "ReportForm", title: "Report form", public: true },
  { route: "preview/widget/sent", component: "ReportSent", title: "Report sent", public: true },
  { route: "preview/widget/fixed", component: "FixedBanner", title: "Fixed banner", public: true },
  { route: "preview/widget/mobile", component: "MobileReport", title: "Mobile report", public: true },
  { route: "preview/email/fixed", component: "EmailFixed", title: "Email · Fixed", public: true },
  { route: "preview/email/vote", component: "EmailVote", title: "Email · Vote", public: true },
  { route: "board", component: "BoardIdeas", title: "Ideas", public: true },
  { route: "board/idea", component: "BoardDetail", title: "Idea detail", public: true },
  { route: "board/roadmap", component: "BoardRoadmap", title: "Roadmap", public: true },
];

function pageSource({ component, title, height }) {
  const h = height === "auto" ? ' height="auto"' : height ? ` height={${height}}` : "";
  return `import type { Metadata } from "next";
import { DesignFrame } from "@/components/DesignFrame";
import { ${component} } from "@/design-screens/${component}";

export const metadata: Metadata = {
  title: "${title} · Closeloop",
};

export default function Page() {
  return (
    <DesignFrame${h}>
      <${component} />
    </DesignFrame>
  );
}
`;
}

for (const r of routes) {
  const dir = path.join(root, "src/app", r.route);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "page.tsx");
  fs.writeFileSync(file, pageSource(r));
  console.log("wrote", path.relative(root, file));
}

// Index of all design previews
const indexDir = path.join(root, "src/app/preview");
fs.mkdirSync(indexDir, { recursive: true });
fs.writeFileSync(
  path.join(indexDir, "page.tsx"),
  `import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Design screens · Closeloop" };

const links = ${JSON.stringify(
    routes.map((r) => ({ href: "/" + r.route.replace(/\[id\]/g, "demo"), title: r.title })),
    null,
    2,
  )};

export default function PreviewIndex() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-ds-sans text-3xl font-medium tracking-tight">Closeloop design screens</h1>
      <p className="mt-2 font-ds-ui text-sm text-[var(--text-secondary)]">
        Pixel-perfect exports from closeloop.pen. App routes require login.
      </p>
      <ul className="mt-8 divide-y divide-[var(--border-subtle)] border-y border-[var(--border-subtle)]">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="font-ds-ui flex items-center justify-between py-3 text-sm text-[var(--text-primary)] no-underline hover:opacity-70">
              <span>{l.title}</span>
              <span className="font-ds-mono text-xs text-[var(--text-tertiary)]">{l.href}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
`,
);
console.log("wrote preview index");
