"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { subscribeWidgetSubmitted } from "@/lib/widget-events";
import { AppSidebar } from "@/components/AppSidebar";
import { Tour } from "@/components/coach/Tour";
import { API_URL, api, clearProjectSelection } from "@/lib/api";
import { onboardingChecklist } from "@/lib/onboarding-checklist";
import { shortRepo, type ProjectRepo, type ReposResponse } from "@/lib/repos";
import type { MeResponse, OrgUsage } from "@/lib/usage";

type TicketType = "bug" | "idea" | "question" | "";
type TicketStatus = "open" | "in_progress" | "fixed" | "wont_fix" | "duplicate" | "";
type TicketPlatform = "web" | "android" | "ios" | "flutter" | "";

type Ticket = {
  id: string;
  project_id: string;
  type: string;
  status: string;
  title: string;
  report_count: number;
  created_at: string;
  updated_at: string;
  repo_id?: string | null;
  repo?: string;
};

type ProjectInfo = {
  id: string;
  name: string;
};

const TYPE_TABS: { id: TicketType; label: string }[] = [
  { id: "", label: "All" },
  { id: "bug", label: "Bugs" },
  { id: "idea", label: "Ideas" },
  { id: "question", label: "Questions" },
];

const STATUS_OPTIONS: { id: TicketStatus; label: string }[] = [
  { id: "", label: "All" },
  { id: "open", label: "Open" },
  { id: "in_progress", label: "In progress" },
  { id: "fixed", label: "Fixed" },
  { id: "wont_fix", label: "Won't fix" },
  { id: "duplicate", label: "Duplicate" },
];

const PLATFORM_OPTIONS: { id: TicketPlatform; label: string }[] = [
  { id: "", label: "All" },
  { id: "web", label: "Web" },
  { id: "android", label: "Android" },
  { id: "ios", label: "iOS" },
  { id: "flutter", label: "Flutter" },
];

const TYPE_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  bug: { bg: "#FEF2F2", text: "#DA314A", label: "Bug" },
  idea: { bg: "#FFF7ED", text: "#EA6C0C", label: "Idea" },
  question: { bg: "#EFF6FF", text: "#266DF0", label: "Question" },
};

const STATUS_DOT: Record<string, string> = {
  open: "#266DF0",
  in_progress: "#EA6C0C",
  fixed: "#16A34A",
  wont_fix: "#A3A3A3",
  duplicate: "#A3A3A3",
};

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  fixed: "Fixed",
  wont_fix: "Won't fix",
  duplicate: "Duplicate",
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

export function Inbox() {
  const router = useRouter();
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [publicKey, setPublicKey] = useState("");
  const [me, setMe] = useState<MeResponse | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [typeFilter, setTypeFilter] = useState<TicketType>("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus>("");
  const [platformFilter, setPlatformFilter] = useState<TicketPlatform>("");
  // "" = all repos, "none" = tickets with no repo, else a repo id (D-15, z9TjRd).
  const [repoFilter, setRepoFilter] = useState("");
  const [repos, setRepos] = useState<ProjectRepo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);

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
          api<MeResponse>(`/api/me?project_id=${encodeURIComponent(projectId || "")}`),
        ]);
        if (cancelled) return;
        setProject(projectRes.project);
        setPublicKey(projectRes.public_key);
        localStorage.setItem("closeloop_public_key", projectRes.public_key);
        setMe(meRes);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load project";
        // Stale project id after DB reset / account switch → re-onboard
        if (/no access|forbidden|not found/i.test(message)) {
          clearProjectSelection();
          router.replace("/app/onboarding");
          return;
        }
        setError(message);
      }
    }

    loadMeta();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    return subscribeWidgetSubmitted(() => {
      setRefreshNonce((n) => n + 1);
    });
  }, []);

  useEffect(() => {
    const projectId = localStorage.getItem("closeloop_project");
    if (!projectId) return;

    let cancelled = false;
    setLoading(true);

    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (platformFilter) params.set("platform", platformFilter);
    const qs = params.toString() ? `?${params.toString()}` : "";

    api<ReposResponse>(`/api/projects/${projectId}/repos`)
      .then((res) => !cancelled && setRepos(res.repos || []))
      .catch(() => !cancelled && setRepos([]));

    api<{ tickets: Ticket[] }>(`/api/projects/${projectId}/tickets${qs}`)
      .then((res) => {
        if (cancelled) return;
        setTickets(res.tickets || []);
        setSelected(new Set());
        setError("");
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load tickets";
        if (/no access|forbidden|not found/i.test(message)) {
          clearProjectSelection();
          router.replace("/app/onboarding");
          return;
        }
        setError(message);
        setTickets([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [statusFilter, platformFilter, refreshNonce, router]);

  const repoCounts = useMemo(() => {
    const counts: Record<string, number> = { "": tickets.length, none: 0 };
    for (const t of tickets) {
      const key = t.repo_id || "none";
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [tickets]);

  const filtered = useMemo(() => {
    let list = tickets;
    if (repoFilter === "none") list = list.filter((t) => !t.repo_id);
    else if (repoFilter) list = list.filter((t) => t.repo_id === repoFilter);
    if (typeFilter) list = list.filter((t) => t.type === typeFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) => t.title.toLowerCase().includes(q) || t.id.toLowerCase().includes(q),
      );
    }
    return list;
  }, [tickets, search, typeFilter, repoFilter]);

  const typeCounts = useMemo(() => {
    const counts = { all: tickets.length, bug: 0, idea: 0, question: 0 };
    for (const t of tickets) {
      if (t.type === "bug") counts.bug += 1;
      else if (t.type === "idea") counts.idea += 1;
      else if (t.type === "question") counts.question += 1;
    }
    return counts;
  }, [tickets]);

  const openCountLabel =
    statusFilter === "open"
      ? `${filtered.length} open`
      : statusFilter === "in_progress"
        ? `${filtered.length} in progress`
        : statusFilter === "fixed"
          ? `${filtered.length} fixed`
          : `${filtered.length}`;

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
          message: "Test report from Saidloop inbox",
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
      setPlatformFilter("");
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
  const plan = me?.org.plan || "free";
  const email = me?.user.email || "";

  return (
    <div className="box-border flex min-h-screen w-full bg-white">
      <Tour id="inbox" ready={!loading} />
      <AppSidebar
        projectName={projectName}
        plan={plan}
        email={email}
        usage={me?.usage}
        userName={me?.user?.name}
        avatarUrl={me?.user?.avatar_url}
        active="inbox"
        inboxCount={filtered.length}
        searchValue={search}
        onSearchChange={setSearch}
      />

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
                data-tour="inbox-bulk"
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

        <div
          data-tour="inbox-filters"
          className="flex h-[58px] shrink-0 items-center gap-2 border-b border-[#17171714] px-6"
        >
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
          <PlatformDropdown value={platformFilter} onChange={setPlatformFilter} />
          {repos.length > 0 && (
            <RepoDropdown repos={repos} value={repoFilter} counts={repoCounts} onChange={setRepoFilter} />
          )}
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
            plan={me?.org.plan || "free"}
            usage={me?.usage}
            onSendTest={sendTestReport}
            sending={sendingTest}
          />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-auto">
            <div className="sticky top-0 z-10 flex items-center gap-4 border-b border-[#17171714] bg-[#FAFAFA] px-6 py-2 font-ds-ui text-[11px] text-[#A3A3A3]">
              <span className="w-4 shrink-0" />
              <span className="flex-1">Report</span>
              <span className="w-20 shrink-0">Reporters</span>
              {repos.length > 0 && <span className="w-[140px] shrink-0">Repo</span>}
              <span className="w-[110px] shrink-0">Status</span>
              <span className="w-10 shrink-0 text-right">Age</span>
            </div>

            {filtered.map((ticket, rowIndex) => {
              const isSelected = selected.has(ticket.id);
              const typeStyle = TYPE_STYLE[ticket.type] || {
                bg: "#F5F5F5",
                text: "#737373",
                label: ticket.type || "Report",
              };
              return (
                <div
                  key={ticket.id}
                  data-tour={rowIndex === 0 ? "inbox-row" : undefined}
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

                  {repos.length > 0 && (
                    <div className="w-[140px] shrink-0 truncate font-ds-mono text-[11.5px]">
                      {ticket.repo ? (
                        <span className="text-[#171717]" title={ticket.repo}>
                          {shortRepo(ticket.repo)}
                        </span>
                      ) : (
                        <span className="text-[#EA6C0C]">No repo yet</span>
                      )}
                    </div>
                  )}

                  <div className="w-[110px] shrink-0">
                    <span className="inline-flex h-[22px] items-center gap-1.5 rounded-full border border-[#1717171F] bg-white px-2">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: STATUS_DOT[ticket.status] || "#A3A3A3" }}
                      />
                      <span className="font-ds-ui text-[11px] font-medium text-[#171717]">
                        {STATUS_LABEL[ticket.status] || ticket.status}
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

function FilterDropdown<T extends string>({
  labelPrefix,
  ariaLabel,
  value,
  options,
  onChange,
}: {
  labelPrefix: string;
  ariaLabel: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (next: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const label = options.find((s) => s.id === value)?.label ?? "All";

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
        {labelPrefix}: {label}
        <svg viewBox="0 0 12 12" className="h-3 w-3 text-[#737373]" aria-hidden>
          <path d="M3 4.5L6 7.5L9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={ariaLabel}
          className="absolute top-[calc(100%+4px)] left-0 z-20 min-w-[140px] overflow-hidden rounded-[10px] border border-[#17171714] bg-white py-1 shadow-[0_8px_24px_#17171714]"
        >
          {options.map((option) => {
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

function RepoDropdown({
  repos,
  value,
  counts,
  onChange,
}: {
  repos: ProjectRepo[];
  value: string;
  counts: Record<string, number>;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const label =
    value === "" ? "All" : value === "none" ? "No repo yet" : shortRepo(repos.find((r) => r.id === value)?.full_name || "");

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

  function item(id: string, text: ReactNode, count: number, mono = false) {
    const selected = id === value;
    return (
      <li key={id || "all"} role="option" aria-selected={selected}>
        <button
          type="button"
          onClick={() => {
            onChange(id);
            setOpen(false);
          }}
          className={`flex w-full cursor-pointer items-center justify-between gap-4 px-3 py-1.5 text-left text-xs ${
            mono ? "font-ds-mono" : "font-ds-ui"
          } ${selected ? "bg-[#F5F5F5] font-medium text-[#171717]" : "text-[#737373] hover:bg-[#FAFAFA] hover:text-[#171717]"}`}
        >
          <span className="flex items-center gap-1.5">{text}</span>
          <span className="font-ds-mono text-[11px] text-[#A3A3A3]">{count}</span>
        </button>
      </li>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-[#1717171F] bg-white px-2 font-ds-ui text-xs font-medium text-[#171717]"
      >
        Repo: {label}
        <svg viewBox="0 0 12 12" className="h-3 w-3 text-[#737373]" aria-hidden>
          <path d="M3 4.5L6 7.5L9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label="Repo"
          className="absolute top-[calc(100%+4px)] left-0 z-20 w-[280px] overflow-hidden rounded-[10px] border border-[#17171714] bg-white py-1 shadow-[0_8px_24px_#17171714]"
        >
          {item("", "All repos", counts[""] || 0)}
          {repos.map((r) => item(r.id, r.full_name, counts[r.id] || 0, true))}
          <li className="my-1 border-t border-[#17171714]" aria-hidden />
          {item(
            "none",
            <>
              <span className="inline-block h-2.5 w-2.5 rounded-full border border-dashed border-[#EA6C0C]" />
              No repo yet
            </>,
            counts.none || 0,
          )}
          <li className="px-3 pb-1.5 pt-1 font-ds-ui text-[11px] leading-[15px] text-[#A3A3A3]">
            Tickets land here only when their platform has no repo and no fallback is set.
          </li>
        </ul>
      )}
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
  return (
    <FilterDropdown
      labelPrefix="Status"
      ariaLabel="Status"
      value={value}
      options={STATUS_OPTIONS}
      onChange={onChange}
    />
  );
}

function PlatformDropdown({
  value,
  onChange,
}: {
  value: TicketPlatform;
  onChange: (next: TicketPlatform) => void;
}) {
  return (
    <FilterDropdown
      labelPrefix="Platform"
      ariaLabel="Platform"
      value={value}
      options={PLATFORM_OPTIONS}
      onChange={onChange}
    />
  );
}

function EmptyState({
  projectName,
  plan,
  usage,
  onSendTest,
  sending,
}: {
  projectName: string;
  plan: string;
  usage?: OrgUsage;
  onSendTest: () => void;
  sending: boolean;
}) {
  const [agentClient, setAgentClient] = useState("");
  const [agentConnected, setAgentConnected] = useState(false);
  const [slackConnected, setSlackConnected] = useState(false);

  useEffect(() => {
    const projectId = localStorage.getItem("closeloop_project");
    if (!projectId) return;
    let cancelled = false;
    Promise.all([
      api<{ tokens: { last_used_at: string | null; clients?: { name?: string }[] }[] }>(
        `/api/projects/${projectId}/mcp-tokens`,
      ).catch(() => ({ tokens: [] })),
      api<{ integrations: { provider: string }[] }>(
        `/api/projects/${projectId}/integrations`,
      ).catch(() => ({ integrations: [] })),
    ]).then(([tokenRes, integRes]) => {
      if (cancelled) return;
      const used = (tokenRes.tokens || []).filter((t) => t.last_used_at);
      setAgentConnected(used.length > 0);
      const client = used.flatMap((t) => t.clients || []).find((c) => c?.name)?.name || "";
      setAgentClient(client);
      setSlackConnected((integRes.integrations || []).some((i) => i.provider === "slack"));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const items = onboardingChecklist({
    plan,
    projectName,
    widgetReporting: (usage?.reports.used ?? 0) > 0,
    agentClient,
    agentConnected,
    teammates: usage?.seats?.used ?? 1,
    slackConnected,
    reposConnected: usage?.repos?.used ?? 0,
  });
  const doneCount = items.filter((i) => i.done).length;

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

      <div
        data-pencil-name="Next Steps"
        data-testid="onboarding-checklist"
        className="w-full max-w-[560px] overflow-hidden rounded-2xl border border-[#17171714] bg-white shadow-[0_4px_4px_#1717170A]"
      >
        <div className="flex items-center justify-between border-b border-[#17171714] bg-[#FAFAFA] px-5 py-3.5">
          <span className="font-ds-ui text-[13px] font-semibold text-[#171717]">
            Get the most out of Saidloop
          </span>
          <span className="font-ds-mono text-[12px] text-[#737373]">
            {doneCount} / {items.length}
          </span>
        </div>
        {items.map((item, index) => (
          <div
            key={item.id}
            data-pencil-name={item.title}
            className={`flex items-center gap-3 px-5 py-3.5 ${
              index > 0 ? "border-t border-[#17171714]" : ""
            }`}
          >
            {item.done ? (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#16A34A] text-[11px] text-white">
                ✓
              </span>
            ) : (
              <span className="h-5 w-5 shrink-0 rounded-full border-[1.5px] border-[#D4D4D4] bg-white" />
            )}
            <span className="min-w-0 flex-1">
              <span
                className={`block font-ds-ui text-[13.5px] font-medium ${
                  item.done ? "text-[#737373]" : "text-[#171717]"
                }`}
              >
                {item.title}
              </span>
              <span className="block font-ds-ui text-xs text-[#A3A3A3]">{item.subtitle}</span>
            </span>
            {!item.done && item.action && (
              <Link
                href={item.action.href}
                className="inline-flex h-7 shrink-0 items-center rounded-md border border-[#1717171F] bg-white px-2.5 font-ds-sans text-[12px] font-medium tracking-[-0.2px] text-[#171717] no-underline shadow-[0_4px_4px_#1717170A] hover:bg-[#FAFAFA]"
              >
                {item.action.label}
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
