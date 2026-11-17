import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/MarketingShell";
import { CodeBlock, MarketingPageHeader, MarketingProse } from "@/components/MarketingProse";
import { docsSnippet } from "@/lib/docs-snippets";

export const metadata: Metadata = {
  title: "Flutter & React Native",
  description: "Install Saidloop on Flutter and React Native using the native SDKs under the hood.",
};

export default function MobileDocsPage() {
  return (
    <MarketingShell>
      <MarketingPageHeader
        title="Flutter & React Native"
        description="Cross-platform packages that forward to the native Android and iOS SDKs."
        eyebrow="Docs"
      />
      <MarketingProse>
        <p>
          Both packages wrap the native SDKs. Get your public key from{" "}
          <Link href="/app/install">Install widget</Link>, then pick your stack.
        </p>

        <h2>Flutter</h2>
        <p>Add the Flutter package; it forwards to the native Android and iOS SDKs.</p>
        <CodeBlock>{docsSnippet("flutter")}</CodeBlock>

        <h2>React Native</h2>
        <p>
          Install the npm package; it wraps the native SDKs (Expo config plugin supported). Package
          name is still <code>@closeloop/react-native</code> during early access.
        </p>
        <CodeBlock>{docsSnippet("react-native")}</CodeBlock>

        <h2>Send a test report</h2>
        <p>
          Call <code>Saidloop.show()</code> (or enable shake), send a short message, and confirm it
          appears in your inbox.
        </p>
        <p>
          <Link href="/docs">← All docs</Link>
        </p>
      </MarketingProse>
    </MarketingShell>
  );
}
