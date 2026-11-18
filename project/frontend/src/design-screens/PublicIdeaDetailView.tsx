"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";
import {
  formatIdeaDate,
  PublicBoardFooter,
  PublicBoardHeader,
  type PublicIdea,
  type PublicProject,
  STATUS_DOT,
  STATUS_LABEL,
  TYPE_STYLE,
} from "./publicBoardShared";

export function PublicIdeaDetailView({ slug, ideaId }: { slug: string; ideaId: string }) {
  const [project, setProject] = useState<PublicProject | null>(null);
  const [idea, setIdea] = useState<PublicIdea | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(
      `${API_URL}/api/public/boards/${encodeURIComponent(slug)}/ideas/${encodeURIComponent(ideaId)}`,
    )
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body?.error?.message || "Idea not found");
        }
        return body as { project: PublicProject; idea: PublicIdea };
      })
      .then((data) => {
        if (cancelled) return;
        setProject(data.project);
        setIdea(data.idea);
        setError("");
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load idea");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, ideaId]);

  const typeStyle = TYPE_STYLE[idea?.type || ""] || TYPE_STYLE.idea;
  const createdLabel = idea ? formatIdeaDate(idea.created_at) : "";

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      <PublicBoardHeader projectName={project?.name || ""} slug={slug} />

      <main className="mx-auto flex w-full max-w-[880px] flex-col gap-6 px-6 py-10 md:px-12">
        {loading ? (
          <p className="font-ds-ui text-sm text-[#737373]">Loading…</p>
        ) : error || !idea ? (
          <div className="rounded-xl border border-[#17171714] bg-white p-8 text-center">
            <h1 className="font-ds-sans text-xl font-medium text-[#171717]">Idea not found</h1>
            <p className="mt-2 font-ds-ui text-sm text-[#737373]">{error || "This idea is not public."}</p>
            <Link
              href={`/board/${encodeURIComponent(slug)}`}
              className="mt-4 inline-block font-ds-ui text-sm text-[#266DF0] no-underline hover:underline"
            >
              Back to ideas
            </Link>
          </div>
        ) : (
          <>
            <Link
              href={`/board/${encodeURIComponent(slug)}`}
              className="font-ds-ui text-[13.5px] text-[#737373] no-underline hover:text-[#171717]"
            >
              ← Back to ideas
            </Link>

            <article className="rounded-xl border border-[#17171714] bg-white px-6 py-6">
              <h1 className="font-ds-sans text-2xl font-medium tracking-[-0.4px] text-[#171717]">
                {idea.title}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
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
                {createdLabel ? (
                  <span className="font-ds-ui text-[12px] text-[#A3A3A3]">{createdLabel}</span>
                ) : null}
              </div>
              <p className="mt-6 font-ds-ui text-[13.5px] text-[#737373]">
                Voting and comments are coming soon.
              </p>
            </article>
          </>
        )}
      </main>

      <PublicBoardFooter />
    </div>
  );
}
