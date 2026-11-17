import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/MarketingShell";
import { MarketingPageHeader, MarketingProse } from "@/components/MarketingProse";

export const metadata: Metadata = {
  title: "Docs",
  description: "Install the Saidloop web widget and mobile SDKs, then connect your AI agent via MCP.",
};

const DOC_LINKS = [
  {
    href: "/docs/web-widget",
    title: "Web widget",
    body: "One script tag. Reports land with screenshot and context.",
  },
  {
    href: "/docs/android",
    title: "Android SDK",
    body: "Kotlin SDK with shake-to-report or Saidloop.show().",
  },
  {
    href: "/docs/ios",
    title: "iOS SDK",
    body: "Swift Package with shake-to-report or Saidloop.show().",
  },
  {
    href: "/docs/mobile",
    title: "Flutter & React Native",
    body: "Cross-platform packages that wrap the native SDKs.",
  },
] as const;

export default function DocsPage() {
  return (
    <MarketingShell>
      <MarketingPageHeader
        title="Docs"
        description="Install Saidloop in a few minutes, then let your agent close the loop."
      />
      <div className="mb-10 flex flex-col gap-3">
        {DOC_LINKS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface)] p-5 no-underline transition-colors hover:border-[var(--border-strong)]"
          >
            <div className="font-ds-sans text-[16px] font-semibold tracking-[-0.2px] text-[var(--text-primary)]">
              {item.title}
            </div>
            <div className="font-ds-ui mt-1 text-[14px] text-[var(--text-secondary)]">{item.body}</div>
          </Link>
        ))}
      </div>
      <MarketingProse>
        <h2>MCP server</h2>
        <p>
          Once reports are flowing, connect Cursor or Claude Code so your agent can read open
          feedback and mark tickets fixed. See the overview on the{" "}
          <a href="/#mcp">landing page</a>, then connect from{" "}
          <Link href="/app/mcp">MCP server</Link> after signup.
        </p>
      </MarketingProse>
    </MarketingShell>
  );
}
