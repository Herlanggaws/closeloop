"use client";

import Link from "next/link";
import { useState } from "react";
import { SaidloopLogo } from "@/components/SaidloopLogo";
import { SuggestIdeaModal } from "./SuggestIdeaModal";

export type PublicIdea = {
  id: string;
  title: string;
  description?: string;
  type: string;
  status: string;
  vote_count?: number;
  created_at: string;
};

export type PublicProject = {
  name: string;
  board_slug: string;
  /** True on Free boards only: shows the "Powered by Saidloop" footer (D-20). */
  badge?: boolean;
  badge_url?: string;
};

export const STATUS_LABEL: Record<string, string> = {
  open: "Planned",
  in_progress: "In progress",
  fixed: "Released",
  wont_fix: "Won't fix",
};

export const STATUS_DOT: Record<string, string> = {
  open: "#266DF0",
  in_progress: "#EA6C0C",
  fixed: "#16A34A",
  wont_fix: "#A3A3A3",
};

export const TYPE_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  bug: { bg: "#FEF2F2", text: "#DA314A", label: "Bug" },
  idea: { bg: "#FFF7ED", text: "#EA6C0C", label: "Idea" },
  question: { bg: "#EFF6FF", text: "#266DF0", label: "Question" },
};

export function votedStorageKey(ideaId: string) {
  return `saidloop_voted_${ideaId}`;
}

export function PublicBoardHeader({
  projectName,
  slug,
  activeTab = "ideas",
}: {
  projectName: string;
  slug: string;
  activeTab?: "ideas" | "roadmap";
}) {
  const [suggestOpen, setSuggestOpen] = useState(false);
  const initial = (projectName.trim()[0] || "P").toUpperCase();
  const ideasHref = `/board/${encodeURIComponent(slug)}`;
  const roadmapHref = `/board/${encodeURIComponent(slug)}/roadmap`;

  return (
    <>
      <header className="flex flex-wrap items-center gap-4 border-b border-[#17171714] bg-white px-6 py-4 md:gap-8 md:px-12 lg:px-[200px]">
        <Link href={ideasHref} className="flex items-center gap-2 no-underline">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F59E0B]">
            <span className="font-ds-sans text-[15px] font-extrabold text-white">{initial}</span>
          </div>
          <div className="font-ds-sans text-[17px] font-extrabold text-[#3B2F2F]">
            {projectName || "…"}
          </div>
          <div className="font-ds-ui text-[14px] text-[#A3A3A3]">Feedback</div>
        </Link>
        <div className="flex flex-1 items-start gap-1">
          <Link
            href={ideasHref}
            className={`rounded-md px-3 py-1.5 font-ds-ui text-[14px] font-medium no-underline ${
              activeTab === "ideas" ? "bg-[#F5F5F5] text-[#171717]" : "text-[#A3A3A3]"
            }`}
          >
            Ideas
          </Link>
          <Link
            href={roadmapHref}
            className={`rounded-md px-3 py-1.5 font-ds-ui text-[14px] font-medium no-underline ${
              activeTab === "roadmap" ? "bg-[#F5F5F5] text-[#171717]" : "text-[#A3A3A3]"
            }`}
          >
            Roadmap
          </Link>
        </div>
        <button
          type="button"
          onClick={() => setSuggestOpen(true)}
          className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md bg-[#171717] px-4 font-ds-sans text-[13px] font-medium text-white"
        >
          <span aria-hidden>+</span>
          Suggest an idea
        </button>
      </header>
      {suggestOpen ? (
        <SuggestIdeaModal slug={slug} onClose={() => setSuggestOpen(false)} />
      ) : null}
    </>
  );
}

export function PublicBoardFooter({ project }: { project: PublicProject | null }) {
  if (!project?.badge) return null;
  return (
    <footer className="flex items-center justify-center gap-2 pb-10 pt-4">
      <Link href={project.badge_url || "/"} className="inline-flex items-center gap-2 no-underline opacity-70 hover:opacity-100">
        <SaidloopLogo href={null} height={16} />
        <span className="font-ds-ui text-[12px] text-[#737373]">Powered by Saidloop</span>
      </Link>
    </footer>
  );
}

export function formatIdeaDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function VoteCountBox({
  count,
  onClick,
  voted,
}: {
  count: number;
  onClick?: () => void;
  voted?: boolean;
}) {
  const interactive = Boolean(onClick);
  const className = `flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg border ${
    voted
      ? "border-[#16A34A33] bg-[#F0FDF4]"
      : "border-[#17171714] bg-[#FAFAFA]"
  } ${interactive ? "cursor-pointer hover:border-[#17171733]" : ""}`;

  const inner = (
    <>
      <span className={`font-ds-ui text-[11px] ${voted ? "text-[#16A34A]" : "text-[#A3A3A3]"}`}>
        ▲
      </span>
      <span
        className={`font-ds-ui text-[12px] font-medium ${
          voted ? "text-[#16A34A]" : "text-[#171717]"
        }`}
      >
        {count}
      </span>
    </>
  );

  if (!interactive) {
    return <div className={className}>{inner}</div>;
  }
  return (
    <button type="button" onClick={onClick} className={className} aria-label="Vote for this idea">
      {inner}
    </button>
  );
}
