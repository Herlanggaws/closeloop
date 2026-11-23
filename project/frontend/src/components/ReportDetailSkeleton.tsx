import React from "react";

export function ReportDetailSkeleton() {
  return (
    <div data-testid="report-detail-skeleton" className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col gap-6 overflow-auto px-8 py-7">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="h-5 w-12 animate-pulse rounded bg-[#1717170D]" />
            <div className="h-4 w-16 animate-pulse rounded bg-[#17171708]" />
            <div className="h-3 w-1 animate-pulse rounded bg-[#17171708]" />
            <div className="h-4 w-24 animate-pulse rounded bg-[#17171708]" />
          </div>
          <div className="h-7 w-3/5 animate-pulse rounded bg-[#1717170D]" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-[#17171708]" />
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-[#17171714] bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 animate-pulse rounded-full bg-[#1717170D]" />
            <div className="space-y-1">
              <div className="h-4 w-32 animate-pulse rounded bg-[#1717170D]" />
              <div className="h-3 w-20 animate-pulse rounded bg-[#17171708]" />
            </div>
          </div>
          <div className="space-y-2 pt-2">
            <div className="h-4 w-full animate-pulse rounded bg-[#1717170D]" />
            <div className="h-4 w-4/5 animate-pulse rounded bg-[#1717170D]" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-[#1717170D]" />
          </div>
        </div>
      </div>

      <div className="hidden w-[340px] shrink-0 flex-col gap-6 border-l border-[#17171714] bg-[#FAFAFA] p-6 lg:flex">
        <div className="space-y-2">
          <div className="h-3.5 w-16 animate-pulse rounded bg-[#1717170D]" />
          <div className="h-8 w-full animate-pulse rounded-md bg-[#1717170D]" />
        </div>
        <div className="space-y-2">
          <div className="h-3.5 w-20 animate-pulse rounded bg-[#1717170D]" />
          <div className="h-8 w-full animate-pulse rounded-md bg-[#1717170D]" />
        </div>
        <div className="space-y-2">
          <div className="h-3.5 w-24 animate-pulse rounded bg-[#1717170D]" />
          <div className="h-20 w-full animate-pulse rounded-md bg-[#1717170D]" />
        </div>
      </div>
    </div>
  );
}

