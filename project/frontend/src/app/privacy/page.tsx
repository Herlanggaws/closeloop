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
  title: "Privacy · Saidloop",
  description: "How Saidloop collects, uses, and protects personal data.",
};

export default function PrivacyPage() {
  return (
    <MarketingShell>
      <MarketingPageHeader
        title="Privacy Policy"
        description={`Last updated ${LEGAL_LAST_UPDATED}. This is a plain-language draft for Saidloop on ${PRODUCT_DOMAIN}, not legal advice.`}
      />
      <MarketingProse>
        <p>
          Saidloop (&quot;we&quot;, &quot;us&quot;) provides a feedback product so builders can collect
          in-app reports and close them with AI agents. This policy explains what we collect and why.
          Questions:{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>

        <h2>Who we are</h2>
        <p>
          The service is operated by Saidloop. The product website and app are available at{" "}
          {PRODUCT_DOMAIN} and related subdomains.
        </p>

        <h2>Data we process</h2>
        <ul>
          <li>
            <strong>Account data</strong> — email, name, authentication identifiers when you sign up
            or log in (including via SSO or Google when enabled).
          </li>
          <li>
            <strong>Project and billing data</strong> — project settings, plan, and payment status.
            Card payments are handled by our merchant of record (Polar); we do not store full card
            numbers.
          </li>
          <li>
            <strong>Feedback reports</strong> — message text, type, metadata, screenshots or session
            context you configure, and optional reporter email or user id if your app sends them.
          </li>
          <li>
            <strong>Usage and logs</strong> — approximate product usage, security, and diagnostic
            logs needed to run the service.
          </li>
          <li>
            <strong>Waitlist and contact</strong> — email and related fields if you join the waitlist
            or email us.
          </li>
        </ul>

        <h2>Screenshots and masking</h2>
        <p>
          Reports may include screenshots or UI context from your users&apos; sessions. Sensitive
          inputs and elements you mark can be masked on the client before upload. You control what
          your integration captures; configure masking carefully for your product.
        </p>

        <h2>How we use data</h2>
        <ul>
          <li>Provide, secure, and improve the Saidloop service</li>
          <li>Deliver reports to your inbox and notify reporters when tickets are marked fixed</li>
          <li>Expose report context to agents you connect via MCP, under your project credentials</li>
          <li>Communicate about the product, waitlist, and account</li>
          <li>Comply with law and enforce our Terms</li>
        </ul>

        <h2>Legal bases (EEA/UK where applicable)</h2>
        <p>
          We rely on contract (to provide the service), legitimate interests (security, product
          improvement, waitlist operations), and consent where required (e.g. optional marketing).
          If you use Saidloop to process personal data of your end users, you are typically the
          controller and Saidloop acts as processor — see our <Link href="/dpa">DPA</Link>.
        </p>

        <h2>Sharing</h2>
        <p>
          We use subprocessors for hosting, email, analytics (if enabled), and billing (Polar). We
          do not sell personal data. We may disclose information if required by law or to protect
          the service and users.
        </p>

        <h2>Retention</h2>
        <p>
          We keep account and project data while your account is active. After a project is deleted,
          associated report data is removed from active systems within about 30 days, subject to
          backups and legal holds. Waitlist emails are kept until you ask to be removed or we close
          the list.
        </p>

        <h2>Security</h2>
        <p>
          We use industry-standard measures (encryption in transit, access controls, least-privilege
          keys). No method is perfect; report security issues to{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>

        <h2>Your rights</h2>
        <p>
          Depending on where you live, you may request access, correction, deletion, export, or
          restriction of your personal data, and object to certain processing. Contact{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. If you are an end user of a
          builder using Saidloop, contact that builder first — they control the project data.
        </p>

        <h2>International transfers</h2>
        <p>
          We may process data in Indonesia and other countries where our providers operate. Where
          required, we use appropriate safeguards for cross-border transfers.
        </p>

        <h2>Children</h2>
        <p>Saidloop is not directed at children under 16. Do not use the service for underage users.</p>

        <h2>Changes</h2>
        <p>
          We may update this policy. Material changes will be posted here with a new &quot;Last
          updated&quot; date. Continued use after changes means you accept the updated policy.
        </p>

        <h2>Contact</h2>
        <p>
          Saidloop · <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> · also see{" "}
          <Link href="/contact">Contact</Link>.
        </p>
      </MarketingProse>
    </MarketingShell>
  );
}
