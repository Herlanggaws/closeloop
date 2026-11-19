export type UsageCounter = { used: number; limit: number };

export type OrgUsage = {
  plan: string;
  projects: UsageCounter;
  reports: UsageCounter;
  seats?: UsageCounter;
  /** Repos in the active project; present when /api/me is called with ?project_id. */
  repos?: UsageCounter;
  auto_pr_credits?: number;
  /** Credits ever granted (starter pack, packs). Used = granted - balance. */
  auto_pr_credits_granted?: number;
  period_start: string;
  // Set by the backend once the org has a paid subscription with the billing provider.
  subscribed?: boolean;
};

export type MeResponse = {
  user: { id?: string; email: string; name?: string; avatar_url?: string };
  org: { id?: string; name: string; plan: string };
  role?: string;
  usage?: OrgUsage;
};

export function planLabel(plan: string) {
  const p = (plan || "free").toLowerCase();
  return p.charAt(0).toUpperCase() + p.slice(1);
}

export function formatLimit(limit: number) {
  if (limit === 0) return "∞";
  return limit.toLocaleString();
}

export function formatUsage(counter: UsageCounter) {
  return `${counter.used.toLocaleString()} / ${formatLimit(counter.limit)}`;
}

export function canCreateProject(usage?: OrgUsage) {
  if (!usage) return true;
  if (usage.projects.limit === 0) return true;
  return usage.projects.used < usage.projects.limit;
}

export function usagePct(counter?: UsageCounter) {
  if (!counter || counter.limit === 0) return 0;
  return Math.min(100, Math.round((counter.used / counter.limit) * 100));
}

/** "3 of 5" style, used by Billing for seats, repos and credits. */
export function formatOf(used: number, limit: number) {
  return `${used.toLocaleString()} of ${formatLimit(limit)}`;
}

export function usagePeriodResetLabel(periodStart?: string) {
  const start = periodStart ? new Date(periodStart) : new Date();
  const next = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  return next.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
