"use client";

import { useMemo, useState } from "react";
import { API_URL } from "@/lib/api";
import { buildMobileSdkGuides, type MobileSdkId } from "@/lib/mobile-sdk";

/** Mobile SDK setup on the Integrations page: one tab per platform, three copyable steps each. */
export function MobileSdkSection({ publicKey }: { publicKey: string }) {
  const guides = useMemo(() => buildMobileSdkGuides(publicKey, API_URL), [publicKey]);
  const [activeId, setActiveId] = useState<MobileSdkId>("ios");
  const active = guides.find((g) => g.id === activeId) ?? guides[0];

  return (
    <section data-tour="integrations-mobile" className="flex flex-col gap-3">
      <h2 className="font-ds-ui text-xs font-medium text-[#A3A3A3]">Mobile SDK</h2>
      <div className="flex flex-col gap-5 rounded-xl border border-[#17171714] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" aria-label="Mobile platform" className="flex flex-wrap gap-1.5 rounded-[10px] bg-[#F5F5F5] p-1">
            {guides.map((guide) => {
              const selected = guide.id === active.id;
              return (
                <button
                  key={guide.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActiveId(guide.id)}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 font-ds-ui text-[13px] font-medium transition ${
                    selected
                      ? "bg-white text-[#171717] shadow-[0_1px_2px_#17171714]"
                      : "text-[#737373] hover:text-[#171717]"
                  }`}
                >
                  {guide.label}
                  {!guide.available ? (
                    <span className="rounded-md bg-[#E5E5E5] px-1.5 py-0.5 font-ds-ui text-[10px] font-medium text-[#737373]">
                      Soon
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <a
            href={active.repoUrl}
            target="_blank"
            rel="noreferrer"
            className="font-ds-ui text-[13px] font-medium text-[#171717] underline-offset-2 hover:underline"
          >
            View on GitHub ↗
          </a>
        </div>

        <p className="font-ds-ui text-[12.5px] leading-[18px] text-[#737373]">{active.summary}</p>

        {active.available ? (
          <ol className="flex flex-col gap-5">
            {active.steps.map((step, i) => (
              <li key={step.title} className="flex gap-3">
                <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[#171717] font-ds-mono text-[11px] font-medium text-white">
                  {i + 1}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div>
                    <p className="font-ds-sans text-[14px] font-semibold text-[#171717]">{step.title}</p>
                    <p className="mt-0.5 font-ds-ui text-[12.5px] leading-[18px] text-[#737373]">
                      {step.description}
                    </p>
                  </div>
                  <CodeBlock label={step.fileLabel} code={step.code} />
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="rounded-[10px] border border-[#17171714] bg-[#FAFAFA] p-4">
            <p className="font-ds-ui text-[13px] font-medium text-[#171717]">
              {active.label} SDK is coming soon
            </p>
            <p className="mt-1 font-ds-ui text-[12px] text-[#737373]">
              The package isn&apos;t published yet. Follow the repo on GitHub to know when it lands.
            </p>
          </div>
        )}

        <p className="font-ds-ui text-xs text-[#A3A3A3]">Public key: {publicKey || "…"}</p>
      </div>
    </section>
  );
}

function CodeBlock({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-ds-mono text-[11px] text-[#A3A3A3]">{label}</span>
        <button
          type="button"
          onClick={copy}
          className="cursor-pointer font-ds-ui text-[13px] font-medium text-[#171717] underline-offset-2 hover:underline"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-[#0A0A0A] p-4 text-xs leading-relaxed text-[#86EFAC]">
        {code}
      </pre>
    </div>
  );
}
