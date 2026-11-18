export type UsageCounter = { used: number; limit: number };

export type OrgUsage = {
  plan: string;
  projects: UsageCounter;
  reports: UsageCounter;
  seats?: UsageCounter;
  auto_pr_credits?: number;
  period_start: string;
};

export type MeResponse = {
  user: { email: string; name?: string; avatar_url?: string };
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

export function usagePeriodResetLabel(periodStart?: string) {
  const start = periodStart ? new Date(periodStart) : new Date();
  const next = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  return next.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
