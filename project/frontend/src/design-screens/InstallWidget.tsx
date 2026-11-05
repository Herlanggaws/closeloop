"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CloseloopLogo } from "@/components/CloseloopLogo";
import { api, logout } from "@/lib/api";
import {
  PLATFORM_LABELS,
  PLATFORM_SUBTITLES,
  buildSnippet,
  normalizePlatforms,
  pickDefaultPlatform,
  readCachedPlatforms,
} from "@/lib/widget-install";

const POLL_MS = 3000;

type ProjectResponse = {
  public_key: string;
  project: { platforms?: string[] };
};

type TicketsResponse = {
  tickets: { id: string }[];
};

export function InstallWidget() {
  const router = useRouter();
  const [publicKey, setPublicKey] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(["web"]);
  const [activePlatform, setActivePlatform] = useState("web");
  const [copied, setCopied] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [firstReportReceived, setFirstReportReceived] = useState(false);
  const [waiting, setWaiting] = useState(true);

  useEffect(() => {
    const cachedKey = localStorage.getItem("closeloop_public_key");
    const cachedPlatforms = readCachedPlatforms();
    if (cachedKey) setPublicKey(cachedKey);
    setPlatforms(cachedPlatforms);
    setActivePlatform(pickDefaultPlatform(cachedPlatforms));

    const id = localStorage.getItem("closeloop_project");
    if (!id) {
      if (!cachedKey) router.replace("/app/onboarding");
      return;
    }
    setProjectId(id);

    api<ProjectResponse>(`/api/projects/${id}`)
      .then((res) => {
        setPublicKey(res.public_key);
        localStorage.setItem("closeloop_public_key", res.public_key);
        const next = normalizePlatforms(res.project.platforms);
        setPlatforms(next);
        localStorage.setItem("closeloop_platforms", JSON.stringify(next));
        setActivePlatform((current) =>
          next.includes(current) ? current : pickDefaultPlatform(next),
        );
      })
      .catch(() => {
        if (!cachedKey) router.replace("/app/onboarding");
      });
  }, [router]);

  useEffect(() => {
    if (!projectId || firstReportReceived) return;

    let cancelled = false;

    async function checkTickets() {
      try {
        const data = await api<TicketsResponse>(`/api/projects/${projectId}/tickets`);
        if (cancelled) return;
        if ((data.tickets || []).length > 0) {
          setFirstReportReceived(true);
          setWaiting(false);
        } else {
          setWaiting(true);
        }
      } catch {
        if (!cancelled) setWaiting(true);
      }
    }

    checkTickets();
    const timer = window.setInterval(checkTickets, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [projectId, firstReportReceived]);

  const snippet = useMemo(
    () => buildSnippet(activePlatform, publicKey),
    [activePlatform, publicKey],
  );

  const webOnly = platforms.length === 1 && platforms[0] === "web";
  const title = webOnly ? "Install the widget" : "Install Closeloop";
  const subtitle = PLATFORM_SUBTITLES[activePlatform] ?? PLATFORM_SUBTITLES.web;
  const showTabs = platforms.length > 1;
  const demoHref = `/demo.html?key=${encodeURIComponent(publicKey)}`;

  async function copySnippet() {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="box-border flex min-h-screen w-full flex-col bg-[#F7F7F7]">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#17171714] bg-white px-8">
        <CloseloopLogo />
        <nav className="flex items-center gap-2 text-[13px]">
          <StepDone label="Create project" />
          <span className="h-px w-10 bg-[#1717171F]" />
          <Step n={2} label="Install" active />
          <span className="h-px w-10 bg-[#1717171F]" />
          <Step n={3} label="Connect agent" />
        </nav>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => logout()}
            className="cursor-pointer text-[13px] text-[#737373] hover:text-[#171717]"
          >
            Log out
          </button>
          <button
            type="button"
            onClick={() => router.push("/app/inbox")}
            className="cursor-pointer text-[13px] text-[#737373] hover:text-[#171717]"
          >
            Skip setup
          </button>
        </div>
      </header>

      <div className="flex flex-1 justify-center px-4 py-14">
        <div className="w-full max-w-[640px] overflow-hidden rounded-2xl border border-[#17171714] bg-white shadow-[0_4px_4px_#1717170A]">
          <div className="flex flex-col gap-6 p-8">
            <div>
              <h1 className="font-ds-sans text-[26px] font-medium tracking-[-0.6px] text-[#171717]">
                {title}
              </h1>
              <p className="mt-1.5 text-sm text-[#737373]">{subtitle}</p>
            </div>

            {showTabs && (
              <div className="flex flex-wrap gap-1.5 rounded-[10px] bg-[#F5F5F5] p-1">
                {platforms.map((id) => {
                  const active = id === activePlatform;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setActivePlatform(id);
                        setCopied(false);
                      }}
                      className={`cursor-pointer rounded-md px-3 py-1.5 text-[13px] font-medium transition ${
                        active
                          ? "bg-white text-[#171717] shadow-[0_1px_2px_#17171714]"
                          : "text-[#737373] hover:text-[#171717]"
                      }`}
                    >
                      {PLATFORM_LABELS[id] ?? id}
                    </button>
                  );
                })}
              </div>
            )}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[13px] font-medium text-[#171717]">
                  {activePlatform === "web" ? "Snippet" : "Install"}
                </span>
                <button
                  type="button"
                  onClick={copySnippet}
                  className="cursor-pointer text-[13px] font-medium text-[#171717] underline-offset-2 hover:underline"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-[#0A0A0A] p-4 text-xs leading-relaxed text-[#86EFAC]">
                {snippet}
              </pre>
              <p className="mt-2 text-xs text-[#A3A3A3]">Public key: {publicKey || "…"}</p>
            </div>

            {activePlatform === "web" && (
              <div className="rounded-[10px] border border-[#17171714] bg-[#FAFAFA] p-4 text-sm text-[#737373]">
                Open the demo app to send a real report:{" "}
                <a
                  className="font-medium text-[#171717] underline"
                  href={demoHref}
                  target="_blank"
                  rel="noreferrer"
                >
                  /demo.html?key=…
                </a>
              </div>
            )}

            <div
              className={`flex items-start gap-3 rounded-[10px] border p-4 ${
                firstReportReceived
                  ? "border-[#16A34A33] bg-[#F0FDF4]"
                  : "border-[#17171714] bg-[#FAFAFA]"
              }`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${
                  firstReportReceived
                    ? "bg-[#16A34A] text-white"
                    : "bg-white text-[#A3A3A3] outline outline-1 outline-[#1717171F]"
                }`}
              >
                {firstReportReceived ? "✓" : "·"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-ds-ui text-[13px] font-medium text-[#171717]">
                  {firstReportReceived ? "First report received" : "Waiting for first report"}
                </p>
                <p className="mt-0.5 font-ds-ui text-[12px] text-[#737373]">
                  {firstReportReceived
                    ? "Your widget is connected. Continue to connect an agent, or open the inbox."
                    : waiting
                      ? "Install the snippet or open the demo app, then send a test report from the floating Report button."
                      : "Checking for reports…"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-[#17171714] bg-[#FAFAFA] px-8 py-4">
            {firstReportReceived ? (
              <button
                type="button"
                onClick={() => router.push("/app/install")}
                className="cursor-pointer text-[13px] font-medium text-[#737373] hover:text-[#171717]"
              >
                Open install page
              </button>
            ) : (
              <span className="text-xs text-[#A3A3A3]">You can continue without a report</span>
            )}
            <button
              type="button"
              onClick={() => router.push("/app/onboarding/mcp")}
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md bg-[#171717] px-4 text-sm font-medium text-white"
            >
              Continue to agent setup
              <span aria-hidden>→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Step({ n, label, active = false }: { n: number; label: string; active?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`flex h-[22px] w-[22px] items-center justify-center rounded-full font-ds-mono text-[11px] font-medium ${
          active ? "bg-[#171717] text-white" : "bg-white text-[#A3A3A3] outline outline-1 outline-[#1717171F]"
        }`}
      >
        {n}
      </span>
      <span className={`text-[13px] ${active ? "font-semibold text-[#171717]" : "font-medium text-[#A3A3A3]"}`}>
        {label}
      </span>
    </div>
  );
}

function StepDone({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#16A34A] text-[11px] text-white">
        ✓
      </span>
      <span className="text-[13px] font-medium text-[#171717]">{label}</span>
    </div>
  );
}
