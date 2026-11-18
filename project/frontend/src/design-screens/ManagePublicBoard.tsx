"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { api } from "@/lib/api";
import type { MeResponse } from "@/lib/usage";

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

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  fixed: "Fixed",
  wont_fix: "Won't fix",
  duplicate: "Duplicate",
};

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
    ])
      .then(([meRes, projectRes, ticketsRes]) => {
        if (cancelled) return;
        setMe(meRes);
        setProject(projectRes.project);
        setSlugDraft(projectRes.project.board_slug || "");
        setTickets(ticketsRes.tickets || []);
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

  const plan = me?.org.plan || "free";
  const email = me?.user.email || "";
  const publicPath = project?.board_slug ? `/board/${project.board_slug}` : "";

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
        <header className="flex shrink-0 items-end border-b border-[#17171714] px-10 pb-6 pt-7">
          <div className="flex max-w-[720px] flex-col gap-1">
            <h1 className="font-ds-sans text-2xl font-medium tracking-[-0.4px] text-[#171717]">
              Public board
            </h1>
            <p className="font-ds-ui text-[13.5px] text-[#737373]">
              Choose a slug and publish tickets visitors can read. Votes come later.
            </p>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-8 px-10 pb-10 pt-6">
          {loading ? (
            <p className="font-ds-ui text-sm text-[#737373]">Loading…</p>
          ) : (
            <>
              {error && <p className="font-ds-ui text-sm text-[#DA314A]">{error}</p>}

              <section className="max-w-[720px] rounded-xl border border-[#17171714] bg-[#FAFAFA] p-5">
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
                {publicPath && (
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <a
                      href={publicPath}
                      target="_blank"
                      rel="noreferrer"
                      className="font-ds-mono text-[13px] text-[#266DF0] no-underline hover:underline"
                    >
                      {publicPath}
                    </a>
                    <button
                      type="button"
                      onClick={() => void copyLink()}
                      className="cursor-pointer font-ds-ui text-xs text-[#737373] hover:text-[#171717]"
                    >
                      {copied ? "Copied" : "Copy link"}
                    </button>
                  </div>
                )}
              </section>

              <section className="max-w-[720px]">
                <h2 className="font-ds-sans text-[15px] font-semibold text-[#171717]">
                  Publish tickets
                </h2>
                <p className="mt-1 font-ds-ui text-[12.5px] text-[#737373]">
                  Published items appear on the public board. Screenshots and reporter details stay
                  private.
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  {tickets.length === 0 ? (
                    <p className="font-ds-ui text-sm text-[#737373]">No tickets yet.</p>
                  ) : (
                    tickets.map((ticket) => (
                      <div
                        key={ticket.id}
                        className="flex items-center gap-3 rounded-xl border border-[#17171714] bg-white px-4 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-ds-ui text-[13.5px] font-medium text-[#171717]">
                            {ticket.title}
                          </div>
                          <div className="mt-0.5 font-ds-ui text-[11px] text-[#A3A3A3]">
                            {ticket.type} · {STATUS_LABEL[ticket.status] || ticket.status}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={toggling === ticket.id}
                          onClick={() => void togglePublic(ticket)}
                          className={`inline-flex h-8 cursor-pointer items-center rounded-md px-3 font-ds-sans text-[12px] font-medium disabled:opacity-50 ${
                            ticket.is_public
                              ? "border border-[#16A34A33] bg-[#F0FDF4] text-[#16A34A]"
                              : "border border-[#1717171F] bg-white text-[#171717]"
                          }`}
                        >
                          {ticket.is_public ? "Published" : "Publish"}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
