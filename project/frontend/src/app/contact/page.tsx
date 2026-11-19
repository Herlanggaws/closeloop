import type { Metadata } from "next";
import { MarketingShell } from "@/components/MarketingShell";
import { MarketingPageHeader, MarketingProse } from "@/components/MarketingProse";
import { CONTACT_EMAIL } from "@/lib/marketing-links";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Email Saidloop for sales, Indie early access, privacy questions, or product support.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <MarketingShell>
      <MarketingPageHeader
        title="Contact"
        description="Sales, privacy, support, or anything else — email works best."
      />
      <MarketingProse>
        <p>
          Write to{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We usually reply within a few
          business days.
        </p>
        <ul>
          <li>
            <strong>Sales / plans</strong> — pricing, Indie early access
          </li>
          <li>
            <strong>Privacy / DPA</strong> — data questions or a countersigned DPA
          </li>
          <li>
            <strong>Support</strong> — install, MCP, or account issues
          </li>
        </ul>
      </MarketingProse>
    </MarketingShell>
  );
}
