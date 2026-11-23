import React from "react";

export function InboxSkeleton({
  rows = 7,
  hasRepos = false,
}: {
  rows?: number;
  hasRepos?: boolean;
}) {
  return (
    <div data-testid="inbox-skeleton" className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="sticky top-0 z-10 flex items-center gap-4 border-b border-[#17171714] bg-[#FAFAFA] px-6 py-2 font-ds-ui text-[11px] text-[#A3A3A3]">
        <span className="w-4 shrink-0" />
        <span className="flex-1">Report</span>
        <span className="w-20 shrink-0">Reporters</span>
        {hasRepos && <span className="w-[140px] shrink-0">Repo</span>}
        <span className="w-[110px] shrink-0">Status</span>
        <span className="w-10 shrink-0 text-right">Age</span>
      </div>

      <div className="flex flex-col divide-y divide-[#17171714] bg-white">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-6 py-3"
            aria-hidden="true"
          >
            <div className="h-4 w-4 shrink-0 animate-pulse rounded bg-[#1717170D]" />

            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="h-5 w-12 shrink-0 animate-pulse rounded bg-[#1717170D]" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div
                  className="h-4 animate-pulse rounded bg-[#1717170D]"
                  style={{ width: `${Math.max(35, 68 - (i % 4) * 11)}%` }}
                />
                <div className="h-3 w-16 animate-pulse rounded bg-[#17171708]" />
              </div>
            </div>

            <div className="w-20 shrink-0">
              <div className="h-3.5 w-6 animate-pulse rounded bg-[#1717170D]" />
            </div>

            {hasRepos && (
              <div className="w-[140px] shrink-0">
                <div className="h-3.5 w-24 animate-pulse rounded bg-[#1717170D]" />
              </div>
            )}

            <div className="w-[110px] shrink-0">
              <div className="h-[22px] w-20 animate-pulse rounded-full bg-[#1717170D]" />
            </div>

            <div className="flex w-10 shrink-0 justify-end">
              <div className="h-3 w-7 animate-pulse rounded bg-[#1717170D]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

