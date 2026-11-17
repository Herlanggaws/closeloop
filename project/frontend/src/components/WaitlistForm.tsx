"use client";

import { FormEvent, useState } from "react";
import { API_URL } from "@/lib/api";

type Variant = "hero" | "footer";

type Props = {
  variant?: Variant;
  source?: string;
};

const MailIcon = ({ fill }: { fill: string }) => (
  <svg
    data-pencil-name="Icon"
    data-icon-name="mail"
    data-icon-set="lucide"
    viewBox="0 0 14 14"
    preserveAspectRatio="xMidYMid meet"
    xmlns="http://www.w3.org/2000/svg"
    className="box-border h-4 w-4 shrink-0"
    aria-hidden
  >
    <path
      d="M2.05762 1.77734q-0.28027 0.04102-0.53321 0.16748-0.34863 0.19824-0.58789 0.50586-0.23584 0.30762-0.32129 0.70069-0.01367 0.10938-0.02734 0.66992l0 3.17871 0 3.17871q0.01367 0.56055 0.02734 0.66992 0.11279 0.5332 0.50245 0.90577 0.39307 0.36914 0.92627 0.46826 0.16748 0.02734 4.95605 0.02734 4.78857 0 4.95605-0.02734 0.5332-0.09912 0.92286-0.46826 0.39307-0.37256 0.50586-0.90577 0.01367-0.10938 0.02734-0.66992l0-3.17871 0-3.17871q-0.01367-0.56055-0.02734-0.66992-0.12647-0.54688-0.53321-0.92285-0.40674-0.37939-0.95019-0.46485-0.1709-0.01367-4.93897-0.01367-4.76465 0-4.90478 0.02734z m9.81298 1.17579q0.09912 0.04443 0.18116 0.12304 0.08545 0.0752 0.12646 0.16065 0.04443 0.08203 0.05127 0.12988 0.00684 0.04785 0.00684 0.18799l0 0.21191-2.46436 1.58252q-2.46436 1.56543-2.53613 1.60303-0.06836 0.03418-0.16748 0.03418l-0.02734 0.01367q-0.0957 0.01367-0.2085-0.04102-0.15381-0.07178-0.65967-0.37939l-4.40918-2.81299 0-0.21191q0-0.14014 0.00684-0.18799 0.00684-0.04785 0.04101-0.12305 0.0376-0.07861 0.12647-0.16064 0.09229-0.08545 0.16748-0.1128 0.07861-0.03076 0.70752-0.04443l4.18701 0 4.18701 0q0.61523 0 0.68359 0.02735z m-5.63964 5.02783q0.22217 0.10938 0.46142 0.15381 0.09912 0.02734 0.30762 0.02734 0.2085 0 0.30762-0.02734 0.30762-0.05811 0.54687-0.19825 0.14014-0.08203 2.26612-1.42529l2.12939-1.36035-0.01367 5.50293-0.04102 0.09912q-0.11279 0.2085-0.3247 0.29395l-0.09571 0.02734-9.5498 0-0.09571-0.02734q-0.21191-0.08545-0.3247-0.29395l-0.04102-0.09912-0.01367-5.50293 2.17041 1.37402q2.17041 1.38428 2.31055 1.45606z"
      fill={fill}
    />
  </svg>
);

const ArrowIcon = ({ fill }: { fill: string }) => (
  <svg
    data-pencil-name="Icon"
    data-icon-name="arrow-right"
    data-icon-set="lucide"
    viewBox="0 0 14 14"
    preserveAspectRatio="xMidYMid meet"
    xmlns="http://www.w3.org/2000/svg"
    className="box-border h-4 w-4 shrink-0"
    aria-hidden
  >
    <path
      d="M8.4 2.8a.55.55 0 0 0-.05.78L10.3 6H2.6a.55.55 0 1 0 0 1.1h7.7L8.35 9.52a.55.55 0 1 0 .8.75l3.15-3.35a.55.55 0 0 0 0-.74L9.15 2.83a.55.55 0 0 0-.75-.03z"
      fill={fill}
    />
  </svg>
);

export function WaitlistForm({ variant = "hero", source }: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState("");
  const isFooter = variant === "footer";
  const resolvedSource = source || (isFooter ? "landing-footer" : "landing-hero");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (status === "loading") return;
    setStatus("loading");
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: resolvedSource }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message || "Could not join waitlist");
      }
      setStatus("success");
      setEmail("");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Could not join waitlist");
    }
  }

  if (status === "success") {
    return (
      <div
        id={isFooter ? undefined : "waitlist"}
        className={
          isFooter
            ? "box-border flex h-fit w-fit shrink-0 flex-row items-center gap-2 rounded-[12px] bg-[#262626] p-3 outline outline-1 outline-offset-[-0.5px] outline-[#FFFFFF1A]"
            : "box-border flex h-fit w-fit shrink-0 flex-row items-center gap-2 rounded-[12px] bg-white p-3 shadow-[0px_2px_6px_#0C0A0914] outline outline-1 outline-offset-[-0.5px] outline-[#1717171F]"
        }
      >
        <p
          className={
            isFooter
              ? "font-ds-ui text-[14px] text-[#FFFFFFE6]"
              : "font-ds-ui text-[14px] text-[#171717]"
          }
        >
          You&apos;re on the list — we&apos;ll email you when it&apos;s your turn.
        </p>
      </div>
    );
  }

  return (
    <div id={isFooter ? undefined : "waitlist"} className="relative flex w-fit flex-col items-start gap-2">
      <form
        onSubmit={onSubmit}
        data-pencil-name="Waitlist Form"
        className={
          isFooter
            ? "box-border flex h-fit w-fit shrink-0 flex-row items-center gap-2 rounded-[12px] bg-[#262626] p-1.5 outline outline-1 outline-offset-[-0.5px] outline-[#FFFFFF1A]"
            : "box-border flex h-fit w-fit shrink-0 flex-row items-center gap-2 rounded-[12px] bg-white p-1.5 shadow-[0px_2px_6px_#0C0A0914] outline outline-1 outline-offset-[-0.5px] outline-[#1717171F]"
        }
      >
        <label className="box-border flex h-10 w-[300px] shrink-0 flex-row items-center gap-2 px-2.5">
          <MailIcon fill={isFooter ? "#FFFFFFB3" : "#A3A3A3"} />
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="you@yourapp.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={status === "loading"}
            className={
              isFooter
                ? "w-full border-0 bg-transparent font-ds-ui text-[14px] text-white outline-none placeholder:text-[#FFFFFFB3]"
                : "w-full border-0 bg-transparent font-ds-ui text-[14px] text-[#171717] outline-none placeholder:text-[#A3A3A3]"
            }
          />
        </label>
        <button
          type="submit"
          disabled={status === "loading" || !email.trim()}
          className={
            isFooter
              ? "box-border flex h-10 w-fit shrink-0 cursor-pointer flex-row items-center justify-center gap-2 rounded-[6px] bg-white px-4 shadow-[0px_4px_4px_#1717170A] transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
              : "box-border flex h-10 w-fit shrink-0 cursor-pointer flex-row items-center justify-center gap-2 rounded-[6px] bg-[#171717] px-4 shadow-[0px_4px_4px_#1717170A] transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
          }
        >
          <span
            className={
              isFooter
                ? "whitespace-nowrap font-ds-sans text-[14px] font-medium tracking-[-0.2px] text-[#171717]"
                : "whitespace-nowrap font-ds-sans text-[14px] font-medium tracking-[-0.2px] text-white"
            }
          >
            {status === "loading" ? "Joining…" : "Join the waitlist"}
          </span>
          <ArrowIcon fill={isFooter ? "#171717" : "#FFFFFF"} />
        </button>
      </form>
      {error && (
        <p
          role="alert"
          className={
            isFooter
              ? "font-ds-ui text-[12px] text-[#FCA5A5]"
              : "font-ds-ui text-[12px] text-[#DA314A]"
          }
        >
          {error}
        </p>
      )}
    </div>
  );
}
