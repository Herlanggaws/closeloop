import type { ReactNode } from "react";
import Link from "next/link";
import { MarketingShell } from "@/components/MarketingShell";
import { CodeBlock, MarketingPageHeader, MarketingProse } from "@/components/MarketingProse";
import { docsSnippet, PLATFORM_SUBTITLES } from "@/lib/docs-snippets";

type DocsPlatformPageProps = {
  platform: "web" | "android" | "ios" | "flutter" | "react-native";
  title: string;
  description: string;
  extra?: ReactNode;
};

export function DocsPlatformPage({
  platform,
  title,
  description,
  extra,
}: DocsPlatformPageProps) {
  const subtitle = PLATFORM_SUBTITLES[platform];

  return (
    <MarketingShell>
      <MarketingPageHeader title={title} description={description} eyebrow="Docs" />
      <MarketingProse>
        <p>{subtitle}</p>
        <h2>1. Get your public key</h2>
        <p>
          After you join and create a project, open{" "}
          <Link href="/app/install">Install widget</Link> in the app and copy your{" "}
          <strong>public key</strong> (<code>pk_…</code>).
        </p>
        <h2>2. Add the snippet</h2>
        <p>Replace the placeholder key with yours:</p>
        <CodeBlock>{docsSnippet(platform)}</CodeBlock>
        <h2>3. Send a test report</h2>
        <p>
          Open your app, trigger the report UI, and send a short message. It should land in your
          Saidloop inbox within a few seconds.
        </p>
        {extra}
        <p>
          <Link href="/docs">← All docs</Link>
        </p>
      </MarketingProse>
    </MarketingShell>
  );
}
