"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
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

type ProviderID = "sentry" | "posthog" | "slack";

type CatalogItem = {
  id: ProviderID;
  name: string;
  description: string;
  icon: string;
};

const DEBUG_CATALOG: CatalogItem[] = [
  {
    id: "sentry",
    name: "Sentry",
    description: "Link reports to errors by user and release",
    icon: "Se",
  },
  {
    id: "posthog",
    name: "PostHog",
    description: "Attach the session from before each report",
    icon: "P",
  },
];

const TEAM_CATALOG: CatalogItem[] = [
  {
    id: "slack",
    name: "Slack",
    description: "Post new reports to a channel via Incoming Webhook",
    icon: "Sl",
  },
];

function asConfig(raw: IntegrationRow["config"]): Record<string, string> {
  let obj: Record<string, unknown> = {};
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      obj = {};
    }
  } else if (raw && typeof raw === "object") {
    obj = raw;
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string" && v.trim()) out[k] = v.trim();
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
  const [expanded, setExpanded] = useState<ProviderID | null>(null);

  const [sentryOrg, setSentryOrg] = useState("");
  const [sentryProject, setSentryProject] = useState("");
  const [posthogHost, setPosthogHost] = useState("https://us.posthog.com");
  const [posthogProject, setPosthogProject] = useState("");
  const [slackWebhook, setSlackWebhook] = useState("");

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
      .then(([meRes, projectRes, integRes]) => {
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

  async function saveProvider(provider: ProviderID, config: Record<string, string>) {
    if (!projectId) return;
    setSaving(provider);
    setError("");
    try {
      await api(`/api/projects/${projectId}/integrations/${provider}`, {
        method: "PUT",
        body: JSON.stringify({ config }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(null);
    }
  }

  async function clearProvider(provider: ProviderID) {
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
      } else {
        setSlackWebhook("");
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

  function statusFor(item: CatalogItem): "connected" | "none" {
    if (item.id === "sentry") return sentryConnected ? "connected" : "none";
    if (item.id === "posthog") return posthogConnected ? "connected" : "none";
    return slackConnected ? "connected" : "none";
  }

  function onAction(item: CatalogItem) {
    setExpanded((prev) => (prev === item.id ? null : item.id));
  }

  function actionLabel(item: CatalogItem) {
    return expanded === item.id ? "Close" : "Configure";
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
              Debugging deep links and team notifications for new reports.
            </p>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-8 px-10 pb-10 pt-6">
          {loading ? (
            <p className="font-ds-ui text-sm text-[#737373]">Loading…</p>
          ) : (
            <>
              {error && <p className="font-ds-ui text-sm text-[#DA314A]">{error}</p>}

              <IntegrationGroup title="Debugging context">
                {DEBUG_CATALOG.map((item) => (
                  <IntegrationCard
                    key={item.id}
                    item={item}
                    status={statusFor(item)}
                    actionLabel={actionLabel(item)}
                    onAction={() => onAction(item)}
                  />
                ))}
              </IntegrationGroup>

              <IntegrationGroup title="Team notifications">
                {TEAM_CATALOG.map((item) => (
                  <IntegrationCard
                    key={item.id}
                    item={item}
                    status={statusFor(item)}
                    actionLabel={actionLabel(item)}
                    onAction={() => onAction(item)}
                  />
                ))}
              </IntegrationGroup>

              {expanded === "sentry" && (
                <div className="rounded-xl border border-[#17171714] bg-[#FAFAFA] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-ds-sans text-[15px] font-semibold text-[#171717]">
                        Sentry
                      </h3>
                      <p className="mt-1 font-ds-ui text-[12.5px] text-[#737373]">
                        Links use <code className="font-ds-mono text-[12px]">sentry_event_id</code>{" "}
                        from report context.
                      </p>
                    </div>
                    {sentryConnected && (
                      <button
                        type="button"
                        disabled={saving === "sentry"}
                        onClick={() => void clearProvider("sentry")}
                        className="cursor-pointer font-ds-ui text-xs text-[#737373] hover:text-[#171717]"
                      >
                        Disconnect
                      </button>
                    )}
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Field label="Org slug" value={sentryOrg} onChange={setSentryOrg} placeholder="acme" />
                    <Field
                      label="Project slug"
                      value={sentryProject}
                      onChange={setSentryProject}
                      placeholder="web-app"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={saving === "sentry" || !sentryOrg.trim()}
                    onClick={() =>
                      void saveProvider("sentry", {
                        org: sentryOrg.trim(),
                        project: sentryProject.trim(),
                      })
                    }
                    className="mt-4 inline-flex h-9 cursor-pointer items-center rounded-md bg-[#171717] px-3 font-ds-sans text-[13px] font-medium text-white disabled:opacity-50"
                  >
                    {saving === "sentry" ? "Saving…" : "Save Sentry"}
                  </button>
                </div>
              )}

              {expanded === "posthog" && (
                <div className="rounded-xl border border-[#17171714] bg-[#FAFAFA] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-ds-sans text-[15px] font-semibold text-[#171717]">
                        PostHog
                      </h3>
                      <p className="mt-1 font-ds-ui text-[12.5px] text-[#737373]">
                        Links use{" "}
                        <code className="font-ds-mono text-[12px]">posthog_session_id</code> from
                        report context.
                      </p>
                    </div>
                    {posthogConnected && (
                      <button
                        type="button"
                        disabled={saving === "posthog"}
                        onClick={() => void clearProvider("posthog")}
                        className="cursor-pointer font-ds-ui text-xs text-[#737373] hover:text-[#171717]"
                      >
                        Disconnect
                      </button>
                    )}
                  </div>
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
                  <button
                    type="button"
                    disabled={
                      saving === "posthog" || !posthogHost.trim() || !posthogProject.trim()
                    }
                    onClick={() =>
                      void saveProvider("posthog", {
                        host: posthogHost.trim().replace(/\/$/, ""),
                        project_id: posthogProject.trim(),
                      })
                    }
                    className="mt-4 inline-flex h-9 cursor-pointer items-center rounded-md bg-[#171717] px-3 font-ds-sans text-[13px] font-medium text-white disabled:opacity-50"
                  >
                    {saving === "posthog" ? "Saving…" : "Save PostHog"}
                  </button>
                </div>
              )}

              {expanded === "slack" && (
                <div className="rounded-xl border border-[#17171714] bg-[#FAFAFA] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-ds-sans text-[15px] font-semibold text-[#171717]">
                        Slack
                      </h3>
                      <p className="mt-1 font-ds-ui text-[12.5px] text-[#737373]">
                        Paste an Incoming Webhook URL from Slack. New reports post to that
                        channel.
                      </p>
                    </div>
                    {slackConnected && (
                      <button
                        type="button"
                        disabled={saving === "slack"}
                        onClick={() => void clearProvider("slack")}
                        className="cursor-pointer font-ds-ui text-xs text-[#737373] hover:text-[#171717]"
                      >
                        Disconnect
                      </button>
                    )}
                  </div>
                  <div className="mt-4 grid gap-3">
                    <Field
                      label="Incoming Webhook URL"
                      value={slackWebhook}
                      onChange={setSlackWebhook}
                      placeholder="https://hooks.slack.com/services/…"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={
                      saving === "slack" ||
                      !slackWebhook.trim().startsWith("https://hooks.slack.com/")
                    }
                    onClick={() =>
                      void saveProvider("slack", {
                        webhook_url: slackWebhook.trim(),
                      })
                    }
                    className="mt-4 inline-flex h-9 cursor-pointer items-center rounded-md bg-[#171717] px-3 font-ds-sans text-[13px] font-medium text-white disabled:opacity-50"
                  >
                    {saving === "slack" ? "Saving…" : "Save Slack"}
                  </button>
                </div>
              )}
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
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">{children}</div>
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
  return (
    <div className="flex min-h-[148px] flex-col rounded-xl border border-[#17171714] bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#17171714] bg-[#FAFAFA] font-ds-sans text-[11px] font-semibold text-[#171717]">
          {item.icon}
        </div>
        {status === "connected" && (
          <span className="inline-flex items-center gap-1.5 font-ds-ui text-[11px] text-[#16A34A]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />
            Connected
          </span>
        )}
      </div>
      <div className="mt-3 font-ds-sans text-[15px] font-semibold text-[#171717]">
        {item.name}
      </div>
      <p className="mt-1 flex-1 font-ds-ui text-[12.5px] leading-[18px] text-[#737373]">
        {item.description}
      </p>
      <button
        type="button"
        onClick={onAction}
        className="mt-4 inline-flex h-8 w-fit cursor-pointer items-center rounded-md border border-[#1717171F] bg-white px-3 font-ds-sans text-[13px] font-medium text-[#171717] hover:bg-[#FAFAFA]"
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
