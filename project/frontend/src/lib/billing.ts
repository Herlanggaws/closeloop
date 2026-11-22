import type { PlanId, PlanInfo } from "./plans";

export type BillingInterval = "month" | "year";

/**
 * What picking a plan card does:
 * - checkout: pay for it on the hosted checkout
 * - portal: an existing subscription is changed or canceled in the billing portal
 * - manual: switch right away (only used to move an unpaid workspace to Free)
 */
export type PlanAction = "checkout" | "portal" | "manual" | "none";

export function planAction(current: string, target: PlanId, subscribed: boolean): PlanAction {
  if (current === "business" || target === "business") return "none";
  if (subscribed) return target === current ? "none" : "portal";
  if (target === "free") return current === "free" ? "none" : "manual";
  // Also covers a plan that was switched manually and is not paid for yet.
  return "checkout";
}

export function planActionLabel(current: string, target: PlanId, action: PlanAction) {
  switch (action) {
    case "portal":
      return target === "free" ? "Cancel subscription" : "Switch plan";
    case "manual":
      return "Switch to Free";
    case "checkout":
      return target === current || current !== "free" ? "Subscribe" : "Upgrade";
    default:
      return "";
  }
}

export function planPriceLabel(plan: PlanInfo, interval: BillingInterval) {
  if (interval === "year" && plan.yearlyPrice) return `${plan.yearlyPrice} / year`;
  return plan.price;
}
