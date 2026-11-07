"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { api, clearProjectSelection, logout } from "@/lib/api";
import {
  displayName,
  initials,
  projectInitial,
} from "@/lib/tickets";
import {
  PLATFORM_LABELS,
  PLATFORM_SUBTITLES,
  buildSnippet,
  normalizePlatforms,
  pickDefaultPlatform,
  readCachedPlatforms,
} from "@/lib/widget-install";

const POLL_MS = 3000;

type ProjectInfo = { id: string; name: string; platforms?: string[] };
type MeResponse = { user: { email: string; name?: string; avatar_url?: string }; org: { name: string; plan: string } };
type ProjectResponse = { public_key: string; project: ProjectInfo };
type TicketsResponse = { tickets: { id: string }[] };

export function InstallStatus() {
  const router = useRouter();
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [publicKey, setPublicKey] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(["web"]);
  const [activePlatform, setActivePlatform] = useState("web");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [firstReportReceived, setFirstReportReceived] = useState(false);
  const [waiting, setWaiting] = useState(true);
  const [ticketCount, setTicketCount] = useState(0);

  useEffect(() => {
    const projectId = localStorage.getItem("closeloop_project");
    if (!projectId) {
      router.replace("/app/onboarding");
      return;
    }

    const cachedKey = localStorage.getItem("closeloop_public_key");
    const cachedPlatforms = readCachedPlatforms();
    if (cachedKey) setPublicKey(cachedKey);
    setPlatforms(cachedPlatforms);
    setActivePlatform(pickDefaultPlatform(cachedPlatforms));

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
        const next = normalizePlatforms(projectRes.project.platforms);
        setPlatforms(next);
        localStorage.setItem("closeloop_platforms", JSON.stringify(next));
        setActivePlatform((current) =>
          next.includes(current) ? current : pickDefaultPlatform(next),
        );
        const count = (ticketsRes.tickets || []).length;
        setTicketCount(count);
        setFirstReportReceived(count > 0);
        setWaiting(count === 0);
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
        const count = (data.tickets || []).length;
        setTicketCount(count);
        if (count > 0) {
          setFirstReportReceived(true);
          setWaiting(false);
        } else {
          setWaiting(true);
        }
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

  const snippet = useMemo(
    () => buildSnippet(activePlatform, publicKey),
    [activePlatform, publicKey],
  );

  const showTabs = platforms.length > 1;
  const demoHref = `/demo.html?key=${encodeURIComponent(publicKey)}`;
  const projectName = project?.name || "Project";
  const plan = me?.org.plan || "Indie";
  const email = me?.user.email || "";
  const subtitle = PLATFORM_SUBTITLES[activePlatform] ?? PLATFORM_SUBTITLES.web;

  async function copySnippet() {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="box-border flex min-h-screen w-full bg-white">
      <aside className="flex h-screen w-[248px] shrink-0 flex-col gap-0.5 border-r border-[#17171714] bg-[#FAFAFA] p-3">
        <div className="flex items-center gap-2.5 rounded-md p-1.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#F59E0B]">
            <span className="font-ds-sans text-[13px] font-semibold text-white">
              {projectInitial(projectName)}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-ds-ui text-[13px] font-semibold text-[#171717]">
              {projectName}
            </div>
            <div className="truncate font-ds-ui text-[11px] text-[#A3A3A3]">
              {email ? `${displayName(email).split(" ")[0]} · ${plan}` : plan}
            </div>
          </div>
        </div>

        <nav className="mt-3 flex flex-1 flex-col gap-0.5 overflow-y-auto">
          <NavItem href="/app/inbox" label="Inbox" />
          <NavItem href="/app/auto-pr" label="Auto PR runs" />
          <NavItem href="/app/board" label="Public board" />
          <SectionLabel>Setup</SectionLabel>
          <NavItem href="/app/install" label="Install widget" active />
          <NavItem href="/app/mcp" label="MCP server" />
          <SectionLabel>Settings</SectionLabel>
          <NavItem href="/app/settings" label="Project" />
          <NavItem href="/app/settings/integrations" label="Integrations" />
          <NavItem href="/app/settings/team" label="Team" />
          <NavItem href="/app/settings/billing" label="Billing" />
        </nav>

        {email && (
          <div className="mt-auto flex items-center gap-2.5 px-1.5 py-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#171717] overflow-hidden shrink-0">
              {me?.user?.avatar_url ? (
                <img src={me.user.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="font-ds-sans text-[11px] font-medium text-white">
                  {initials(email)}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-ds-ui text-[13px] font-medium text-[#171717]">
                {me?.user?.name || displayName(email)}
              </div>
              <button
                type="button"
                onClick={() => logout()}
                className="cursor-pointer font-ds-ui text-[11px] text-[#A3A3A3] hover:text-[#171717]"
              >
                Log out
              </button>
            </div>
          </div>
        )}
      </aside>

      <main className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-[#17171714] px-6">
          <h1 className="font-ds-sans text-lg font-semibold tracking-[-0.36px] text-[#171717]">
            Install widget
          </h1>
          {activePlatform === "web" && publicKey && (
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

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-6">
          {loading ? (
            <p className="font-ds-ui text-sm text-[#737373]">Loading…</p>
          ) : (
            <>
              {error && (
                <div className="rounded-md bg-[#FEF2F2] px-3 py-2 font-ds-ui text-[13px] text-[#DA314A]">
                  {error}
                </div>
              )}

              <section
                className={`rounded-2xl border p-5 ${
                  firstReportReceived
                    ? "border-[#16A34A33] bg-[#F0FDF4]"
                    : "border-[#17171714] bg-[#FAFAFA]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                      firstReportReceived
                        ? "bg-[#16A34A] text-white"
                        : "bg-white text-[#A3A3A3] outline outline-1 outline-[#1717171F]"
                    }`}
                  >
                    {firstReportReceived ? "✓" : "·"}
                  </span>
                  <h2 className="font-ds-ui text-[15px] font-semibold text-[#171717]">
                    {firstReportReceived ? "Widget receiving reports" : "Waiting for first report"}
                  </h2>
                </div>
                <p className="mt-1.5 font-ds-ui text-[13px] text-[#737373]">
                  {firstReportReceived
                    ? `${ticketCount} ticket${ticketCount === 1 ? "" : "s"} in this project so far.`
                    : waiting
                      ? "Install the snippet or open the demo app, then send a test report."
                      : "Checking for reports…"}
                </p>
              </section>

              <section className="rounded-2xl border border-[#17171714] bg-white p-5 shadow-[0_4px_4px_#1717170A]">
                <h3 className="font-ds-ui text-[14px] font-semibold text-[#171717]">Snippet</h3>
                <p className="mt-1 font-ds-ui text-[12px] text-[#737373]">{subtitle}</p>

                {showTabs && (
                  <div className="mt-4 flex flex-wrap gap-1.5 rounded-[10px] bg-[#F5F5F5] p-1">
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

                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[13px] font-medium text-[#171717]">
                      {activePlatform === "web" ? "Script tag" : "Install"}
                    </span>
                    <button
                      type="button"
                      onClick={copySnippet}
                      className="cursor-pointer text-[13px] font-medium underline-offset-2 hover:underline"
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
                  <p className="mt-4 font-ds-ui text-[13px] text-[#737373]">
                    Demo host:{" "}
                    <a
                      className="font-medium text-[#171717] underline"
                      href={demoHref}
                      target="_blank"
                      rel="noreferrer"
                    >
                      /demo.html?key=…
                    </a>
                  </p>
                )}
              </section>

              <section className="rounded-2xl border border-[#17171714] bg-white p-5">
                <h3 className="font-ds-ui text-[14px] font-semibold text-[#171717]">Next</h3>
                <p className="mt-1 font-ds-ui text-[13px] text-[#737373]">
                  Connect Cursor or Claude Code so an agent can read open feedback.
                </p>
                <Link
                  href="/app/mcp"
                  className="mt-3 inline-flex h-9 items-center rounded-md bg-[#171717] px-4 font-ds-sans text-[13px] font-medium text-white no-underline"
                >
                  Open MCP server
                </Link>
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mt-3 px-2 pb-1 pt-2 font-ds-ui text-[11px] font-medium uppercase tracking-[0.04em] text-[#A3A3A3]">
      {children}
    </div>
  );
}

function NavItem({
  href,
  label,
  active = false,
}: {
  href: string;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center rounded-md px-2 py-1.5 font-ds-ui text-[13px] no-underline transition ${
        active
          ? "bg-white font-semibold text-[#171717] shadow-[0_1px_2px_#17171714]"
          : "font-medium text-[#737373] hover:bg-white/70 hover:text-[#171717]"
      }`}
    >
      {label}
    </Link>
  );
}
