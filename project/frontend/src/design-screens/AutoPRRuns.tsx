"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { Tour } from "@/components/coach/Tour";
import { api } from "@/lib/api";
import { repoPlatformLabel, shortRepo, type ProjectRepo, type ReposResponse } from "@/lib/repos";
import type { MeResponse } from "@/lib/usage";
import { AUTO_PR_VISIBLE } from "@/lib/plans";

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
  suggested_repo?: string;
  reroute_reason?: string;
};

function isGitLabRun(run: AutoprRun, repos: ProjectRepo[]) {
  if (run.pr_url?.includes("/-/merge_requests/")) return true;
  const match = repos.find((r) => r.full_name.toLowerCase() === (run.repo || "").toLowerCase());
  return match?.provider === "gitlab";
}

function statusLabel(status: string, isGitLab = false) {
  switch (status) {
    case "queued":
      return "Queued";
    case "running":
      return "Running";
    case "succeeded":
      return isGitLab ? "MR opened" : "PR opened";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    case "needs_reroute":
      return "Needs reroute";
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
  const [gitlabConnected, setGitlabConnected] = useState(false);
  const [repos, setRepos] = useState<ProjectRepo[]>([]);
  const [crossRead, setCrossRead] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [rerunning, setRerunning] = useState(false);
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
      api<ReposResponse>(`/api/projects/${id}/repos`).catch(() => null),
    ])
      .then(([meRes, projectRes, runsRes, integRes, reposRes]) => {
        if (cancelled) return;
        setRepos(reposRes?.repos || []);
        setCrossRead(Boolean(reposRes?.allow_cross_repo_read));
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
        const gl = (integRes.integrations || []).find((i) => i.provider === "gitlab");
        setGitlabConnected(Boolean(gl));
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
  const rerouteRun =
    selected && selected.status === "needs_reroute" && !dismissed.has(selected.id) ? selected : null;

  // "Run in <repo>": move the ticket to the suggested repo, then start a new run there (US-57).
  async function runInSuggested(run: AutoprRun) {
    const target = repos.find((r) => r.full_name.toLowerCase() === (run.suggested_repo || "").toLowerCase());
    if (!target) {
      setError(`${run.suggested_repo} is not connected to this project. Add it in Integrations first.`);
      return;
    }
    setRerunning(true);
    setError("");
    try {
      await api(`/api/tickets/${run.ticket_id}`, {
        method: "PATCH",
        body: JSON.stringify({ repo_id: target.id, reason: run.reroute_reason || "Suggested by auto PR" }),
      });
      const res = await api<{ run: AutoprRun }>(`/api/tickets/${run.ticket_id}/autopr`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setRuns((prev) => [res.run, ...prev]);
      setSelectedId(res.run.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the run");
    } finally {
      setRerunning(false);
    }
  }
  const credits = me?.usage?.auto_pr_credits ?? 0;
  const succeeded = runs.filter((r) => r.status === "succeeded").length;
  const hasIntegration = Boolean(repos.length || githubRepo || gitlabConnected);

  return (
    <div className="box-border flex min-h-screen w-full bg-white">
      <Tour id="auto-pr" ready={!loading} />
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
                {AUTO_PR_VISIBLE ? "Add-on" : "Coming soon"}
              </span>
            </div>
            <p className="font-ds-ui text-[13.5px] text-[#737373]">
              {AUTO_PR_VISIBLE
                ? "Agent opens a pull request (GitHub) or merge request (GitLab) from a ticket. Review and merge yourself \u2014 Saidloop never merges."
                : "An agent that turns a ticket into a fix PR or MR you review. It is not available yet."}
            </p>
          </div>
          {AUTO_PR_VISIBLE && (
          <Link
            href="/app/settings/billing"
            className="inline-flex h-9 shrink-0 items-center rounded-md border border-[#1717171F] bg-white px-3 font-ds-sans text-[13px] font-medium text-[#171717] no-underline"
          >
            Buy credits
          </Link>
          )}
        </header>

        <div className="flex flex-1 flex-col gap-6 px-10 pb-10 pt-6">
          {!AUTO_PR_VISIBLE ? (
            <div
              data-pencil-name="Auto PR coming soon"
              className="flex max-w-[560px] flex-col gap-2 rounded-xl border border-[#17171714] bg-[#FAFAFA] p-6"
            >
              <p className="font-ds-sans text-[15px] font-medium text-[#171717]">Auto PR is coming soon</p>
              <p className="font-ds-ui text-[13px] text-[#737373]">
                We are still building the agent that writes the fix. Until then, use the MCP loop to
                fix tickets from your own coding agent, or create a GitHub issue from a ticket.
              </p>
              <Link
                href="/app/inbox"
                className="mt-2 w-fit font-ds-ui text-[13px] text-[#171717] underline"
              >
                Back to inbox
              </Link>
            </div>
          ) : loading ? (
            <p className="font-ds-ui text-sm text-[#737373]">Loading…</p>
          ) : (
            <>
              {error && <p className="font-ds-ui text-sm text-[#DA314A]">{error}</p>}

              <div className="grid gap-3 sm:grid-cols-4">
                <Stat label="Runs listed" value={String(runs.length)} />
                <Stat label="PRs / MRs opened" value={String(succeeded)} />
                <Stat label="Credits left" value={String(credits)} />
                <Stat
                  label="Repository"
                  value={
                    repos.length
                      ? `${repos.length} connected`
                      : githubRepo || (gitlabConnected ? "GitLab connected" : "Not connected")
                  }
                  href={hasIntegration ? undefined : "/app/settings/integrations"}
                />
              </div>

              <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_320px]">
                <div
                  data-tour="autopr-runs"
                  className="overflow-hidden rounded-xl border border-[#17171714]"
                >
                  <table className="w-full border-collapse text-left">
                    <thead className="bg-[#FAFAFA]">
                      <tr className="font-ds-ui text-[11px] text-[#A3A3A3]">
                        <th className="px-4 py-2.5 font-medium">Status</th>
                        <th className="px-4 py-2.5 font-medium">Ticket</th>
                        <th className="px-4 py-2.5 font-medium">PR / MR</th>
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
                            {!hasIntegration ? (
                              <>
                                {" "}
                                after{" "}
                                <Link
                                  href="/app/settings/integrations"
                                  className="text-[#171717] underline"
                                >
                                  connecting GitHub or GitLab
                                </Link>
                              </>
                            ) : null}
                            .
                          </td>
                        </tr>
                      ) : (
                        runs.map((run) => {
                          const isGL = isGitLabRun(run, repos);
                          return (
                            <tr
                              key={run.id}
                              onClick={() => setSelectedId(run.id)}
                              className={`cursor-pointer border-t border-[#17171714] font-ds-ui text-[13px] ${
                                run.status === "needs_reroute"
                                  ? "bg-[#FFF7ED]"
                                  : selectedId === run.id
                                    ? "bg-[#FAFAFA]"
                                    : "bg-white"
                              }`}
                            >
                              <td className="px-4 py-3 text-[#171717]">
                                {run.status === "needs_reroute" ? (
                                  <span className="inline-flex items-center gap-1.5 text-[#EA6C0C]">
                                    <span aria-hidden>↪</span>
                                    {statusLabel(run.status, isGL)}
                                  </span>
                                ) : (
                                  statusLabel(run.status, isGL)
                                )}
                              </td>
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
                                    {isGL ? "Open MR" : "Open PR"}
                                  </a>
                                ) : (
                                  <span className="text-[#A3A3A3]">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3 font-ds-mono text-[12px]">
                                {run.status === "needs_reroute" ? (
                                  <span className="text-[#16A34A]">Refund</span>
                                ) : (
                                  formatCost(run.cost_cents)
                                )}
                              </td>
                              <td className="px-4 py-3 text-[#737373]">
                                {formatWhen(run.created_at)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {rerouteRun && (
                  <div
                    data-pencil-name="Needs reroute"
                    className="flex flex-col gap-3 rounded-xl border border-[#F59E0B4D] bg-white p-5 lg:col-start-1"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="font-ds-sans text-[15px] font-semibold text-[#171717]">
                          Run #{rerouteRun.id.slice(0, 6)} stopped: the fix belongs in another repo
                        </div>
                        <div className="font-ds-ui text-[12.5px] text-[#737373]">
                          #{rerouteRun.ticket_id.slice(0, 8)} · ran in {rerouteRun.repo}
                        </div>
                      </div>
                      <span className="rounded-full bg-[#F0FDF4] px-2 py-0.5 font-ds-ui text-[11px] font-medium text-[#16A34A]">
                        1 credit refunded
                      </span>
                    </div>
                    <div className="rounded-lg bg-[#FAFAFA] p-3 font-ds-mono text-[12px] text-[#171717]">
                      Suggested repo: {rerouteRun.suggested_repo || "—"}
                      {rerouteRun.reroute_reason && (
                        <div className="mt-1 font-ds-ui text-[12.5px] text-[#737373]">
                          “{rerouteRun.reroute_reason}”
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-ds-ui text-[12px] text-[#A3A3A3]">No pull or merge request was opened.</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setDismissed((prev) => new Set(prev).add(rerouteRun.id))}
                          className="h-8 cursor-pointer rounded-md border border-[#1717171F] bg-white px-3 font-ds-sans text-[13px] font-medium text-[#171717]"
                        >
                          Dismiss
                        </button>
                        {rerouteRun.suggested_repo && (
                          <button
                            type="button"
                            disabled={rerunning}
                            onClick={() => void runInSuggested(rerouteRun)}
                            className="h-8 cursor-pointer rounded-md bg-[#171717] px-3 font-ds-sans text-[13px] font-medium text-white disabled:opacity-50"
                          >
                            {rerunning ? "Starting…" : `Run in ${shortRepo(rerouteRun.suggested_repo)}`}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <aside className="flex flex-col gap-4 rounded-xl border border-[#17171714] bg-[#FAFAFA] p-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
                  <div data-tour="autopr-repo">
                    <div className="font-ds-ui text-[11px] font-medium text-[#A3A3A3]">Repositories</div>
                    <p className="mt-1 font-ds-ui text-[12px] text-[#737373]">
                      Each run uses the ticket&apos;s repo (GitHub or GitLab). Write access covers that repo only.
                    </p>
                    {repos.length === 0 ? (
                      <div className="mt-2 font-ds-ui text-[13px] text-[#171717]">
                        {githubRepo || (gitlabConnected ? "GitLab connected" : "Connect GitHub or GitLab")}
                      </div>
                    ) : (
                      <ul className="mt-2 flex flex-col gap-1.5">
                        {repos.map((r) => (
                          <li key={r.id} className="flex flex-col">
                            <span className="font-ds-mono text-[12px] text-[#171717]">{r.full_name}</span>
                            <span className="font-ds-ui text-[11px] text-[#A3A3A3]">
                              {r.provider === "gitlab" ? "GitLab" : "GitHub"} ·{" "}
                              {r.routes.length
                                ? r.routes.map((rt) => repoPlatformLabel(rt.platform)).join(", ")
                                : r.is_fallback
                                  ? "Fallback"
                                  : "No platforms"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-2 font-ds-ui text-[12px] text-[#737373]">
                      Read access to other repos: {crossRead ? "on" : "off"}
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
                  {!hasIntegration && projectId ? (
                    <Link
                      href="/app/settings/integrations"
                      className="inline-flex h-9 items-center justify-center rounded-md bg-[#171717] px-3 font-ds-sans text-[13px] font-medium text-white no-underline"
                    >
                      Connect GitHub or GitLab
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
