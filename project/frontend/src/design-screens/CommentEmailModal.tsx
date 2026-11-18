"use client";

import { useEffect, useId, useState } from "react";
import { API_URL } from "@/lib/api";

export function CommentEmailModal({
  slug,
  ideaId,
  ideaTitle,
  body,
  parentId,
  onClose,
  onSubmitted,
}: {
  slug: string;
  ideaId: string;
  ideaTitle: string;
  body: string;
  parentId?: string;
  onClose: () => void;
  onSubmitted: (email: string) => void;
}) {
  const titleId = useId();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
        `${API_URL}/api/public/boards/${encodeURIComponent(slug)}/ideas/${encodeURIComponent(ideaId)}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            body,
            display_name: displayName.trim() || undefined,
            parent_id: parentId || undefined,
          }),
        },
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error?.message || "Could not send comment email");
      }
      onSubmitted(email.trim().toLowerCase());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send comment email");
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
        <h2 id={titleId} className="font-ds-sans text-[18px] font-semibold text-[#171717]">
          Confirm your comment
        </h2>
        <p className="mt-1 font-ds-ui text-[13px] text-[#737373]">
          We&apos;ll email a link so your comment on “{ideaTitle}” appears on the board.
        </p>
        <form className="mt-4 flex flex-col gap-3" onSubmit={(e) => void submit(e)}>
          <label className="flex flex-col gap-1.5">
            <span className="font-ds-ui text-xs font-medium text-[#171717]">Name (optional)</span>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="How should we show you?"
              className="h-10 rounded-md border border-[#1717171F] bg-white px-3 font-ds-ui text-[13px] outline-none focus:border-[#171717]"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-ds-ui text-xs font-medium text-[#171717]">Email</span>
            <input
              type="email"
              required
              autoFocus
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
              disabled={saving || !email.trim()}
              className="inline-flex h-9 cursor-pointer items-center rounded-md bg-[#171717] px-3 font-ds-sans text-[13px] font-medium text-white disabled:opacity-50"
            >
              {saving ? "Sending…" : "Send confirm link"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
