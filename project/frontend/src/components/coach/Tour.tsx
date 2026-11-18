"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  areToursDisabled,
  disableAllTours,
  isTourSeen,
  markTourSeen,
} from "@/lib/tour-store";
import {
  availableTourSteps,
  getTour,
  resolveTourTarget,
  tourFooterLabels,
  type TourSide,
  type TourStep,
} from "@/lib/tours";
import { api } from "@/lib/api";
import type { MeResponse } from "@/lib/usage";
import { CoachMark } from "./CoachMark";

const SPOTLIGHT_PAD = 8;
const CARD_GAP = 14;
const VIEW_MARGIN = 16;
const CARD_WIDTH = 320;
const CARD_EST_HEIGHT = 200;
const ARROW_INSET = 24;

type Placement = {
  side: TourSide;
  card: { top: number; left: number };
  arrowOffset: number;
  hole: { x: number; y: number; w: number; h: number };
};

type ActiveTour = {
  userId: string;
  tourId: string;
  steps: TourStep[];
  index: number;
};

let activeTourId: string | null = null;
const TOUR_ENDED_EVENT = "saidloop:tour-ended";

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function opposite(side: TourSide): TourSide {
  switch (side) {
    case "above":
      return "below";
    case "below":
      return "above";
    case "left":
      return "right";
    case "right":
      return "left";
  }
}

function holeFromRect(rect: DOMRect) {
  return {
    x: rect.left - SPOTLIGHT_PAD,
    y: rect.top - SPOTLIGHT_PAD,
    w: rect.width + SPOTLIGHT_PAD * 2,
    h: rect.height + SPOTLIGHT_PAD * 2,
  };
}

function idealPosition(
  side: TourSide,
  hole: { x: number; y: number; w: number; h: number },
  cardH: number,
) {
  if (side === "below") {
    return { top: hole.y + hole.h + CARD_GAP, left: hole.x };
  }
  if (side === "above") {
    return { top: hole.y - CARD_GAP - cardH, left: hole.x };
  }
  if (side === "right") {
    return { top: hole.y + hole.h / 2 - cardH / 2, left: hole.x + hole.w + CARD_GAP };
  }
  return { top: hole.y + hole.h / 2 - cardH / 2, left: hole.x - CARD_GAP - CARD_WIDTH };
}

function clampToViewport(top: number, left: number, cardH: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const maxLeft = Math.max(VIEW_MARGIN, vw - CARD_WIDTH - VIEW_MARGIN);
  const maxTop = Math.max(VIEW_MARGIN, vh - cardH - VIEW_MARGIN);
  return {
    left: Math.min(Math.max(left, VIEW_MARGIN), maxLeft),
    top: Math.min(Math.max(top, VIEW_MARGIN), maxTop),
  };
}

function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
  pad = 0,
) {
  return !(
    a.x + a.w + pad <= b.x ||
    b.x + b.w + pad <= a.x ||
    a.y + a.h + pad <= b.y ||
    b.y + b.h + pad <= a.y
  );
}

function arrowOffsetFor(
  side: TourSide,
  hole: { x: number; y: number; w: number; h: number },
  card: { top: number; left: number },
  cardH: number,
) {
  const targetCenterX = hole.x + hole.w / 2;
  const targetCenterY = hole.y + hole.h / 2;
  if (side === "above" || side === "below") {
    return Math.min(Math.max(targetCenterX - card.left - 8, 12), CARD_WIDTH - 28);
  }
  return Math.min(Math.max(targetCenterY - card.top - 4, 12), cardH - 28);
}

function placeCard(
  preferred: TourSide,
  hole: { x: number; y: number; w: number; h: number },
  cardH: number,
): Placement {
  const sides: TourSide[] = [preferred, opposite(preferred), "below", "above", "left", "right"];
  const seen = new Set<TourSide>();
  let fallback: Placement | null = null;

  for (const side of sides) {
    if (seen.has(side)) continue;
    seen.add(side);

    const ideal = idealPosition(side, hole, cardH);
    const fitsUnclamped =
      ideal.top >= VIEW_MARGIN &&
      ideal.left >= VIEW_MARGIN &&
      ideal.top + cardH <= window.innerHeight - VIEW_MARGIN &&
      ideal.left + CARD_WIDTH <= window.innerWidth - VIEW_MARGIN;

    const card = fitsUnclamped ? ideal : clampToViewport(ideal.top, ideal.left, cardH);
    const cardRect = { x: card.left, y: card.top, w: CARD_WIDTH, h: cardH };
    const overlapsTarget = rectsOverlap(cardRect, hole, CARD_GAP);

    const placement: Placement = {
      side,
      card,
      arrowOffset: arrowOffsetFor(side, hole, card, cardH),
      hole,
    };

    if (!overlapsTarget && fitsUnclamped) {
      return placement;
    }
    if (!overlapsTarget && !fallback) {
      fallback = placement;
    }
  }

  if (fallback) return fallback;

  // Last resort: park below the hole if possible, otherwise above, clear of the target.
  const belowTop = hole.y + hole.h + CARD_GAP;
  const aboveTop = hole.y - CARD_GAP - cardH;
  const top =
    belowTop + cardH <= window.innerHeight - VIEW_MARGIN
      ? belowTop
      : Math.max(VIEW_MARGIN, aboveTop);
  const card = clampToViewport(top, hole.x, cardH);
  const side: TourSide = card.top >= hole.y + hole.h ? "below" : "above";
  return {
    side,
    card,
    arrowOffset: arrowOffsetFor(side, hole, card, cardH),
    hole,
  };
}

export function Tour({ id, ready = true }: { id: string; ready?: boolean }) {
  const [active, setActive] = useState<ActiveTour | null>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const previousFocus = useRef<HTMLElement | null>(null);
  const cardMeasureRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const activeRef = useRef<ActiveTour | null>(null);
  activeRef.current = active;

  useEffect(() => {
    setMounted(true);
    setReducedMotion(prefersReducedMotion());
  }, []);

  const endTour = useCallback(
    (opts: { markSeen: boolean; disableAll?: boolean }) => {
      const current = active;
      if (!current) return;
      if (opts.disableAll) disableAllTours(current.userId);
      else if (opts.markSeen) markTourSeen(current.userId, current.tourId);
      if (activeTourId === current.tourId) activeTourId = null;
      setActive(null);
      setPlacement(null);
      previousFocus.current?.focus?.();
      previousFocus.current = null;
      window.dispatchEvent(
        new CustomEvent(TOUR_ENDED_EVENT, { detail: { tourId: current.tourId } }),
      );
    },
    [active],
  );

  const updatePlacement = useCallback(() => {
    if (!active) return;
    const step = active.steps[active.index];
    if (!step) return;
    const el = resolveTourTarget(step.target);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const hole = holeFromRect(rect);
    const measured =
      cardMeasureRef.current?.getBoundingClientRect().height || CARD_EST_HEIGHT;
    setPlacement(placeCard(step.side, hole, measured));
  }, [active]);

  const schedulePlacement = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      updatePlacement();
    });
  }, [updatePlacement]);

  useEffect(() => {
    if (!ready || !mounted) return;
    let cancelled = false;
    let attempt = 0;

    async function tryStart() {
      if (cancelled || activeRef.current || activeTourId) return;
      const tour = getTour(id);
      if (!tour) return;

      let userId = "";
      try {
        const me = await api<MeResponse>("/api/me");
        userId = me.user.id || me.user.email;
      } catch {
        return;
      }
      if (cancelled || !userId) return;
      if (areToursDisabled(userId) || isTourSeen(userId, id)) return;
      if (tour.after && !isTourSeen(userId, tour.after)) return;

      const waitForTargets = () =>
        new Promise<TourStep[]>((resolve) => {
          const check = () => availableTourSteps(tour.steps);
          const immediate = check();
          if (immediate.length > 0) {
            resolve(immediate);
            return;
          }
          if (attempt > 0) {
            resolve(check());
            return;
          }
          const started = Date.now();
          const observer = new MutationObserver(() => {
            const steps = check();
            if (steps.length > 0 || Date.now() - started > 4000) {
              observer.disconnect();
              resolve(steps);
            }
          });
          observer.observe(document.body, { childList: true, subtree: true });
          window.setTimeout(() => {
            observer.disconnect();
            resolve(check());
          }, 4000);
        });

      const steps = await waitForTargets();
      if (cancelled || steps.length === 0) return;
      if (activeTourId) return;

      const first = steps[0];
      const el = resolveTourTarget(first.target);
      if (el) {
        el.scrollIntoView({
          block: "center",
          inline: "nearest",
          behavior: "instant" as ScrollBehavior,
        });
      }

      previousFocus.current = document.activeElement as HTMLElement | null;
      activeTourId = id;
      setActive({ userId, tourId: id, steps, index: 0 });
    }

    void tryStart();

    function onTourEnded(event: Event) {
      const endedId = (event as CustomEvent<{ tourId: string }>).detail?.tourId;
      if (endedId === id) return;
      attempt += 1;
      window.setTimeout(() => {
        void tryStart();
      }, 50);
    }

    window.addEventListener(TOUR_ENDED_EVENT, onTourEnded);
    return () => {
      cancelled = true;
      window.removeEventListener(TOUR_ENDED_EVENT, onTourEnded);
    };
  }, [id, ready, mounted]);

  useLayoutEffect(() => {
    if (!active) return;
    const step = active.steps[active.index];
    const el = step ? resolveTourTarget(step.target) : null;
    if (el) {
      el.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" as ScrollBehavior });
    }
    updatePlacement();
  }, [active, updatePlacement]);

  useEffect(() => {
    if (!active) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        endTour({ markSeen: true });
      }
    }

    function onScrollOrResize() {
      schedulePlacement();
    }

    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, { passive: true, capture: true });

    const step = active.steps[active.index];
    const el = step ? resolveTourTarget(step.target) : null;
    const ro = el ? new ResizeObserver(() => schedulePlacement()) : null;
    if (el && ro) ro.observe(el);

    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
      ro?.disconnect();
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [active, endTour, schedulePlacement]);

  useEffect(() => {
    return () => {
      if (activeTourId === id) activeTourId = null;
    };
  }, [id]);

  if (!mounted || !active) return null;

  const current = active;
  const step = current.steps[current.index];
  if (!step) return null;
  const footer = tourFooterLabels(current.index, current.steps.length);
  const hole = placement?.hole;

  function goNext() {
    if (current.index >= current.steps.length - 1) {
      endTour({ markSeen: true });
      return;
    }
    const nextIndex = current.index + 1;
    setActive({ ...current, index: nextIndex });
  }

  function goBack() {
    if (current.index <= 0) return;
    setActive({ ...current, index: current.index - 1 });
  }

  function onSecondary() {
    if (footer.kind === "first") {
      endTour({ markSeen: true });
      return;
    }
    if (footer.kind === "single") {
      endTour({ markSeen: true, disableAll: true });
      return;
    }
    goBack();
  }

  function onPrimary() {
    if (footer.kind === "last" || footer.kind === "single") {
      endTour({ markSeen: true });
      return;
    }
    goNext();
  }

  const overlay = (
    <>
      {hole ? (
        <svg
          className="pointer-events-none fixed inset-0 z-[10040] h-full w-full"
          width="100%"
          height="100%"
          aria-hidden
        >
          <defs>
            <mask id={`tour-mask-${current.tourId}`}>
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              <rect
                x={hole.x}
                y={hole.y}
                width={hole.w}
                height={hole.h}
                rx="10"
                ry="10"
                fill="black"
              />
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="#0A0A0A8C"
            mask={`url(#tour-mask-${current.tourId})`}
          />
          <rect
            x={hole.x}
            y={hole.y}
            width={hole.w}
            height={hole.h}
            rx="10"
            ry="10"
            fill="transparent"
            stroke="#FFFFFF"
            strokeWidth="2"
          />
        </svg>
      ) : null}

      {hole ? (
        <>
          <div
            className="fixed z-[10041]"
            style={{ left: 0, top: 0, width: "100%", height: Math.max(0, hole.y) }}
            onClick={(e) => e.preventDefault()}
            aria-hidden
          />
          <div
            className="fixed z-[10041]"
            style={{
              left: 0,
              top: hole.y + hole.h,
              width: "100%",
              height: Math.max(0, window.innerHeight - (hole.y + hole.h)),
            }}
            onClick={(e) => e.preventDefault()}
            aria-hidden
          />
          <div
            className="fixed z-[10041]"
            style={{ left: 0, top: hole.y, width: Math.max(0, hole.x), height: hole.h }}
            onClick={(e) => e.preventDefault()}
            aria-hidden
          />
          <div
            className="fixed z-[10041]"
            style={{
              left: hole.x + hole.w,
              top: hole.y,
              width: Math.max(0, window.innerWidth - (hole.x + hole.w)),
              height: hole.h,
            }}
            onClick={(e) => e.preventDefault()}
            aria-hidden
          />
        </>
      ) : (
        <div
          className="fixed inset-0 z-[10041] bg-[#0A0A0A8C]"
          onClick={(e) => e.preventDefault()}
          aria-hidden
        />
      )}

      <CoachMark
        ref={cardMeasureRef}
        tag={step.tag}
        title={step.title}
        body={step.body}
        side={placement?.side ?? step.side}
        footer={footer}
        arrowOffset={placement?.arrowOffset ?? ARROW_INSET}
        reducedMotion={reducedMotion}
        style={{
          top: placement?.card.top ?? 0,
          left: placement?.card.left ?? 0,
          visibility: placement ? "visible" : "hidden",
        }}
        onClose={() => endTour({ markSeen: true })}
        onSecondary={onSecondary}
        onPrimary={onPrimary}
      />
    </>
  );

  return createPortal(overlay, document.body);
}
