import { formatLimit, planLabel, type UsageCounter } from "@/lib/usage";

// S-14 v2 (APr9x) seat copy, D-21. Free has 1 seat, Indie 2, Studio 5.

export function seatSubtitle(plan: string, seats: UsageCounter) {
  const noun = seats.limit === 1 ? "seat" : "seats";
  return `${planLabel(plan)} plan · ${seats.used} of ${formatLimit(seats.limit)} ${noun} used`;
}

export function seatsAtCap(seats: UsageCounter) {
  return seats.limit !== 0 && seats.used >= seats.limit;
}

export function seatsOverLimit(seats: UsageCounter) {
  return seats.limit !== 0 && seats.used > seats.limit;
}

/** Red banner when an invite is refused (or the plan is full). */
export function seatLimitBanner(plan: string, seats: UsageCounter, existingName?: string) {
  const name = planLabel(plan);
  const noun = seats.limit === 1 ? "seat" : "seats";
  const free = plan.toLowerCase() === "free";
  const upsell = free
    ? "New invites need Indie (2 seats) or Studio (5 seats)."
    : "New invites need Studio, which has 5 seats.";
  return {
    title: `Invite not sent. ${name} includes ${formatLimit(seats.limit)} ${noun}.`,
    body: existingName
      ? `Existing members like ${existingName} keep their access. ${upsell}`
      : upsell,
    cta: free ? "Upgrade to Indie" : "Upgrade to Studio",
  };
}

export function memberSummary(plan: string, active: number, pending: number, seats: UsageCounter) {
  if (seatsOverLimit(seats)) return `${active} active · over the ${planLabel(plan)} seat limit`;
  return `${active} active · ${pending} pending`;
}
