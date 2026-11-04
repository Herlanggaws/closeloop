import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Design screens · Closeloop" };

const links = [
  {
    "href": "/app/onboarding",
    "title": "Create project"
  },
  {
    "href": "/app/install",
    "title": "Install widget"
  },
  {
    "href": "/app/mcp",
    "title": "Connect MCP"
  },
  {
    "href": "/app/inbox",
    "title": "Inbox"
  },
  {
    "href": "/app/inbox/empty",
    "title": "Inbox · Empty"
  },
  {
    "href": "/app/inbox/merge",
    "title": "Merge duplicates"
  },
  {
    "href": "/app/tickets/demo",
    "title": "Report detail"
  },
  {
    "href": "/app/tickets/demo/fixed",
    "title": "Mark fixed"
  },
  {
    "href": "/app/auto-pr",
    "title": "Auto PR runs"
  },
  {
    "href": "/app/board",
    "title": "Public board"
  },
  {
    "href": "/app/settings",
    "title": "Project settings"
  },
  {
    "href": "/app/settings/integrations",
    "title": "Integrations"
  },
  {
    "href": "/app/settings/team",
    "title": "Team"
  },
  {
    "href": "/app/settings/billing",
    "title": "Billing"
  },
  {
    "href": "/app/settings/sso",
    "title": "SSO & audit"
  },
  {
    "href": "/app/settings/self-host",
    "title": "Self-host"
  },
  {
    "href": "/preview/widget",
    "title": "Widget launcher"
  },
  {
    "href": "/preview/widget/report",
    "title": "Report form"
  },
  {
    "href": "/preview/widget/sent",
    "title": "Report sent"
  },
  {
    "href": "/preview/widget/fixed",
    "title": "Fixed banner"
  },
  {
    "href": "/preview/widget/mobile",
    "title": "Mobile report"
  },
  {
    "href": "/preview/email/fixed",
    "title": "Email · Fixed"
  },
  {
    "href": "/preview/email/vote",
    "title": "Email · Vote"
  },
  {
    "href": "/board",
    "title": "Ideas"
  },
  {
    "href": "/board/idea",
    "title": "Idea detail"
  },
  {
    "href": "/board/roadmap",
    "title": "Roadmap"
  }
];

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
