"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { API_URL, api } from "@/lib/api";

type TicketType = "bug" | "idea" | "question" | "";
type TicketStatus = "open" | "fixed" | "duplicate" | "";

type Ticket = {
  id: string;
  project_id: string;
  type: string;
  status: string;
  title: string;
  report_count: number;
  created_at: string;
  updated_at: string;
};

type ProjectInfo = {
  id: string;
  name: string;
};

type MeResponse = {
  user: { email: string };
  org: { name: string; plan: string };
};

const TYPE_TABS: { id: TicketType; label: string }[] = [
  { id: "", label: "All" },
  { id: "bug", label: "Bugs" },
  { id: "idea", label: "Ideas" },
  { id: "question", label: "Questions" },
];

const STATUS_OPTIONS: { id: TicketStatus; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "fixed", label: "Fixed" },
  { id: "duplicate", label: "Duplicate" },
  { id: "", label: "All" },
];

const TYPE_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  bug: { bg: "#FEF2F2", text: "#DA314A", label: "Bug" },
  idea: { bg: "#FFF7ED", text: "#EA6C0C", label: "Idea" },
  question: { bg: "#EFF6FF", text: "#266DF0", label: "Question" },
};

const STATUS_DOT: Record<string, string> = {
  open: "#266DF0",
  fixed: "#16A34A",
  duplicate: "#A3A3A3",
};

function shortId(id: string) {
  return id.replace(/-/g, "").slice(0, 6);
}

function relativeTime(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d`;
  return new Date(iso).toLocaleDateString();
}

function projectInitial(name: string) {
  return (name.trim()[0] || "P").toUpperCase();
}

function displayName(email: string) {
  const local = email.split("@")[0] || "You";
  return local
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function initials(email: string) {
  const name = displayName(email);
  const parts = name.split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function Inbox() {
  const router = useRouter();
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [publicKey, setPublicKey] = useState("");
  const [me, setMe] = useState<MeResponse | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [typeFilter, setTypeFilter] = useState<TicketType>("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus>("open");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    const projectId = localStorage.getItem("closeloop_project");
    if (!projectId) {
      router.replace("/app/onboarding");
      return;
    }

    let cancelled = false;

    async function loadMeta() {
      try {
        const [projectRes, meRes] = await Promise.all([
          api<{ project: ProjectInfo; public_key: string }>(`/api/projects/${projectId}`),
          api<MeResponse>("/api/me"),
        ]);
        if (cancelled) return;
        setProject(projectRes.project);
        setPublicKey(projectRes.public_key);
        localStorage.setItem("closeloop_public_key", projectRes.public_key);
        setMe(meRes);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load project");
        }
      }
    }

    loadMeta();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    const projectId = localStorage.getItem("closeloop_project");
    if (!projectId) return;

    let cancelled = false;
    setLoading(true);

    const qs = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";

    api<{ tickets: Ticket[] }>(`/api/projects/${projectId}/tickets${qs}`)
      .then((res) => {
        if (cancelled) return;
        setTickets(res.tickets || []);
        setSelected(new Set());
        setError("");
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load tickets");
          setTickets([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [statusFilter]);

  const filtered = useMemo(() => {
    let list = tickets;
    if (typeFilter) list = list.filter((t) => t.type === typeFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) => t.title.toLowerCase().includes(q) || t.id.toLowerCase().includes(q),
      );
    }
    return list;
  }, [tickets, search, typeFilter]);

  const typeCounts = useMemo(() => {
    const counts = { all: tickets.length, bug: 0, idea: 0, question: 0 };
    for (const t of tickets) {
      if (t.type === "bug") counts.bug += 1;
      else if (t.type === "idea") counts.idea += 1;
      else if (t.type === "question") counts.question += 1;
    }
    return counts;
  }, [tickets]);

  const openCountLabel = statusFilter === "open" ? `${filtered.length} open` : `${filtered.length}`;

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function sendTestReport() {
    const key = publicKey || localStorage.getItem("closeloop_public_key");
    if (!key) {
      setError("Missing public key — finish install first.");
      return;
    }
    setSendingTest(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/v1/ingest/reports`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Closeloop-Key": key,
        },
        body: JSON.stringify({
          type: "bug",
          message: "Test report from Closeloop inbox",
          platform: "web",
          app_version: "dev",
          context: { path: "/app/inbox", source: "send_test_report" },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error?.message || "Failed to send test report");
      }
      setStatusFilter("open");
      setTypeFilter("");
      const projectId = localStorage.getItem("closeloop_project");
      if (projectId) {
        const list = await api<{ tickets: Ticket[] }>(
          `/api/projects/${projectId}/tickets?status=open`,
        );
        setTickets(list.tickets || []);
      }
      if (data.ticket_id) {
        router.push(`/app/tickets/${data.ticket_id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send test report");
    } finally {
      setSendingTest(false);
    }
  }

  function goMerge() {
    if (selected.size < 2) return;
    const ids = Array.from(selected);
    sessionStorage.setItem("closeloop_merge_ids", JSON.stringify(ids));
    router.push("/app/inbox/merge");
  }

  const projectName = project?.name || "Project";
  const plan = me?.org.plan || "Indie";
  const email = me?.user.email || "";

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

        <label className="mt-2 flex h-8 items-center gap-2 rounded-md border border-[#1717171F] bg-white px-2.5 shadow-[0_1px_2px_#0000000A]">
          <span className="text-[13px] text-[#A3A3A3]">⌕</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reports"
            className="min-w-0 flex-1 bg-transparent font-ds-ui text-[13px] text-[#171717] outline-none placeholder:text-[#A3A3A3]"
          />
        </label>

        <nav className="mt-1 flex flex-1 flex-col gap-0.5 overflow-y-auto">
          <NavItem href="/app/inbox" label="Inbox" active count={filtered.length} />
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

        <div className="mt-auto flex flex-col gap-2">
          {email && (
            <div className="flex items-center gap-2.5 px-1.5 py-1">
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
        </div>
      </aside>

      <main className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-[#17171714] px-6">
          <div className="flex items-center gap-2.5">
            <h1 className="font-ds-sans text-lg font-semibold tracking-[-0.36px] text-[#171717]">
              Inbox
            </h1>
            <span className="rounded-full bg-[#F5F5F5] px-1.5 py-px font-ds-mono text-[11px] text-[#737373]">
              {openCountLabel}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {selected.size >= 2 && (
              <button
                type="button"
                onClick={goMerge}
                className="h-8 cursor-pointer rounded-md border border-[#1717171F] bg-white px-4 font-ds-sans text-[13px] font-medium tracking-[-0.2px] text-[#171717] shadow-[0_4px_4px_#1717170A] hover:bg-[#FAFAFA]"
              >
                Merge {selected.size}
              </button>
            )}
            <button
              type="button"
              onClick={sendTestReport}
              disabled={sendingTest}
              className="h-8 cursor-pointer rounded-md bg-[#171717] px-4 font-ds-sans text-[13px] font-medium tracking-[-0.2px] text-white shadow-[0_4px_4px_#1717170A] disabled:opacity-60"
            >
              {sendingTest ? "Sending…" : "Send test report"}
            </button>
          </div>
        </header>

        <div className="flex h-[58px] shrink-0 items-center gap-2 border-b border-[#17171714] px-6">
          <div className="flex gap-0.5 rounded-[10px] border border-[#17171714] bg-[#F5F5F5] p-[3px]">
            {TYPE_TABS.map((tab) => {
              const active = typeFilter === tab.id;
              const count =
                tab.id === ""
                  ? typeCounts.all
                  : tab.id === "bug"
                    ? typeCounts.bug
                    : tab.id === "idea"
                      ? typeCounts.idea
                      : typeCounts.question;
              return (
                <button
                  key={tab.id || "all"}
                  type="button"
                  onClick={() => setTypeFilter(tab.id)}
                  className={`h-7 cursor-pointer rounded-md px-2.5 font-ds-ui text-xs font-medium ${
                    active
                      ? "bg-white text-[#171717] shadow-[0_1px_2px_#0000000F]"
                      : "bg-transparent text-[#737373] hover:text-[#171717]"
                  }`}
                >
                  {tab.label} {count}
                </button>
              );
            })}
          </div>

          <div className="h-5 w-px bg-[#1717171F]" />

          <StatusDropdown value={statusFilter} onChange={setStatusFilter} />
        </div>

        {error && (
          <div className="border-b border-[#FEF2F2] bg-[#FEF2F2] px-6 py-2 font-ds-ui text-[13px] text-[#DA314A]">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid flex-1 place-items-center font-ds-ui text-sm text-[#737373]">
            Loading reports…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            projectName={projectName}
            onSendTest={sendTestReport}
            sending={sendingTest}
          />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-auto">
            <div className="sticky top-0 z-10 flex items-center gap-4 border-b border-[#17171714] bg-[#FAFAFA] px-6 py-2 font-ds-ui text-[11px] text-[#A3A3A3]">
              <span className="w-4 shrink-0" />
              <span className="flex-1">Report</span>
              <span className="w-20 shrink-0">Reporters</span>
              <span className="w-[110px] shrink-0">Status</span>
              <span className="w-10 shrink-0" />
            </div>

            {filtered.map((ticket) => {
              const isSelected = selected.has(ticket.id);
              const typeStyle = TYPE_STYLE[ticket.type] || {
                bg: "#F5F5F5",
                text: "#737373",
                label: ticket.type || "Report",
              };
              return (
                <div
                  key={ticket.id}
                  className={`flex items-center gap-4 border-b border-[#17171714] px-6 py-3 ${
                    isSelected ? "bg-[#EFF6FF]" : "bg-white hover:bg-[#FAFAFA]"
                  }`}
                >
                  <button
                    type="button"
                    aria-label={isSelected ? "Deselect" : "Select"}
                    onClick={() => toggleSelect(ticket.id)}
                    className={`flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded ${
                      isSelected
                        ? "bg-[#266DF0] text-[10px] text-white"
                        : "border border-[#1717171F] bg-white"
                    }`}
                  >
                    {isSelected ? "✓" : ""}
                  </button>

                  <Link
                    href={`/app/tickets/${ticket.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3 no-underline"
                  >
                    <span
                      className="shrink-0 rounded px-1.5 py-0.5 font-ds-ui text-[11px] font-medium"
                      style={{ background: typeStyle.bg, color: typeStyle.text }}
                    >
                      {typeStyle.label}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-ds-ui text-sm font-medium tracking-[-0.2px] text-[#171717]">
                        {ticket.title}
                      </span>
                      <span className="mt-0.5 block font-ds-mono text-[11px] text-[#A3A3A3]">
                        #{shortId(ticket.id)}
                      </span>
                    </span>
                  </Link>

                  <div className="w-20 shrink-0 font-ds-mono text-xs text-[#737373]">
                    {ticket.report_count || 1}
                  </div>

                  <div className="w-[110px] shrink-0">
                    <span className="inline-flex h-[22px] items-center gap-1.5 rounded-full border border-[#1717171F] bg-white px-2">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: STATUS_DOT[ticket.status] || "#A3A3A3" }}
                      />
                      <span className="font-ds-ui text-[11px] font-medium capitalize text-[#171717]">
                        {ticket.status}
                      </span>
                    </span>
                  </div>

                  <span className="w-10 shrink-0 text-right font-ds-mono text-[11px] text-[#A3A3A3]">
                    {relativeTime(ticket.created_at)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function StatusDropdown({
  value,
  onChange,
}: {
  value: TicketStatus;
  onChange: (next: TicketStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const label = STATUS_OPTIONS.find((s) => s.id === value)?.label ?? "All";

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
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
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-[#1717171F] bg-white px-2 font-ds-ui text-xs font-medium text-[#171717]"
      >
        Status: {label}
        <svg viewBox="0 0 12 12" className="h-3 w-3 text-[#737373]" aria-hidden>
          <path d="M3 4.5L6 7.5L9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Status"
          className="absolute top-[calc(100%+4px)] left-0 z-20 min-w-[140px] overflow-hidden rounded-[10px] border border-[#17171714] bg-white py-1 shadow-[0_8px_24px_#17171714]"
        >
          {STATUS_OPTIONS.map((option) => {
            const selected = option.id === value;
            return (
              <li key={option.id || "all"} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                  className={`flex w-full cursor-pointer items-center justify-between px-3 py-1.5 text-left font-ds-ui text-xs ${
                    selected
                      ? "bg-[#F5F5F5] font-medium text-[#171717]"
                      : "font-normal text-[#737373] hover:bg-[#FAFAFA] hover:text-[#171717]"
                  }`}
                >
                  {option.label}
                  {selected && <span className="text-[#171717]">✓</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
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
  count,
}: {
  href: string;
  label: string;
  active?: boolean;
  count?: number;
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
      {typeof count === "number" && (
        <span className="font-ds-mono text-[11px] text-[#A3A3A3]">{count}</span>
      )}
    </Link>
  );
}

function EmptyState({
  projectName,
  onSendTest,
  sending,
}: {
  projectName: string;
  onSendTest: () => void;
  sending: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-10 px-4 py-20">
      <div className="flex w-full max-w-[460px] flex-col items-center gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-[#17171714] bg-[#FAFAFA]">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
            <path
              d="M4 6h16v3l-3 4v5H7v-5L4 9V6z"
              stroke="#737373"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h2 className="font-ds-sans text-2xl font-medium tracking-[-0.5px] text-[#171717]">
          No open reports
        </h2>
        <p className="font-ds-ui text-sm leading-[21px] text-[#737373]">
          New reports from {projectName} will appear here. Send a test report to verify the
          pipeline, or wait for the first real one.
        </p>
        <button
          type="button"
          onClick={onSendTest}
          disabled={sending}
          className="mt-2 h-9 cursor-pointer rounded-md bg-[#171717] px-4 font-ds-sans text-[13px] font-medium text-white disabled:opacity-60"
        >
          {sending ? "Sending…" : "Send test report"}
        </button>
      </div>

      <div className="w-full max-w-[560px] overflow-hidden rounded-2xl border border-[#17171714] bg-white shadow-[0_4px_4px_#1717170A]">
        <div className="flex items-center justify-between border-b border-[#17171714] bg-[#FAFAFA] px-5 py-3.5">
          <span className="font-ds-ui text-[13px] font-semibold text-[#171717]">
            Get the most out of Closeloop
          </span>
        </div>
        <Link
          href="/app/install"
          className="flex items-center gap-3 border-b border-[#17171714] px-5 py-3.5 no-underline hover:bg-[#FAFAFA]"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#F5F5F5] font-ds-mono text-[10px] text-[#737373]">
            1
          </span>
          <span>
            <span className="block font-ds-ui text-[13.5px] font-medium text-[#171717]">
              Install the widget
            </span>
            <span className="block font-ds-ui text-xs text-[#A3A3A3]">
              Drop the snippet so users can report
            </span>
          </span>
        </Link>
        <Link
          href="/app/mcp"
          className="flex items-center gap-3 px-5 py-3.5 no-underline hover:bg-[#FAFAFA]"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#F5F5F5] font-ds-mono text-[10px] text-[#737373]">
            2
          </span>
          <span>
            <span className="block font-ds-ui text-[13.5px] font-medium text-[#171717]">
              Connect your coding agent
            </span>
            <span className="block font-ds-ui text-xs text-[#A3A3A3]">
              MCP token for Cursor or Claude Code
            </span>
          </span>
        </Link>
      </div>
    </div>
  );
}
