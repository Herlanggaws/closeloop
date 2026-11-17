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
  title: "DPA · Saidloop",
  description: "Data Processing Addendum for Saidloop customers.",
};

export default function DpaPage() {
  return (
    <MarketingShell>
      <MarketingPageHeader
        title="Data Processing Addendum"
        description={`Last updated ${LEGAL_LAST_UPDATED}. A simple DPA for builders using Saidloop (${PRODUCT_DOMAIN}) with end-user personal data. Not legal advice.`}
      />
      <MarketingProse>
        <p>
          This Data Processing Addendum (&quot;DPA&quot;) forms part of the{" "}
          <Link href="/terms">Terms of Service</Link> between you (&quot;Customer&quot;,
          controller) and Saidloop (&quot;Processor&quot;) when Saidloop processes personal data on
          your behalf in providing the service. For a countersigned PDF or custom terms, email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>

        <h2>1. Roles</h2>
        <p>
          Customer determines the purposes and means of processing personal data in feedback reports
          and related content. Saidloop processes that data only to provide the Saidloop service as
          described in the Terms and this DPA, and on documented instructions from Customer
          (including configuration in the product).
        </p>

        <h2>2. Details of processing</h2>
        <ul>
          <li>
            <strong>Subject matter</strong> — hosting and processing feedback reports, screenshots /
            UI context, optional reporter identifiers, and project metadata
          </li>
          <li>
            <strong>Duration</strong> — for the term of the agreement and retention periods in the{" "}
            <Link href="/privacy">Privacy Policy</Link> (including ~30 days after project deletion
            from active systems)
          </li>
          <li>
            <strong>Nature and purpose</strong> — store, display, notify, and expose data to agents
            Customer connects (e.g. MCP) so Customer can triage and close feedback
          </li>
          <li>
            <strong>Types of data</strong> — may include names, emails, user ids, device/app
            metadata, message content, and images of product UI
          </li>
          <li>
            <strong>Data subjects</strong> — Customer&apos;s end users and other individuals whose
            data appears in reports
          </li>
        </ul>

        <h2>3. Processor obligations</h2>
        <p>Saidloop will:</p>
        <ul>
          <li>Process personal data only on Customer&apos;s documented instructions</li>
          <li>Ensure persons authorized to process data are bound by confidentiality</li>
          <li>Implement appropriate technical and organizational security measures</li>
          <li>
            Assist Customer, taking into account the nature of processing, with data subject
            requests and DPIA-related information reasonably available to us
          </li>
          <li>
            Notify Customer without undue delay after becoming aware of a personal data breach
            affecting Customer data
          </li>
          <li>
            Delete or return Customer personal data after the end of the service relationship,
            subject to legal retention and backup cycles
          </li>
          <li>
            Make available information reasonably necessary to demonstrate compliance with this DPA
            and allow audits as mutually agreed in writing (remote questionnaires preferred)
          </li>
        </ul>

        <h2>4. Customer obligations</h2>
        <p>
          Customer is responsible for lawful collection of end-user data, notices and consents,
          configuring client-side masking, and not instructing Saidloop to process data unlawfully.
          Customer must not submit special-category data unless the parties agree in writing.
        </p>

        <h2>5. Subprocessors</h2>
        <p>
          Customer authorizes Saidloop to use subprocessors for infrastructure, email, storage, and
          similar functions. Saidloop remains responsible for subprocessors and will impose data
          protection terms no less protective than this DPA. A current list is available on request
          at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Material changes will be
          communicated with a reasonable objection window where required by law.
        </p>

        <h2>6. International transfers</h2>
        <p>
          Where Saidloop transfers personal data from the EEA/UK/Switzerland to a country without an
          adequacy decision, Saidloop will use appropriate safeguards (such as Standard Contractual
          Clauses) or another lawful transfer mechanism.
        </p>

        <h2>7. Liability</h2>
        <p>
          Liability under this DPA is subject to the limitations in the Terms, except where
          prohibited by applicable data protection law.
        </p>

        <h2>8. Order of precedence</h2>
        <p>
          If this DPA conflicts with the Terms regarding data protection, this DPA controls. By
          using Saidloop to process personal data of end users, Customer agrees to this DPA.
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
