"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { Tour } from "@/components/coach/Tour";
import { api, clearProjectSelection } from "@/lib/api";
import type { MeResponse } from "@/lib/usage";
import {
  INSTALL_METHOD_LABELS,
  type InstallMethod,
  buildInstallSteps,
  isWebInstallMethod,
  methodsForPlatforms,
  normalizePlatforms,
  pickDefaultMethod,
  platformLabelForMethod,
  readCachedPlatforms,
} from "@/lib/widget-install";

const POLL_MS = 3000;

type ProjectInfo = { id: string; name: string; platforms?: string[] };
type ProjectResponse = { public_key: string; project: ProjectInfo };
type TicketSummary = { id: string; title: string };
type TicketsResponse = { tickets: TicketSummary[] };

export function InstallStatus() {
  const router = useRouter();
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [publicKey, setPublicKey] = useState("");
  const [methods, setMethods] = useState<InstallMethod[]>(["script"]);
  const [activeMethod, setActiveMethod] = useState<InstallMethod>("script");
  const [copiedStep, setCopiedStep] = useState<number | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [firstReportReceived, setFirstReportReceived] = useState(false);
  const [waiting, setWaiting] = useState(true);
  const [ticketCount, setTicketCount] = useState(0);
  const [firstTicket, setFirstTicket] = useState<TicketSummary | null>(null);

  useEffect(() => {
    const projectId = localStorage.getItem("closeloop_project");
    if (!projectId) {
      router.replace("/app/onboarding");
      return;
    }

    const cachedKey = localStorage.getItem("closeloop_public_key");
    const cachedMethods = methodsForPlatforms(readCachedPlatforms());
    if (cachedKey) setPublicKey(cachedKey);
    setMethods(cachedMethods);
    setActiveMethod(pickDefaultMethod(cachedMethods));

    let cancelled = false;
    setLoading(true);

    Promise.all([
      api<ProjectResponse>(`/api/projects/${projectId}`),
      api<MeResponse>("/api/me"),
      api<TicketsResponse>(`/api/projects/${projectId}/tickets`),
    ])
      .then(([projectRes, meRes, ticketsRes]) => {
        if (cancelled) return;
        setProject(projectRes.project);
        setMe(meRes);
        setPublicKey(projectRes.public_key);
        localStorage.setItem("closeloop_public_key", projectRes.public_key);
        const platforms = normalizePlatforms(projectRes.project.platforms);
        localStorage.setItem("closeloop_platforms", JSON.stringify(platforms));
        const nextMethods = methodsForPlatforms(platforms);
        setMethods(nextMethods);
        setActiveMethod((current) =>
          nextMethods.includes(current) ? current : pickDefaultMethod(nextMethods),
        );
        applyTickets(ticketsRes.tickets || []);
        setError("");
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load install page";
        setError(message);
        if (/not found|forbidden/i.test(message)) {
          clearProjectSelection();
          router.replace("/app/onboarding");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    const projectId = localStorage.getItem("closeloop_project");
    if (!projectId || firstReportReceived) return;

    let cancelled = false;

    async function checkTickets() {
      try {
        const data = await api<TicketsResponse>(`/api/projects/${projectId}/tickets`);
        if (cancelled) return;
        applyTickets(data.tickets || []);
      } catch {
        if (!cancelled) setWaiting(true);
      }
    }

    const timer = window.setInterval(checkTickets, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [firstReportReceived]);

  function applyTickets(tickets: TicketSummary[]) {
    const count = tickets.length;
    setTicketCount(count);
    setFirstTicket(tickets[0] ?? null);
    setFirstReportReceived(count > 0);
    setWaiting(count === 0);
  }

  const steps = useMemo(
    () => buildInstallSteps(activeMethod, publicKey),
    [activeMethod, publicKey],
  );

  const showTabs = methods.length > 1;
  const demoHref = `/demo.html?key=${encodeURIComponent(publicKey)}`;
  const projectName = project?.name || "Project";
  const plan = me?.org.plan || "free";
  const email = me?.user.email || "";
  const guideTitle = `Install on ${projectName} ${platformLabelForMethod(activeMethod)}`;
  const showDemo = isWebInstallMethod(activeMethod) && Boolean(publicKey);

  async function copyText(text: string, stepNumber: number | null) {
    await navigator.clipboard.writeText(text);
    if (stepNumber === null) {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 1500);
      return;
    }
    setCopiedStep(stepNumber);
    setTimeout(() => setCopiedStep(null), 1500);
  }

  return (
    <div className="box-border flex min-h-screen w-full bg-white">
      <AppSidebar
        projectName={projectName}
        plan={plan}
        email={email}
        usage={me?.usage}
        userName={me?.user?.name}
        avatarUrl={me?.user?.avatar_url}
        active="install"
      />

      <Tour id="install" ready={!loading} />
      <main className="flex min-h-screen min-w-0 flex-1 flex-col bg-[#F7F7F7]">
        <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-[#17171714] bg-white px-6">
          <h1 className="font-ds-sans text-lg font-semibold tracking-[-0.36px] text-[#171717]">
            Install widget
          </h1>
          {showDemo && (
            <a
              href={demoHref}
              target="_blank"
              rel="noreferrer"
              className="h-8 cursor-pointer rounded-md border border-[#1717171F] bg-white px-4 font-ds-sans text-[13px] font-medium leading-8 text-[#171717] no-underline hover:bg-[#FAFAFA]"
            >
              Open demo
            </a>
          )}
        </header>

        <div className="flex flex-1 flex-col overflow-y-auto px-6 py-8 lg:px-10">
          {loading ? (
            <p className="font-ds-ui text-sm text-[#737373]">Loading…</p>
          ) : (
            <>
              {error && (
                <div className="mb-6 rounded-md bg-[#FEF2F2] px-3 py-2 font-ds-ui text-[13px] text-[#DA314A]">
                  {error}
                </div>
              )}

              <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 lg:flex-row lg:items-start">
                <section className="flex min-w-0 flex-1 flex-col gap-6 rounded-2xl bg-white p-8 shadow-[0_4px_4px_#1717170A]">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="font-ds-sans text-2xl font-medium tracking-[-0.48px] text-[#171717]">
                      {guideTitle}
                    </h2>
                    {showTabs && (
                      <div className="flex flex-wrap gap-0.5 rounded-[10px] bg-[#F5F5F5] p-[3px]">
                        {methods.map((id) => {
                          const active = id === activeMethod;
                          return (
                            <button
                              key={id}
                              type="button"
                              onClick={() => {
                                setActiveMethod(id);
                                setCopiedStep(null);
                              }}
                              className={`cursor-pointer rounded-md px-3 py-1.5 font-ds-ui text-[13px] font-medium transition ${
                                active
                                  ? "bg-white text-[#171717] shadow-[0_1px_2px_#17171714]"
                                  : "text-[#737373] hover:text-[#171717]"
                              }`}
                            >
                              {INSTALL_METHOD_LABELS[id]}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-6">
                    {steps.map((step) => (
                      <div
                        key={step.number}
                        data-tour={step.tourTarget}
                        className="flex gap-4"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F5F5F5] font-ds-mono text-[11px] font-medium text-[#171717]">
                          {step.number}
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                          <h3 className="font-ds-sans text-base font-semibold text-[#171717]">
                            {step.title}
                          </h3>
                          <p className="font-ds-ui text-[13px] leading-5 text-[#737373]">
                            {step.description}
                          </p>
                          <div className="overflow-hidden rounded-md bg-[#0A0A0A]">
                            <div className="flex items-center justify-between px-3 py-2">
                              <span className="font-ds-mono text-[11px] text-[#A3A3A3]">
                                {step.fileLabel}
                              </span>
                              <button
                                type="button"
                                onClick={() => copyText(step.code, step.number)}
                                className="cursor-pointer font-ds-ui text-[11px] text-[#A3A3A3] hover:text-white"
                              >
                                {copiedStep === step.number ? "Copied" : "Copy"}
                              </button>
                            </div>
                            <pre className="overflow-x-auto whitespace-pre-wrap px-3.5 pb-3.5 font-ds-mono text-xs leading-relaxed text-[#E5E5E5]">
                              {step.code}
                            </pre>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-[360px]">
                  <section
                    data-tour="install-first-report"
                    className={`flex flex-col gap-4 rounded-2xl border bg-white p-6 ${
                      firstReportReceived ? "border-[#16A34A33]" : "border-[#17171714]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ${
                          firstReportReceived
                            ? "bg-[#16A34A] text-white"
                            : "bg-[#F5F5F5] text-[#A3A3A3]"
                        }`}
                      >
                        {firstReportReceived ? "✓" : "·"}
                      </span>
                      <div>
                        <h3 className="font-ds-sans text-base font-semibold text-[#171717]">
                          {firstReportReceived
                            ? "First report received"
                            : "Waiting for first report"}
                        </h3>
                        <p className="mt-0.5 font-ds-ui text-[13px] text-[#737373]">
                          {firstReportReceived
                            ? "Your widget is live."
                            : waiting
                              ? "Install the snippet or open the demo, then send a test report."
                              : "Checking for reports…"}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-md bg-[#F5F5F5] px-3.5 py-3">
                      {firstReportReceived && firstTicket ? (
                        <>
                          <p className="font-ds-ui text-[13px] font-medium text-[#171717]">
                            {firstTicket.title || "Test report from Saidloop setup"}
                          </p>
                          <p className="mt-1 font-ds-mono text-[11px] text-[#A3A3A3]">
                            {ticketCount} ticket{ticketCount === 1 ? "" : "s"} in this project
                          </p>
                        </>
                      ) : (
                        <p className="font-ds-ui text-[13px] text-[#737373]">
                          No reports yet. Send one from your app or the demo host.
                        </p>
                      )}
                    </div>

                    <ul className="flex flex-col gap-2.5">
                      {[
                        "Screenshot captured",
                        "identify() received user and version",
                        "1 element masked",
                      ].map((label) => (
                        <li key={label} className="flex items-center gap-2">
                          <span
                            className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                              firstReportReceived
                                ? "text-[#16A34A]"
                                : "text-[#D4D4D4]"
                            }`}
                          >
                            ✓
                          </span>
                          <span className="font-ds-ui text-[12.5px] text-[#737373]">{label}</span>
                        </li>
                      ))}
                    </ul>

                    <Link
                      href="/app/mcp"
                      className="flex h-10 items-center justify-center rounded-md bg-[#171717] px-4 font-ds-sans text-[13px] font-medium text-white no-underline"
                    >
                      Continue to agent setup →
                    </Link>
                  </section>

                  <section className="flex flex-col gap-2 rounded-xl border border-[#17171714] bg-white p-4">
                    <p className="font-ds-ui text-xs font-medium text-[#737373]">Public key</p>
                    <div className="flex items-center gap-2 rounded-md bg-[#F5F5F5] px-3 py-2">
                      <code className="min-w-0 flex-1 truncate font-ds-mono text-xs text-[#171717]">
                        {publicKey || "…"}
                      </code>
                      <button
                        type="button"
                        onClick={() => copyText(publicKey, null)}
                        disabled={!publicKey}
                        className="shrink-0 cursor-pointer font-ds-ui text-[11px] font-medium text-[#737373] hover:text-[#171717] disabled:cursor-default disabled:opacity-40"
                      >
                        {copiedKey ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <p className="font-ds-ui text-[11.5px] text-[#A3A3A3]">
                      Safe to ship in your app. It can only create reports.
                    </p>
                  </section>
                </aside>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
