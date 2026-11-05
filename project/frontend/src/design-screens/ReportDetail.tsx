"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import {
  STATUS_META,
  STATUS_OPTIONS,
  TYPE_STYLE,
  actorLabel,
  contextEntries,
  displayName,
  eventDescription,
  initials,
  primaryReport,
  projectInitial,
  relativeTime,
  reporterLine,
  screenshotUrl,
  shortId,
  type TicketDetailResponse,
  type TicketStatus,
} from "@/lib/tickets";

type ProjectInfo = { id: string; name: string };
type MeResponse = { user: { email: string }; org: { name: string; plan: string } };

export function ReportDetail() {
  const router = useRouter();
  const params = useParams();
  const ticketId = typeof params.id === "string" ? params.id : "";

  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [data, setData] = useState<TicketDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);

  useEffect(() => {
    const projectId = localStorage.getItem("closeloop_project");
    if (!projectId) {
      router.replace("/app/onboarding");
      return;
    }
    if (!ticketId || ticketId === "demo") {
      setLoading(false);
      setError("Open a report from the inbox to see live details.");
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [projectRes, meRes, detail] = await Promise.all([
          api<{ project: ProjectInfo }>(`/api/projects/${projectId}`),
          api<MeResponse>("/api/me"),
          api<TicketDetailResponse>(`/api/tickets/${ticketId}`),
        ]);
        if (cancelled) return;
        setProject(projectRes.project);
        setMe(meRes);
        setData(detail);
        setError("");
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load report");
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [router, ticketId]);

  async function reloadDetail() {
    if (!ticketId) return;
    const detail = await api<TicketDetailResponse>(`/api/tickets/${ticketId}`);
    setData(detail);
  }

  async function addNote() {
    const body = note.trim();
    if (!body || !ticketId) return;
    setSavingNote(true);
    setError("");
    try {
      await api(`/api/tickets/${ticketId}/notes`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      setNote("");
      await reloadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add note");
    } finally {
      setSavingNote(false);
    }
  }

  async function changeStatus(status: TicketStatus) {
    if (!ticketId || !data || data.ticket.status === status) return;
    if (status === "fixed") {
      router.push(`/app/tickets/${ticketId}/fixed`);
      return;
    }
    setSavingStatus(true);
    setError("");
    try {
      await api(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await reloadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setSavingStatus(false);
    }
  }

  const projectName = project?.name || "Project";
  const plan = me?.org.plan || "Indie";
  const email = me?.user.email || "";
  const ticket = data?.ticket;
  const report = data ? primaryReport(data.reports || []) : undefined;
  const typeStyle = TYPE_STYLE[ticket?.type || ""] || {
    bg: "#F5F5F5",
    text: "#737373",
    label: ticket?.type || "Report",
  };
  const statusMeta = STATUS_META[ticket?.status || ""] || {
    label: ticket?.status || "Unknown",
    dot: "#A3A3A3",
  };
  const shot = data ? screenshotUrl(data.attachments || []) : "";
  const contextRows = contextEntries(report);
  const reporterTotal = data?.reporters?.total ?? ticket?.report_count ?? 0;
  const events = [...(data?.events || [])].reverse();

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
          <NavItem href="/app/inbox" label="Inbox" active />
          <NavItem href="/app/auto-pr" label="Auto PR runs" />
          <NavItem href="/app/board" label="Public board" />
          <SectionLabel>Setup</SectionLabel>
          <NavItem href="/app/install" label="Install widget" />
          <NavItem href="/app/mcp" label="MCP server" />
          <SectionLabel>Settings</SectionLabel>
          <NavItem href="/app/settings" label="Project" />
          <NavItem href="/app/settings/integrations" label="Integrations" />
          <NavItem href="/app/settings/team" label="Team" />
          <NavItem href="/app/settings/billing" label="Billing" />
        </nav>

        {email && (
          <div className="mt-auto flex items-center gap-2.5 px-1.5 py-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#171717]">
              <span className="font-ds-sans text-[11px] font-medium text-white">
                {initials(email)}
              </span>
            </div>
            <div className="truncate font-ds-ui text-[13px] font-medium text-[#171717]">
              {displayName(email)}
            </div>
          </div>
        )}
      </aside>

      <main className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-[#17171714] px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/app/inbox"
              className="font-ds-ui text-[13px] text-[#737373] no-underline hover:text-[#171717]"
            >
              ← Inbox
            </Link>
            {ticket && (
              <span className="font-ds-mono text-[12px] text-[#A3A3A3]">
                #{shortId(ticket.id)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled
              className="h-8 cursor-not-allowed rounded-md border border-[#1717171F] bg-white px-3 font-ds-sans text-[13px] font-medium tracking-[-0.2px] text-[#A3A3A3] opacity-70"
            >
              Create Linear issue
            </button>
            <button
              type="button"
              disabled
              className="h-8 cursor-not-allowed rounded-md border border-[#1717171F] bg-white px-3 font-ds-sans text-[13px] font-medium tracking-[-0.2px] text-[#A3A3A3] opacity-70"
            >
              Run auto PR
            </button>
            {ticket && ticket.status !== "fixed" && (
              <Link
                href={`/app/tickets/${ticket.id}/fixed`}
                className="flex h-8 items-center rounded-md bg-[#171717] px-3 font-ds-sans text-[13px] font-medium tracking-[-0.2px] text-white no-underline shadow-[0_4px_4px_#1717170A]"
              >
                Mark fixed
              </Link>
            )}
          </div>
        </header>

        {error && (
          <div className="border-b border-[#FEF2F2] bg-[#FEF2F2] px-6 py-2 font-ds-ui text-[13px] text-[#DA314A]">
            {error}{" "}
            <Link href="/app/inbox" className="underline">
              Back to inbox
            </Link>
          </div>
        )}

        {loading ? (
          <div className="grid flex-1 place-items-center font-ds-ui text-sm text-[#737373]">
            Loading report…
          </div>
        ) : !ticket ? (
          <div className="grid flex-1 place-items-center gap-3 font-ds-ui text-sm text-[#737373]">
            <p>Report not found.</p>
            <Link href="/app/inbox" className="text-[#266DF0] no-underline">
              Back to inbox
            </Link>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1">
            <div className="flex min-w-0 flex-1 flex-col gap-6 overflow-auto px-8 py-7">
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="rounded px-1.5 py-0.5 font-ds-ui text-[11px] font-medium"
                    style={{ background: typeStyle.bg, color: typeStyle.text }}
                  >
                    {typeStyle.label}
                  </span>
                  <span className="inline-flex h-[22px] items-center gap-1.5 rounded-full border border-[#1717171F] bg-white px-2">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: statusMeta.dot }}
                    />
                    <span className="font-ds-ui text-[11px] font-medium text-[#171717]">
                      {statusMeta.label}
                    </span>
                  </span>
                  <span className="font-ds-ui text-xs text-[#737373]">
                    {ticket.report_count} reporter{ticket.report_count === 1 ? "" : "s"}
                    {reporterTotal > 0 ? ` · ${reporterTotal} linked` : ""}
                  </span>
                </div>

                <h1 className="font-ds-sans text-[26px] font-medium tracking-[-0.6px] text-[#171717]">
                  {ticket.title}
                </h1>

                <p className="font-ds-ui text-[13px] text-[#737373]">
                  {reporterLine(report, ticket.created_at)}
                </p>
              </div>

              {report?.message && (
                <div className="border-l-2 border-[#1717171F] py-1 pl-4">
                  <p className="font-ds-sans text-[15px] leading-[23px] tracking-[-0.2px] text-[#171717]">
                    {report.message}
                  </p>
                </div>
              )}

              <div className="relative h-[300px] overflow-hidden rounded-xl border border-[#17171714] bg-[#FAFAFA]">
                {shot ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={shot}
                    alt="Report screenshot"
                    className="h-full w-full object-contain object-top"
                  />
                ) : (
                  <div className="grid h-full place-items-center font-ds-ui text-[13px] text-[#A3A3A3]">
                    No screenshot uploaded
                  </div>
                )}
              </div>

              <div className="flex gap-5 border-b border-[#17171714]">
                <span className="border-b-2 border-[#171717] pb-2.5 font-ds-ui text-[13px] font-medium text-[#171717]">
                  Activity
                </span>
                <span className="pb-2.5 font-ds-ui text-[13px] font-medium text-[#737373]">
                  Session replay
                </span>
                <span className="pb-2.5 font-ds-ui text-[13px] font-medium text-[#737373]">
                  Sentry
                </span>
                <span className="pb-2.5 font-ds-ui text-[13px] font-medium text-[#737373]">
                  PostHog
                </span>
              </div>

              <div className="flex flex-col gap-3.5 pb-8">
                {events.length === 0 ? (
                  <p className="font-ds-ui text-[13px] text-[#A3A3A3]">No activity yet.</p>
                ) : (
                  events.map((event) => (
                    <div key={event.id} className="flex items-center gap-2.5">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F5F5F5] font-ds-ui text-[10px] text-[#737373]">
                        {event.kind === "note" ? "N" : event.kind === "status_changed" ? "S" : "•"}
                      </div>
                      <div className="min-w-0 flex-1 font-ds-ui text-[13px]">
                        <span className="font-medium text-[#171717]">
                          {actorLabel(event.actor)}
                        </span>{" "}
                        <span className="text-[#737373]">{eventDescription(event)}</span>
                      </div>
                      <span className="shrink-0 font-ds-mono text-[11px] text-[#A3A3A3]">
                        {relativeTime(event.created_at)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <aside className="flex w-[340px] shrink-0 flex-col gap-5 overflow-auto border-l border-[#17171714] bg-[#FAFAFA] px-5 py-6">
              <div className="flex flex-col gap-2.5">
                <div className="font-ds-ui text-[11px] font-medium text-[#A3A3A3]">Status</div>
                <StatusSelect
                  value={(ticket.status as TicketStatus) || "open"}
                  disabled={savingStatus}
                  onChange={changeStatus}
                />
              </div>

              <div className="flex flex-col gap-2.5">
                <div className="font-ds-ui text-[11px] font-medium text-[#A3A3A3]">Context</div>
                {contextRows.length === 0 ? (
                  <p className="font-ds-ui text-xs text-[#A3A3A3]">No context captured.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {contextRows.map((row) => (
                      <div key={row.key} className="flex items-start justify-between gap-3">
                        <span className="shrink-0 font-ds-ui text-xs text-[#737373]">
                          {row.key}
                        </span>
                        <span className="max-w-[60%] truncate text-right font-ds-mono text-[11.5px] text-[#171717]">
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2.5">
                <div className="font-ds-ui text-[11px] font-medium text-[#A3A3A3]">Linked</div>
                <StubCard title="Sentry" subtitle="Connect in Integrations" />
                <StubCard title="Session before report" subtitle="PostHog · coming soon" />
                <StubCard title="No pull request yet" subtitle="Auto PR · 1 credit per run" />
              </div>

              <div className="mt-auto flex flex-col gap-2 rounded-[10px] border border-[#1717171F] bg-white p-3">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Write an internal note…"
                  rows={3}
                  className="w-full resize-none bg-transparent font-ds-ui text-[13px] text-[#171717] outline-none placeholder:text-[#A3A3A3]"
                />
                <div className="flex items-center justify-between">
                  <span className="font-ds-ui text-[11px] text-[#A3A3A3]">
                    Only your team sees notes
                  </span>
                  <button
                    type="button"
                    onClick={addNote}
                    disabled={savingNote || !note.trim()}
                    className="h-7 cursor-pointer rounded-md border border-[#1717171F] bg-white px-2.5 font-ds-sans text-xs font-medium tracking-[-0.2px] text-[#171717] shadow-[0_4px_4px_#1717170A] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingNote ? "Adding…" : "Add note"}
                  </button>
                </div>
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

function StatusSelect({
  value,
  onChange,
  disabled,
}: {
  value: TicketStatus;
  onChange: (status: TicketStatus) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const meta = STATUS_META[value] || STATUS_META.open;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-[34px] w-full cursor-pointer items-center gap-2 rounded-md border border-[#1717171F] bg-white px-2.5 disabled:opacity-60"
      >
        <span className="h-[7px] w-[7px] rounded-full" style={{ background: meta.dot }} />
        <span className="flex-1 text-left font-ds-ui text-[13px] font-medium text-[#171717]">
          {meta.label}
        </span>
        <span className="text-[#A3A3A3]">↕</span>
      </button>
      {open && (
        <ul className="absolute top-[calc(100%+4px)] left-0 z-20 w-full overflow-hidden rounded-[10px] border border-[#17171714] bg-white py-1 shadow-[0_8px_24px_#17171714]">
          {STATUS_OPTIONS.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(option.id);
                  setOpen(false);
                }}
                className={`flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left font-ds-ui text-xs ${
                  option.id === value
                    ? "bg-[#F5F5F5] font-medium text-[#171717]"
                    : "text-[#737373] hover:bg-[#FAFAFA]"
                }`}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: STATUS_META[option.id].dot }}
                />
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StubCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[10px] border border-[#17171714] bg-white p-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#F5F5F5] font-ds-ui text-[10px] text-[#A3A3A3]">
        ·
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-ds-ui text-[12.5px] font-medium text-[#171717]">
          {title}
        </div>
        <div className="truncate font-ds-ui text-[11px] text-[#A3A3A3]">{subtitle}</div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-2 pt-3 pb-1 font-ds-ui text-[11px] text-[#A3A3A3]">{children}</div>
  );
}

function NavItem({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 rounded-md px-2 py-[7px] no-underline transition-opacity hover:opacity-80 ${
        active ? "bg-[#F5F5F5]" : "bg-transparent"
      }`}
    >
      <span
        className={`flex-1 font-ds-ui text-[13px] ${
          active ? "font-medium text-[#171717]" : "font-normal text-[#737373]"
        }`}
      >
        {label}
      </span>
    </Link>
  );
}
