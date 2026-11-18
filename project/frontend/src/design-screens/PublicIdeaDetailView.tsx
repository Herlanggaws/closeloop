"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";
import { VoteEmailModal } from "./VoteEmailModal";
import {
  formatIdeaDate,
  PublicBoardFooter,
  PublicBoardHeader,
  type PublicIdea,
  type PublicProject,
  STATUS_DOT,
  STATUS_LABEL,
  TYPE_STYLE,
  VoteCountBox,
  votedStorageKey,
} from "./publicBoardShared";

export function PublicIdeaDetailView({ slug, ideaId }: { slug: string; ideaId: string }) {
  const [project, setProject] = useState<PublicProject | null>(null);
  const [idea, setIdea] = useState<PublicIdea | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [voteOpen, setVoteOpen] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [votedAs, setVotedAs] = useState("");

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

  useEffect(() => {
    try {
      const saved = localStorage.getItem(votedStorageKey(ideaId));
      if (saved) setVotedAs(saved);
    } catch {
      /* ignore */
    }
  }, [ideaId]);

  const typeStyle = TYPE_STYLE[idea?.type || ""] || TYPE_STYLE.idea;
  const createdLabel = idea ? formatIdeaDate(idea.created_at) : "";
  const voteCount = idea?.vote_count ?? 0;

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      <PublicBoardHeader projectName={project?.name || ""} slug={slug} activeTab="ideas" />

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
              ← All ideas
            </Link>
          </div>
        ) : (
          <>
            <Link
              href={`/board/${encodeURIComponent(slug)}`}
              className="font-ds-ui text-[13.5px] text-[#737373] no-underline hover:text-[#171717]"
            >
              ← All ideas
            </Link>

            <article className="rounded-xl border border-[#17171714] bg-white px-6 py-6">
              <div className="flex gap-4">
                <VoteCountBox
                  count={voteCount}
                  voted={Boolean(votedAs)}
                  onClick={votedAs || pendingEmail ? undefined : () => setVoteOpen(true)}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
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
                      <span className="font-ds-ui text-[12px] text-[#A3A3A3]">
                        First on {createdLabel}
                      </span>
                    ) : null}
                  </div>
                  <h1 className="mt-3 font-ds-sans text-2xl font-medium tracking-[-0.4px] text-[#171717]">
                    {idea.title}
                  </h1>
                  {votedAs ? (
                    <p className="mt-4 rounded-lg bg-[#F0FDF4] px-3 py-2 font-ds-ui text-[12.5px] text-[#166534]">
                      You voted as {votedAs}. We&apos;ll email you when this ships.
                    </p>
                  ) : pendingEmail ? (
                    <p className="mt-4 rounded-lg bg-[#EFF6FF] px-3 py-2 font-ds-ui text-[12.5px] text-[#1D4ED8]">
                      Check {pendingEmail} for a confirm link. Your vote counts after you click it.
                    </p>
                  ) : (
                    <p className="mt-4 font-ds-ui text-[13px] text-[#737373]">
                      Tap the vote button and confirm your email so we can tell you when this ships.
                    </p>
                  )}
                </div>
              </div>
            </article>

            <section className="rounded-xl border border-[#17171714] bg-white px-6 py-5">
              <h2 className="font-ds-sans text-[15px] font-semibold text-[#171717]">
                Comments · coming soon
              </h2>
              <p className="mt-1 font-ds-ui text-[13px] text-[#737373]">
                Visitors will be able to discuss ideas after email verification.
              </p>
              <div className="mt-4 flex gap-2">
                <input
                  disabled
                  placeholder="Add a comment — we'll verify your email first"
                  className="h-10 flex-1 cursor-not-allowed rounded-md border border-[#1717171F] bg-[#FAFAFA] px-3 font-ds-ui text-[13px] text-[#A3A3A3]"
                />
                <button
                  type="button"
                  disabled
                  className="inline-flex h-10 cursor-not-allowed items-center rounded-md bg-[#171717] px-4 font-ds-sans text-[13px] font-medium text-white opacity-50"
                >
                  Post
                </button>
              </div>
            </section>
          </>
        )}
      </main>

      <PublicBoardFooter />

      {voteOpen && idea ? (
        <VoteEmailModal
          slug={slug}
          ideaId={idea.id}
          ideaTitle={idea.title}
          onClose={() => setVoteOpen(false)}
          onSubmitted={(email) => {
            setPendingEmail(email);
            setVoteOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
