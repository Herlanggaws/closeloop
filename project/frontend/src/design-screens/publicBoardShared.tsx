import Link from "next/link";
import { SaidloopLogo } from "@/components/SaidloopLogo";

export type PublicIdea = {
  id: string;
  title: string;
  type: string;
  status: string;
  created_at: string;
};

export type PublicProject = {
  name: string;
  board_slug: string;
};

export const STATUS_LABEL: Record<string, string> = {
  open: "Open",
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

export function PublicBoardHeader({
  projectName,
  slug,
}: {
  projectName: string;
  slug: string;
}) {
  const initial = (projectName.trim()[0] || "P").toUpperCase();

  return (
    <header className="flex items-center gap-8 border-b border-[#17171714] bg-white px-6 py-4 md:px-12 lg:px-[200px]">
      <Link href={`/board/${encodeURIComponent(slug)}`} className="flex items-center gap-2 no-underline">
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
          href={`/board/${encodeURIComponent(slug)}`}
          className="rounded-md bg-[#F5F5F5] px-3 py-1.5 font-ds-ui text-[14px] font-medium text-[#171717] no-underline"
        >
          Ideas
        </Link>
        <div
          className="rounded-md px-3 py-1.5 font-ds-ui text-[14px] font-medium text-[#A3A3A3]"
          title="Coming soon"
        >
          Roadmap
        </div>
      </div>
    </header>
  );
}

export function PublicBoardFooter() {
  return (
    <footer className="flex items-center justify-center gap-2 pb-10 pt-4">
      <Link href="/" className="inline-flex items-center gap-2 no-underline opacity-70 hover:opacity-100">
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
