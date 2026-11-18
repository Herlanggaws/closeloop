"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { api } from "@/lib/api";
import type { MeResponse } from "@/lib/usage";

type AutoprRun = {
  id: string;
  ticket_id: string;
  status: string;
  repo: string;
  branch: string;
  pr_url: string;
  cost_cents: number;
  error: string;
  log_excerpt: string;
  created_at: string;
  finished_at?: string | null;
};

function statusLabel(status: string) {
  switch (status) {
    case "queued":
      return "Queued";
    case "running":
      return "Running";
    case "succeeded":
      return "PR opened";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

function formatCost(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function AutoPRRuns() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [projectName, setProjectName] = useState("Project");
  const [projectId, setProjectId] = useState("");
  const [runs, setRuns] = useState<AutoprRun[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [githubRepo, setGithubRepo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const id = localStorage.getItem("closeloop_project");
    if (!id) {
      router.replace("/app/onboarding");
      return;
    }
    setProjectId(id);
    let cancelled = false;
    Promise.all([
      api<MeResponse>("/api/me"),
      api<{ project: { name: string } }>(`/api/projects/${id}`),
      api<{ runs: AutoprRun[] }>(`/api/projects/${id}/autopr/runs`),
      api<{ integrations: { provider: string; config: Record<string, unknown> | string }[] }>(
        `/api/projects/${id}/integrations`,
      ),
    ])
      .then(([meRes, projectRes, runsRes, integRes]) => {
        if (cancelled) return;
        setMe(meRes);
        setProjectName(projectRes.project.name || "Project");
        const list = runsRes.runs || [];
        setRuns(list);
        if (list[0]) setSelectedId(list[0].id);
        const gh = (integRes.integrations || []).find((i) => i.provider === "github_app");
        if (gh) {
          const cfg =
            typeof gh.config === "string"
              ? (JSON.parse(gh.config) as Record<string, unknown>)
              : gh.config;
          setGithubRepo(String(cfg.repo_full_name || ""));
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  const selected = runs.find((r) => r.id === selectedId) || null;
  const credits = me?.usage?.auto_pr_credits ?? 0;
  const succeeded = runs.filter((r) => r.status === "succeeded").length;

  return (
    <div className="box-border flex min-h-screen w-full bg-white">
      <AppSidebar
        projectName={projectName}
        plan={me?.org.plan || "free"}
        email={me?.user.email || ""}
        usage={me?.usage}
        userName={me?.user?.name}
        avatarUrl={me?.user?.avatar_url}
        active="auto-pr"
      />

      <main className="flex min-h-screen min-w-0 flex-1 flex-col overflow-y-auto bg-white">
        <header className="flex shrink-0 items-end justify-between gap-4 border-b border-[#17171714] px-10 pb-6 pt-7">
          <div className="flex max-w-[720px] flex-col gap-1">
            <div className="flex items-center gap-2">
              <h1 className="font-ds-sans text-2xl font-medium tracking-[-0.4px] text-[#171717]">
                Auto PR runs
              </h1>
              <span className="rounded-full bg-[#F5F5F5] px-2 py-0.5 font-ds-ui text-[11px] text-[#737373]">
                Add-on
              </span>
            </div>
            <p className="font-ds-ui text-[13.5px] text-[#737373]">
              Agent opens a pull request from a ticket. Review and merge yourself — Saidloop never
              merges.
            </p>
          </div>
          <Link
            href="/app/settings/billing"
            className="inline-flex h-9 shrink-0 items-center rounded-md border border-[#1717171F] bg-white px-3 font-ds-sans text-[13px] font-medium text-[#171717] no-underline"
          >
            Buy credits
          </Link>
        </header>

        <div className="flex flex-1 flex-col gap-6 px-10 pb-10 pt-6">
          {loading ? (
            <p className="font-ds-ui text-sm text-[#737373]">Loading…</p>
          ) : (
            <>
              {error && <p className="font-ds-ui text-sm text-[#DA314A]">{error}</p>}

              <div className="grid gap-3 sm:grid-cols-4">
                <Stat label="Runs listed" value={String(runs.length)} />
                <Stat label="PRs opened" value={String(succeeded)} />
                <Stat label="Credits left" value={String(credits)} />
                <Stat
                  label="Repository"
                  value={githubRepo || "Not connected"}
                  href={githubRepo ? undefined : "/app/settings/integrations"}
                />
              </div>

              <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_320px]">
                <div className="overflow-hidden rounded-xl border border-[#17171714]">
                  <table className="w-full border-collapse text-left">
                    <thead className="bg-[#FAFAFA]">
                      <tr className="font-ds-ui text-[11px] text-[#A3A3A3]">
                        <th className="px-4 py-2.5 font-medium">Status</th>
                        <th className="px-4 py-2.5 font-medium">Ticket</th>
                        <th className="px-4 py-2.5 font-medium">Pull request</th>
                        <th className="px-4 py-2.5 font-medium">Cost</th>
                        <th className="px-4 py-2.5 font-medium">Started</th>
                      </tr>
                    </thead>
                    <tbody>
                      {runs.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-4 py-8 font-ds-ui text-[13px] text-[#737373]"
                          >
                            No runs yet. Open a ticket and click Run Auto PR
                            {!githubRepo ? (
                              <>
                                {" "}
                                after{" "}
                                <Link
                                  href="/app/settings/integrations"
                                  className="text-[#171717] underline"
                                >
                                  connecting GitHub App
                                </Link>
                              </>
                            ) : null}
                            .
                          </td>
                        </tr>
                      ) : (
                        runs.map((run) => (
                          <tr
                            key={run.id}
                            onClick={() => setSelectedId(run.id)}
                            className={`cursor-pointer border-t border-[#17171714] font-ds-ui text-[13px] ${
                              selectedId === run.id ? "bg-[#FAFAFA]" : "bg-white"
                            }`}
                          >
                            <td className="px-4 py-3 text-[#171717]">{statusLabel(run.status)}</td>
                            <td className="px-4 py-3">
                              <Link
                                href={`/app/tickets/${run.ticket_id}`}
                                className="text-[#171717] underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {run.ticket_id.slice(0, 8)}
                              </Link>
                            </td>
                            <td className="px-4 py-3">
                              {run.pr_url ? (
                                <a
                                  href={run.pr_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[#171717] underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Open PR
                                </a>
                              ) : (
                                <span className="text-[#A3A3A3]">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 font-ds-mono text-[12px]">
                              {formatCost(run.cost_cents)}
                            </td>
                            <td className="px-4 py-3 text-[#737373]">
                              {formatWhen(run.created_at)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <aside className="flex flex-col gap-4 rounded-xl border border-[#17171714] bg-[#FAFAFA] p-4">
                  <div>
                    <div className="font-ds-ui text-[11px] font-medium text-[#A3A3A3]">Repository</div>
                    <div className="mt-1 font-ds-ui text-[13px] text-[#171717]">
                      {githubRepo || "Connect GitHub App"}
                    </div>
                    <p className="mt-1 font-ds-ui text-[12px] text-[#737373]">
                      Read code · create PRs · never merges
                    </p>
                  </div>
                  <div>
                    <div className="font-ds-ui text-[11px] font-medium text-[#A3A3A3]">Credits</div>
                    <div className="mt-1 font-ds-sans text-xl font-medium text-[#171717]">
                      {credits}
                    </div>
                    <p className="mt-1 font-ds-ui text-[12px] text-[#737373]">
                      1 credit = 1 run · paid plans only
                    </p>
                  </div>
                  {selected ? (
                    <div>
                      <div className="font-ds-ui text-[11px] font-medium text-[#A3A3A3]">Run log</div>
                      <pre className="mt-2 max-h-[240px] overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 font-ds-mono text-[11px] text-[#171717]">
                        {selected.log_excerpt || selected.error || "No log yet."}
                      </pre>
                    </div>
                  ) : null}
                  {!githubRepo && projectId ? (
                    <Link
                      href="/app/settings/integrations"
                      className="inline-flex h-9 items-center justify-center rounded-md bg-[#171717] px-3 font-ds-sans text-[13px] font-medium text-white no-underline"
                    >
                      Connect GitHub App
                    </Link>
                  ) : null}
                </aside>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function Stat({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  const inner = (
    <>
      <div className="font-ds-ui text-[11px] text-[#A3A3A3]">{label}</div>
      <div className="mt-1 truncate font-ds-sans text-[18px] font-medium tracking-[-0.3px] text-[#171717]">
        {value}
      </div>
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="rounded-xl border border-[#17171714] bg-white p-4 no-underline"
      >
        {inner}
      </Link>
    );
  }
  return <div className="rounded-xl border border-[#17171714] bg-white p-4">{inner}</div>;
}
