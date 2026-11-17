import type { Metadata } from "next";
import { MarketingShell } from "@/components/MarketingShell";
import { MarketingPageHeader } from "@/components/MarketingProse";
import { CHANGELOG_ENTRIES } from "@/lib/changelog";

export const metadata: Metadata = {
  title: "Changelog",
  description:
    "Product updates for Saidloop — landing, docs, widget, MCP, and reporter notify as they ship. Newest first.",
  alternates: { canonical: "/changelog" },
};

export default function ChangelogPage() {
  return (
    <MarketingShell>
      <MarketingPageHeader
        title="Changelog"
        description="Product updates as Saidloop ships. Newest first."
      />
      <ol className="m-0 flex list-none flex-col gap-8 p-0">
        {CHANGELOG_ENTRIES.map((entry) => (
          <li
            key={`${entry.date}-${entry.title}`}
            className="border-t border-[var(--border-subtle)] pt-8 first:border-t-0 first:pt-0"
          >
            <time
              dateTime={entry.date}
              className="font-ds-ui text-[13px] font-medium text-[var(--text-tertiary)]"
            >
              {formatDate(entry.date)}
            </time>
            <h2 className="font-ds-sans mt-2 mb-2 text-[20px] font-semibold tracking-[-0.3px] text-[var(--text-primary)]">
              {entry.title}
            </h2>
            <p className="font-ds-ui m-0 text-[15px] leading-relaxed text-[var(--text-secondary)]">
              {entry.body}
            </p>
          </li>
        ))}
      </ol>
    </MarketingShell>
  );
}

function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
