"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  shortId,
  type TicketDetailResponse,
} from "@/lib/tickets";

const NOTE_MAX = 280;

export function MarkFixed() {
  const router = useRouter();
  const params = useParams();
  const ticketId = typeof params.id === "string" ? params.id : "";

  const [data, setData] = useState<TicketDetailResponse | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [emailOn, setEmailOn] = useState(true);
  const [bannerOn, setBannerOn] = useState(true);

  useEffect(() => {
    const projectId = localStorage.getItem("closeloop_project");
    if (!projectId) {
      router.replace("/app/onboarding");
      return;
    }
    if (!ticketId || ticketId === "demo") {
      setLoading(false);
      setError("Open a report from the inbox to mark it fixed.");
      return;
    }

    let cancelled = false;

    api<TicketDetailResponse>(`/api/tickets/${ticketId}`)
      .then((detail) => {
        if (cancelled) return;
        setData(detail);
        setNote(detail.ticket.fixed_note || "");
        setError("");
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load report");
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router, ticketId]);

  function close() {
    if (ticketId) router.push(`/app/tickets/${ticketId}`);
    else router.push("/app/inbox");
  }

  async function confirm() {
    const body = note.trim();
    if (!body || !ticketId || saving) return;
    setSaving(true);
    setError("");
    try {
      await api(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "fixed", note: body }),
      });
      router.push("/app/inbox");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark fixed");
      setSaving(false);
    }
  }

  const reporters = data?.reporters || { total: 0, with_email: 0 };
  const previewNote = note.trim() || "Your report was fixed.";
  const canSubmit = Boolean(note.trim()) && !saving && Boolean(data?.ticket);

  return (
    <div className="relative box-border flex min-h-screen w-full items-center justify-center bg-[#17171766] p-6">
      <button
        type="button"
        aria-label="Close backdrop"
        onClick={close}
        className="absolute inset-0 cursor-default"
      />

      <div className="relative z-10 flex w-full max-w-[680px] flex-col overflow-hidden rounded-2xl border border-[#17171714] bg-white shadow-[0_24px_64px_#17171733]">
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-2">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="font-ds-sans text-lg font-semibold tracking-[-0.36px] text-[#171717]">
              {data?.ticket
                ? `Mark #${shortId(data.ticket.id)} as fixed`
                : "Mark as fixed"}
            </h1>
            <p className="font-ds-ui text-[13px] leading-[19px] text-[#737373]">
              Your note goes to everyone who reported this, by email and as an in-app banner
              the next time they open your app.
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

            {data?.ticket && (
              <p className="truncate font-ds-ui text-[13px] text-[#A3A3A3]">
                {data.ticket.title}
              </p>
            )}

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="release-note"
                  className="font-ds-ui text-[13px] font-medium text-[#171717]"
                >
                  Release note
                </label>
                <span className="font-ds-ui text-[11px] text-[#A3A3A3]">
                  {note.length} / {NOTE_MAX}
                </span>
              </div>
              <textarea
                id="release-note"
                value={note}
                maxLength={NOTE_MAX}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Filters now refresh when you change the dates."
                className="w-full resize-none rounded-[10px] border-[1.5px] border-[#171717] bg-white p-3 font-ds-ui text-sm leading-[21px] text-[#171717] outline-none"
              />
              <p className="font-ds-ui text-[11.5px] text-[#A3A3A3]">
                Edit before sending if you like.
              </p>
            </div>

            <div className="flex gap-2">
              <ChannelToggle
                title="Email"
                subtitle={
                  reporters.with_email > 0
                    ? `${reporters.with_email} reporter${reporters.with_email === 1 ? "" : "s"} left an email`
                    : "No reporter emails yet"
                }
                on={emailOn}
                onToggle={() => setEmailOn((v) => !v)}
              />
              <ChannelToggle
                title="In-app banner"
                subtitle={
                  reporters.total > 0
                    ? `${reporters.total} reporter${reporters.total === 1 ? "" : "s"} will see it`
                    : "No reporters linked yet"
                }
                on={bannerOn}
                onToggle={() => setBannerOn((v) => !v)}
              />
            </div>

            <div className="flex flex-col gap-2.5 rounded-[10px] bg-[#F5F5F5] p-4">
              <div className="flex items-center justify-between">
                <span className="font-ds-ui text-[11px] font-medium text-[#A3A3A3]">
                  Banner preview
                </span>
              </div>
              <div className="flex items-center gap-3 rounded-[10px] border border-[#17171714] bg-white px-3.5 py-3 shadow-[0_4px_12px_#1717170F]">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F0FDF4] font-ds-ui text-[12px] text-[#16A34A]">
                  ✓
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-ds-ui text-[13px] font-semibold text-[#171717]">
                    Your report was fixed
                  </div>
                  <div className="truncate font-ds-ui text-[12.5px] text-[#737373]">
                    {previewNote}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 border-t border-[#17171714] bg-[#FAFAFA] px-6 py-3.5">
          <div className="flex-1 font-ds-ui text-xs text-[#A3A3A3]">
            {reporters.total > 0
              ? `${reporters.total} reporter${reporters.total === 1 ? "" : "s"} will be notified`
              : "Reporters will be notified when available"}
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
            {saving ? "Saving…" : "Mark fixed and notify"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChannelToggle({
  title,
  subtitle,
  on,
  onToggle,
}: {
  title: string;
  subtitle: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex flex-1 cursor-pointer items-center gap-2.5 rounded-[10px] border border-[#1717171F] bg-white p-3 text-left"
    >
      <div className="min-w-0 flex-1">
        <div className="font-ds-ui text-[13px] font-medium text-[#171717]">{title}</div>
        <div className="truncate font-ds-ui text-[11.5px] text-[#A3A3A3]">{subtitle}</div>
      </div>
      <span
        className={`flex h-[18px] w-8 shrink-0 items-center rounded-full p-0.5 transition-colors ${
          on ? "justify-end bg-[#16A34A]" : "justify-start bg-[#E5E5E5]"
        }`}
      >
        <span className="h-3.5 w-3.5 rounded-full bg-white" />
      </span>
    </button>
  );
}
