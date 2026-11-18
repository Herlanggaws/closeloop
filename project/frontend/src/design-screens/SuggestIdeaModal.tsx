"use client";

import { useEffect, useId, useState } from "react";
import { API_URL } from "@/lib/api";

export function SuggestIdeaModal({
  slug,
  onClose,
  onSubmitted,
}: {
  slug: string;
  onClose: () => void;
  onSubmitted?: () => void;
}) {
  const titleId = useId();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(
        `${API_URL}/api/public/boards/${encodeURIComponent(slug)}/ideas/suggest`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            body: body.trim(),
            email: email.trim(),
          }),
        },
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error?.message || "Could not send suggestion");
      }
      setDone(true);
      onSubmitted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send suggestion");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 border-0 bg-[#0A0A0A66]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-[440px] rounded-2xl border border-[#17171714] bg-white p-6"
      >
        {done ? (
          <>
            <h2 id={titleId} className="font-ds-sans text-[18px] font-semibold text-[#171717]">
              Check your email
            </h2>
            <p className="mt-1 font-ds-ui text-[13px] text-[#737373]">
              Check your email to confirm — we&apos;ll show it after the team publishes.
            </p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 cursor-pointer items-center rounded-md bg-[#171717] px-3 font-ds-sans text-[13px] font-medium text-white"
              >
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id={titleId} className="font-ds-sans text-[18px] font-semibold text-[#171717]">
              Suggest an idea
            </h2>
            <p className="mt-1 font-ds-ui text-[13px] text-[#737373]">
              Share a title and optional details. We&apos;ll email a confirm link — the team publishes
              what goes live.
            </p>
            <form className="mt-4 flex flex-col gap-3" onSubmit={(e) => void submit(e)}>
              <label className="flex flex-col gap-1.5">
                <span className="font-ds-ui text-xs font-medium text-[#171717]">Title</span>
                <input
                  type="text"
                  required
                  autoFocus
                  maxLength={120}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Dark mode for settings"
                  className="h-10 rounded-md border border-[#1717171F] bg-white px-3 font-ds-ui text-[13px] outline-none focus:border-[#171717]"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="font-ds-ui text-xs font-medium text-[#171717]">
                  Details <span className="font-normal text-[#A3A3A3]">(optional)</span>
                </span>
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Why this would help…"
                  className="rounded-md border border-[#1717171F] bg-white px-3 py-2 font-ds-ui text-[13px] outline-none focus:border-[#171717]"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="font-ds-ui text-xs font-medium text-[#171717]">Email</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="h-10 rounded-md border border-[#1717171F] bg-white px-3 font-ds-ui text-[13px] outline-none focus:border-[#171717]"
                />
              </label>
              {error ? <p className="font-ds-ui text-sm text-[#DA314A]">{error}</p> : null}
              <div className="mt-1 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-9 cursor-pointer items-center rounded-md border border-[#1717171F] bg-white px-3 font-ds-sans text-[13px] font-medium text-[#171717]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !title.trim() || !email.trim()}
                  className="inline-flex h-9 cursor-pointer items-center rounded-md bg-[#171717] px-3 font-ds-sans text-[13px] font-medium text-white disabled:opacity-50"
                >
                  {saving ? "Sending…" : "Send confirm link"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
