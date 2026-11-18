"use client";

import { forwardRef, useEffect, useId, useRef } from "react";
import type { TourFooterLabels, TourSide } from "@/lib/tours";

type CoachMarkProps = {
  tag: string;
  title: string;
  body: string;
  side: TourSide;
  footer: TourFooterLabels;
  arrowOffset: number;
  style: React.CSSProperties;
  reducedMotion: boolean;
  onClose: () => void;
  onSecondary: () => void;
  onPrimary: () => void;
};

function IconX({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function IconArrowRight({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function arrowClass(side: TourSide) {
  switch (side) {
    case "below":
      return "left-0 top-0 -translate-y-full";
    case "above":
      return "left-0 bottom-0 translate-y-full rotate-180";
    case "right":
      return "left-0 top-0 -translate-x-full -rotate-90 origin-top-right";
    case "left":
      return "right-0 top-0 translate-x-full rotate-90 origin-top-left";
  }
}

export const CoachMark = forwardRef<HTMLDivElement, CoachMarkProps>(function CoachMark(
  {
    tag,
    title,
    body,
    side,
    footer,
    arrowOffset,
    style,
    reducedMotion,
    onClose,
    onSecondary,
    onPrimary,
  },
  ref,
) {
  const titleId = useId();
  const bodyId = useId();
  const primaryRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  function setCardRef(node: HTMLDivElement | null) {
    cardRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  }

  useEffect(() => {
    primaryRef.current?.focus();
  }, [title, footer.primary]);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab" || !card) return;
      const focusable = card.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey) {
        if (active === first || !card.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    card.addEventListener("keydown", onKeyDown);
    return () => card.removeEventListener("keydown", onKeyDown);
  }, []);

  const arrowStyle: React.CSSProperties =
    side === "left" || side === "right" ? { top: arrowOffset } : { left: arrowOffset };

  return (
    <div
      ref={setCardRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      style={style}
      className={`fixed z-[10050] flex w-[320px] flex-col gap-3.5 rounded-xl bg-[#0A0A0A] px-5 pb-4 pt-[18px] shadow-[0_16px_40px_#0A0A0A40,0_2px_6px_#0A0A0A1F] ${
        reducedMotion ? "" : "animate-coach-fade"
      }`}
    >
      <span
        aria-hidden
        className={`pointer-events-none absolute h-2 w-4 text-[#0A0A0A] ${arrowClass(side)}`}
        style={arrowStyle}
      >
        <svg width="16" height="8" viewBox="0 0 16 8" fill="currentColor">
          <path d="M0 8 L8 0 L16 8 Z" />
        </svg>
      </span>

      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-[5px] rounded bg-[#FFFFFF14] px-[7px] py-[3px]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E]" aria-hidden />
          <span className="font-ds-mono text-[10.5px] font-medium tracking-[0.4px] text-white">
            NEW · {tag}
          </span>
        </span>
        <span className="min-w-0 flex-1" />
        <button
          type="button"
          aria-label="Close tour"
          onClick={onClose}
          className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[#FFFFFFB3] outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <IconX />
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        <h2
          id={titleId}
          className="font-ds-sans text-base font-semibold leading-[1.3] tracking-[-0.3px] text-white"
        >
          {title}
        </h2>
        <p id={bodyId} className="font-ds-ui text-[13px] leading-[1.5] text-[#FFFFFFB3]">
          {body}
        </p>
      </div>

      <div className="flex items-center gap-3 pt-1">
        {footer.counter ? (
          <span className="font-ds-mono text-[11px] text-[#FFFFFFB3]">{footer.counter}</span>
        ) : null}
        <span className="min-w-0 flex-1" />
        <button
          type="button"
          onClick={onSecondary}
          className="inline-flex min-h-8 cursor-pointer items-center px-1 font-ds-ui text-[12.5px] font-medium text-[#FFFFFFB3] outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-white/40"
        >
          {footer.secondary}
        </button>
        <button
          ref={primaryRef}
          type="button"
          onClick={onPrimary}
          className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-md bg-white px-3 py-[7px] font-ds-sans text-[13px] font-semibold text-[#171717] outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A]"
        >
          {footer.primary}
          {footer.showArrow ? <IconArrowRight /> : null}
        </button>
      </div>
    </div>
  );
});
