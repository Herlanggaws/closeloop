"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { api } from "@/lib/api";
import type { MeResponse } from "@/lib/usage";
import { TYPE_STYLE } from "./publicBoardShared";

type Ticket = {
  id: string;
  type: string;
  status: string;
  title: string;
  is_public: boolean;
  created_at: string;
};

type Project = {
  id: string;
  name: string;
  board_slug: string;
};

type BoardComment = {
  id: string;
  ticket_id: string;
  idea_title: string;
  email: string;
  display_name: string;
  body: string;
  is_team: boolean;
  status: "pending" | "visible" | "hidden";
  created_at: string;
};

const ROADMAP_LABEL: Record<string, string> = {
  open: "Planned",
  in_progress: "In progress",
  fixed: "Released",
  wont_fix: "Won't fix",
  duplicate: "Duplicate",
};

const ROADMAP_DOT: Record<string, string> = {
  open: "#266DF0",
  in_progress: "#EA6C0C",
  fixed: "#16A34A",
  wont_fix: "#A3A3A3",
  duplicate: "#A3A3A3",
};

const ROADMAP_COLUMNS: { status: "open" | "in_progress" | "fixed"; label: string }[] = [
  { status: "open", label: "Planned" },
  { status: "in_progress", label: "In progress" },
  { status: "fixed", label: "Released" },
];

const ROADMAP_STATUSES = new Set(ROADMAP_COLUMNS.map((c) => c.status));

export function ManagePublicBoard() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [slugDraft, setSlugDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingSlug, setSavingSlug] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"ideas" | "roadmap" | "comments">("ideas");
  const [boardComments, setBoardComments] = useState<BoardComment[]>([]);
  const [pendingComments, setPendingComments] = useState(0);
  const [commentFilter, setCommentFilter] = useState<"all" | "pending" | "visible" | "hidden">(
    "all",
  );
  const [moderating, setModerating] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

  async function loadBoardComments(projectId: string, status: string) {
    const res = await api<{ comments: BoardComment[]; pending_count: number }>(
      `/api/projects/${projectId}/board-comments?status=${encodeURIComponent(status)}`,
    );
    setBoardComments(res.comments || []);
    setPendingComments(res.pending_count || 0);
  }

  useEffect(() => {
    const id = localStorage.getItem("closeloop_project");
    if (!id) {
      router.replace("/app/onboarding");
      return;
    }
    let cancelled = false;
    Promise.all([
      api<MeResponse>("/api/me"),
      api<{ project: Project }>(`/api/projects/${id}`),
      api<{ tickets: Ticket[] }>(`/api/projects/${id}/tickets`),
      api<{ comments: BoardComment[]; pending_count: number }>(
        `/api/projects/${id}/board-comments?status=all`,
      ),
    ])
      .then(([meRes, projectRes, ticketsRes, commentsRes]) => {
        if (cancelled) return;
        setMe(meRes);
        setProject(projectRes.project);
        setSlugDraft(projectRes.project.board_slug || "");
        setTickets(ticketsRes.tickets || []);
        setBoardComments(commentsRes.comments || []);
        setPendingComments(commentsRes.pending_count || 0);
        setError("");
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!project || activeTab !== "comments") return;
    let cancelled = false;
    loadBoardComments(project.id, commentFilter)
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load comments");
      });
    return () => {
      cancelled = true;
    };
  }, [project, activeTab, commentFilter]);

  async function setCommentHidden(comment: BoardComment, hidden: boolean) {
    if (!project) return;
    setModerating(comment.id);
    setError("");
    try {
      await api(`/api/comments/${comment.id}`, {
        method: "PATCH",
        body: JSON.stringify({ hidden }),
      });
      await loadBoardComments(project.id, commentFilter);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update comment");
    } finally {
      setModerating(null);
    }
  }

  async function saveSlug() {
    if (!project) return;
    setSavingSlug(true);
    setError("");
    try {
      const res = await api<{ project: Project }>(`/api/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({ board_slug: slugDraft.trim() }),
      });
      setProject(res.project);
      setSlugDraft(res.project.board_slug);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save slug");
    } finally {
      setSavingSlug(false);
    }
  }

  async function togglePublic(ticket: Ticket) {
    setToggling(ticket.id);
    setError("");
    try {
      const res = await api<{ ticket: Ticket }>(`/api/tickets/${ticket.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_public: !ticket.is_public }),
      });
      setTickets((prev) =>
        prev.map((t) => (t.id === ticket.id ? { ...t, is_public: res.ticket.is_public } : t)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update publish");
    } finally {
      setToggling(null);
    }
  }

  async function copyLink() {
    if (!project?.board_slug) return;
    const url = `${window.location.origin}/board/${project.board_slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Could not copy link");
    }
  }

  async function moveRoadmapTicket(ticketId: string, nextStatus: string) {
    const current = tickets.find((t) => t.id === ticketId);
    if (!current || current.status === nextStatus) return;
    const previousStatus = current.status;
    setMovingId(ticketId);
    setError("");
    setTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, status: nextStatus } : t)),
    );
    try {
      const res = await api<{ ticket: Ticket }>(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      setTickets((prev) =>
        prev.map((t) =>
          t.id === ticketId
            ? { ...t, status: res.ticket.status, is_public: res.ticket.is_public }
            : t,
        ),
      );
    } catch (err) {
      setTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, status: previousStatus } : t)),
      );
      setError(err instanceof Error ? err.message : "Could not move idea");
    } finally {
      setMovingId(null);
    }
  }

  const plan = me?.org.plan || "free";
  const email = me?.user.email || "";
  const publicPath = project?.board_slug ? `/board/${project.board_slug}` : "";
  const ideaCount = tickets.filter((t) => t.status !== "duplicate").length;
  const roadmapByStatus = useMemo(() => {
    const map: Record<string, Ticket[]> = { open: [], in_progress: [], fixed: [] };
    for (const ticket of tickets) {
      if (!ticket.is_public || !ROADMAP_STATUSES.has(ticket.status as "open" | "in_progress" | "fixed")) {
        continue;
      }
      map[ticket.status].push(ticket);
    }
    return map;
  }, [tickets]);

  return (
    <div className="box-border flex min-h-screen w-full bg-white">
      <AppSidebar
        projectName={project?.name || "Project"}
        plan={plan}
        email={email}
        usage={me?.usage}
        userName={me?.user?.name}
        avatarUrl={me?.user?.avatar_url}
        active="board"
        showUsageCard
      />
      <main className="flex min-h-screen min-w-0 flex-1 flex-col overflow-y-auto bg-white">
        <header className="flex shrink-0 flex-wrap items-end justify-between gap-4 border-b border-[#17171714] px-10 pb-6 pt-7">
          <div className="flex max-w-[720px] flex-col gap-1">
            <h1 className="font-ds-sans text-2xl font-medium tracking-[-0.4px] text-[#171717]">
              Public board
            </h1>
            <p className="font-ds-ui text-[13.5px] text-[#737373]">
              {project?.board_slug
                ? `/board/${project.board_slug} · choose what visitors can see`
                : "Choose a slug and publish tickets visitors can read."}
            </p>
          </div>
          {publicPath ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void copyLink()}
                className="cursor-pointer font-ds-ui text-xs text-[#737373] hover:text-[#171717]"
              >
                {copied ? "Copied" : "Copy link"}
              </button>
              <Link
                href={publicPath}
                target="_blank"
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#1717171F] bg-white px-3 font-ds-sans text-[13px] font-medium text-[#171717] no-underline hover:bg-[#FAFAFA]"
              >
                View board
                <span aria-hidden>↗</span>
              </Link>
            </div>
          ) : null}
        </header>

        <div className="flex flex-1 flex-col gap-6 px-10 pb-10 pt-6">
          {loading ? (
            <p className="font-ds-ui text-sm text-[#737373]">Loading…</p>
          ) : (
            <>
              {error && <p className="font-ds-ui text-sm text-[#DA314A]">{error}</p>}

              <section className="max-w-[880px] rounded-xl border border-[#17171714] bg-[#FAFAFA] p-5">
                <h2 className="font-ds-sans text-[15px] font-semibold text-[#171717]">
                  Board URL
                </h2>
                <p className="mt-1 font-ds-ui text-[12.5px] text-[#737373]">
                  Lowercase letters, numbers, and hyphens. 3–48 characters.
                </p>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                  <label className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="font-ds-ui text-xs font-medium text-[#171717]">Slug</span>
                    <input
                      value={slugDraft}
                      onChange={(e) => setSlugDraft(e.target.value.toLowerCase())}
                      className="h-9 rounded-md border border-[#1717171F] bg-white px-3 font-ds-mono text-[13px] outline-none focus:border-[#171717]"
                      placeholder="bear-budget"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={savingSlug || !slugDraft.trim() || slugDraft === project?.board_slug}
                    onClick={() => void saveSlug()}
                    className="inline-flex h-9 cursor-pointer items-center rounded-md bg-[#171717] px-3 font-ds-sans text-[13px] font-medium text-white disabled:opacity-50"
                  >
                    {savingSlug ? "Saving…" : "Save slug"}
                  </button>
                </div>
              </section>

              <div className="flex items-center gap-1 border-b border-[#17171714]">
                {(
                  [
                    ["ideas", `Ideas${ideaCount ? ` · ${ideaCount}` : ""}`],
                    ["roadmap", "Roadmap"],
                    [
                      "comments",
                      pendingComments > 0
                        ? `Comments · ${pendingComments} pending`
                        : "Comments",
                    ],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveTab(id)}
                    className={`-mb-px cursor-pointer border-b-2 px-3 py-2 font-ds-ui text-[13.5px] ${
                      activeTab === id
                        ? "border-[#F59E0B] font-medium text-[#171717]"
                        : "border-transparent text-[#737373] hover:text-[#171717]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {activeTab === "ideas" ? (
                <section className="max-w-[880px]">
                  <div className="overflow-hidden rounded-xl border border-[#17171714]">
                    <div className="grid grid-cols-[1fr_72px_120px_100px] gap-3 border-b border-[#17171714] bg-[#FAFAFA] px-4 py-2.5">
                      <span className="font-ds-ui text-[11px] font-medium uppercase tracking-wide text-[#A3A3A3]">
                        Idea
                      </span>
                      <span className="font-ds-ui text-[11px] font-medium uppercase tracking-wide text-[#A3A3A3]">
                        Votes
                      </span>
                      <span className="font-ds-ui text-[11px] font-medium uppercase tracking-wide text-[#A3A3A3]">
                        Roadmap
                      </span>
                      <span className="font-ds-ui text-[11px] font-medium uppercase tracking-wide text-[#A3A3A3]">
                        Public
                      </span>
                    </div>
                    {tickets.length === 0 ? (
                      <p className="px-4 py-8 font-ds-ui text-sm text-[#737373]">No tickets yet.</p>
                    ) : (
                      tickets.map((ticket) => (
                        <div
                          key={ticket.id}
                          className="grid grid-cols-[1fr_72px_120px_100px] items-center gap-3 border-b border-[#17171714] px-4 py-3 last:border-b-0"
                        >
                          <div className="min-w-0">
                            <div className="truncate font-ds-ui text-[13.5px] font-medium text-[#171717]">
                              {ticket.title}
                            </div>
                            <div className="mt-0.5 font-ds-ui text-[11px] capitalize text-[#A3A3A3]">
                              {ticket.type}
                            </div>
                          </div>
                          <span className="font-ds-ui text-[13px] text-[#A3A3A3]" title="Voting coming soon">
                            —
                          </span>
                          <span className="inline-flex items-center gap-1.5 font-ds-ui text-[12px] text-[#737373]">
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ background: ROADMAP_DOT[ticket.status] || "#A3A3A3" }}
                            />
                            {ROADMAP_LABEL[ticket.status] || ticket.status}
                          </span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={ticket.is_public}
                            disabled={toggling === ticket.id}
                            onClick={() => void togglePublic(ticket)}
                            className={`relative inline-flex h-6 w-11 cursor-pointer items-center rounded-full transition-colors disabled:opacity-50 ${
                              ticket.is_public ? "bg-[#16A34A]" : "bg-[#E5E5E5]"
                            }`}
                            title={ticket.is_public ? "Public" : "Not public"}
                          >
                            <span
                              className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                                ticket.is_public ? "translate-x-[22px]" : "translate-x-0.5"
                              }`}
                            />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                  <p className="mt-4 rounded-lg border border-[#266DF01F] bg-[#EFF6FF] px-4 py-3 font-ds-ui text-[12.5px] text-[#3B5BDB]">
                    Bugs and reports with personal data stay private unless you turn them public.
                    Screenshots and reporter details are never shown on the board.
                  </p>
                </section>
              ) : activeTab === "roadmap" ? (
                <section className="max-w-[1100px]">
                  <p className="mb-4 font-ds-ui text-[13px] text-[#737373]">
                    Drag public ideas between columns. Moving to Released marks the ticket fixed
                    and notifies reporters and voters.
                  </p>
                  <div className="grid gap-4 md:grid-cols-3">
                    {ROADMAP_COLUMNS.map((col) => {
                      const columnTickets = roadmapByStatus[col.status] || [];
                      const isActiveDrop = dropTarget === col.status;
                      return (
                        <div
                          key={col.status}
                          data-roadmap-column={col.status}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "move";
                            if (dropTarget !== col.status) setDropTarget(col.status);
                          }}
                          onDragLeave={() => {
                            if (dropTarget === col.status) setDropTarget(null);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            setDropTarget(null);
                            const ticketId = e.dataTransfer.getData("text/ticket-id");
                            if (!ticketId) return;
                            void moveRoadmapTicket(ticketId, col.status);
                          }}
                          className={`flex min-h-[280px] flex-col rounded-xl border bg-white p-4 transition-colors ${
                            isActiveDrop
                              ? "border-[#F59E0B] bg-[#FFFBEB]"
                              : "border-[#17171714]"
                          }`}
                        >
                          <h2 className="font-ds-sans text-[14px] font-semibold text-[#171717]">
                            {col.label}
                            <span className="ml-2 font-ds-ui text-[12px] font-normal text-[#A3A3A3]">
                              {columnTickets.length}
                            </span>
                          </h2>
                          <div className="mt-3 flex flex-1 flex-col gap-2">
                            {columnTickets.length === 0 ? (
                              <p className="font-ds-ui text-[12.5px] text-[#A3A3A3]">
                                Drop ideas here
                              </p>
                            ) : (
                              columnTickets.map((ticket) => {
                                const typeStyle = TYPE_STYLE[ticket.type] || TYPE_STYLE.idea;
                                const busy = movingId === ticket.id;
                                return (
                                  <div
                                    key={ticket.id}
                                    draggable={!busy}
                                    data-roadmap-card={ticket.id}
                                    onDragStart={(e) => {
                                      e.dataTransfer.setData("text/ticket-id", ticket.id);
                                      e.dataTransfer.effectAllowed = "move";
                                      setDraggingId(ticket.id);
                                    }}
                                    onDragEnd={() => {
                                      setDraggingId(null);
                                      setDropTarget(null);
                                    }}
                                    className={`rounded-lg border border-[#17171714] px-3 py-2.5 ${
                                      busy
                                        ? "cursor-wait opacity-60"
                                        : "cursor-grab active:cursor-grabbing"
                                    } ${draggingId === ticket.id ? "opacity-50" : ""}`}
                                  >
                                    <div className="font-ds-sans text-[13.5px] font-medium text-[#171717]">
                                      {ticket.title}
                                    </div>
                                    <div className="mt-1.5 flex items-center gap-2">
                                      <span
                                        className="inline-flex rounded-md px-1.5 py-0.5 font-ds-ui text-[10px] font-medium"
                                        style={{
                                          background: typeStyle.bg,
                                          color: typeStyle.text,
                                        }}
                                      >
                                        {typeStyle.label}
                                      </span>
                                      <span className="font-ds-ui text-[11px] text-[#A3A3A3]">
                                        —
                                      </span>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ) : (
                <section className="max-w-[880px]">
                  <div className="mb-4 flex flex-wrap gap-2">
                    {(
                      [
                        ["all", "All"],
                        ["pending", "Pending"],
                        ["visible", "Visible"],
                        ["hidden", "Hidden"],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setCommentFilter(id)}
                        className={`inline-flex h-8 cursor-pointer items-center rounded-full border px-3 font-ds-ui text-[12.5px] ${
                          commentFilter === id
                            ? "border-[#171717] bg-[#171717] text-white"
                            : "border-[#1717171F] bg-white text-[#737373] hover:text-[#171717]"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="overflow-hidden rounded-xl border border-[#17171714]">
                    <div className="grid grid-cols-[1fr_140px_90px_100px] gap-3 border-b border-[#17171714] bg-[#FAFAFA] px-4 py-2.5">
                      <span className="font-ds-ui text-[11px] font-medium uppercase tracking-wide text-[#A3A3A3]">
                        Comment
                      </span>
                      <span className="font-ds-ui text-[11px] font-medium uppercase tracking-wide text-[#A3A3A3]">
                        Author
                      </span>
                      <span className="font-ds-ui text-[11px] font-medium uppercase tracking-wide text-[#A3A3A3]">
                        Status
                      </span>
                      <span className="font-ds-ui text-[11px] font-medium uppercase tracking-wide text-[#A3A3A3]">
                        Action
                      </span>
                    </div>
                    {boardComments.length === 0 ? (
                      <p className="px-4 py-8 font-ds-ui text-sm text-[#737373]">
                        No comments in this filter.
                      </p>
                    ) : (
                      boardComments.map((comment) => (
                        <div
                          key={comment.id}
                          className="grid grid-cols-[1fr_140px_90px_100px] items-center gap-3 border-b border-[#17171714] px-4 py-3 last:border-b-0"
                        >
                          <div className="min-w-0">
                            <div className="truncate font-ds-ui text-[13px] font-medium text-[#171717]">
                              {comment.idea_title}
                            </div>
                            <div className="mt-0.5 line-clamp-2 font-ds-ui text-[12.5px] text-[#737373]">
                              {comment.body}
                            </div>
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-ds-ui text-[12.5px] text-[#171717]">
                              {comment.display_name}
                              {comment.is_team ? " · Team" : ""}
                            </div>
                            <div className="truncate font-ds-ui text-[11px] text-[#A3A3A3]">
                              {comment.email}
                            </div>
                          </div>
                          <span className="font-ds-ui text-[12px] capitalize text-[#737373]">
                            {comment.status}
                          </span>
                          <div>
                            {comment.status === "pending" ? (
                              <span className="font-ds-ui text-[12px] text-[#A3A3A3]">Awaiting email</span>
                            ) : comment.status === "hidden" ? (
                              <button
                                type="button"
                                disabled={moderating === comment.id}
                                onClick={() => void setCommentHidden(comment, false)}
                                className="cursor-pointer border-0 bg-transparent p-0 font-ds-ui text-[12.5px] font-medium text-[#266DF0] disabled:opacity-50"
                              >
                                Unhide
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={moderating === comment.id}
                                onClick={() => void setCommentHidden(comment, true)}
                                className="cursor-pointer border-0 bg-transparent p-0 font-ds-ui text-[12.5px] font-medium text-[#DA314A] disabled:opacity-50"
                              >
                                Hide
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
