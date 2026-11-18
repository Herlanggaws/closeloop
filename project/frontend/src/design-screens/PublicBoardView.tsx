"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";
import {
  PublicBoardFooter,
  PublicBoardHeader,
  type PublicIdea,
  type PublicProject,
  STATUS_DOT,
  STATUS_LABEL,
  TYPE_STYLE,
} from "./publicBoardShared";

export function PublicBoardView({ slug }: { slug: string }) {
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

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      <PublicBoardHeader projectName={project?.name || ""} slug={slug} />

      <main className="mx-auto flex w-full max-w-[880px] flex-col gap-6 px-6 py-10 md:px-12">
        {loading ? (
          <p className="font-ds-ui text-sm text-[#737373]">Loading…</p>
        ) : error ? (
          <div className="rounded-xl border border-[#17171714] bg-white p-8 text-center">
            <h1 className="font-ds-sans text-xl font-medium text-[#171717]">Board not found</h1>
            <p className="mt-2 font-ds-ui text-sm text-[#737373]">{error}</p>
          </div>
        ) : (
          <>
            <div>
              <h1 className="font-ds-sans text-2xl font-medium tracking-[-0.4px] text-[#171717]">
                Ideas
              </h1>
              <p className="mt-1 font-ds-ui text-[13.5px] text-[#737373]">
                Public feedback for {project?.name}. Voting is coming soon.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {ideas.length === 0 ? (
                <div className="rounded-xl border border-[#17171714] bg-white p-8 text-center">
                  <p className="font-ds-ui text-sm text-[#737373]">
                    No published ideas yet.
                  </p>
                </div>
              ) : (
                ideas.map((idea) => {
                  const typeStyle = TYPE_STYLE[idea.type] || TYPE_STYLE.idea;
                  return (
                    <article
                      key={idea.id}
                      className="rounded-xl border border-[#17171714] bg-white transition-colors hover:border-[#17171733]"
                    >
                      <Link
                        href={`/board/${encodeURIComponent(slug)}/ideas/${encodeURIComponent(idea.id)}`}
                        aria-label={idea.title}
                        className="block px-5 py-4 no-underline"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
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
                        </div>
                      </Link>
                    </article>
                  );
                })
              )}
            </div>
          </>
        )}
      </main>

      <PublicBoardFooter />
    </div>
  );
}
