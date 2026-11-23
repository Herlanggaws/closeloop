import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/MarketingShell";
import { MarketingPageHeader, MarketingProse } from "@/components/MarketingProse";
import {
  CONTACT_EMAIL,
  LEGAL_LAST_UPDATED,
  PRODUCT_DOMAIN,
} from "@/lib/marketing-links";

export const metadata: Metadata = {
  title: "Terms",
  description: "Terms of Service for Saidloop.",
};

export default function TermsPage() {
  return (
    <MarketingShell>
      <MarketingPageHeader
        title="Terms of Service"
        description={`Last updated ${LEGAL_LAST_UPDATED}. Plain-language terms for using Saidloop on ${PRODUCT_DOMAIN}. Not legal advice.`}
      />
      <MarketingProse>
        <p>
          By accessing or using Saidloop, you agree to these Terms. If you use Saidloop on behalf of
          an organization, you represent that you can bind that organization. Contact:{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>

        <h2>The service</h2>
        <p>
          Saidloop provides tools to collect in-app feedback, triage reports, notify reporters, and
          connect AI agents (for example via MCP). Features and limits depend on your plan. Early
          access and waitlist features may change without notice.
        </p>

        <h2>Accounts</h2>
        <p>
          You must provide accurate account information and keep credentials secure. You are
          responsible for activity under your account and for configuring integrations (widget, SDKs,
          MCP) safely, including masking of sensitive UI.
        </p>

        <h2>Your content</h2>
        <p>
          You retain ownership of reports, screenshots, and other content you or your end users
          submit (&quot;Customer Content&quot;). You grant Saidloop a license to host, process, and
          display Customer Content solely to provide and improve the service. You represent that you
          have the rights and notices required to submit that content, including personal data of
          end users.
        </p>

        <h2>Acceptable use</h2>
        <ul>
          <li>Do not abuse, disrupt, or reverse-engineer the service beyond permitted APIs</li>
          <li>Do not upload unlawful, harmful, or infringing content</li>
          <li>Do not use Saidloop to violate privacy or security laws</li>
          <li>Do not resell the service without our written consent</li>
        </ul>

        <h2>Plans and payment</h2>
        <p>
          Paid plans are billed through our merchant of record unless we agree otherwise.
          Fees are as listed on the pricing page or your order. Taxes may apply. We may change
          prices with notice for the next billing period. Free and early-access offers may be
          withdrawn or modified.
        </p>

        <h2>Self-hosting</h2>
        <p>
          Business self-host options (if offered) are governed by a separate license or order form.
          Cloud Terms still apply to any cloud components you use.
        </p>

        <h2>Third-party services</h2>
        <p>
          Agents, IDEs, payment providers, email providers, and other third parties have their own terms. We are
          not responsible for third-party products. Saidloop does not merge code for you; agents may
          open PRs that you review and ship.
        </p>

        <h2>Privacy</h2>
        <p>
          Our <Link href="/privacy">Privacy Policy</Link> explains how we process personal data.
          Builders processing EU end-user data should review the <Link href="/dpa">DPA</Link>.
        </p>

        <h2>Disclaimer</h2>
        <p>
          THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES
          OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR
          PURPOSE, AND NON-INFRINGEMENT. We do not warrant uninterrupted or error-free operation.
        </p>

        <h2>Limitation of liability</h2>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, SAIDLOOP WILL NOT BE LIABLE FOR INDIRECT,
          INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR LOST PROFITS OR DATA. OUR
          TOTAL LIABILITY FOR CLAIMS ARISING OUT OF THESE TERMS OR THE SERVICE IS LIMITED TO THE
          AMOUNTS YOU PAID US FOR THE SERVICE IN THE TWELVE MONTHS BEFORE THE CLAIM (OR USD $100 IF
          YOU PAID NOTHING).
        </p>

        <h2>Indemnity</h2>
        <p>
          You will defend and indemnify Saidloop against claims arising from your Customer Content,
          your use of the service, or your violation of these Terms or applicable law.
        </p>

        <h2>Suspension and termination</h2>
        <p>
          You may stop using Saidloop at any time. We may suspend or terminate access for breach,
          risk, non-payment, or discontinuation of the service. On termination, your license ends;
          provisions that should survive (liability, indemnity, etc.) remain in effect.
        </p>

        <h2>Governing law</h2>
        <p>
          These Terms are governed by the laws of Indonesia, without regard to conflict-of-law
          rules, unless mandatory consumer law in your country says otherwise. Courts in Indonesia
          have exclusive jurisdiction, subject to those mandatory rights.
        </p>

        <h2>Changes</h2>
        <p>
          We may update these Terms by posting a new version with a revised date. Continued use
          after the effective date constitutes acceptance.
        </p>

        <h2>Contact</h2>
        <p>
          Saidloop · <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> ·{" "}
          <Link href="/contact">Contact</Link>.
        </p>
      </MarketingProse>
    </MarketingShell>
  );
}
