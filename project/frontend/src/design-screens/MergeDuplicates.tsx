"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import {
  primaryReport,
  shortId,
  TYPE_STYLE,
  type TicketDetailResponse,
} from "@/lib/tickets";

const MERGE_IDS_KEY = "closeloop_merge_ids";

type Candidate = {
  detail: TicketDetailResponse;
  meta: string;
  attachmentCount: number;
};

function readMergeIds(): string[] {
  try {
    const raw = sessionStorage.getItem(MERGE_IDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch {
    return [];
  }
}

function pickDefaultParent(candidates: Candidate[]): string {
  if (candidates.length === 0) return "";
  const sorted = [...candidates].sort((a, b) => {
    const countDiff = b.detail.ticket.report_count - a.detail.ticket.report_count;
    if (countDiff !== 0) return countDiff;
    const attachDiff = b.attachmentCount - a.attachmentCount;
    if (attachDiff !== 0) return attachDiff;
    return (
      new Date(a.detail.ticket.created_at).getTime() -
      new Date(b.detail.ticket.created_at).getTime()
    );
  });
  return sorted[0].detail.ticket.id;
}

function candidateMeta(detail: TicketDetailResponse): { meta: string; attachmentCount: number } {
  const report = primaryReport(detail.reports);
  const platform = report?.platform || "web";
  const parts = [platform[0].toUpperCase() + platform.slice(1)];
  const browser = report?.context?.browser;
  if (typeof browser === "string" && browser) parts.push(browser);
  const shots = detail.attachments.filter((a) => a.kind === "screenshot" && a.uploaded).length;
  if (shots > 0) parts.push(shots === 1 ? "screenshot" : `${shots} screenshots`);
  if (detail.ticket.report_count > 1) {
    parts.push(
      `${detail.ticket.report_count} report${detail.ticket.report_count === 1 ? "" : "s"}`,
    );
  }
  return { meta: parts.join(" · "), attachmentCount: shots };
}

export function MergeDuplicates() {
  const router = useRouter();
  const [ids, setIds] = useState<string[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [parentId, setParentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const projectId = localStorage.getItem("closeloop_project");
    if (!projectId) {
      router.replace("/app/onboarding");
      return;
    }

    const mergeIds = readMergeIds();
    if (mergeIds.length < 2) {
      router.replace("/app/inbox");
      return;
    }
    setIds(mergeIds);

    let cancelled = false;
    Promise.all(mergeIds.map((id) => api<TicketDetailResponse>(`/api/tickets/${id}`)))
      .then((details) => {
        if (cancelled) return;
        const next = details.map((detail) => {
          const { meta, attachmentCount } = candidateMeta(detail);
          return { detail, meta, attachmentCount };
        });
        setCandidates(next);
        setParentId(pickDefaultParent(next));
        setError("");
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load reports");
          setCandidates([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  const mostContextId = useMemo(() => pickDefaultParent(candidates), [candidates]);
  const childCount = Math.max(0, ids.length - 1);
  const totalReports = candidates.reduce((sum, c) => sum + c.detail.ticket.report_count, 0);
  const totalReporters = candidates.reduce((sum, c) => sum + (c.detail.reporters?.total || 0), 0);
  const canSubmit = Boolean(parentId) && candidates.length >= 2 && !saving && !loading;

  function close() {
    router.push("/app/inbox");
  }

  async function confirm() {
    if (!canSubmit || !parentId) return;
    setSaving(true);
    setError("");
    try {
      await api("/api/tickets/merge", {
        method: "POST",
        body: JSON.stringify({
          parent_id: parentId,
          child_ids: ids.filter((id) => id !== parentId),
        }),
      });
      sessionStorage.removeItem(MERGE_IDS_KEY);
      router.push(`/app/tickets/${parentId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to merge reports");
      setSaving(false);
    }
  }

  return (
    <div className="relative box-border flex min-h-screen w-full items-center justify-center bg-[#17171766] p-6">
      <button
        type="button"
        aria-label="Close backdrop"
        onClick={close}
        className="absolute inset-0 cursor-default"
      />

      <div className="relative z-10 flex w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border border-[#17171714] bg-white shadow-[0_24px_64px_#17171733]">
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-2">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="font-ds-sans text-lg font-semibold tracking-[-0.36px] text-[#171717]">
              {ids.length > 0
                ? `Merge ${ids.length} reports into one ticket`
                : "Merge reports into one ticket"}
            </h1>
            <p className="font-ds-ui text-[13px] leading-[19px] text-[#737373]">
              Pick the parent. The other reports become duplicates and their reporters are notified
              when the parent is fixed.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="cursor-pointer font-ds-ui text-[#A3A3A3] hover:text-[#171717]"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="px-6 py-16 text-center font-ds-ui text-sm text-[#737373]">
            Loading…
          </div>
        ) : (
          <div className="flex flex-col gap-4 px-6 pb-6 pt-2">
            {error && (
              <div className="rounded-md bg-[#FEF2F2] px-3 py-2 font-ds-ui text-[13px] text-[#DA314A]">
                {error}{" "}
                <Link href="/app/inbox" className="underline">
                  Back to inbox
                </Link>
              </div>
            )}

            {candidates.length >= 2 && (
              <div className="flex flex-col gap-2" role="radiogroup" aria-label="Parent ticket">
                {candidates.map((candidate) => {
                  const ticket = candidate.detail.ticket;
                  const selected = parentId === ticket.id;
                  const typeStyle = TYPE_STYLE[ticket.type] || TYPE_STYLE.bug;
                  const isMostContext = ticket.id === mostContextId;

                  return (
                    <button
                      key={ticket.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setParentId(ticket.id)}
                      className={`flex w-full cursor-pointer items-start gap-3 rounded-[10px] p-3.5 text-left transition-colors ${
                        selected
                          ? "bg-[#EFF6FF] outline outline-[1.5px] outline-[#266DF0] outline-offset-[-0.75px]"
                          : "bg-white outline outline-1 outline-[#1717171F] outline-offset-[-0.5px] hover:bg-[#FAFAFA]"
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-4 w-4 shrink-0 rounded-full ${
                          selected
                            ? "bg-white outline outline-[5px] outline-[#266DF0] outline-offset-[-2.5px]"
                            : "bg-white outline outline-[1.5px] outline-[#17171733] outline-offset-[-0.75px]"
                        }`}
                      />
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="flex items-center gap-2">
                          <span className="font-ds-mono text-xs text-[#737373]">
                            #{shortId(ticket.id)}
                          </span>
                          <span
                            className="rounded px-1.5 py-0.5 font-ds-ui text-[11px] font-medium"
                            style={{ background: typeStyle.bg, color: typeStyle.text }}
                          >
                            {typeStyle.label}
                          </span>
                        </span>
                        <span className="font-ds-ui text-[13.5px] font-medium text-[#171717]">
                          {ticket.title}
                        </span>
                        <span className="font-ds-ui text-xs text-[#A3A3A3]">{candidate.meta}</span>
                      </span>
                      {isMostContext && (
                        <span className="shrink-0 rounded border border-[#1717171F] bg-white px-1.5 py-0.5 font-ds-ui text-[11px] font-medium text-[#737373]">
                          Most context
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {candidates.length >= 2 && (
              <div className="flex flex-col gap-1.5 rounded-[10px] bg-[#F5F5F5] p-3.5">
                <p className="font-ds-ui text-[13px] text-[#171717]">
                  {childCount} report{childCount === 1 ? "" : "s"} become duplicates.{" "}
                  {totalReports} report{totalReports === 1 ? "" : "s"} roll up on the parent.
                </p>
                <p className="font-ds-ui text-[12px] text-[#737373]">
                  {totalReporters > 0
                    ? `${totalReporters} reporter${totalReporters === 1 ? "" : "s"} will be notified when the parent is fixed.`
                    : "Reporters will be notified when the parent is fixed."}
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 border-t border-[#17171714] bg-[#FAFAFA] px-6 py-3.5">
          <div className="flex-1 font-ds-ui text-xs text-[#A3A3A3]">
            You can filter duplicates from the inbox later
          </div>
          <button
            type="button"
            onClick={close}
            className="h-[34px] cursor-pointer rounded-md border border-[#1717171F] bg-white px-4 font-ds-sans text-[13px] font-medium tracking-[-0.2px] text-[#171717] shadow-[0_4px_4px_#1717170A]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!canSubmit}
            className="flex h-[34px] cursor-pointer items-center gap-2 rounded-md bg-[#171717] px-4 font-ds-sans text-[13px] font-medium tracking-[-0.2px] text-white shadow-[0_4px_4px_#1717170A] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? "Merging…"
              : `Merge ${ids.length || candidates.length || 0} reports`}
          </button>
        </div>
      </div>
    </div>
  );
}
