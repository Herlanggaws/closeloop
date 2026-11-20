// Single source for plan copy shown on the landing page and in Billing.
// Mirrors backend/internal/application/entitlements.go; keep the limits in sync.

/**
 * Business plan stays hidden until M6 (D-22). Flip to true to show the
 * Business card on landing + Billing, the SSO & audit nav and its tours again.
 */
export const BUSINESS_PLAN_VISIBLE = false;

export type PlanId = "free" | "indie" | "studio" | "business";

export type PlanInfo = {
  id: PlanId;
  name: string;
  /** Monthly price label used in Billing, e.g. "$12" or "From $149". */
  price: string;
  /** Short feature line in Billing's Change plan card. */
  blurb: string;
  /** Secondary limit line in Billing's Change plan card. */
  billingLimits: string;
  /** Landing card copy. */
  landing: {
    desc: string;
    limits: string;
    features: string[];
  };
};

export const PLANS: PlanInfo[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    blurb: "Widget, inbox, full MCP loop",
    billingLimits: "1 project · 50 reports / mo · 3 repos / project · 1 seat",
    landing: {
      desc: "The full loop on one app.",
      limits: "1 project · 50 reports / mo · 3 repos / project",
      features: [
        "Web widget and mobile SDKs",
        "Inbox and tickets",
        "Full MCP loop, including mark_fixed",
        "Reporter notifications",
        "“Powered by Saidloop” badge",
      ],
    },
  },
  {
    id: "indie",
    name: "Indie",
    price: "$12",
    blurb: "Slack & GitHub Issues, public board, no badge",
    billingLimits: "3 projects · 1,000 reports / mo · 5 repos / project · 1 seat",
    landing: {
      desc: "For solo builders shipping with AI.",
      limits: "3 projects · 1,000 reports / mo · 5 repos / project · 1 seat",
      features: [
        "Everything in Free",
        "Slack and GitHub Issues",
        "Public board and voting",
        "No Saidloop badge",
        "Auto PR starter credits",
      ],
    },
  },
  {
    id: "studio",
    name: "Studio",
    price: "$39",
    blurb: "5 seats, branding, Linear & Jira, replay 7d",
    billingLimits: "Unlimited projects · 10,000 reports / mo · 10 repos / project · 5 seats",
    landing: {
      desc: "For small teams running client apps.",
      limits: "Unlimited projects · 10,000 reports / mo · 10 repos / project · 5 seats",
      features: [
        "Everything in Indie",
        "Your own widget branding",
        "Linear and Jira",
        "Session replay, 7 days",
      ],
    },
  },
  {
    id: "business",
    name: "Business",
    price: "From $149",
    blurb: "SSO, audit log, replay 30d, self-host option",
    billingLimits: "Unlimited projects · Contract quota · Unlimited repos · Unlimited seats",
    landing: {
      desc: "Security and control for companies.",
      limits: "Unlimited projects, repos and seats · custom report volume",
      features: [
        "Everything in Studio",
        "SSO with SAML or OIDC",
        "Audit log with export",
        "Session replay, 30 days",
        "Self-hosting, annual license",
      ],
    },
  },
];

export function isBusinessPlan(plan?: string | null) {
  return (plan || "").toLowerCase() === "business";
}

/** Plans a user can see and pick. Business only shows when the flag is on. */
export function visiblePlans(): PlanInfo[] {
  return PLANS.filter((p) => p.id !== "business" || BUSINESS_PLAN_VISIBLE);
}

/** Business-only surfaces (SSO & audit, self-host) show for Business orgs or once the flag is on. */
export function businessSurfacesVisible(plan?: string | null) {
  return BUSINESS_PLAN_VISIBLE || isBusinessPlan(plan);
}

export function planInfo(plan?: string | null): PlanInfo | undefined {
  return PLANS.find((p) => p.id === (plan || "").toLowerCase());
}

/** Rank used for "needs at least X" checks; mirrors backend plan ordering. */
export function planRank(plan?: string | null) {
  switch ((plan || "free").toLowerCase()) {
    case "indie":
      return 1;
    case "studio":
      return 2;
    case "business":
      return 3;
    default:
      return 0;
  }
}

export function planAtLeast(plan: string | null | undefined, min: PlanId) {
  return planRank(plan) >= planRank(min);
}
