"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { api } from "@/lib/api";
import { planInfo, visiblePlans } from "@/lib/plans";
import {
  formatOf,
  formatUsage,
  planLabel,
  usagePct,
  usagePeriodResetLabel,
  type MeResponse,
  type OrgUsage,
} from "@/lib/usage";

export function Billing() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [projectName, setProjectName] = useState("Project");
  const [usage, setUsage] = useState<OrgUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const projectId = localStorage.getItem("closeloop_project");
    if (!projectId) {
      router.replace("/app/onboarding");
      return;
    }

    let cancelled = false;
    Promise.all([
      api<MeResponse>(`/api/me?project_id=${encodeURIComponent(projectId)}`),
      api<{ project: { name: string } }>(`/api/projects/${projectId}`),
    ])
      .then(([meRes, projectRes]) => {
        if (cancelled) return;
        setMe(meRes);
        setUsage(meRes.usage || null);
        setProjectName(projectRes.project.name || "Project");
        setError("");
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load billing");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function changePlan(plan: string) {
    if (plan === usage?.plan || saving) return;
    setSaving(true);
    setError("");
    try {
      const projectId = localStorage.getItem("closeloop_project") || "";
      const res = await api<{ usage: OrgUsage }>(
        `/api/org/plan?project_id=${encodeURIComponent(projectId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ plan }),
        },
      );
      setUsage(res.usage);
      setMe((prev) =>
        prev
          ? {
              ...prev,
              org: { ...prev.org, plan: res.usage.plan },
              usage: res.usage,
            }
          : prev,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update plan");
    } finally {
      setSaving(false);
    }
  }

  const plan = usage?.plan || me?.org.plan || "free";
  const email = me?.user.email || "";
  const reports = usage?.reports || { used: 0, limit: 50 };
  const projects = usage?.projects || { used: 0, limit: 1 };
  const reportPct = usagePct(reports);
  const projectPct = usagePct(projects);
  const overQuota = reports.limit > 0 && reports.used >= reports.limit;
  const credits = usage?.auto_pr_credits ?? 0;
  const creditsGranted = Math.max(usage?.auto_pr_credits_granted ?? 0, credits);
  const creditsUsed = creditsGranted - credits;
  const current = planInfo(plan);
  // Business stays hidden until M6, but an org already on it still sees its own card.
  const changePlans = visiblePlans().concat(
    current && !visiblePlans().some((p) => p.id === current.id) ? [current] : [],
  );

  return (
    <div className="box-border flex min-h-screen w-full bg-white">
      <AppSidebar
        projectName={projectName}
        plan={plan}
        email={email}
        usage={usage || undefined}
        userName={me?.user?.name}
        avatarUrl={me?.user?.avatar_url}
        active="billing"
      />

      <main className="flex min-h-screen flex-1 flex-col overflow-y-auto bg-[#F7F7F7]">
        <header className="flex h-14 shrink-0 items-center border-b border-[#17171714] bg-white px-8">
          <h1 className="font-ds-sans text-[15px] font-semibold tracking-[-0.2px] text-[#171717]">
            Billing
          </h1>
        </header>

        <div className="mx-auto flex w-full max-w-[920px] flex-col gap-6 px-8 py-8">
          {loading ? (
            <p className="font-ds-ui text-sm text-[#737373]">Loading…</p>
          ) : (
            <>
              {error && <p className="text-sm text-[#DA314A]">{error}</p>}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-4 rounded-2xl bg-[#0A0A0A] p-6 text-white">
                  <div className="flex items-center justify-between">
                    <span className="font-ds-ui text-xs text-white/70">Current plan</span>
                    {!usage?.subscribed && (
                      <span className="rounded-full bg-[#22C55E26] px-2 py-0.5 font-ds-ui text-[11px] font-medium text-[#22C55E]">
                        Manual until Subscribed
                      </span>
                    )}
                  </div>
                  <div className="flex items-end gap-2">
                    <span className="font-ds-sans text-[32px] font-medium tracking-[-0.8px]">
                      {planLabel(plan)}
                    </span>
                    <span className="pb-1 font-ds-ui text-[13px] text-white/70">
                      {current?.price || "$0"} / month
                    </span>
                  </div>
                  <p className="font-ds-ui text-[13px] text-white/70">{current?.blurb}</p>
                </div>

                <div className="flex flex-col gap-[18px] rounded-2xl border border-[#17171714] bg-white p-6">
                  <div className="font-ds-ui text-xs text-[#737373]">
                    Usage this month · resets {usagePeriodResetLabel(usage?.period_start)}
                  </div>
                  <UsageBar
                    label="Reports"
                    value={formatUsage(reports)}
                    pct={reportPct}
                    warn={overQuota}
                  />
                  <UsageBar
                    label="Projects"
                    value={formatUsage(projects)}
                    pct={projectPct}
                    warn={projects.limit > 0 && projects.used >= projects.limit}
                  />
                  {creditsGranted > 0 && (
                    <UsageBar
                      label="Auto PR credits"
                      value={`${formatOf(creditsUsed, creditsGranted)} used`}
                      pct={Math.min(100, Math.round((creditsUsed / creditsGranted) * 100))}
                    />
                  )}
                  {usage?.seats && (
                    <UsageBar
                      label="Seats"
                      value={formatOf(usage.seats.used, usage.seats.limit)}
                      pct={usagePct(usage.seats)}
                      warn={usage.seats.limit > 0 && usage.seats.used > usage.seats.limit}
                    />
                  )}
                  {usage?.repos && (
                    <UsageBar
                      label={`Repos in ${projectName}`}
                      value={formatOf(usage.repos.used, usage.repos.limit)}
                      pct={usagePct(usage.repos)}
                    />
                  )}
                  {overQuota && (
                    <p className="font-ds-ui text-[12px] text-[#B45309]">
                      Over quota: new reports are still accepted but stay locked until you upgrade
                      or the month rolls over.
                    </p>
                  )}
                </div>
              </div>

              <section className="rounded-2xl border border-[#17171714] bg-white p-6">
                <h2 className="font-ds-sans text-[16px] font-medium tracking-[-0.3px] text-[#171717]">
                  Auto PR credits
                </h2>
                <p className="mt-1 font-ds-ui text-[13px] text-[#737373]">
                  1 credit = 1 Auto PR run. Paid plans get a starter pack. Credit packs are coming
                  soon.
                </p>
                <div className="mt-4 flex items-end justify-between gap-4">
                  <div>
                    <div className="font-ds-ui text-[11px] text-[#A3A3A3]">Balance</div>
                    <div className="font-ds-sans text-[28px] font-medium tracking-[-0.6px] text-[#171717]">
                      {credits}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled
                    title="Credit packs are coming soon"
                    className="inline-flex h-9 cursor-not-allowed items-center rounded-md border border-[#1717171F] bg-[#FAFAFA] px-3 font-ds-sans text-[13px] font-medium text-[#A3A3A3]"
                  >
                    Buy credits · soon
                  </button>
                </div>
              </section>

              <section className="rounded-2xl border border-[#17171714] bg-white p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-ds-sans text-[16px] font-medium tracking-[-0.3px] text-[#171717]">
                    Change plan
                  </h2>
                  <span className="font-ds-ui text-[12px] text-[#737373]">
                    Every limit below is enforced in the product, not just listed.
                  </span>
                </div>
                {!usage?.subscribed && (
                  <p className="mt-1 font-ds-ui text-[13px] text-[#737373]">
                    Plans are switched manually until you&apos;re subscribed.
                  </p>
                )}
                <div
                  data-testid="change-plan-grid"
                  className={`mt-5 grid gap-3 sm:grid-cols-2 ${
                    changePlans.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4"
                  }`}
                >
                  {changePlans.map((p) => {
                    const isCurrent = p.id === plan;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        data-plan={p.id}
                        disabled={saving || isCurrent}
                        onClick={() => changePlan(p.id)}
                        className={`flex cursor-pointer flex-col gap-1 rounded-[12px] border p-4 text-left transition disabled:cursor-default ${
                          isCurrent
                            ? "border-[#171717] bg-[#FAFAFA]"
                            : "border-[#1717171F] bg-white hover:bg-[#FAFAFA]"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-ds-sans text-[15px] font-medium text-[#171717]">
                            {p.name}
                          </span>
                          <span className="font-ds-mono text-[12px] text-[#737373]">{p.price}</span>
                        </div>
                        <span className="font-ds-ui text-[12px] text-[#737373]">{p.blurb}</span>
                        <span className="mt-2 font-ds-ui text-[11px] text-[#A3A3A3]">
                          {p.billingLimits}
                        </span>
                        {isCurrent && (
                          <span className="mt-2 font-ds-ui text-[11px] font-medium text-[#171717]">
                            Current plan
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>

            </>
          )}
        </div>
      </main>
    </div>
  );
}

function UsageBar({
  label,
  value,
  pct,
  warn,
}: {
  label: string;
  value: string;
  pct: number;
  warn?: boolean;
}) {
  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-start justify-between">
        <span className="font-ds-ui text-[13px] font-medium text-[#171717]">{label}</span>
        <span className="font-ds-mono text-[12px] text-[#737373]">{value}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#F5F5F5]">
        <div
          className={`h-full rounded-full ${warn ? "bg-[#F59E0B]" : "bg-[#171717]"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
