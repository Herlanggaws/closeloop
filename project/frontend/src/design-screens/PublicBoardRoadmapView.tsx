"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { API_URL } from "@/lib/api";
import {
  PublicBoardFooter,
  PublicBoardHeader,
  type PublicIdea,
  type PublicProject,
  TYPE_STYLE,
} from "./publicBoardShared";

const COLUMNS: { status: string; label: string }[] = [
  { status: "open", label: "Planned" },
  { status: "in_progress", label: "In progress" },
  { status: "fixed", label: "Released" },
];

export function PublicBoardRoadmapView({ slug }: { slug: string }) {
  const [project, setProject] = useState<PublicProject | null>(null);
  const [ideas, setIdeas] = useState<PublicIdea[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

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

  const byStatus = useMemo(() => {
    const map: Record<string, PublicIdea[]> = { open: [], in_progress: [], fixed: [] };
    for (const idea of ideas) {
      if (map[idea.status]) map[idea.status].push(idea);
    }
    return map;
  }, [ideas]);

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      <PublicBoardHeader projectName={project?.name || ""} slug={slug} activeTab="roadmap" />

      <main className="mx-auto w-full max-w-[1100px] px-6 py-10 md:px-12">
        {loading ? (
          <p className="font-ds-ui text-sm text-[#737373]">Loading…</p>
        ) : error ? (
          <div className="rounded-xl border border-[#17171714] bg-white p-8 text-center">
            <h1 className="font-ds-sans text-xl font-medium text-[#171717]">Board not found</h1>
            <p className="mt-2 font-ds-ui text-sm text-[#737373]">{error}</p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h1 className="font-ds-sans text-2xl font-medium tracking-[-0.4px] text-[#171717]">
                Roadmap
              </h1>
              <p className="mt-1 font-ds-ui text-[13.5px] text-[#737373]">
                What {project?.name} is planning, building, and shipping.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {COLUMNS.map((col) => (
                <section
                  key={col.status}
                  className="flex min-h-[240px] flex-col rounded-xl border border-[#17171714] bg-white p-4"
                >
                  <h2 className="font-ds-sans text-[14px] font-semibold text-[#171717]">
                    {col.label}
                    <span className="ml-2 font-ds-ui text-[12px] font-normal text-[#A3A3A3]">
                      {byStatus[col.status]?.length || 0}
                    </span>
                  </h2>
                  <div className="mt-3 flex flex-col gap-2">
                    {(byStatus[col.status] || []).length === 0 ? (
                      <p className="font-ds-ui text-[12.5px] text-[#A3A3A3]">Nothing here yet.</p>
                    ) : (
                      (byStatus[col.status] || []).map((idea) => {
                        const typeStyle = TYPE_STYLE[idea.type] || TYPE_STYLE.idea;
                        return (
                          <Link
                            key={idea.id}
                            href={`/board/${encodeURIComponent(slug)}/ideas/${encodeURIComponent(idea.id)}`}
                            aria-label={idea.title}
                            className="rounded-lg border border-[#17171714] px-3 py-2.5 no-underline hover:border-[#17171733]"
                          >
                            <div className="font-ds-sans text-[13.5px] font-medium text-[#171717]">
                              {idea.title}
                            </div>
                            <span
                              className="mt-1.5 inline-flex rounded-md px-1.5 py-0.5 font-ds-ui text-[10px] font-medium"
                              style={{ background: typeStyle.bg, color: typeStyle.text }}
                            >
                              {typeStyle.label}
                            </span>
                          </Link>
                        );
                      })
                    )}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
      </main>

      <PublicBoardFooter project={project} />
    </div>
  );
}
