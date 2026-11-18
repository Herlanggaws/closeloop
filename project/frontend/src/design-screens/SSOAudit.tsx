"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { api } from "@/lib/api";
import type { MeResponse } from "@/lib/usage";

type AuditEntry = {
  id: string;
  actor: string;
  action: string;
  target: string;
  ip: string;
  created_at: string;
};

type ProjectInfo = { id: string; name: string };

function formatWhen(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SSOAudit() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const projectId = localStorage.getItem("closeloop_project");
    if (!projectId) {
      router.replace("/app/onboarding");
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [meRes, projectRes] = await Promise.all([
          api<MeResponse>("/api/me"),
          api<{ project: ProjectInfo }>(`/api/projects/${projectId}`),
        ]);
        if (cancelled) return;
        setMe(meRes);
        setProject(projectRes.project);
        if ((meRes.org.plan || "").toLowerCase() === "business") {
          const audit = await api<{ entries: AuditEntry[] }>("/api/org/audit-logs?days=30&limit=100");
          if (!cancelled) setEntries(audit.entries || []);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function exportCSV() {
    setExporting(true);
    setError("");
    try {
      const token =
        typeof window !== "undefined" ? localStorage.getItem("closeloop_access") : null;
      const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
      const res = await fetch(`${base}/api/org/audit-logs/export?format=csv&days=30`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "audit-log.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  const plan = (me?.org.plan || "free").toLowerCase();
  const isBusiness = plan === "business";
  const projectName = project?.name || "Project";
  const email = me?.user.email || "";

  return (
    <div className="box-border flex min-h-screen w-full bg-white">
      <AppSidebar
        projectName={projectName}
        plan={plan}
        email={email}
        active="sso"
      />
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center border-b border-[#17171714] px-8">
          <h1 className="font-ds-sans text-[15px] font-medium tracking-[-0.2px] text-[#171717]">
            SSO &amp; audit
          </h1>
        </header>

        {error && (
          <div className="border-b border-[#FEF2F2] bg-[#FEF2F2] px-8 py-2 font-ds-ui text-[13px] text-[#DA314A]">
            {error}
          </div>
        )}

        <div className="flex flex-1 flex-col gap-6 overflow-auto px-8 py-7">
          <section className="overflow-hidden rounded-xl border border-[#17171714]">
            <div className="flex items-center justify-between border-b border-[#17171714] bg-[#FAFAFA] px-5 py-3">
              <div>
                <div className="font-ds-ui text-[13px] font-semibold text-[#171717]">
                  Single sign-on
                </div>
                <div className="font-ds-ui text-[12px] text-[#A3A3A3]">
                  SAML / OIDC — coming soon on Business
                </div>
              </div>
              <span className="rounded-md bg-[#F5F5F5] px-2 py-1 font-ds-ui text-[11px] text-[#737373]">
                Coming soon
              </span>
            </div>
            <div className="px-5 py-4 font-ds-ui text-[13px] text-[#737373]">
              Connect Okta, Google Workspace, or Azure AD when SSO ships. Force-SSO and verified
              domains stay disabled until then.
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-[#17171714]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#17171714] bg-[#FAFAFA] px-5 py-3">
              <div>
                <div className="font-ds-ui text-[13px] font-semibold text-[#171717]">Audit log</div>
                <div className="font-ds-ui text-[12px] text-[#A3A3A3]">Retained 1 year</div>
              </div>
              <button
                type="button"
                disabled={!isBusiness || exporting}
                onClick={() => void exportCSV()}
                className="flex h-7 items-center rounded-md border border-[#1717171F] bg-white px-2.5 font-ds-sans text-[12px] font-medium text-[#171717] disabled:opacity-50"
              >
                {exporting ? "Exporting…" : "Export CSV"}
              </button>
            </div>

            {loading ? (
              <div className="px-5 py-8 font-ds-ui text-[13px] text-[#A3A3A3]">Loading…</div>
            ) : !isBusiness ? (
              <div className="px-5 py-8 font-ds-ui text-[13px] text-[#A3A3A3]">
                Audit log export is available on the Business plan. Upgrade in Billing to view
                login, MCP, and Auto PR actions.
              </div>
            ) : entries.length === 0 ? (
              <div className="px-5 py-8 font-ds-ui text-[13px] text-[#A3A3A3]">
                No audit events in the last 30 days.
              </div>
            ) : (
              <div className="divide-y divide-[#17171714]">
                {entries.map((e) => (
                  <div key={e.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <span className="w-[110px] shrink-0 font-ds-mono text-[11.5px] text-[#A3A3A3]">
                      {formatWhen(e.created_at)}
                    </span>
                    <span className="w-[200px] shrink-0 truncate font-ds-ui text-[12.5px] text-[#171717]">
                      {e.actor}
                    </span>
                    <span className="rounded bg-[#EFF6FF] px-1.5 py-0.5 font-ds-ui text-[11px] font-medium text-[#266DF0]">
                      {e.action}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-ds-mono text-[11px] text-[#737373]">
                      {e.target || "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
