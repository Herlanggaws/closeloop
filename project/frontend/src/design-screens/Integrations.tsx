"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type ReactNode } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { Tour } from "@/components/coach/Tour";
import { RepositoriesSection } from "@/components/repos/RepositoriesSection";
import { api } from "@/lib/api";
import { asConfig, parseIntegrationConfig } from "@/lib/integration-config";
import { planAtLeast, planInfo, type PlanId } from "@/lib/plans";
import type { MeResponse } from "@/lib/usage";

type Integration = {
  id: string;
  provider: string;
  config: Record<string, string>;
};

type IntegrationRow = {
  id: string;
  provider: string;
  /** Connected before plan gating shipped; keeps working on any plan. */
  grandfathered?: boolean;
  config: Record<string, unknown> | string;
};

type WiredProvider = "sentry" | "posthog" | "slack" | "webhooks" | "github_app" | "linear" | "jira" | "gitlab";

type CatalogItem = {
  id: string;
  name: string;
  description: string;
  icon: string;
  iconBg: string;
  action: "configure" | "coming_soon" | "upgrade";
  badge?: string;
  wired?: WiredProvider;
  /** Lowest plan that may connect it (pricing update P2). Mirrors backend entitlements. */
  minPlan?: PlanId;
};

const NOTIFY_CATALOG: CatalogItem[] = [
  {
    id: "slack",
    name: "Slack",
    description: "Post new reports and status changes to a channel",
    icon: "Sl",
    iconBg: "#4A154B",
    action: "configure",
    wired: "slack",
    minPlan: "indie",
  },
  {
    id: "github_issues",
    name: "GitHub Issues",
    description: "Create issues and close tickets when they close",
    icon: "GH",
    iconBg: "#171717",
    action: "configure",
    minPlan: "indie",
  },
  {
    id: "linear",
    name: "Linear",
    description: "Create Linear issues with two-way status sync",
    icon: "Li",
    iconBg: "#5E6AD2",
    action: "configure",
    wired: "linear",
    minPlan: "studio",
  },
  {
    id: "jira",
    name: "Jira",
    description: "Create issues in Jira Cloud + status webhook",
    icon: "Ji",
    iconBg: "#2684FF",
    action: "configure",
    wired: "jira",
    minPlan: "studio",
  },
];

const DEBUG_CATALOG: CatalogItem[] = [
  {
    id: "sentry",
    name: "Sentry",
    description: "Link reports to errors by user and release",
    icon: "Se",
    iconBg: "#362D59",
    action: "configure",
    wired: "sentry",
  },
  {
    id: "posthog",
    name: "PostHog",
    description: "Attach the session from before each report",
    icon: "Ph",
    iconBg: "#1D4AFF",
    action: "configure",
    wired: "posthog",
  },
  {
    id: "github_app",
    name: "GitHub App",
    description: "Repository access for AI auto PR",
    icon: "GA",
    iconBg: "#171717",
    action: "configure",
    wired: "github_app",
  },
  {
    id: "gitlab",
    name: "GitLab",
    description: "Repository access for multi-repo routing and Auto PR merge requests",
    icon: "GL",
    iconBg: "#FC6D26",
    action: "configure",
    wired: "gitlab",
  },
  {
    id: "webhooks",
    name: "Webhooks",
    description: "POST every report event to your endpoint",
    icon: "Wh",
    iconBg: "#EA6C0C",
    action: "configure",
    wired: "webhooks",
  },
];

const SLACK_EVENT_KEYS = ["new_bug", "new_idea", "status_changed", "marked_fixed"] as const;
type SlackEventKey = (typeof SLACK_EVENT_KEYS)[number];
type SlackEventsState = Record<SlackEventKey, boolean>;

const WEBHOOK_EVENT_KEYS = [
  "ticket.created",
  "ticket.status_changed",
  "ticket.fixed",
] as const;
type WebhookEventKey = (typeof WEBHOOK_EVENT_KEYS)[number];
type WebhookEventsState = Record<WebhookEventKey, boolean>;

function slackEventsFromConfig(raw: IntegrationRow["config"]): SlackEventsState {
  const defaults: SlackEventsState = {
    new_bug: true,
    new_idea: true,
    status_changed: true,
    marked_fixed: true,
  };
  const obj = parseIntegrationConfig(raw);
  const list = obj.events;
  if (!Array.isArray(list) || list.length === 0) return defaults;
  const enabled = new Set(
    list.filter((item): item is string => typeof item === "string" && item.trim() !== ""),
  );
  const out = { ...defaults };
  for (const key of SLACK_EVENT_KEYS) {
    out[key] = enabled.has(key);
  }
  return out;
}

function webhookEventsFromConfig(raw: IntegrationRow["config"]): WebhookEventsState {
  const defaults: WebhookEventsState = {
    "ticket.created": true,
    "ticket.status_changed": true,
    "ticket.fixed": true,
  };
  const obj = parseIntegrationConfig(raw);
  const list = obj.events;
  if (!Array.isArray(list) || list.length === 0) return defaults;
  const enabled = new Set(
    list.filter((item): item is string => typeof item === "string" && item.trim() !== ""),
  );
  const out = { ...defaults };
  for (const key of WEBHOOK_EVENT_KEYS) {
    out[key] = enabled.has(key);
  }
  return out;
}

export function Integrations() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [projectName, setProjectName] = useState("Project");
  const [projectId, setProjectId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [configureModal, setConfigureModal] = useState<WiredProvider | "github_issues" | null>(
    null,
  );
  const [grandfathered, setGrandfathered] = useState<Set<string>>(new Set());
  const configureTitleId = useId();

  const [sentryOrg, setSentryOrg] = useState("");
  const [sentryProject, setSentryProject] = useState("");
  const [posthogHost, setPosthogHost] = useState("https://us.posthog.com");
  const [posthogProject, setPosthogProject] = useState("");
  const [slackWebhook, setSlackWebhook] = useState("");
  const [slackChannel, setSlackChannel] = useState({ channel: "", team: "", configuration_url: "" });
  const [slackOAuth, setSlackOAuth] = useState(false);
  const [slackPaste, setSlackPaste] = useState(false);
  const [slackEvents, setSlackEvents] = useState<SlackEventsState>({
    new_bug: true,
    new_idea: true,
    status_changed: true,
    marked_fixed: true,
  });
  const [webhookURL, setWebhookURL] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [webhookEvents, setWebhookEvents] = useState<WebhookEventsState>({
    "ticket.created": true,
    "ticket.status_changed": true,
    "ticket.fixed": true,
  });
  const [githubInstallationId, setGithubInstallationId] = useState("");
  const [githubAccount, setGithubAccount] = useState("");
  const [gitlabToken, setGitlabToken] = useState("");
  const [gitlabHost, setGitlabHost] = useState("https://gitlab.com");
  const [gitlabUsername, setGitlabUsername] = useState("");
  const [repoAddRequest, setRepoAddRequest] = useState(0);
  const [linearAPIKey, setLinearAPIKey] = useState("");
  const [linearTeamID, setLinearTeamID] = useState("");
  const [jiraEmail, setJiraEmail] = useState("");
  const [jiraToken, setJiraToken] = useState("");
  const [jiraSite, setJiraSite] = useState("");
  const [jiraProjectKey, setJiraProjectKey] = useState("");

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
      api<{ integrations: IntegrationRow[] }>(`/api/projects/${id}/integrations`),
    ])
      .then(async ([meRes, projectRes, integRes]) => {
        if (cancelled) return;
        setMe(meRes);
        setProjectName(projectRes.project.name || "Project");
        setGrandfathered(
          new Set(
            (integRes.integrations || []).filter((row) => row.grandfathered).map((row) => row.provider),
          ),
        );
        const list = (integRes.integrations || []).map((row) => ({
          id: row.id,
          provider: row.provider,
          config: asConfig(row.config),
        })) as Integration[];
        const sentry = list.find((i) => i.provider === "sentry");
        const posthog = list.find((i) => i.provider === "posthog");
        const slack = list.find((i) => i.provider === "slack");
        if (sentry) {
          setSentryOrg(sentry.config.org || "");
          setSentryProject(sentry.config.project || "");
        }
        if (posthog) {
          setPosthogHost(posthog.config.host || "https://us.posthog.com");
          setPosthogProject(posthog.config.project_id || posthog.config.project || "");
        }
        if (slack) {
          setSlackWebhook(slack.config.webhook_url || "");
          setSlackChannel({
            channel: slack.config.channel || "",
            team: slack.config.team || "",
            configuration_url: slack.config.configuration_url || "",
          });
          const row = (integRes.integrations || []).find((i) => i.provider === "slack");
          if (row) setSlackEvents(slackEventsFromConfig(row.config));
        }
        const hooks = list.find((i) => i.provider === "webhooks");
        if (hooks) {
          setWebhookURL(hooks.config.url || "");
          setWebhookSecret(hooks.config.secret || "");
          const row = (integRes.integrations || []).find((i) => i.provider === "webhooks");
          if (row) setWebhookEvents(webhookEventsFromConfig(row.config));
        }
        const gh = list.find((i) => i.provider === "github_app");
        if (gh) {
          applyGitHubConfig(gh.config);
        }
        const gl = list.find((i) => i.provider === "gitlab");
        if (gl) {
          setGitlabToken(gl.config.token || gl.config.api_token || "");
          setGitlabHost(gl.config.base_url || "https://gitlab.com");
          setGitlabUsername(gl.config.username || "");
        }
        const linear = list.find((i) => i.provider === "linear");
        if (linear) {
          setLinearAPIKey(linear.config.api_key || "");
          setLinearTeamID(linear.config.team_id || "");
        }
        const jira = list.find((i) => i.provider === "jira");
        if (jira) {
          setJiraEmail(jira.config.email || "");
          setJiraToken(jira.config.api_token || "");
          setJiraSite(jira.config.site || "");
          setJiraProjectKey(jira.config.project_key || "");
        }

        const params = new URLSearchParams(window.location.search);
        api<{ oauth: boolean }>("/api/integrations/slack/config")
          .then((res) => !cancelled && setSlackOAuth(Boolean(res.oauth)))
          .catch(() => undefined);
        const slackCode = params.get("slack_code");
        const slackError = params.get("slack_error");
        if (slackCode || slackError) {
          if (slackCode) await finishSlackInstall(id, slackCode, params.get("slack_state") || "");
          else setError("Slack was not connected. Try Add to Slack again.");
          for (const key of ["slack_code", "slack_state", "slack_error"]) params.delete(key);
          const rest = params.toString();
          window.history.replaceState(
            {},
            "",
            rest ? `${window.location.pathname}?${rest}` : window.location.pathname,
          );
        }
        const installationId = params.get("installation_id");
        if (installationId) {
          await finishGitHubInstall(id, Number(installationId));
          params.delete("installation_id");
          params.delete("setup_action");
          params.delete("state");
          const next = params.toString();
          window.history.replaceState(
            {},
            "",
            next ? `${window.location.pathname}?${next}` : window.location.pathname,
          );
        }
        setError("");
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

  function applyGitHubConfig(config: Record<string, string>) {
    setGithubInstallationId(String(config.installation_id || ""));
    setGithubAccount(config.account_login || "");
  }

  async function finishSlackInstall(project: string, code: string, state: string) {
    setSaving("slack");
    try {
      const res = await api<{ integration: { config: Record<string, unknown> | string } }>(
        `/api/projects/${project}/integrations/slack/complete`,
        { method: "POST", body: JSON.stringify({ code, state }) },
      );
      const config = asConfig(res.integration.config);
      setSlackWebhook(config.webhook_url || "");
      setSlackChannel({
        channel: config.channel || "",
        team: config.team || "",
        configuration_url: config.configuration_url || "",
      });
      setConfigureModal("slack");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect Slack");
    } finally {
      setSaving(null);
    }
  }

  async function connectSlack() {
    if (!projectId) return;
    setSaving("slack");
    setError("");
    try {
      const res = await api<{ url: string }>(
        `/api/integrations/slack/install?project_id=${encodeURIComponent(projectId)}`,
      );
      if (!res.url) throw new Error("Slack sign-in URL missing");
      window.location.href = res.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start Slack sign-in");
      setSaving(null);
    }
  }

  async function finishGitHubInstall(project: string, installationId: number) {
    setSaving("github_app");
    try {
      const res = await api<{
        integration: { config: Record<string, unknown> | string };
      }>(`/api/projects/${project}/integrations/github_app/complete`, {
        method: "POST",
        body: JSON.stringify({ installation_id: installationId }),
      });
      const config = asConfig(res.integration.config);
      applyGitHubConfig(config);
      // Callback id is authoritative; config may still omit it if JSON types drift.
      setGithubInstallationId(String(installationId));
      // A single-repo install is added for you; otherwise pick repos and routes next.
      if (!config.repo_full_name) setRepoAddRequest((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect GitHub App");
    } finally {
      setSaving(null);
    }
  }


  async function connectGitHubApp() {
    if (!projectId) return;
    setSaving("github_app");
    setError("");
    try {
      const res = await api<{ url: string }>(
        `/api/integrations/github/install?project_id=${encodeURIComponent(projectId)}`,
      );
      if (!res.url) throw new Error("Install URL missing");
      window.location.href = res.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start GitHub install");
      setSaving(null);
    }
  }

  async function saveProvider(
    provider: WiredProvider,
    config: Record<string, string | string[]>,
  ) {
    if (!projectId) return false;
    setSaving(provider);
    setError("");
    try {
      const res = await api<{
        integration: { config: Record<string, unknown> | string };
      }>(`/api/projects/${projectId}/integrations/${provider}`, {
        method: "PUT",
        body: JSON.stringify({ config }),
      });
      if (provider === "webhooks") {
        const saved = asConfig(res.integration.config);
        setWebhookURL(saved.url || webhookURL);
        setWebhookSecret(saved.secret || "");
        setWebhookEvents(webhookEventsFromConfig(res.integration.config));
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
      return false;
    } finally {
      setSaving(null);
    }
  }

  async function testAndSaveGitLab() {
    if (!gitlabToken.trim()) {
      setError("GitLab Personal Access Token is required");
      return;
    }
    setSaving("gitlab");
    setError("");
    try {
      const testRes = await api<{ ok: boolean; username: string }>(
        `/api/projects/${projectId}/integrations/gitlab/test`,
        {
          method: "POST",
          body: JSON.stringify({
            token: gitlabToken.trim(),
            base_url: gitlabHost.trim() || "https://gitlab.com",
          }),
        },
      );
      if (testRes.username) {
        setGitlabUsername(testRes.username);
      }
      await saveProvider("gitlab", {
        token: gitlabToken.trim(),
        base_url: gitlabHost.trim() || "https://gitlab.com",
        username: testRes.username || gitlabUsername.trim(),
      });
      setConfigureModal(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "GitLab authentication failed");
    } finally {
      setSaving(null);
    }
  }

  async function clearProvider(provider: WiredProvider) {
    if (!projectId) return;
    setSaving(provider);
    setError("");
    try {
      await api(`/api/projects/${projectId}/integrations/${provider}`, {
        method: "DELETE",
      });
      if (provider === "sentry") {
        setSentryOrg("");
        setSentryProject("");
      } else if (provider === "posthog") {
        setPosthogHost("https://us.posthog.com");
        setPosthogProject("");
      } else if (provider === "slack") {
        setSlackWebhook("");
        setSlackChannel({ channel: "", team: "", configuration_url: "" });
      } else if (provider === "webhooks") {
        setWebhookURL("");
        setWebhookSecret("");
        setWebhookEvents({
          "ticket.created": true,
          "ticket.status_changed": true,
          "ticket.fixed": true,
        });
      } else if (provider === "github_app") {
        setGithubInstallationId("");
        setGithubAccount("");
      } else if (provider === "gitlab") {
        setGitlabToken("");
        setGitlabUsername("");
      } else if (provider === "linear") {
        setLinearAPIKey("");
        setLinearTeamID("");
      } else if (provider === "jira") {
        setJiraEmail("");
        setJiraToken("");
        setJiraSite("");
        setJiraProjectKey("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disconnect");
    } finally {
      setSaving(null);
    }
  }

  const plan = me?.org.plan || "free";
  const email = me?.user.email || "";
  const sentryConnected = Boolean(sentryOrg.trim());
  const posthogConnected = Boolean(posthogHost.trim() && posthogProject.trim());
  const slackConnected = Boolean(slackWebhook.trim());
  const webhooksConnected = Boolean(webhookURL.trim());
  const githubConnected = Boolean(githubInstallationId.trim());
  const gitlabConnected = Boolean(gitlabToken.trim());
  const linearConnected = Boolean(linearAPIKey.trim() && linearTeamID.trim());
  const jiraConnected = Boolean(
    jiraEmail.trim() && jiraToken.trim() && jiraSite.trim() && jiraProjectKey.trim(),
  );
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

  function statusFor(item: CatalogItem): "connected" | "none" {
    if (item.wired === "sentry") return sentryConnected ? "connected" : "none";
    if (item.wired === "posthog") return posthogConnected ? "connected" : "none";
    if (item.wired === "slack") return slackConnected ? "connected" : "none";
    if (item.wired === "webhooks") return webhooksConnected ? "connected" : "none";
    if (item.wired === "github_app") return githubConnected ? "connected" : "none";
    if (item.wired === "gitlab") return gitlabConnected ? "connected" : "none";
    if (item.wired === "linear") return linearConnected ? "connected" : "none";
    if (item.wired === "jira") return jiraConnected ? "connected" : "none";
    if (item.id === "github_issues") return githubConnected ? "connected" : "none";
    return "none";
  }

  useEffect(() => {
    if (!configureModal) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setConfigureModal(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [configureModal]);

  // A card is locked when the plan is below its minimum and the connection is not grandfathered.
  function lockedPlan(item: CatalogItem): PlanId | null {
    if (!item.minPlan || planAtLeast(plan, item.minPlan)) return null;
    const connection = item.id === "github_issues" ? "github_app" : item.wired;
    if (connection && grandfathered.has(connection)) return null;
    return item.minPlan;
  }

  function badgeFor(item: CatalogItem): string | undefined {
    return item.minPlan ? planInfo(item.minPlan)?.name : item.badge;
  }

  function onCardAction(item: CatalogItem) {
    if (lockedPlan(item)) {
      router.push("/app/settings/billing");
      return;
    }
    if (item.id === "github_issues") {
      if (!githubConnected) {
        void connectGitHubApp();
        return;
      }
      setConfigureModal("github_issues");
      return;
    }
    if (item.action === "configure" && item.wired === "github_app") {
      if (!githubConnected) {
        void connectGitHubApp();
        return;
      }
      setConfigureModal("github_app");
      return;
    }
    if (item.action === "configure" && item.wired) {
      setConfigureModal(item.wired);
    }
  }

  function actionLabel(item: CatalogItem): string {
    const locked = lockedPlan(item);
    if (locked) return `Upgrade to ${planInfo(locked)?.name}`;
    if (item.action === "upgrade") return "Upgrade";
    if (item.wired === "webhooks") return webhooksConnected ? "Configure" : "Add endpoint";
    if (item.action === "coming_soon") return "Coming soon";
    if (item.id === "github_issues") return githubConnected ? "Configure" : "Connect";
    if (item.wired === "github_app") return githubConnected ? "Configure" : "Connect";
    if (item.wired === "gitlab") return gitlabConnected ? "Configure" : "Connect";
    return "Configure";
  }

  async function saveAndClose(
    provider: WiredProvider,
    config: Record<string, string | string[]>,
  ) {
    const ok = await saveProvider(provider, config);
    if (ok) setConfigureModal(null);
  }

  return (
    <div className="box-border flex min-h-screen w-full bg-white">
      <Tour id="integrations" ready={!loading} />
      <AppSidebar
        projectName={projectName}
        plan={plan}
        email={email}
        usage={me?.usage}
        userName={me?.user?.name}
        avatarUrl={me?.user?.avatar_url}
        active="integrations"
        showUsageCard
      />

      <main className="flex min-h-screen min-w-0 flex-1 flex-col overflow-y-auto bg-white">
        <header className="flex shrink-0 items-end border-b border-[#17171714] px-10 pb-6 pt-7">
          <div className="flex max-w-[720px] flex-col gap-1">
            <h1 className="font-ds-sans text-2xl font-medium tracking-[-0.4px] text-[#171717]">
              Integrations
            </h1>
            <p className="font-ds-ui text-[13.5px] text-[#737373]">
              Send reports where your team already works, and pull in debugging context.
            </p>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-8 px-10 pb-10 pt-6">
          {loading ? (
            <p className="font-ds-ui text-sm text-[#737373]">Loading…</p>
          ) : (
            <>
              {error && <p className="font-ds-ui text-sm text-[#DA314A]">{error}</p>}

              <RepositoriesSection
                projectId={projectId}
                projectName={projectName}
                installationId={Number(githubInstallationId) || 0}
                accountLogin={githubAccount}
                gitlabConnected={gitlabConnected}
                gitlabUsername={gitlabUsername}
                addRequest={repoAddRequest}
              />

              <IntegrationGroup
                title={
                  planAtLeast(plan, "indie")
                    ? "Notify and track"
                    : "Notify and track · Slack and GitHub Issues need Indie"
                }
                tourTarget="integrations-track"
              >
                {NOTIFY_CATALOG.map((item) => {
                  // Issues are created in the ticket's repo, so the card never names one repo.
                  const cardItem = { ...item, badge: badgeFor(item) };
                  return (
                    <IntegrationCard
                      key={item.id}
                      item={cardItem}
                      status={statusFor(item)}
                      actionLabel={actionLabel(item)}
                      locked={Boolean(lockedPlan(item))}
                      onAction={() => onCardAction(item)}
                    />
                  );
                })}
              </IntegrationGroup>

              <IntegrationGroup title="Debugging context" tourTarget="integrations-debug">
                {DEBUG_CATALOG.map((item) => (
                  <IntegrationCard
                    key={item.id}
                    item={item}
                    status={statusFor(item)}
                    actionLabel={actionLabel(item)}
                    onAction={() => onCardAction(item)}
                  />
                ))}
              </IntegrationGroup>

              {configureModal ? (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center p-4"
                  role="presentation"
                >
                  <button
                    type="button"
                    aria-label="Close configure"
                    className="absolute inset-0 border-0 bg-[#0A0A0A66]"
                    onClick={() => setConfigureModal(null)}
                  />
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={configureTitleId}
                    className="relative z-10 max-h-[90vh] w-full max-w-[520px] overflow-y-auto rounded-2xl border border-[#17171714] bg-white p-6 shadow-lg"
                  >
                    {error ? (
                      <p className="mb-3 font-ds-ui text-sm text-[#DA314A]">{error}</p>
                    ) : null}
                    {configureModal === "slack" ? (
                      <>
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3
                              id={configureTitleId}
                              className="font-ds-sans text-[18px] font-semibold text-[#171717]"
                            >
                              Slack
                            </h3>
                            <p className="mt-1 font-ds-ui text-[12.5px] text-[#737373]">
                              {slackOAuth
                                ? "Pick a channel in Slack, then choose which events post there."
                                : "Choose which events post to the channel. Paste a Slack Incoming Webhook URL to connect."}
                            </p>
                          </div>
                          <button
                            type="button"
                            aria-label="Close"
                            onClick={() => setConfigureModal(null)}
                            className="cursor-pointer font-ds-ui text-lg leading-none text-[#A3A3A3] hover:text-[#171717]"
                          >
                            ×
                          </button>
                        </div>
                        {slackConnected && (
                          <button
                            type="button"
                            disabled={saving === "slack"}
                            onClick={() => void clearProvider("slack")}
                            className="mt-3 cursor-pointer font-ds-ui text-xs text-[#737373] hover:text-[#171717]"
                          >
                            Disconnect
                          </button>
                        )}
                        <div
                          data-tour="integrations-slack"
                          className="mt-4 grid gap-3 sm:grid-cols-2"
                        >
                          {(
                            [
                              ["new_bug", "New bug"],
                              ["new_idea", "New idea"],
                              ["status_changed", "Status changed"],
                              ["marked_fixed", "Marked fixed"],
                            ] as const
                          ).map(([key, label]) => (
                            <label
                              key={key}
                              className="flex cursor-pointer items-center justify-between rounded-lg border border-[#17171714] bg-[#FAFAFA] px-3 py-2.5"
                            >
                              <span className="font-ds-ui text-[13px] text-[#171717]">{label}</span>
                              <input
                                type="checkbox"
                                checked={slackEvents[key]}
                                onChange={(e) =>
                                  setSlackEvents((prev) => ({
                                    ...prev,
                                    [key]: e.target.checked,
                                  }))
                                }
                                className="h-4 w-4 accent-[#16A34A]"
                              />
                            </label>
                          ))}
                        </div>
                        {slackConnected && slackChannel.channel ? (
                          <p className="mt-4 font-ds-ui text-[13px] text-[#171717]">
                            Posting to <span className="font-medium">{slackChannel.channel}</span>
                            {slackChannel.team ? ` in ${slackChannel.team}` : ""}
                          </p>
                        ) : null}
                        {slackOAuth ? (
                          <div className="mt-4 flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              disabled={saving === "slack"}
                              onClick={() => void connectSlack()}
                              className="inline-flex h-9 cursor-pointer items-center rounded-md border border-[#1717171F] bg-white px-3 font-ds-sans text-[13px] font-medium text-[#171717] disabled:opacity-50"
                            >
                              {slackConnected ? "Change channel" : "Add to Slack"}
                            </button>
                            {!slackPaste ? (
                              <button
                                type="button"
                                onClick={() => setSlackPaste(true)}
                                className="cursor-pointer font-ds-ui text-xs text-[#737373] hover:text-[#171717]"
                              >
                                Or paste a webhook URL
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                        {!slackOAuth || slackPaste ? (
                          <div className="mt-4">
                            <Field
                              label="Incoming Webhook URL"
                              value={slackWebhook}
                              onChange={(v) => {
                                setSlackWebhook(v);
                                setSlackChannel({ channel: "", team: "", configuration_url: "" });
                              }}
                              placeholder="https://hooks.slack.com/services/…"
                            />
                          </div>
                        ) : null}
                        <div className="mt-5 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setConfigureModal(null)}
                            className="inline-flex h-9 cursor-pointer items-center rounded-md border border-[#1717171F] bg-white px-3 font-ds-sans text-[13px] font-medium text-[#171717]"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={
                              saving === "slack" ||
                              !slackWebhook.trim().startsWith("https://hooks.slack.com/")
                            }
                            onClick={() =>
                              void saveAndClose("slack", {
                                webhook_url: slackWebhook.trim(),
                                events: SLACK_EVENT_KEYS.filter((key) => slackEvents[key]),
                                ...Object.fromEntries(
                                  Object.entries(slackChannel).filter(([, v]) => v),
                                ),
                              })
                            }
                            className="inline-flex h-9 cursor-pointer items-center rounded-md bg-[#171717] px-3 font-ds-sans text-[13px] font-medium text-white disabled:opacity-50"
                          >
                            {saving === "slack" ? "Saving…" : "Save Slack"}
                          </button>
                        </div>
                      </>
                    ) : null}

                    {configureModal === "linear" ? (
                      <>
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3
                              id={configureTitleId}
                              className="font-ds-sans text-[18px] font-semibold text-[#171717]"
                            >
                              Linear
                            </h3>
                            <p className="mt-1 font-ds-ui text-[12.5px] text-[#737373]">
                              Paste a personal API key and team id. Point Linear webhooks to{" "}
                              <code className="font-ds-mono text-[11px]">
                                {apiBase}/webhooks/linear
                              </code>{" "}
                              for Done → fixed sync.
                            </p>
                          </div>
                          <button
                            type="button"
                            aria-label="Close"
                            onClick={() => setConfigureModal(null)}
                            className="cursor-pointer font-ds-ui text-lg leading-none text-[#A3A3A3] hover:text-[#171717]"
                          >
                            ×
                          </button>
                        </div>
                        {linearConnected && (
                          <button
                            type="button"
                            disabled={saving === "linear"}
                            onClick={() => void clearProvider("linear")}
                            className="mt-3 font-ds-ui text-[12px] text-[#DA314A]"
                          >
                            Disconnect
                          </button>
                        )}
                        <div className="mt-4 flex flex-col gap-3">
                          <Field
                            label="API key"
                            value={linearAPIKey}
                            onChange={setLinearAPIKey}
                            placeholder="lin_api_…"
                          />
                          <Field
                            label="Team ID"
                            value={linearTeamID}
                            onChange={setLinearTeamID}
                            placeholder="UUID from Linear team settings"
                          />
                        </div>
                        <div className="mt-5 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setConfigureModal(null)}
                            className="inline-flex h-9 cursor-pointer items-center rounded-md border border-[#1717171F] bg-white px-3 font-ds-sans text-[13px] font-medium text-[#171717]"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={
                              saving === "linear" || !linearAPIKey.trim() || !linearTeamID.trim()
                            }
                            onClick={() =>
                              void saveAndClose("linear", {
                                api_key: linearAPIKey.trim(),
                                team_id: linearTeamID.trim(),
                              })
                            }
                            className="inline-flex h-9 cursor-pointer items-center rounded-md bg-[#171717] px-3 font-ds-sans text-[13px] font-medium text-white disabled:opacity-50"
                          >
                            {saving === "linear" ? "Saving…" : "Save Linear"}
                          </button>
                        </div>
                      </>
                    ) : null}

                    {configureModal === "jira" ? (
                      <>
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3
                              id={configureTitleId}
                              className="font-ds-sans text-[18px] font-semibold text-[#171717]"
                            >
                              Jira Cloud
                            </h3>
                            <p className="mt-1 font-ds-ui text-[12.5px] text-[#737373]">
                              Use an Atlassian API token. Webhook URL:{" "}
                              <code className="font-ds-mono text-[11px]">
                                {apiBase}/webhooks/jira
                              </code>
                            </p>
                          </div>
                          <button
                            type="button"
                            aria-label="Close"
                            onClick={() => setConfigureModal(null)}
                            className="cursor-pointer font-ds-ui text-lg leading-none text-[#A3A3A3] hover:text-[#171717]"
                          >
                            ×
                          </button>
                        </div>
                        {jiraConnected && (
                          <button
                            type="button"
                            disabled={saving === "jira"}
                            onClick={() => void clearProvider("jira")}
                            className="mt-3 font-ds-ui text-[12px] text-[#DA314A]"
                          >
                            Disconnect
                          </button>
                        )}
                        <div className="mt-4 flex flex-col gap-3">
                          <Field
                            label="Atlassian email"
                            value={jiraEmail}
                            onChange={setJiraEmail}
                            placeholder="you@company.com"
                          />
                          <Field
                            label="API token"
                            value={jiraToken}
                            onChange={setJiraToken}
                            placeholder="Atlassian API token"
                          />
                          <Field
                            label="Site"
                            value={jiraSite}
                            onChange={setJiraSite}
                            placeholder="acme.atlassian.net"
                          />
                          <Field
                            label="Project key"
                            value={jiraProjectKey}
                            onChange={setJiraProjectKey}
                            placeholder="ENG"
                          />
                        </div>
                        <div className="mt-5 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setConfigureModal(null)}
                            className="inline-flex h-9 cursor-pointer items-center rounded-md border border-[#1717171F] bg-white px-3 font-ds-sans text-[13px] font-medium text-[#171717]"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={
                              saving === "jira" ||
                              !jiraEmail.trim() ||
                              !jiraToken.trim() ||
                              !jiraSite.trim() ||
                              !jiraProjectKey.trim()
                            }
                            onClick={() =>
                              void saveAndClose("jira", {
                                email: jiraEmail.trim(),
                                api_token: jiraToken.trim(),
                                site: jiraSite.trim(),
                                project_key: jiraProjectKey.trim(),
                              })
                            }
                            className="inline-flex h-9 cursor-pointer items-center rounded-md bg-[#171717] px-3 font-ds-sans text-[13px] font-medium text-white disabled:opacity-50"
                          >
                            {saving === "jira" ? "Saving…" : "Save Jira"}
                          </button>
                        </div>
                      </>
                    ) : null}

                    {configureModal === "webhooks" ? (
                      <>
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3
                              id={configureTitleId}
                              className="font-ds-sans text-[18px] font-semibold text-[#171717]"
                            >
                              Outbound webhooks
                            </h3>
                            <p className="mt-1 font-ds-ui text-[12.5px] text-[#737373]">
                              We POST signed JSON to your HTTPS endpoint. Header{" "}
                              <code className="font-ds-mono text-[11px]">X-Saidloop-Signature</code>{" "}
                              is HMAC-SHA256 of the body.
                            </p>
                          </div>
                          <button
                            type="button"
                            aria-label="Close"
                            onClick={() => setConfigureModal(null)}
                            className="cursor-pointer font-ds-ui text-lg leading-none text-[#A3A3A3] hover:text-[#171717]"
                          >
                            ×
                          </button>
                        </div>
                        {webhooksConnected && (
                          <button
                            type="button"
                            disabled={saving === "webhooks"}
                            onClick={() => void clearProvider("webhooks")}
                            className="mt-3 cursor-pointer font-ds-ui text-xs text-[#737373] hover:text-[#171717]"
                          >
                            Disconnect
                          </button>
                        )}
                        <div className="mt-4 grid gap-3">
                          {(
                            [
                              ["ticket.created", "Ticket created"],
                              ["ticket.status_changed", "Status changed"],
                              ["ticket.fixed", "Marked fixed"],
                            ] as const
                          ).map(([key, label]) => (
                            <label
                              key={key}
                              className="flex cursor-pointer items-center justify-between rounded-lg border border-[#17171714] bg-[#FAFAFA] px-3 py-2.5"
                            >
                              <span className="font-ds-ui text-[13px] text-[#171717]">{label}</span>
                              <input
                                type="checkbox"
                                checked={webhookEvents[key]}
                                onChange={(e) =>
                                  setWebhookEvents((prev) => ({
                                    ...prev,
                                    [key]: e.target.checked,
                                  }))
                                }
                                className="h-4 w-4 accent-[#16A34A]"
                              />
                            </label>
                          ))}
                        </div>
                        <div className="mt-4">
                          <Field
                            label="Endpoint URL"
                            value={webhookURL}
                            onChange={setWebhookURL}
                            placeholder="https://example.com/hooks/saidloop"
                          />
                        </div>
                        {webhookSecret ? (
                          <div className="mt-3 rounded-lg border border-[#17171714] bg-[#FAFAFA] px-3 py-2.5">
                            <div className="font-ds-ui text-[11px] font-medium text-[#737373]">
                              Signing secret
                            </div>
                            <code className="mt-1 block break-all font-ds-mono text-[12px] text-[#171717]">
                              {webhookSecret}
                            </code>
                          </div>
                        ) : (
                          <p className="mt-3 font-ds-ui text-[12px] text-[#A3A3A3]">
                            A signing secret is generated on save if you leave it blank.
                          </p>
                        )}
                        <div className="mt-5 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setConfigureModal(null)}
                            className="inline-flex h-9 cursor-pointer items-center rounded-md border border-[#1717171F] bg-white px-3 font-ds-sans text-[13px] font-medium text-[#171717]"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={
                              saving === "webhooks" ||
                              !webhookURL.trim().startsWith("https://") ||
                              webhookURL.trim().startsWith("https://hooks.slack.com/")
                            }
                            onClick={() =>
                              void saveAndClose("webhooks", {
                                url: webhookURL.trim(),
                                ...(webhookSecret.trim()
                                  ? { secret: webhookSecret.trim() }
                                  : {}),
                                events: WEBHOOK_EVENT_KEYS.filter((key) => webhookEvents[key]),
                              })
                            }
                            className="inline-flex h-9 cursor-pointer items-center rounded-md bg-[#171717] px-3 font-ds-sans text-[13px] font-medium text-white disabled:opacity-50"
                          >
                            {saving === "webhooks" ? "Saving…" : "Save webhooks"}
                          </button>
                        </div>
                      </>
                    ) : null}

                    {configureModal === "github_app" ? (
                      <>
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3
                              id={configureTitleId}
                              className="font-ds-sans text-[18px] font-semibold text-[#171717]"
                            >
                              GitHub App
                            </h3>
                            <p className="mt-1 font-ds-ui text-[12.5px] text-[#737373]">
                              Auto PR opens branches and pull requests in your project's repos. Saidloop
                              never merges.
                            </p>
                          </div>
                          <button
                            type="button"
                            aria-label="Close"
                            onClick={() => setConfigureModal(null)}
                            className="cursor-pointer font-ds-ui text-lg leading-none text-[#A3A3A3] hover:text-[#171717]"
                          >
                            ×
                          </button>
                        </div>
                        {githubConnected && (
                          <div className="mt-3 flex flex-wrap gap-3">
                            <button
                              type="button"
                              disabled={saving === "github_app"}
                              onClick={() => void clearProvider("github_app")}
                              className="cursor-pointer font-ds-ui text-xs text-[#737373] hover:text-[#171717]"
                            >
                              Disconnect
                            </button>
                            <button
                              type="button"
                              disabled={saving === "github_app"}
                              onClick={() => void connectGitHubApp()}
                              className="cursor-pointer font-ds-ui text-xs text-[#737373] hover:text-[#171717]"
                            >
                              Change repo access on GitHub
                            </button>
                          </div>
                        )}
                        {githubAccount || githubInstallationId ? (
                          <p className="mt-3 font-ds-ui text-[12px] text-[#737373]">
                            Installation {githubInstallationId}
                            {githubAccount ? ` · ${githubAccount}` : ""}
                          </p>
                        ) : null}
                        <p className="mt-4 font-ds-ui text-[13px] text-[#171717]">
                          Pick which repos this project ships from, and which platform goes to
                          which repo, in Repositories at the top of this page.
                        </p>
                        <div className="mt-5 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setConfigureModal(null)}
                            className="inline-flex h-9 cursor-pointer items-center rounded-md border border-[#1717171F] bg-white px-3 font-ds-sans text-[13px] font-medium text-[#171717]"
                          >
                            Done
                          </button>
                          <button
                            type="button"
                            disabled={!githubInstallationId}
                            onClick={() => {
                              setConfigureModal(null);
                              setRepoAddRequest((n) => n + 1);
                            }}
                            className="inline-flex h-9 cursor-pointer items-center rounded-md bg-[#171717] px-3 font-ds-sans text-[13px] font-medium text-white disabled:opacity-50"
                          >
                            Add repository
                          </button>
                        </div>
                      </>
                    ) : null}

                    {configureModal === "gitlab" ? (
                      <>
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3
                              id={configureTitleId}
                              className="font-ds-sans text-[18px] font-semibold text-[#171717]"
                            >
                              GitLab
                            </h3>
                            <p className="mt-1 font-ds-ui text-[12.5px] text-[#737373]">
                              Connect GitLab with a Personal Access Token or Project Token with{" "}
                              <code className="font-ds-mono text-xs text-[#171717]">api</code> and{" "}
                              <code className="font-ds-mono text-xs text-[#171717]">write_repository</code> scopes.
                            </p>
                          </div>
                          <button
                            type="button"
                            aria-label="Close"
                            onClick={() => setConfigureModal(null)}
                            className="cursor-pointer font-ds-ui text-lg leading-none text-[#A3A3A3] hover:text-[#171717]"
                          >
                            ×
                          </button>
                        </div>

                        <div className="mt-4 flex flex-col gap-3">
                          <div>
                            <label className="font-ds-ui text-[12px] font-medium text-[#171717]">
                              GitLab Host URL
                            </label>
                            <input
                              type="text"
                              value={gitlabHost}
                              onChange={(e) => setGitlabHost(e.target.value)}
                              placeholder="https://gitlab.com"
                              className="mt-1 w-full rounded-md border border-[#1717171F] px-3 py-2 font-ds-ui text-[13px] text-[#171717] outline-none focus:border-[#171717]"
                            />
                            <p className="mt-1 font-ds-ui text-[11px] text-[#737373]">
                              Leave as https://gitlab.com or enter your self-hosted GitLab URL.
                            </p>
                          </div>

                          <div>
                            <label className="font-ds-ui text-[12px] font-medium text-[#171717]">
                              Access Token
                            </label>
                            <input
                              type="password"
                              value={gitlabToken}
                              onChange={(e) => setGitlabToken(e.target.value)}
                              placeholder="glpat-..."
                              className="mt-1 w-full rounded-md border border-[#1717171F] px-3 py-2 font-ds-ui text-[13px] text-[#171717] outline-none focus:border-[#171717]"
                            />
                          </div>

                          {gitlabConnected && (
                            <div className="flex items-center justify-between rounded-md bg-[#FAFAFA] px-3 py-2 border border-[#1717170F]">
                              <span className="font-ds-ui text-xs text-[#171717]">
                                Connected{gitlabUsername ? ` as @${gitlabUsername}` : ""}
                              </span>
                              <button
                                type="button"
                                disabled={saving === "gitlab"}
                                onClick={() => void clearProvider("gitlab")}
                                className="cursor-pointer font-ds-ui text-xs text-[#DA314A] hover:underline"
                              >
                                Disconnect
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="mt-5 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setConfigureModal(null)}
                            className="inline-flex h-9 cursor-pointer items-center rounded-md border border-[#1717171F] bg-white px-3 font-ds-sans text-[13px] font-medium text-[#171717]"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={saving === "gitlab"}
                            onClick={() => void testAndSaveGitLab()}
                            className="inline-flex h-9 cursor-pointer items-center rounded-md bg-[#171717] px-3 font-ds-sans text-[13px] font-medium text-white disabled:opacity-50"
                          >
                            {saving === "gitlab" ? "Connecting…" : gitlabConnected ? "Save" : "Connect"}
                          </button>
                        </div>
                      </>
                    ) : null}

                    {configureModal === "github_issues" ? (
                      <>
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3
                              id={configureTitleId}
                              className="font-ds-sans text-[18px] font-semibold text-[#171717]"
                            >
                              GitHub Issues
                            </h3>
                            <p className="mt-1 font-ds-ui text-[12.5px] text-[#737373]">
                              Uses the GitHub App installation. Create an issue from any ticket
                              detail with one click.
                            </p>
                          </div>
                          <button
                            type="button"
                            aria-label="Close"
                            onClick={() => setConfigureModal(null)}
                            className="cursor-pointer font-ds-ui text-lg leading-none text-[#A3A3A3] hover:text-[#171717]"
                          >
                            ×
                          </button>
                        </div>
                        <p className="mt-4 font-ds-ui text-[13px] text-[#171717]">
                          Issues open in the ticket&apos;s repo. Tickets with no repo yet use the
                          fallback repo.
                        </p>
                        <div className="mt-5 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setConfigureModal("github_app");
                            }}
                            className="inline-flex h-9 cursor-pointer items-center rounded-md border border-[#1717171F] bg-white px-3 font-ds-sans text-[13px] font-medium text-[#171717]"
                          >
                            Configure GitHub App
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfigureModal(null)}
                            className="inline-flex h-9 cursor-pointer items-center rounded-md bg-[#171717] px-3 font-ds-sans text-[13px] font-medium text-white"
                          >
                            Done
                          </button>
                        </div>
                      </>
                    ) : null}

                    {configureModal === "sentry" ? (
                      <>
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3
                              id={configureTitleId}
                              className="font-ds-sans text-[18px] font-semibold text-[#171717]"
                            >
                              Sentry
                            </h3>
                            <p className="mt-1 font-ds-ui text-[12.5px] text-[#737373]">
                              Links use{" "}
                              <code className="font-ds-mono text-[12px]">sentry_event_id</code> from
                              report context.
                            </p>
                          </div>
                          <button
                            type="button"
                            aria-label="Close"
                            onClick={() => setConfigureModal(null)}
                            className="cursor-pointer font-ds-ui text-lg leading-none text-[#A3A3A3] hover:text-[#171717]"
                          >
                            ×
                          </button>
                        </div>
                        {sentryConnected && (
                          <button
                            type="button"
                            disabled={saving === "sentry"}
                            onClick={() => void clearProvider("sentry")}
                            className="mt-3 cursor-pointer font-ds-ui text-xs text-[#737373] hover:text-[#171717]"
                          >
                            Disconnect
                          </button>
                        )}
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <Field
                            label="Org slug"
                            value={sentryOrg}
                            onChange={setSentryOrg}
                            placeholder="acme"
                          />
                          <Field
                            label="Project slug"
                            value={sentryProject}
                            onChange={setSentryProject}
                            placeholder="web-app"
                          />
                        </div>
                        <div className="mt-5 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setConfigureModal(null)}
                            className="inline-flex h-9 cursor-pointer items-center rounded-md border border-[#1717171F] bg-white px-3 font-ds-sans text-[13px] font-medium text-[#171717]"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={saving === "sentry" || !sentryOrg.trim()}
                            onClick={() =>
                              void saveAndClose("sentry", {
                                org: sentryOrg.trim(),
                                project: sentryProject.trim(),
                              })
                            }
                            className="inline-flex h-9 cursor-pointer items-center rounded-md bg-[#171717] px-3 font-ds-sans text-[13px] font-medium text-white disabled:opacity-50"
                          >
                            {saving === "sentry" ? "Saving…" : "Save Sentry"}
                          </button>
                        </div>
                      </>
                    ) : null}

                    {configureModal === "posthog" ? (
                      <>
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3
                              id={configureTitleId}
                              className="font-ds-sans text-[18px] font-semibold text-[#171717]"
                            >
                              PostHog
                            </h3>
                            <p className="mt-1 font-ds-ui text-[12.5px] text-[#737373]">
                              Links use{" "}
                              <code className="font-ds-mono text-[12px]">posthog_session_id</code>{" "}
                              from report context.
                            </p>
                          </div>
                          <button
                            type="button"
                            aria-label="Close"
                            onClick={() => setConfigureModal(null)}
                            className="cursor-pointer font-ds-ui text-lg leading-none text-[#A3A3A3] hover:text-[#171717]"
                          >
                            ×
                          </button>
                        </div>
                        {posthogConnected && (
                          <button
                            type="button"
                            disabled={saving === "posthog"}
                            onClick={() => void clearProvider("posthog")}
                            className="mt-3 cursor-pointer font-ds-ui text-xs text-[#737373] hover:text-[#171717]"
                          >
                            Disconnect
                          </button>
                        )}
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <Field
                            label="Host"
                            value={posthogHost}
                            onChange={setPosthogHost}
                            placeholder="https://us.posthog.com"
                          />
                          <Field
                            label="Project id"
                            value={posthogProject}
                            onChange={setPosthogProject}
                            placeholder="12345"
                          />
                        </div>
                        <div className="mt-5 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setConfigureModal(null)}
                            className="inline-flex h-9 cursor-pointer items-center rounded-md border border-[#1717171F] bg-white px-3 font-ds-sans text-[13px] font-medium text-[#171717]"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={
                              saving === "posthog" ||
                              !posthogHost.trim() ||
                              !posthogProject.trim()
                            }
                            onClick={() =>
                              void saveAndClose("posthog", {
                                host: posthogHost.trim().replace(/\/$/, ""),
                                project_id: posthogProject.trim(),
                              })
                            }
                            className="inline-flex h-9 cursor-pointer items-center rounded-md bg-[#171717] px-3 font-ds-sans text-[13px] font-medium text-white disabled:opacity-50"
                          >
                            {saving === "posthog" ? "Saving…" : "Save PostHog"}
                          </button>
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function IntegrationGroup({
  title,
  children,
  tourTarget,
}: {
  title: string;
  children: ReactNode;
  tourTarget?: string;
}) {
  return (
    <section data-tour={tourTarget} className="flex flex-col gap-3">
      <h2 className="font-ds-ui text-xs font-medium text-[#A3A3A3]">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
    </section>
  );
}

function IntegrationCard({
  item,
  status,
  actionLabel,
  locked = false,
  onAction,
}: {
  item: CatalogItem;
  status: "connected" | "none";
  actionLabel: string;
  locked?: boolean;
  onAction: () => void;
}) {
  const disabled = item.action === "coming_soon";
  // Plan upgrades use the secondary (outline) style, per S-13.
  const primary = item.action === "upgrade" && !locked;

  return (
    <div className="flex min-h-[156px] flex-col rounded-xl border border-[#17171714] bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg font-ds-sans text-[11px] font-semibold text-white"
          style={{ background: item.iconBg }}
        >
          <IntegrationIcon id={item.id} fallback={item.icon} />
        </div>
        <div className="flex items-center gap-2">
          {item.badge ? (
            <span className="rounded-md bg-[#F5F5F5] px-1.5 py-0.5 font-ds-ui text-[10px] font-medium text-[#737373]">
              {item.badge}
            </span>
          ) : null}
          {status === "connected" && (
            <span className="inline-flex items-center gap-1.5 font-ds-ui text-[11px] text-[#16A34A]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />
              Connected
            </span>
          )}
        </div>
      </div>
      <div className="mt-3 font-ds-sans text-[15px] font-semibold text-[#171717]">
        {item.name}
      </div>
      <p className="mt-1 flex-1 font-ds-ui text-[12.5px] leading-[18px] text-[#737373]">
        {item.description}
      </p>
      <button
        type="button"
        disabled={disabled}
        onClick={onAction}
        title={disabled ? "Coming soon" : undefined}
        className={`mt-4 inline-flex h-8 w-fit items-center rounded-md px-3 font-ds-sans text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
          primary
            ? "cursor-pointer bg-[#171717] text-white"
            : "cursor-pointer border border-[#1717171F] bg-white text-[#171717] hover:bg-[#FAFAFA]"
        }`}
      >
        {actionLabel}
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-ds-ui text-xs font-medium text-[#171717]">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 rounded-md border border-[#1717171F] bg-white px-3 font-ds-ui text-[13px] outline-none focus:border-[#171717]"
      />
    </label>
  );
}

function IntegrationIcon({ id, fallback }: { id: string; fallback: string }) {
  const cls = "h-4 w-4 text-white";
  switch (id) {
    case "slack":
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="currentColor" aria-hidden>
          <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
        </svg>
      );
    case "github_issues":
    case "github_app":
      return (
        <svg viewBox="0 0 16 16" className={cls} fill="currentColor" aria-hidden>
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
        </svg>
      );
    case "gitlab":
      return (
        <svg viewBox="0 0 16 16" className={cls} fill="currentColor" aria-hidden>
          <path d="M15.97 9.058l-.8-2.464a.54.54 0 00-.206-.276.545.545 0 00-.342-.08.542.542 0 00-.327.126.548.548 0 00-.174.298L12.9 10.42H3.102L1.878 6.662a.544.544 0 00-.174-.298.546.546 0 00-.328-.126.547.547 0 00-.342.08.543.543 0 00-.206.276l-.8 2.464a.81.81 0 00.294.898l7.444 5.408a.542.542 0 00.64 0l7.444-5.408a.81.81 0 00.294-.898z" />
        </svg>
      );
    case "linear":
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="currentColor" aria-hidden>
          <path d="M2.886 14.376a9.985 9.985 0 0 0 6.738 6.738L2.886 14.376zm-.77-2.752 10.26 10.26a10.02 10.02 0 0 1-2.063-.412L2.528 13.687a10.02 10.02 0 0 1-.412-2.063zm.88-3.09 12.47 12.47a9.97 9.97 0 0 1-1.577.743L2.253 10.111a9.97 9.97 0 0 1 .743-1.577zm1.98-2.61 13.1 13.1A9.974 9.974 0 0 0 22 12c0-5.523-4.477-10-10-10a9.974 9.974 0 0 0-7.024 3.924z" />
        </svg>
      );
    case "jira":
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="currentColor" aria-hidden>
          <path d="M11.53 2c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7c0 2.4 1.94 4.34 4.34 4.35V2.84a.84.84 0 0 0-.84-.84H11.53zM6.77 6.8a4.362 4.362 0 0 0 4.34 4.34h1.8v1.72a4.362 4.362 0 0 0 4.34 4.34V7.63a.84.84 0 0 0-.83-.83H6.77zM2 11.6c0 2.4 1.95 4.34 4.35 4.34h1.78v1.72A4.354 4.354 0 0 0 12.47 22v-9.57a.84.84 0 0 0-.84-.83H2z" />
        </svg>
      );
    case "sentry":
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="currentColor" aria-hidden>
          <path d="M13.91 2.26a2.19 2.19 0 0 0-3.82 0L2.31 15.74A2.19 2.19 0 0 0 4.22 19h2.29v-2H4.22a.19.19 0 0 1-.17-.29l3.18-5.52a7.5 7.5 0 0 1 5.04 6.81h2a9.5 9.5 0 0 0-6.11-8.88l1.69-2.93 5.95 10.31A.19.19 0 0 1 15.63 17H13.5v2h2.13a2.19 2.19 0 0 0 1.91-3.28L13.91 2.26zM7.75 19a2.5 2.5 0 0 1 4.5 0H7.75z" />
        </svg>
      );
    case "posthog":
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 3v18h18" />
          <path d="M7 16v-4" />
          <path d="M12 16V8" />
          <path d="M17 16v-6" />
        </svg>
      );
    case "webhooks":
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2" />
          <path d="m6 17 3.13-5.78c.53-.97.1-2.18-.5-3.1a4 4 0 1 1 6.89-4.06" />
          <path d="m12 6 3.13 5.73C15.66 12.7 16.9 13 18 13a4 4 0 0 1 0 8" />
        </svg>
      );
    default:
      return <>{fallback}</>;
  }
}
