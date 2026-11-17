import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/MarketingShell";
import { MarketingPageHeader, MarketingProse } from "@/components/MarketingProse";

export const metadata: Metadata = {
  title: "About · Saidloop",
  description: "Saidloop closes the loop between user feedback and AI agents.",
};

export default function AboutPage() {
  return (
    <MarketingShell>
      <MarketingPageHeader
        title="About Saidloop"
        description="Feedback your AI agent can close."
      />
      <MarketingProse>
        <p>
          Users report a bug. Your agent reads the report, opens a fix, and Saidloop tells the
          reporter it&apos;s done. That&apos;s the loop — and most tools stop at the inbox.
        </p>
        <p>
          Saidloop is built for indie and small teams shipping with Cursor, Claude Code, and similar
          agents. Install a widget or SDK, triage in one place, and let the agent work from real
          context instead of a pasted screenshot in Slack.
        </p>
        <p>
          It&apos;s made by a solo builder in Indonesia. No big company behind the curtain — just a
          focused product for people who want reports to become shipped fixes.
        </p>
        <p>
          Want in? <Link href="/?join=1">Join the waitlist</Link>, or{" "}
          <Link href="/contact">say hello</Link>.
        </p>
      </MarketingProse>
    </MarketingShell>
  );
}
