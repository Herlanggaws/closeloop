"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { Tour } from "@/components/coach/Tour";
import { SessionReplayPlayer } from "@/components/SessionReplayPlayer";
import { api } from "@/lib/api";
import {
  STATUS_META,
  STATUS_OPTIONS,
  TYPE_STYLE,
  actorLabel,
  buildPosthogUrl,
  buildSentryUrl,
  contextEntries,
  displayName,
  eventDescription,
  platformLabel,
  primaryReport,
  relativeTime,
  replayUrl,
  reporterLine,
  reportersSummary,
  screenshotUrl,
  shortId,
  type TicketDetailResponse,
  type TicketStatus,
} from "@/lib/tickets";
import { planAtLeast } from "@/lib/plans";
import { repoPlatformLabel, shortRepo, type ProjectRepo, type ReposResponse } from "@/lib/repos";
import type { MeResponse } from "@/lib/usage";

type DetailTab = "activity" | "replay" | "sentry" | "posthog";

type ProjectInfo = { id: string; name: string };

export function ReportDetail() {
  const router = useRouter();
  const params = useParams();
  const ticketId = typeof params.id === "string" ? params.id : "";

  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [data, setData] = useState<TicketDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [autoprBusy, setAutoprBusy] = useState(false);
  const [autoprMsg, setAutoprMsg] = useState("");
  const [latestAutopr, setLatestAutopr] = useState<{
    status: string;
    pr_url?: string;
    error?: string;
  } | null>(null);
  const [githubIssueBusy, setGithubIssueBusy] = useState(false);
  const [githubIssueUrl, setGithubIssueUrl] = useState("");
  const [githubAppConnected, setGithubAppConnected] = useState(false);
  const [linearConnected, setLinearConnected] = useState(false);
  const [jiraConnected, setJiraConnected] = useState(false);
  const [linearIssueBusy, setLinearIssueBusy] = useState(false);
  const [linearIssueUrl, setLinearIssueUrl] = useState("");
  const [jiraIssueBusy, setJiraIssueBusy] = useState(false);
  const [jiraIssueUrl, setJiraIssueUrl] = useState("");
  const [detailTab, setDetailTab] = useState<DetailTab>("activity");
  const [projectRepos, setProjectRepos] = useState<ProjectRepo[]>([]);
  const [repoPickerOpen, setRepoPickerOpen] = useState(false);
  const [rerouting, setRerouting] = useState(false);

  useEffect(() => {
    const projectId = localStorage.getItem("closeloop_project");
    if (!projectId) {
      router.replace("/app/onboarding");
      return;
    }
    if (!ticketId || ticketId === "demo") {
      setLoading(false);
      setError("Open a report from the inbox to see live details.");
      return;
    }

    let cancelled = false;

    api<ReposResponse>(`/api/projects/${projectId}/repos`)
      .then((res) => !cancelled && setProjectRepos(res.repos || []))
      .catch(() => !cancelled && setProjectRepos([]));

    async function load() {
      setLoading(true);
      try {
        const [projectRes, meRes, detail, autoprRes, integRes] = await Promise.all([
          api<{ project: ProjectInfo }>(`/api/projects/${projectId}`),
          api<MeResponse>("/api/me"),
          api<TicketDetailResponse>(`/api/tickets/${ticketId}`),
          api<{ runs: { status: string; pr_url?: string; error?: string }[] }>(
            `/api/tickets/${ticketId}/autopr`,
          ).catch(() => ({ runs: [] })),
          api<{
            integrations: { provider: string; config: Record<string, unknown> | string }[];
          }>(`/api/projects/${projectId}/integrations`).catch(() => ({ integrations: [] })),
        ]);
        if (cancelled) return;
        setProject(projectRes.project);
        setMe(meRes);
        setData(detail);
        setLatestAutopr(autoprRes.runs?.[0] || null);
        const gh = (integRes.integrations || []).find((i) => i.provider === "github_app");
        let ghCfg: Record<string, unknown> = {};
        if (gh) {
          ghCfg =
            typeof gh.config === "string"
              ? (JSON.parse(gh.config) as Record<string, unknown>)
              : gh.config || {};
        }
        setGithubAppConnected(
          Boolean(ghCfg.installation_id) && Boolean(String(ghCfg.repo_full_name || "").trim()),
        );
        const linear = (integRes.integrations || []).find((i) => i.provider === "linear");
        const jira = (integRes.integrations || []).find((i) => i.provider === "jira");
        setLinearConnected(Boolean(linear));
        setJiraConnected(Boolean(jira));
        const linearEv = [...(detail.events || [])]
          .reverse()
          .find((e) => e.kind === "linear_issue_created");
        if (linearEv) {
          const payload =
            typeof linearEv.payload === "string"
              ? (JSON.parse(linearEv.payload) as { url?: string })
              : ((linearEv.payload || {}) as { url?: string });
          if (payload.url) setLinearIssueUrl(payload.url);
        }
        const jiraEv = [...(detail.events || [])]
          .reverse()
          .find((e) => e.kind === "jira_issue_created");
        if (jiraEv) {
          const payload =
            typeof jiraEv.payload === "string"
              ? (JSON.parse(jiraEv.payload) as { url?: string })
              : ((jiraEv.payload || {}) as { url?: string });
          if (payload.url) setJiraIssueUrl(payload.url);
        }
        const issueEv = [...(detail.events || [])]
          .reverse()
          .find((e) => e.kind === "github_issue_created");
        if (issueEv) {
          const payload =
            typeof issueEv.payload === "string"
              ? (JSON.parse(issueEv.payload) as { html_url?: string })
              : (issueEv.payload as { html_url?: string });
          setGithubIssueUrl(payload?.html_url || "");
        } else {
          setGithubIssueUrl("");
        }
        setError("");
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load report");
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [router, ticketId]);

  async function reloadDetail() {
    if (!ticketId) return;
    const detail = await api<TicketDetailResponse>(`/api/tickets/${ticketId}`);
    setData(detail);
  }

  async function addNote() {
    const body = note.trim();
    if (!body || !ticketId) return;
    setSavingNote(true);
    setError("");
    try {
      await api(`/api/tickets/${ticketId}/notes`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      setNote("");
      await reloadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add note");
    } finally {
      setSavingNote(false);
    }
  }

  async function runAutopr() {
    if (!ticketId || autoprBusy) return;
    setAutoprBusy(true);
    setAutoprMsg("");
    setError("");
    try {
      const res = await api<{ run: { status: string; pr_url?: string; error?: string } }>(
        `/api/tickets/${ticketId}/autopr`,
        { method: "POST", body: "{}" },
      );
      setLatestAutopr(res.run);
      setAutoprMsg(
        res.run.status === "queued" || res.run.status === "running"
          ? "Auto PR queued — watch progress under Auto PR runs."
          : `Auto PR ${res.run.status}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start Auto PR");
    } finally {
      setAutoprBusy(false);
    }
  }

  async function createTrackerIssue(
    path: "linear-issue" | "jira-issue",
    setBusy: (v: boolean) => void,
    setUrl: (v: string) => void,
  ) {
    if (!ticketId) return;
    setBusy(true);
    setError("");
    try {
      const res = await api<{ issue: { url?: string }; existing?: boolean }>(
        `/api/tickets/${ticketId}/${path}`,
        { method: "POST" },
      );
      if (res.issue?.url) setUrl(res.issue.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create issue");
    } finally {
      setBusy(false);
    }
  }

  async function createGitHubIssue() {
    if (!ticketId || githubIssueBusy) return;
    setGithubIssueBusy(true);
    setError("");
    try {
      const res = await api<{ issue: { html_url: string; number: number }; existing?: boolean }>(
        `/api/tickets/${ticketId}/github-issue`,
        { method: "POST", body: "{}" },
      );
      setGithubIssueUrl(res.issue.html_url);
      await reloadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create GitHub issue");
    } finally {
      setGithubIssueBusy(false);
    }
  }

  async function rerouteTo(repoId: string) {
    if (!ticketId) return;
    setRerouting(true);
    setError("");
    try {
      await api(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        body: JSON.stringify({ repo_id: repoId }),
      });
      setRepoPickerOpen(false);
      await reloadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change repo");
    } finally {
      setRerouting(false);
    }
  }

  async function changeStatus(status: TicketStatus) {
    if (!ticketId || !data || data.ticket.status === status) return;
    if (status === "fixed") {
      router.push(`/app/tickets/${ticketId}/fixed`);
      return;
    }
    const previous = data.ticket.status;
    setSavingStatus(true);
    setError("");
    try {
      await api(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setData((current) => {
        if (!current) return current;
        const optimistic = {
          id: `local-${Date.now()}`,
          ticket_id: ticketId,
          actor: me?.user.email ? `user:${me.user.email}` : "user",
          kind: "status_changed",
          payload: { from: previous, to: status },
          created_at: new Date().toISOString(),
        };
        return {
          ...current,
          ticket: { ...current.ticket, status },
          events: [...(current.events || []), optimistic],
        };
      });
      await reloadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setSavingStatus(false);
    }
  }

  const projectName = project?.name || "Project";
  const plan = me?.org.plan || "free";
  const email = me?.user.email || "";
  const ticket = data?.ticket;
  const report = data ? primaryReport(data.reports || []) : undefined;
  const typeStyle = TYPE_STYLE[ticket?.type || ""] || {
    bg: "#F5F5F5",
    text: "#737373",
    label: ticket?.type || "Report",
  };
  const statusMeta = STATUS_META[ticket?.status || ""] || {
    label: ticket?.status || "Unknown",
    dot: "#A3A3A3",
  };
  const shot = data ? screenshotUrl(data.attachments || []) : "";
  const replay = data ? replayUrl(data.attachments || []) : "";
  const contextRows = contextEntries(report);
  const reporterTotal = data?.reporters?.total ?? ticket?.report_count ?? 0;
  const events = data?.events || [];
  const sentryUrl = data ? buildSentryUrl(report, data.integrations) : null;
  const posthogUrl = data ? buildPosthogUrl(report, data.integrations) : null;
  const hasSentryConfig = !!data?.integrations?.some((i) => i.provider === "sentry");
  const hasPosthogConfig = !!data?.integrations?.some((i) => i.provider === "posthog");
  const replayPlanOk = plan === "studio" || plan === "business";
  const reporterItems = data?.reporters?.items || [];
  const hasRepos = projectRepos.length > 0;
  const ticketRepo = ticket?.repo || "";
  const primaryPlatform = data?.reports?.[0]?.platform || "web";
  const lastReroute = [...(data?.events || [])].reverse().find((e) => e.kind === "ticket_rerouted");
  const rerouteNote = (() => {
    if (!lastReroute) return "";
    const p = (typeof lastReroute.payload === "object" && lastReroute.payload) as Record<string, unknown> | null;
    const from = p && typeof p.from === "string" && p.from ? p.from : "";
    const platform = p && typeof p.platform === "string" ? repoPlatformLabel(p.platform) : "";
    return from ? `Rerouted from ${shortRepo(from)} by ${actorLabel(lastReroute.actor)}${platform ? ` · ${platform}` : ""}` : "";
  })();
  const autoprBlocked = hasRepos && !ticketRepo;
  // Issue buttons follow the plan: GitHub Issues on Indie+, Linear/Jira on Studio+ when connected.
  const githubIssueGrandfathered = !!data?.integrations?.some(
    (i) => i.provider === "github_app" && (i as { grandfathered?: boolean }).grandfathered,
  );
  const showGitHubIssue =
    !!githubIssueUrl || (githubAppConnected && (planAtLeast(plan, "indie") || githubIssueGrandfathered));
  const showLinearIssue = !!linearIssueUrl || (linearConnected && planAtLeast(plan, "studio"));
  const showJiraIssue = !!jiraIssueUrl || (jiraConnected && planAtLeast(plan, "studio"));

  return (
    <div className="box-border flex min-h-screen w-full bg-white">
      <Tour id="replay" ready={!loading && !!ticket} />
      <AppSidebar
        projectName={projectName}
        plan={plan}
        email={email}
        usage={me?.usage}
        userName={me?.user?.name}
        avatarUrl={me?.user?.avatar_url}
        active="inbox"
      />

      <main className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-[#17171714] px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/app/inbox"
              className="font-ds-ui text-[13px] text-[#737373] no-underline hover:text-[#171717]"
            >
              ← Inbox
            </Link>
            {ticket && (
              <span className="font-ds-mono text-[12px] text-[#A3A3A3]">
                #{shortId(ticket.id)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {ticket && showGitHubIssue && (
              <HeaderButton
                label={
                  githubIssueUrl
                    ? "GitHub issue ↗"
                    : githubIssueBusy
                      ? "Creating…"
                      : ticketRepo
                        ? `Create issue in ${shortRepo(ticketRepo)}`
                        : "Create GitHub issue"
                }
                href={githubIssueUrl || undefined}
                disabled={githubIssueBusy}
                onClick={
                  githubIssueUrl
                    ? undefined
                    : autoprBlocked
                      ? () => setRepoPickerOpen(true)
                      : () => void createGitHubIssue()
                }
              />
            )}
            {ticket && showLinearIssue && (
              <HeaderButton
                label={linearIssueUrl ? "Linear issue ↗" : linearIssueBusy ? "Creating…" : "Create Linear issue"}
                href={linearIssueUrl || undefined}
                disabled={linearIssueBusy}
                onClick={
                  linearIssueUrl
                    ? undefined
                    : () => void createTrackerIssue("linear-issue", setLinearIssueBusy, setLinearIssueUrl)
                }
              />
            )}
            {ticket && showJiraIssue && (
              <HeaderButton
                label={jiraIssueUrl ? "Jira issue ↗" : jiraIssueBusy ? "Creating…" : "Create Jira issue"}
                href={jiraIssueUrl || undefined}
                disabled={jiraIssueBusy}
                onClick={
                  jiraIssueUrl
                    ? undefined
                    : () => void createTrackerIssue("jira-issue", setJiraIssueBusy, setJiraIssueUrl)
                }
              />
            )}
            {ticket && (
              <HeaderButton
                label={autoprBusy ? "Starting…" : "Run auto PR"}
                disabled={autoprBusy || autoprBlocked}
                title={autoprBlocked ? "Pick a repo for this ticket first. Auto PR runs in the ticket's repo." : undefined}
                onClick={() => void runAutopr()}
              />
            )}
            {ticket && ticket.status !== "fixed" && (
              <Link
                href={`/app/tickets/${ticket.id}/fixed`}
                className="flex h-8 items-center rounded-md bg-[#171717] px-3 font-ds-sans text-[13px] font-medium tracking-[-0.2px] text-white no-underline shadow-[0_4px_4px_#1717170A]"
              >
                Mark fixed
              </Link>
            )}
          </div>
        </header>

        {error && (
          <div className="border-b border-[#FEF2F2] bg-[#FEF2F2] px-6 py-2 font-ds-ui text-[13px] text-[#DA314A]">
            {error}{" "}
            <Link href="/app/inbox" className="underline">
              Back to inbox
            </Link>
          </div>
        )}

        {loading ? (
          <div className="grid flex-1 place-items-center font-ds-ui text-sm text-[#737373]">
            Loading report…
          </div>
        ) : !ticket ? (
          <div className="grid flex-1 place-items-center gap-3 font-ds-ui text-sm text-[#737373]">
            <p>Report not found.</p>
            <Link href="/app/inbox" className="text-[#266DF0] no-underline">
              Back to inbox
            </Link>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1">
            <div className="flex min-w-0 flex-1 flex-col gap-6 overflow-auto px-8 py-7">
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="rounded px-1.5 py-0.5 font-ds-ui text-[11px] font-medium"
                    style={{ background: typeStyle.bg, color: typeStyle.text }}
                  >
                    {typeStyle.label}
                  </span>
                  <span className="inline-flex h-[22px] items-center gap-1.5 rounded-full border border-[#1717171F] bg-white px-2">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: statusMeta.dot }}
                    />
                    <span className="font-ds-ui text-[11px] font-medium text-[#171717]">
                      {statusMeta.label}
                    </span>
                  </span>
                  <span className="font-ds-ui text-xs text-[#737373]">
                    {ticket.report_count} reporter{ticket.report_count === 1 ? "" : "s"}
                    {reporterTotal > 0 ? ` · ${reporterTotal} linked` : ""}
                  </span>
                </div>

                <h1 className="font-ds-sans text-[26px] font-medium tracking-[-0.6px] text-[#171717]">
                  {ticket.title}
                </h1>

                <p className="font-ds-ui text-[13px] text-[#737373]">
                  {reporterLine(report, ticket.created_at)}
                </p>
              </div>

              {report?.message && (
                <div className="border-l-2 border-[#1717171F] py-1 pl-4">
                  <p className="font-ds-sans text-[15px] leading-[23px] tracking-[-0.2px] text-[#171717]">
                    {report.message}
                  </p>
                </div>
              )}

              <div className="relative h-[300px] overflow-hidden rounded-xl border border-[#17171714] bg-[#FAFAFA]">
                {shot ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={shot}
                    alt="Report screenshot"
                    className="h-full w-full object-contain object-top"
                  />
                ) : (
                  <div className="grid h-full place-items-center font-ds-ui text-[13px] text-[#A3A3A3]">
                    No screenshot uploaded
                  </div>
                )}
              </div>

              <div className="flex gap-5 border-b border-[#17171714]">
                {(
                  [
                    ["activity", "Activity"],
                    ["replay", "Session replay"],
                    ["sentry", "Sentry"],
                    ["posthog", "PostHog"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    data-tour={id === "replay" ? "ticket-replay-tab" : undefined}
                    onClick={() => setDetailTab(id)}
                    className={
                      detailTab === id
                        ? "border-b-2 border-[#171717] pb-2.5 font-ds-ui text-[13px] font-medium text-[#171717]"
                        : "border-b-2 border-transparent pb-2.5 font-ds-ui text-[13px] font-medium text-[#737373]"
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-3.5 pb-8">
                {detailTab === "activity" &&
                  (events.length === 0 ? (
                    <p className="font-ds-ui text-[13px] text-[#A3A3A3]">No activity yet.</p>
                  ) : (
                    events.map((event) => (
                      <div key={event.id} className="flex items-center gap-2.5">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F5F5F5] font-ds-ui text-[10px] text-[#737373]">
                          {event.kind === "note" ? "N" : event.kind === "status_changed" ? "S" : "•"}
                        </div>
                        <div className="min-w-0 flex-1 font-ds-ui text-[13px]">
                          <span className="font-medium text-[#171717]">
                            {actorLabel(event.actor)}
                          </span>{" "}
                          <span className="text-[#737373]">{eventDescription(event)}</span>
                        </div>
                        <span className="shrink-0 font-ds-mono text-[11px] text-[#A3A3A3]">
                          {relativeTime(event.created_at)}
                        </span>
                      </div>
                    ))
                  ))}

                {detailTab === "replay" &&
                  (replay ? (
                    <SessionReplayPlayer url={replay} />
                  ) : replayPlanOk ? (
                    <p className="font-ds-ui text-[13px] text-[#A3A3A3]">
                      No session replay was attached to this report.
                    </p>
                  ) : (
                    <p className="font-ds-ui text-[13px] text-[#A3A3A3]">
                      Session replay is available on Studio.
                    </p>
                  ))}

                {detailTab === "sentry" &&
                  (sentryUrl ? (
                    <a
                      href={sentryUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-ds-ui text-[13px] text-[#266DF0] no-underline"
                    >
                      Open related Sentry event
                    </a>
                  ) : (
                    <p className="font-ds-ui text-[13px] text-[#A3A3A3]">
                      {hasSentryConfig
                        ? "No Sentry event id on this report."
                        : "Connect Sentry in Integrations to deep-link events."}
                    </p>
                  ))}

                {detailTab === "posthog" &&
                  (posthogUrl ? (
                    <a
                      href={posthogUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-ds-ui text-[13px] text-[#266DF0] no-underline"
                    >
                      Open PostHog session
                    </a>
                  ) : (
                    <p className="font-ds-ui text-[13px] text-[#A3A3A3]">
                      {hasPosthogConfig
                        ? "No PostHog session id on this report."
                        : "Connect PostHog in Integrations to deep-link sessions."}
                    </p>
                  ))}
              </div>
            </div>

            <aside className="flex w-[340px] shrink-0 flex-col gap-5 overflow-auto border-l border-[#17171714] bg-[#FAFAFA] px-5 py-6">
              <div className="flex flex-col gap-2.5">
                <div className="font-ds-ui text-[11px] font-medium text-[#A3A3A3]">Status</div>
                <StatusSelect
                  value={(ticket.status as TicketStatus) || "open"}
                  disabled={savingStatus}
                  onChange={changeStatus}
                />
              </div>

              {hasRepos && (
                <div data-pencil-name="Repo" className="relative flex flex-col gap-2.5">
                  <div className="font-ds-ui text-[11px] font-medium text-[#A3A3A3]">Repo</div>
                  <button
                    type="button"
                    onClick={() => setRepoPickerOpen((v) => !v)}
                    className="flex w-full cursor-pointer flex-col items-start gap-0.5 rounded-lg border border-[#1717171F] bg-white px-3 py-2 text-left hover:bg-[#FAFAFA]"
                  >
                    {ticketRepo ? (
                      <>
                        <span className="font-ds-mono text-[12.5px] text-[#171717]">{ticketRepo}</span>
                        {rerouteNote && (
                          <span className="font-ds-ui text-[11px] text-[#737373]">{rerouteNote}</span>
                        )}
                      </>
                    ) : (
                      <span className="flex items-center gap-1.5 font-ds-ui text-[12.5px] font-medium text-[#EA6C0C]">
                        <span className="inline-block h-2.5 w-2.5 rounded-full border border-dashed border-[#EA6C0C]" />
                        No repo yet
                      </span>
                    )}
                  </button>
                  {!ticketRepo && (
                    <p className="font-ds-ui text-[11.5px] leading-[16px] text-[#737373]">
                      {repoPlatformLabel(primaryPlatform)} has no repo, and this project has no fallback. Pick one
                      to run auto PR or create an issue.
                    </p>
                  )}
                  {repoPickerOpen && (
                    <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 overflow-hidden rounded-[10px] border border-[#17171714] bg-white py-1 shadow-[0_8px_24px_#17171714]">
                      {projectRepos.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          disabled={rerouting || r.id === ticket?.repo_id}
                          onClick={() => void rerouteTo(r.id)}
                          className="flex w-full cursor-pointer flex-col items-start px-3 py-1.5 text-left hover:bg-[#FAFAFA] disabled:cursor-default"
                        >
                          <span className="font-ds-mono text-[12px] text-[#171717]">
                            {r.full_name}
                            {r.id === ticket?.repo_id ? " ✓" : ""}
                          </span>
                          <span className="font-ds-ui text-[11px] text-[#A3A3A3]">
                            {r.routes.length
                              ? r.routes.map((rt) => repoPlatformLabel(rt.platform)).join(", ")
                              : r.is_fallback
                                ? "Fallback"
                                : "No platforms"}
                          </span>
                        </button>
                      ))}
                      <p className="border-t border-[#17171714] px-3 pb-1 pt-2 font-ds-ui text-[11px] text-[#A3A3A3]">
                        The change is saved to this ticket&apos;s history.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div data-pencil-name="Reporters" className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="font-ds-ui text-[11px] font-medium text-[#A3A3A3]">Reporters</div>
                  <div className="font-ds-ui text-[11px] text-[#737373]">
                    {reportersSummary(reporterItems, data?.reporters?.by_platform)}
                  </div>
                </div>
                {reporterItems.length === 0 ? (
                  <p className="font-ds-ui text-xs text-[#A3A3A3]">No reporters yet.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {reporterItems.map((r, index) => {
                      const name = r.email ? displayName(r.email) : "Anonymous";
                      return (
                        <div
                          key={`${r.reporter_id || "anon"}-${r.platform}-${index}`}
                          className="flex items-center gap-2.5"
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#E5E5E5] font-ds-ui text-[10px] font-semibold text-[#525252]">
                            {r.email ? name.charAt(0).toUpperCase() : "?"}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-ds-ui text-[12.5px] font-medium text-[#171717]">
                              {name}
                            </span>
                            <span
                              className={`block truncate font-ds-ui text-[11px] ${
                                r.email ? "text-[#737373]" : "text-[#A3A3A3]"
                              }`}
                            >
                              {r.email || "no email"}
                            </span>
                          </span>
                          <span className="shrink-0 font-ds-ui text-[11px] text-[#737373]">
                            {platformLabel(r.platform)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2.5">
                <div className="font-ds-ui text-[11px] font-medium text-[#A3A3A3]">Context</div>
                {contextRows.length === 0 ? (
                  <p className="font-ds-ui text-xs text-[#A3A3A3]">No context captured.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {contextRows.map((row) => (
                      <div key={row.key} className="flex items-start justify-between gap-3">
                        <span className="shrink-0 font-ds-ui text-xs text-[#737373]">
                          {row.key}
                        </span>
                        <span className="max-w-[60%] truncate text-right font-ds-mono text-[11.5px] text-[#171717]">
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2.5">
                <div className="font-ds-ui text-[11px] font-medium text-[#A3A3A3]">Linked</div>
                {sentryUrl ? (
                  <LinkedRow
                    title="Sentry event"
                    subtitle="Sentry · open related error"
                    actionLabel="Open"
                    href={sentryUrl}
                  />
                ) : (
                  <LinkedRow
                    title="Sentry"
                    subtitle={
                      hasSentryConfig
                        ? "No sentry_event_id on this report"
                        : "Connect in Integrations"
                    }
                  />
                )}
                {posthogUrl ? (
                  <LinkedRow
                    title="Session before report"
                    subtitle="PostHog · open session replay"
                    actionLabel="Play"
                    href={posthogUrl}
                  />
                ) : (
                  <LinkedRow
                    title="Session before report"
                    subtitle={
                      hasPosthogConfig
                        ? "No posthog_session_id on this report"
                        : "Connect in Integrations"
                    }
                  />
                )}
                <LinkedRow
                  title={
                    latestAutopr?.pr_url
                      ? "Pull request ready"
                      : latestAutopr
                        ? `Auto PR · ${latestAutopr.status}`
                        : "No pull request yet"
                  }
                  subtitle="Auto PR · 1 credit per run"
                  actionLabel={autoprBusy ? "…" : "Run"}
                  onAction={() => void runAutopr()}
                  actionDisabled={autoprBusy}
                  footer={
                    <>
                      {autoprMsg ? (
                        <p className="mt-1 font-ds-ui text-[11px] text-[#737373]">{autoprMsg}</p>
                      ) : null}
                      {latestAutopr?.pr_url ? (
                        <a
                          href={latestAutopr.pr_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-block font-ds-ui text-[11px] text-[#171717] underline"
                        >
                          Open PR
                        </a>
                      ) : null}
                      {latestAutopr?.error ? (
                        <p className="mt-1 font-ds-ui text-[11px] text-[#DA314A]">
                          {latestAutopr.error}
                        </p>
                      ) : null}
                      <Link
                        href="/app/auto-pr"
                        className="mt-1 inline-block font-ds-ui text-[11px] text-[#737373] underline"
                      >
                        View all runs
                      </Link>
                    </>
                  }
                />
              </div>

              <div className="mt-auto flex flex-col gap-2 rounded-[10px] border border-[#1717171F] bg-white p-3">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Write an internal note…"
                  rows={3}
                  className="w-full resize-none bg-transparent font-ds-ui text-[13px] text-[#171717] outline-none placeholder:text-[#A3A3A3]"
                />
                <div className="flex items-center justify-between">
                  <span className="font-ds-ui text-[11px] text-[#A3A3A3]">
                    Only your team sees notes
                  </span>
                  <button
                    type="button"
                    onClick={addNote}
                    disabled={savingNote || !note.trim()}
                    className="h-7 cursor-pointer rounded-md border border-[#1717171F] bg-white px-2.5 font-ds-sans text-xs font-medium tracking-[-0.2px] text-[#171717] shadow-[0_4px_4px_#1717170A] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingNote ? "Adding…" : "Add note"}
                  </button>
                </div>
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

function StatusSelect({
  value,
  onChange,
  disabled,
}: {
  value: TicketStatus;
  onChange: (status: TicketStatus) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const meta = STATUS_META[value] || STATUS_META.open;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-[34px] w-full cursor-pointer items-center gap-2 rounded-md border border-[#1717171F] bg-white px-2.5 disabled:opacity-60"
      >
        <span className="h-[7px] w-[7px] rounded-full" style={{ background: meta.dot }} />
        <span className="flex-1 text-left font-ds-ui text-[13px] font-medium text-[#171717]">
          {meta.label}
        </span>
        <span className="text-[#A3A3A3]">↕</span>
      </button>
      {open && (
        <ul className="absolute top-[calc(100%+4px)] left-0 z-20 w-full overflow-hidden rounded-[10px] border border-[#17171714] bg-white py-1 shadow-[0_8px_24px_#17171714]">
          {STATUS_OPTIONS.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(option.id);
                  setOpen(false);
                }}
                className={`flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left font-ds-ui text-xs ${
                  option.id === value
                    ? "bg-[#F5F5F5] font-medium text-[#171717]"
                    : "text-[#737373] hover:bg-[#FAFAFA]"
                }`}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: STATUS_META[option.id].dot }}
                />
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function HeaderButton({
  label,
  href,
  onClick,
  disabled,
  title,
}: {
  label: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  const className =
    "flex h-8 cursor-pointer items-center rounded-md border border-[#1717171F] bg-white px-3 font-ds-sans text-[13px] font-medium tracking-[-0.2px] text-[#171717] no-underline shadow-[0_4px_4px_#1717170A] hover:bg-[#FAFAFA] disabled:cursor-default disabled:opacity-60";
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {label}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} className={className}>
      {label}
    </button>
  );
}

function LinkedRow({
  title,
  subtitle,
  actionLabel,
  href,
  onAction,
  actionDisabled,
  footer,
}: {
  title: string;
  subtitle: string;
  actionLabel?: string;
  href?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  footer?: ReactNode;
}) {
  const actionClass =
    "inline-flex h-7 shrink-0 cursor-pointer items-center rounded-md bg-[#171717] px-2.5 font-ds-sans text-[11px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="rounded-[10px] border border-[#17171714] bg-white p-3">
      <div className="flex items-center gap-2.5">
        <div className="min-w-0 flex-1">
          <div className="truncate font-ds-ui text-[12.5px] font-medium text-[#171717]">
            {title}
          </div>
          <div className="truncate font-ds-ui text-[11px] text-[#737373]">{subtitle}</div>
        </div>
        {href && actionLabel ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className={actionClass}
          >
            {actionLabel}
          </a>
        ) : null}
        {!href && actionLabel && onAction ? (
          <button
            type="button"
            disabled={actionDisabled}
            onClick={onAction}
            className={actionClass}
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
      {footer}
    </div>
  );
}
