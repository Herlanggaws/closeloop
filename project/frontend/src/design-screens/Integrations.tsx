"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type ReactNode } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { api } from "@/lib/api";
import type { MeResponse } from "@/lib/usage";

type Integration = {
  id: string;
  provider: string;
  config: Record<string, string>;
};

type IntegrationRow = {
  id: string;
  provider: string;
  config: Record<string, unknown> | string;
};

type WiredProvider = "sentry" | "posthog" | "slack" | "webhooks" | "github_app";

type CatalogItem = {
  id: string;
  name: string;
  description: string;
  icon: string;
  iconBg: string;
  action: "configure" | "coming_soon" | "upgrade";
  badge?: string;
  wired?: WiredProvider;
};

const NOTIFY_CATALOG: CatalogItem[] = [
  {
    id: "slack",
    name: "Slack",
    description: "Incoming webhook · new reports and status changes",
    icon: "Sl",
    iconBg: "#4A154B",
    action: "configure",
    wired: "slack",
  },
  {
    id: "github_issues",
    name: "GitHub Issues",
    description: "Create issues from tickets",
    icon: "GH",
    iconBg: "#171717",
    action: "coming_soon",
  },
  {
    id: "linear",
    name: "Linear",
    description: "Two-way status sync",
    icon: "Li",
    iconBg: "#5E6AD2",
    action: "coming_soon",
  },
  {
    id: "jira",
    name: "Jira",
    description: "Create issues in Jira Cloud projects",
    icon: "Ji",
    iconBg: "#2684FF",
    action: "upgrade",
    badge: "Studio",
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

function parseConfigObject(raw: IntegrationRow["config"]): Record<string, unknown> {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (raw && typeof raw === "object") return raw;
  return {};
}

function asConfig(raw: IntegrationRow["config"]): Record<string, string> {
  const obj = parseConfigObject(raw);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string" && v.trim()) out[k] = v.trim();
  }
  return out;
}

function slackEventsFromConfig(raw: IntegrationRow["config"]): SlackEventsState {
  const defaults: SlackEventsState = {
    new_bug: true,
    new_idea: true,
    status_changed: true,
    marked_fixed: true,
  };
  const obj = parseConfigObject(raw);
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
  const obj = parseConfigObject(raw);
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
  const [configureModal, setConfigureModal] = useState<WiredProvider | null>(null);
  const configureTitleId = useId();

  const [sentryOrg, setSentryOrg] = useState("");
  const [sentryProject, setSentryProject] = useState("");
  const [posthogHost, setPosthogHost] = useState("https://us.posthog.com");
  const [posthogProject, setPosthogProject] = useState("");
  const [slackWebhook, setSlackWebhook] = useState("");
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
  const [githubRepo, setGithubRepo] = useState("");
  const [githubBranch, setGithubBranch] = useState("main");
  const [githubAccount, setGithubAccount] = useState("");
  const [githubRepos, setGithubRepos] = useState<
    { full_name: string; default_branch: string }[]
  >([]);

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

        const params = new URLSearchParams(window.location.search);
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
    setGithubRepo(config.repo_full_name || "");
    setGithubBranch(config.default_branch || "main");
    setGithubAccount(config.account_login || "");
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
      applyGitHubConfig(asConfig(res.integration.config));
      setConfigureModal("github_app");
      await loadGitHubRepos(project, installationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect GitHub App");
    } finally {
      setSaving(null);
    }
  }

  async function loadGitHubRepos(project: string, installationId?: number) {
    const q =
      installationId && installationId > 0 ? `?installation_id=${installationId}` : "";
    try {
      const res = await api<{
        repos: { full_name: string; default_branch: string }[];
      }>(`/api/projects/${project}/integrations/github_app/repos${q}`);
      setGithubRepos(res.repos || []);
    } catch {
      setGithubRepos([]);
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
        setGithubRepo("");
        setGithubBranch("main");
        setGithubAccount("");
        setGithubRepos([]);
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

  function statusFor(item: CatalogItem): "connected" | "none" {
    if (item.wired === "sentry") return sentryConnected ? "connected" : "none";
    if (item.wired === "posthog") return posthogConnected ? "connected" : "none";
    if (item.wired === "slack") return slackConnected ? "connected" : "none";
    if (item.wired === "webhooks") return webhooksConnected ? "connected" : "none";
    if (item.wired === "github_app") return githubConnected ? "connected" : "none";
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

  function onCardAction(item: CatalogItem) {
    if (item.action === "configure" && item.wired === "github_app") {
      if (!githubConnected) {
        void connectGitHubApp();
        return;
      }
      void loadGitHubRepos(projectId, Number(githubInstallationId) || undefined);
      setConfigureModal("github_app");
      return;
    }
    if (item.action === "configure" && item.wired) {
      setConfigureModal(item.wired);
    }
  }

  function actionLabel(item: CatalogItem): string {
    if (item.action === "upgrade") return "Upgrade";
    if (item.action === "coming_soon") return "Coming soon";
    if (item.wired === "github_app") return githubConnected ? "Configure" : "Connect";
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

              <IntegrationGroup title="Notify and track">
                {NOTIFY_CATALOG.map((item) => (
                  <IntegrationCard
                    key={item.id}
                    item={item}
                    status={statusFor(item)}
                    actionLabel={actionLabel(item)}
                    onAction={() => onCardAction(item)}
                  />
                ))}
              </IntegrationGroup>

              <IntegrationGroup title="Debugging context">
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
                              Slack · Incoming webhook
                            </h3>
                            <p className="mt-1 font-ds-ui text-[12.5px] text-[#737373]">
                              Choose which events post to the channel. Paste a Slack Incoming
                              Webhook URL to connect.
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
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
                        <div className="mt-4">
                          <Field
                            label="Incoming Webhook URL"
                            value={slackWebhook}
                            onChange={setSlackWebhook}
                            placeholder="https://hooks.slack.com/services/…"
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
                              saving === "slack" ||
                              !slackWebhook.trim().startsWith("https://hooks.slack.com/")
                            }
                            onClick={() =>
                              void saveAndClose("slack", {
                                webhook_url: slackWebhook.trim(),
                                events: SLACK_EVENT_KEYS.filter((key) => slackEvents[key]),
                              })
                            }
                            className="inline-flex h-9 cursor-pointer items-center rounded-md bg-[#171717] px-3 font-ds-sans text-[13px] font-medium text-white disabled:opacity-50"
                          >
                            {saving === "slack" ? "Saving…" : "Save Slack"}
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
                              Choose the repo Auto PR may open branches and pull requests in. Saidloop
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
                              Reinstall / change repos
                            </button>
                          </div>
                        )}
                        {githubAccount || githubInstallationId ? (
                          <p className="mt-3 font-ds-ui text-[12px] text-[#737373]">
                            Installation {githubInstallationId}
                            {githubAccount ? ` · ${githubAccount}` : ""}
                          </p>
                        ) : null}
                        <div className="mt-4">
                          <label className="flex flex-col gap-1.5">
                            <span className="font-ds-ui text-[11px] font-medium text-[#737373]">
                              Repository
                            </span>
                            {githubRepos.length > 0 ? (
                              <select
                                value={githubRepo}
                                onChange={(e) => {
                                  const full = e.target.value;
                                  setGithubRepo(full);
                                  const match = githubRepos.find((r) => r.full_name === full);
                                  if (match?.default_branch) setGithubBranch(match.default_branch);
                                  if (full.includes("/")) {
                                    setGithubAccount(full.split("/")[0] || "");
                                  }
                                }}
                                className="h-10 rounded-md border border-[#1717171F] bg-white px-3 font-ds-ui text-[13px] text-[#171717]"
                              >
                                <option value="">Select a repository…</option>
                                {githubRepos.map((r) => (
                                  <option key={r.full_name} value={r.full_name}>
                                    {r.full_name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <Field
                                label=""
                                value={githubRepo}
                                onChange={setGithubRepo}
                                placeholder="owner/repo"
                              />
                            )}
                          </label>
                        </div>
                        <div className="mt-3">
                          <Field
                            label="Base branch"
                            value={githubBranch}
                            onChange={setGithubBranch}
                            placeholder="main"
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
                              saving === "github_app" ||
                              !githubInstallationId ||
                              !githubRepo.trim()
                            }
                            onClick={() =>
                              void saveAndClose("github_app", {
                                installation_id: githubInstallationId,
                                account_login: githubAccount || githubRepo.split("/")[0] || "",
                                repo_full_name: githubRepo.trim(),
                                default_branch: githubBranch.trim() || "main",
                              })
                            }
                            className="inline-flex h-9 cursor-pointer items-center rounded-md bg-[#171717] px-3 font-ds-sans text-[13px] font-medium text-white disabled:opacity-50"
                          >
                            {saving === "github_app" ? "Saving…" : "Save repository"}
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

function IntegrationGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-ds-ui text-xs font-medium text-[#A3A3A3]">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
    </section>
  );
}

function IntegrationCard({
  item,
  status,
  actionLabel,
  onAction,
}: {
  item: CatalogItem;
  status: "connected" | "none";
  actionLabel: string;
  onAction: () => void;
}) {
  const disabled = item.action === "coming_soon";
  const primary = item.action === "upgrade";

  return (
    <div className="flex min-h-[156px] flex-col rounded-xl border border-[#17171714] bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg font-ds-sans text-[11px] font-semibold text-white"
          style={{ background: item.iconBg }}
        >
          {item.icon}
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
