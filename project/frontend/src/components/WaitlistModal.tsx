"use client";

import { FormEvent, useEffect, useId, useState } from "react";
import { API_URL } from "@/lib/api";

export type WaitlistModalView = "enter" | "invalid" | "joined" | "already";

type Props = {
  open: boolean;
  onClose: () => void;
  initialView?: WaitlistModalView;
  initialEmail?: string;
  initialCreatedAt?: string;
  source?: string;
  contained?: boolean;
};

type JoinResponse = {
  ok?: boolean;
  inserted?: boolean;
  email?: string;
  created_at?: string;
  error?: { message?: string };
};

const INVALID_COPY = "Add the domain, like rina@bearbudget.app";

function isValidWaitlistEmail(value: string): boolean {
  const email = value.trim();
  if (!email) return false;
  const at = email.indexOf("@");
  if (at <= 0 || at !== email.lastIndexOf("@")) return false;
  const domain = email.slice(at + 1);
  if (!domain.includes(".")) return false;
  const [host, tld] = [domain.slice(0, domain.lastIndexOf(".")), domain.slice(domain.lastIndexOf(".") + 1)];
  return host.length > 0 && tld.length > 1;
}

function formatJoinedOn(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "earlier";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function WaitlistModal({
  open,
  onClose,
  initialView = "enter",
  initialEmail = "",
  initialCreatedAt = "",
  source = "landing-modal",
  contained = false,
}: Props) {
  const titleId = useId();
  const [view, setView] = useState<WaitlistModalView>(initialView);
  const [email, setEmail] = useState(initialEmail);
  const [createdAt, setCreatedAt] = useState(initialCreatedAt);
  const [confirmedEmail, setConfirmedEmail] = useState(initialEmail);
  const [status, setStatus] = useState<"idle" | "loading" | "resending">("idle");
  const [fieldError, setFieldError] = useState(initialView === "invalid" ? INVALID_COPY : "");
  const [resendNote, setResendNote] = useState("");

  useEffect(() => {
    if (!open) return;
    setView(initialView);
    setEmail(initialEmail);
    setCreatedAt(initialCreatedAt);
    setConfirmedEmail(initialEmail);
    setStatus("idle");
    setFieldError(initialView === "invalid" ? INVALID_COPY : "");
    setResendNote("");
  }, [open, initialView, initialEmail, initialCreatedAt]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (status === "loading") return;
    setResendNote("");
    if (!isValidWaitlistEmail(email)) {
      setView("invalid");
      setFieldError(INVALID_COPY);
      return;
    }
    setStatus("loading");
    setFieldError("");
    try {
      const res = await fetch(`${API_URL}/api/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source }),
      });
      const data = (await res.json().catch(() => null)) as JoinResponse | null;
      if (!res.ok) {
        setView("invalid");
        setFieldError(data?.error?.message || INVALID_COPY);
        setStatus("idle");
        return;
      }
      const addr = data?.email || email.trim().toLowerCase();
      setConfirmedEmail(addr);
      setCreatedAt(typeof data?.created_at === "string" ? data.created_at : "");
      setView(data?.inserted ? "joined" : "already");
      setStatus("idle");
    } catch {
      setView("invalid");
      setFieldError("Could not join waitlist");
      setStatus("idle");
    }
  }

  async function onResend() {
    if (status === "resending" || !confirmedEmail) return;
    setStatus("resending");
    setResendNote("");
    try {
      const res = await fetch(`${API_URL}/api/waitlist/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: confirmedEmail }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setResendNote(data?.error?.message || "Could not resend confirmation");
        setStatus("idle");
        return;
      }
      setResendNote("Confirmation resent — check your inbox.");
      setStatus("idle");
    } catch {
      setResendNote("Could not resend confirmation");
      setStatus("idle");
    }
  }

  const showForm = view === "enter" || view === "invalid";
  const inputStroke = view === "invalid" ? "#DA314A" : "#171717";

  return (
    <div
      data-pencil-name="Waitlist Overlay"
      className={
        contained
          ? "absolute inset-0 z-50 flex items-center justify-center"
          : "fixed inset-0 z-50 flex items-center justify-center"
      }
      role="presentation"
    >
      <button
        type="button"
        aria-label="Close waitlist"
        data-pencil-name="Scrim"
        className="absolute inset-0 border-0 bg-[#0A0A0A66]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-pencil-name="Waitlist Modal"
        className={
          showForm
            ? "relative z-10 box-border flex w-[440px] flex-col gap-5 rounded-2xl bg-white p-[24px_24px_20px_24px] outline outline-1 outline-offset-[-1px] outline-[#17171714]"
            : "relative z-10 box-border flex w-[440px] flex-col items-center gap-5 rounded-2xl bg-white p-[32px_28px_24px_28px] outline outline-1 outline-offset-[-1px] outline-[#17171714]"
        }
      >
        {showForm ? (
          <>
            <div data-pencil-name="Head" className="flex w-full flex-col gap-3">
              <h2
                id={titleId}
                data-pencil-name="Title"
                className="m-0 font-ds-sans text-[20px] font-semibold leading-[26px] tracking-[-0.3px] text-[#171717]"
              >
                Join the waitlist
              </h2>
              <p
                data-pencil-name="Sub"
                className="m-0 font-ds-ui text-[13.5px] font-normal leading-[20px] text-[#737373]"
              >
                Just your email. We&apos;ll write when your spot opens. The first 50 builders get Indie
                free for 3 months.
              </p>
            </div>
            <form onSubmit={onSubmit} className="flex w-full flex-col gap-5">
              <div data-pencil-name="Field" className="flex w-full flex-col gap-1.5">
                <label
                  htmlFor="waitlist-modal-email"
                  data-pencil-name="Label"
                  className="font-ds-ui text-[13px] font-medium text-[#171717]"
                >
                  Email
                </label>
                <div
                  data-pencil-name="Email Input"
                  className="box-border flex h-[42px] w-full items-center gap-2 rounded-[10px] bg-white px-3"
                  style={{ outline: `1px solid ${inputStroke}`, outlineOffset: -1 }}
                >
                  <input
                    id="waitlist-modal-email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (view === "invalid") {
                        setView("enter");
                        setFieldError("");
                      }
                    }}
                    disabled={status === "loading"}
                    placeholder="you@yourapp.com"
                    className="w-full border-0 bg-transparent font-ds-ui text-[14px] text-[#171717] outline-none placeholder:text-[#A3A3A3]"
                  />
                </div>
                {view === "invalid" && fieldError ? (
                  <div data-pencil-name="Error" className="flex w-full items-center gap-1.5">
                    <p
                      role="alert"
                      data-pencil-name="Message"
                      className="m-0 font-ds-ui text-[12.5px] text-[#DA314A]"
                    >
                      {fieldError}
                    </p>
                  </div>
                ) : null}
              </div>
              <button
                type="submit"
                disabled={status === "loading" || !email.trim()}
                data-pencil-name="Submit"
                className="box-border flex h-[42px] w-full cursor-pointer items-center justify-center gap-2 rounded-[6px] bg-[#171717] px-4 transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="font-ds-sans text-[14px] font-medium tracking-[-0.2px] text-white">
                  {status === "loading" ? "Joining…" : "Join the waitlist"}
                </span>
              </button>
            </form>
            <p
              data-pencil-name="Footnote"
              className="m-0 w-full text-center font-ds-ui text-[12.5px] text-[#A3A3A3]"
            >
              No spam. One email when you&apos;re in. Unsubscribe anytime.
            </p>
          </>
        ) : (
          <>
            <div className="flex w-full flex-col items-center gap-3 text-center">
              <h2
                id={titleId}
                data-pencil-name="Title"
                className="m-0 font-ds-sans text-[20px] font-semibold leading-[26px] tracking-[-0.3px] text-[#171717]"
              >
                {view === "joined" ? "You're on the list" : "You're already on the list"}
              </h2>
              <p
                data-pencil-name="Sub"
                className="m-0 w-full font-ds-ui text-[13.5px] font-normal leading-[20px] text-[#737373]"
              >
                {view === "joined"
                  ? "We sent a confirmation to your inbox. When your spot opens, we'll email you a link to set up your first project."
                  : `This email joined on ${formatJoinedOn(createdAt)}. Nothing else to do. We'll email you when your spot opens.`}
              </p>
            </div>
            <div
              data-pencil-name="Email Chip"
              className="box-border flex items-center gap-1.5 rounded-full bg-[#F5F5F5] px-3 py-1.5"
            >
              <span
                data-pencil-name="Email"
                className="font-ds-ui text-[13px] font-medium text-[#171717]"
              >
                {confirmedEmail}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              data-pencil-name="Done"
              className="box-border flex h-[42px] w-full cursor-pointer items-center justify-center gap-2 rounded-[6px] bg-white px-4 outline outline-1 outline-offset-[-1px] outline-[#1717171F] transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]"
            >
              <span className="font-ds-sans text-[14px] font-medium tracking-[-0.2px] text-[#171717]">
                Done
              </span>
            </button>
            <div data-pencil-name="Footnote" className="flex items-center gap-1">
              {view === "joined" ? (
                <>
                  <span data-pencil-name="Q" className="font-ds-ui text-[12.5px] text-[#A3A3A3]">
                    Wrong email?
                  </span>
                  <button
                    type="button"
                    data-pencil-name="Link"
                    onClick={() => {
                      setView("enter");
                      setEmail(confirmedEmail);
                      setFieldError("");
                      setResendNote("");
                    }}
                    className="cursor-pointer border-0 bg-transparent p-0 font-ds-ui text-[12.5px] font-medium text-[#171717]"
                  >
                    Change it
                  </button>
                </>
              ) : (
                <>
                  <span data-pencil-name="Q" className="font-ds-ui text-[12.5px] text-[#A3A3A3]">
                    Can&apos;t find the confirmation?
                  </span>
                  <button
                    type="button"
                    data-pencil-name="Link"
                    onClick={onResend}
                    disabled={status === "resending"}
                    className="cursor-pointer border-0 bg-transparent p-0 font-ds-ui text-[12.5px] font-medium text-[#171717] disabled:opacity-60"
                  >
                    {status === "resending" ? "Sending…" : "Resend it"}
                  </button>
                </>
              )}
            </div>
            {resendNote ? (
              <p role="status" className="m-0 text-center font-ds-ui text-[12.5px] text-[#737373]">
                {resendNote}
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
