"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { api } from "@/lib/api";
import {
  formatUsage,
  planLabel,
  usagePeriodResetLabel,
  type MeResponse,
  type OrgUsage,
} from "@/lib/usage";

const PLANS: {
  id: "free" | "indie" | "studio" | "business";
  name: string;
  price: string;
  blurb: string;
  projects: string;
  reports: string;
}[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    blurb: "Widget, inbox, MCP read-only",
    projects: "1 project",
    reports: "50 reports / mo",
  },
  {
    id: "indie",
    name: "Indie",
    price: "$12",
    blurb: "All MCP tools, notify, Slack & GitHub Issues",
    projects: "3 projects",
    reports: "1,000 reports / mo",
  },
  {
    id: "studio",
    name: "Studio",
    price: "$39",
    blurb: "5 seats, branding, Linear & Jira, replay 7d",
    projects: "Unlimited projects",
    reports: "10,000 reports / mo",
  },
  {
    id: "business",
    name: "Business",
    price: "From $149",
    blurb: "SSO, audit, replay 30d, self-host option",
    projects: "Unlimited projects",
    reports: "Contract quota",
  },
];

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
      api<MeResponse>("/api/me"),
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
      const res = await api<{ usage: OrgUsage }>("/api/org/plan", {
        method: "PATCH",
        body: JSON.stringify({ plan }),
      });
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
  const reportPct =
    reports.limit === 0 ? 0 : Math.min(100, Math.round((reports.used / reports.limit) * 100));
  const projectPct =
    projects.limit === 0 ? 0 : Math.min(100, Math.round((projects.used / projects.limit) * 100));
  const overQuota = reports.limit > 0 && reports.used >= reports.limit;

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
                    <span className="rounded-full bg-[#22C55E26] px-2 py-0.5 font-ds-ui text-[11px] font-medium text-[#22C55E]">
                      Manual until Polar
                    </span>
                  </div>
                  <div className="flex items-end gap-2">
                    <span className="font-ds-sans text-[32px] font-medium tracking-[-0.8px]">
                      {planLabel(plan)}
                    </span>
                    <span className="pb-1 font-ds-ui text-[13px] text-white/70">
                      {PLANS.find((p) => p.id === plan)?.price || "$0"} / month
                    </span>
                  </div>
                  <p className="font-ds-ui text-[13px] text-white/70">
                    {PLANS.find((p) => p.id === plan)?.blurb}
                  </p>
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
                  Change plan
                </h2>
                <p className="mt-1 font-ds-ui text-[13px] text-[#737373]">
                  Polar checkout ships in M5. Until then, owners can switch entitlements here.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {PLANS.map((p) => {
                    const current = p.id === plan;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        disabled={saving || current}
                        onClick={() => changePlan(p.id)}
                        className={`flex cursor-pointer flex-col gap-1 rounded-[12px] border p-4 text-left transition disabled:cursor-default ${
                          current
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
                          {p.projects} · {p.reports}
                        </span>
                        {current && (
                          <span className="mt-2 font-ds-ui text-[11px] font-medium text-[#171717]">
                            Current
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
