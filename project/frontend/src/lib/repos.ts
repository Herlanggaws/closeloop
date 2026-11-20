// Multi-repo per project (D-12…D-19). Mirrors backend/internal/application/repos.go.

export const REPO_PLATFORMS = ["web", "android", "ios", "backend", "shared"] as const;
export type RepoPlatform = (typeof REPO_PLATFORMS)[number];

export type RepoRoute = { platform: RepoPlatform; path: string };

export type ProjectRepo = {
  id: string;
  project_id: string;
  installation_id: number;
  account_login: string;
  full_name: string;
  default_branch: string;
  is_fallback: boolean;
  routing_paused: boolean;
  routes: RepoRoute[];
  created_at: string;
};

export type ReposResponse = {
  repos: ProjectRepo[];
  usage: { used: number; limit: number };
  plan: string;
  allow_cross_repo_read: boolean;
};

const LABEL: Record<string, string> = {
  web: "Web",
  android: "Android",
  ios: "iOS",
  backend: "Backend",
  shared: "Shared",
};

export function repoPlatformLabel(p: string) {
  return LABEL[p] || p;
}

/** "bearbudget-web" from "herlangga/bearbudget-web". */
export function shortRepo(fullName: string) {
  return fullName.split("/").pop() || fullName;
}

/** "3 of 5 repos"; unlimited plans read "3 repos". */
export function repoCounter(used: number, limit: number) {
  return limit === 0 ? `${used} repo${used === 1 ? "" : "s"}` : `${used} of ${limit} repos`;
}

export function repoLimitReached(used: number, limit: number) {
  return limit > 0 && used >= limit;
}

const NEXT_PLAN: Record<string, { name: string; repos: number } | undefined> = {
  free: { name: "Indie", repos: 5 },
  indie: { name: "Studio", repos: 10 },
};

/** Card subtitle; switches to the limit copy when the plan is full (S-13 v2 dmcSk). */
export function repositoriesSubtitle(plan: string, used: number, limit: number) {
  if (repoLimitReached(used, limit)) {
    const next = NEXT_PLAN[plan];
    const planName = plan.charAt(0).toUpperCase() + plan.slice(1);
    if (next) {
      return `${planName} includes ${limit} repos per project. Upgrade to ${next.name} for ${next.repos}.`;
    }
  }
  return "Reports route to a repo by platform. Platforms with no repo go to the fallback.";
}

/** Which repo a platform routes to today, if any (for conflict hints in the add modal). */
export function platformOwner(repos: ProjectRepo[], platform: string, exceptRepoId = "") {
  return repos.find((r) => r.id !== exceptRepoId && r.routes.some((rt) => rt.platform === platform));
}

/** Platforms a repo serves; the fallback also serves platforms nobody else routes. */
export function repoServes(repos: ProjectRepo[], repoId: string): Set<string> {
  const served = new Set<string>();
  const routed = new Set<string>();
  for (const r of repos) {
    for (const rt of r.routes) {
      routed.add(rt.platform);
      if (r.id === repoId) served.add(rt.platform);
    }
  }
  const repo = repos.find((r) => r.id === repoId);
  if (repo?.is_fallback) {
    for (const p of REPO_PLATFORMS) if (!routed.has(p)) served.add(p);
  }
  return served;
}

/** S-09 v2: who gets notified when marking fixed, given the cross-platform checkbox. */
export function fixedNotifyPlan(
  coverage: { covered: Record<string, number>; uncovered: Record<string, number> } | undefined,
  notifyAll: boolean,
) {
  const covered = coverage?.covered || {};
  const uncovered = coverage?.uncovered || {};
  const sum = (m: Record<string, number>) => Object.values(m).reduce((a, b) => a + b, 0);
  const coveredCount = sum(covered);
  const total = coveredCount + sum(uncovered);
  const hasGap = Object.keys(uncovered).length > 0;
  return {
    hasGap,
    notified: notifyAll || !hasGap ? total : coveredCount,
    total,
    platforms: notifyAll || !hasGap ? [] : Object.keys(covered),
  };
}
