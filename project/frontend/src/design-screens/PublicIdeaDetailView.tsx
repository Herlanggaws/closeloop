"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { API_URL } from "@/lib/api";
import { CommentEmailModal } from "./CommentEmailModal";
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

type PublicComment = {
  id: string;
  display_name: string;
  initial: string;
  body: string;
  is_team: boolean;
  created_at: string;
  replies?: PublicComment[];
};

const AVATAR_COLORS = ["#171717", "#7C3AED", "#0EA5E9", "#EA6C0C", "#16A34A"];

function avatarColor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash + seed.charCodeAt(i) * (i + 1)) % 997;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function relativeTime(iso: string) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffSec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (diffSec < 60) return "just now";
  const mins = Math.round(diffSec / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

function CommentCard({
  comment,
  nested,
  onReply,
}: {
  comment: PublicComment;
  nested?: boolean;
  onReply?: () => void;
}) {
  return (
    <div
      className={`flex gap-3 rounded-xl border p-4 ${
        comment.is_team
          ? "border-[#1717171F] bg-[#FAFAFA]"
          : "border-[#17171714] bg-white"
      } ${nested ? "ml-8" : ""}`}
    >
      <div
        className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full font-ds-sans text-[12px] font-semibold text-white"
        style={{ background: comment.is_team ? "#171717" : avatarColor(comment.id) }}
      >
        {comment.initial || "?"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-ds-ui text-[13.5px] font-semibold text-[#171717]">
            {comment.display_name}
          </span>
          {comment.is_team ? (
            <span className="rounded bg-[#171717] px-1.5 py-0.5 font-ds-ui text-[10.5px] font-medium text-white">
              Team
            </span>
          ) : null}
          <span className="font-ds-ui text-[12px] text-[#A3A3A3]">
            {relativeTime(comment.created_at)}
          </span>
        </div>
        <p className="mt-1 whitespace-pre-wrap font-ds-ui text-[14px] leading-[21px] text-[#737373]">
          {comment.body}
        </p>
        {onReply ? (
          <button
            type="button"
            onClick={onReply}
            className="mt-2 cursor-pointer border-0 bg-transparent p-0 font-ds-ui text-[12px] font-medium text-[#266DF0] hover:underline"
          >
            Reply
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function PublicIdeaDetailView({ slug, ideaId }: { slug: string; ideaId: string }) {
  const [project, setProject] = useState<PublicProject | null>(null);
  const [idea, setIdea] = useState<PublicIdea | null>(null);
  const [comments, setComments] = useState<PublicComment[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [voteOpen, setVoteOpen] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [votedAs, setVotedAs] = useState("");
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<PublicComment | null>(null);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentPending, setCommentPending] = useState("");

  const loadComments = useCallback(() => {
    return fetch(
      `${API_URL}/api/public/boards/${encodeURIComponent(slug)}/ideas/${encodeURIComponent(ideaId)}/comments`,
    )
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body?.error?.message || "Could not load comments");
        }
        return (body.comments || []) as PublicComment[];
      })
      .then((list) => setComments(list));
  }, [slug, ideaId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch(
        `${API_URL}/api/public/boards/${encodeURIComponent(slug)}/ideas/${encodeURIComponent(ideaId)}`,
      ).then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body?.error?.message || "Idea not found");
        }
        return body as { project: PublicProject; idea: PublicIdea };
      }),
      fetch(
        `${API_URL}/api/public/boards/${encodeURIComponent(slug)}/ideas/${encodeURIComponent(ideaId)}/comments`,
      ).then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body?.error?.message || "Could not load comments");
        }
        return (body.comments || []) as PublicComment[];
      }),
    ])
      .then(([data, list]) => {
        if (cancelled) return;
        setProject(data.project);
        setIdea(data.idea);
        setComments(list);
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
  const commentCount =
    comments.reduce((n, c) => n + 1 + (c.replies?.length || 0), 0);

  function openComposer(parent?: PublicComment) {
    setReplyTo(parent || null);
    if (!draft.trim()) return;
    setCommentModalOpen(true);
  }

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
                  {idea.description ? (
                    <p className="mt-3 whitespace-pre-wrap font-ds-ui text-[14px] leading-[21px] text-[#737373]">
                      {idea.description}
                    </p>
                  ) : null}
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

            <section className="flex flex-col gap-3">
              <h2 className="font-ds-sans text-[16px] font-semibold text-[#171717]">
                Comments · {commentCount}
              </h2>

              {comments.length === 0 ? (
                <p className="font-ds-ui text-[13px] text-[#737373]">
                  No comments yet. Be the first — we&apos;ll verify your email.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {comments.map((comment) => (
                    <div key={comment.id} className="flex flex-col gap-3">
                      <CommentCard
                        comment={comment}
                        onReply={() => {
                          setReplyTo(comment);
                          setDraft("");
                        }}
                      />
                      {(comment.replies || []).map((reply) => (
                        <CommentCard key={reply.id} comment={reply} nested />
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {commentPending ? (
                <p className="rounded-lg bg-[#EFF6FF] px-3 py-2 font-ds-ui text-[12.5px] text-[#1D4ED8]">
                  Check {commentPending} for a confirm link. Your comment appears after you click it.
                </p>
              ) : null}

              {replyTo ? (
                <p className="font-ds-ui text-[12.5px] text-[#737373]">
                  Replying to {replyTo.display_name}.{" "}
                  <button
                    type="button"
                    className="cursor-pointer border-0 bg-transparent p-0 font-medium text-[#266DF0] hover:underline"
                    onClick={() => setReplyTo(null)}
                  >
                    Cancel
                  </button>
                </p>
              ) : null}

              <div className="flex items-center gap-2 rounded-xl border border-[#1717171F] bg-white p-2">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Add a comment — we'll verify your email first"
                  aria-label="Comment"
                  className="h-[34px] flex-1 border-0 bg-transparent px-2 font-ds-ui text-[13.5px] outline-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      openComposer(replyTo || undefined);
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={!draft.trim()}
                  onClick={() => openComposer(replyTo || undefined)}
                  className="inline-flex h-[34px] cursor-pointer items-center rounded-md bg-[#171717] px-4 font-ds-sans text-[13px] font-medium text-white disabled:opacity-50"
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

      {commentModalOpen && idea ? (
        <CommentEmailModal
          slug={slug}
          ideaId={idea.id}
          ideaTitle={idea.title}
          body={draft.trim()}
          parentId={replyTo?.id}
          onClose={() => setCommentModalOpen(false)}
          onSubmitted={(email) => {
            setCommentPending(email);
            setDraft("");
            setReplyTo(null);
            setCommentModalOpen(false);
            void loadComments().catch(() => undefined);
          }}
        />
      ) : null}
    </div>
  );
}
