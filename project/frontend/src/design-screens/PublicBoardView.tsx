"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { API_URL } from "@/lib/api";
import {
  PublicBoardFooter,
  PublicBoardHeader,
  type PublicIdea,
  type PublicProject,
  STATUS_DOT,
  STATUS_LABEL,
  TYPE_STYLE,
  VoteCountBox,
} from "./publicBoardShared";

type FilterKey = "all" | "open" | "in_progress" | "fixed";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All ideas" },
  { key: "open", label: "Planned" },
  { key: "in_progress", label: "In progress" },
  { key: "fixed", label: "Released" },
];

export function PublicBoardView({ slug }: { slug: string }) {
  const [project, setProject] = useState<PublicProject | null>(null);
  const [ideas, setIdeas] = useState<PublicIdea[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/api/public/boards/${encodeURIComponent(slug)}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body?.error?.message || "Board not found");
        }
        return body as { project: PublicProject; ideas: PublicIdea[] };
      })
      .then((data) => {
        if (cancelled) return;
        setProject(data.project);
        setIdeas(data.ideas || []);
        setError("");
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load board");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const counts = useMemo(() => {
    const base = { all: ideas.length, open: 0, in_progress: 0, fixed: 0 };
    for (const idea of ideas) {
      if (idea.status === "open") base.open += 1;
      else if (idea.status === "in_progress") base.in_progress += 1;
      else if (idea.status === "fixed") base.fixed += 1;
    }
    return base;
  }, [ideas]);

  const visible = filter === "all" ? ideas : ideas.filter((i) => i.status === filter);

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      <PublicBoardHeader projectName={project?.name || ""} slug={slug} activeTab="ideas" />

      <main className="mx-auto flex w-full max-w-[1100px] flex-col gap-8 px-6 py-10 md:flex-row md:px-12">
        {loading ? (
          <p className="font-ds-ui text-sm text-[#737373]">Loading…</p>
        ) : error ? (
          <div className="w-full rounded-xl border border-[#17171714] bg-white p-8 text-center">
            <h1 className="font-ds-sans text-xl font-medium text-[#171717]">Board not found</h1>
            <p className="mt-2 font-ds-ui text-sm text-[#737373]">{error}</p>
          </div>
        ) : (
          <>
            <div className="min-w-0 flex-1 flex-col gap-6">
              <div>
                <h1 className="font-ds-sans text-2xl font-medium tracking-[-0.4px] text-[#171717]">
                  Help shape {project?.name}
                </h1>
                <p className="mt-1 font-ds-ui text-[13.5px] text-[#737373]">
                  Vote for what you want next. We&apos;ll email you when it ships.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                {visible.length === 0 ? (
                  <div className="rounded-xl border border-[#17171714] bg-white p-8 text-center">
                    <p className="font-ds-ui text-sm text-[#737373]">No published ideas yet.</p>
                  </div>
                ) : (
                  visible.map((idea) => {
                    const typeStyle = TYPE_STYLE[idea.type] || TYPE_STYLE.idea;
                    return (
                      <article
                        key={idea.id}
                        className="rounded-xl border border-[#17171714] bg-white transition-colors hover:border-[#17171733]"
                      >
                        <Link
                          href={`/board/${encodeURIComponent(slug)}/ideas/${encodeURIComponent(idea.id)}`}
                          aria-label={idea.title}
                          className="flex gap-4 px-5 py-4 no-underline"
                        >
                          <VoteCountBox count={idea.vote_count ?? 0} />
                          <div className="min-w-0 flex-1">
                            <h2 className="font-ds-sans text-[16px] font-semibold text-[#171717]">
                              {idea.title}
                            </h2>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span
                                className="inline-flex rounded-md px-2 py-0.5 font-ds-ui text-[11px] font-medium"
                                style={{ background: typeStyle.bg, color: typeStyle.text }}
                              >
                                {typeStyle.label}
                              </span>
                              <span className="inline-flex items-center gap-1.5 font-ds-ui text-[12px] text-[#737373]">
                                <span
                                  className="h-1.5 w-1.5 rounded-full"
                                  style={{ background: STATUS_DOT[idea.status] || "#A3A3A3" }}
                                />
                                {STATUS_LABEL[idea.status] || idea.status}
                              </span>
                            </div>
                          </div>
                        </Link>
                      </article>
                    );
                  })
                )}
              </div>
            </div>

            <aside className="w-full shrink-0 md:w-[220px]">
              <div className="rounded-xl border border-[#17171714] bg-white p-4">
                <div className="font-ds-sans text-[14px] font-semibold text-[#171717]">
                  {counts.all} {counts.all === 1 ? "idea" : "ideas"}
                </div>
                <ul className="mt-3 flex flex-col gap-1">
                  {FILTERS.map((f) => (
                    <li key={f.key}>
                      <button
                        type="button"
                        onClick={() => setFilter(f.key)}
                        className={`flex w-full cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-left font-ds-ui text-[13px] ${
                          filter === f.key
                            ? "bg-[#F5F5F5] font-medium text-[#171717]"
                            : "text-[#737373] hover:bg-[#FAFAFA]"
                        }`}
                      >
                        <span className="inline-flex items-center gap-2">
                          {f.key !== "all" ? (
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ background: STATUS_DOT[f.key] || "#A3A3A3" }}
                            />
                          ) : null}
                          {f.label}
                        </span>
                        <span className="text-[#A3A3A3]">{counts[f.key]}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          </>
        )}
      </main>

      <PublicBoardFooter />
    </div>
  );
}
