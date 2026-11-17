"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ProjectSwitcher } from "@/components/ProjectSwitcher";
import { api, logout } from "@/lib/api";
import { displayName, initials } from "@/lib/tickets";
import { formatUsage, type MeResponse } from "@/lib/usage";

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

type CatalogItem = {
  id: string;
  name: string;
  description: string;
  group: "notify" | "debug";
  action: "configure" | "upgrade" | "add";
  icon: string;
  planBadge?: string;
  wired?: boolean;
};

const CATALOG: CatalogItem[] = [
  {
    id: "slack",
    name: "Slack",
    description: "Post new reports and status changes to a channel",
    group: "notify",
    action: "configure",
    icon: "S",
  },
  {
    id: "github_issues",
    name: "GitHub Issues",
    description: "Create issues from tickets in your repo",
    group: "notify",
    action: "configure",
    icon: "G",
  },
  {
    id: "linear",
    name: "Linear",
    description: "Two-way status sync with a Linear team",
    group: "notify",
    action: "configure",
    icon: "L",
  },
  {
    id: "jira",
    name: "Jira",
    description: "Create issues in Jira Cloud projects",
    group: "notify",
    action: "upgrade",
    icon: "J",
    planBadge: "Studio",
  },
  {
    id: "sentry",
    name: "Sentry",
    description: "Link reports to errors by user and release",
    group: "debug",
    action: "configure",
    icon: "Se",
    wired: true,
  },
  {
    id: "posthog",
    name: "PostHog",
    description: "Attach the session from before each report",
    group: "debug",
    action: "configure",
    icon: "P",
    wired: true,
  },
  {
    id: "github_app",
    name: "GitHub App",
    description: "Repository access for AI auto PR",
    group: "debug",
    action: "configure",
    icon: "Gh",
  },
  {
    id: "webhooks",
    name: "Webhooks",
    description: "POST every report event to your endpoint",
    group: "debug",
    action: "add",
    icon: "W",
  },
];

const SLACK_EVENTS = [
  { id: "new_bug", label: "New bug", defaultOn: true },
  { id: "new_idea", label: "New idea", defaultOn: true },
  { id: "status_changed", label: "Status changed", defaultOn: false },
  { id: "marked_fixed", label: "Marked fixed", defaultOn: true },
] as const;

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
  const [expanded, setExpanded] = useState<"slack" | "sentry" | "posthog" | null>(null);
  const [slackEvents, setSlackEvents] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(SLACK_EVENTS.map((e) => [e.id, e.defaultOn])),
  );

  const [sentryOrg, setSentryOrg] = useState("");
  const [sentryProject, setSentryProject] = useState("");
  const [posthogHost, setPosthogHost] = useState("https://us.posthog.com");
  const [posthogProject, setPosthogProject] = useState("");

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
        if (sentry) {
          setSentryOrg(sentry.config.org || "");
          setSentryProject(sentry.config.project || "");
        }
        if (posthog) {
          setPosthogHost(posthog.config.host || "https://us.posthog.com");
          setPosthogProject(posthog.config.project_id || posthog.config.project || "");
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

  async function saveProvider(provider: "sentry" | "posthog", config: Record<string, string>) {
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

  async function clearProvider(provider: "sentry" | "posthog") {
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
      } else {
        setPosthogHost("https://us.posthog.com");
        setPosthogProject("");
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

  function statusFor(item: CatalogItem): "connected" | "coming" | "upgrade" | "none" {
    if (item.id === "sentry") return sentryConnected ? "connected" : "none";
    if (item.id === "posthog") return posthogConnected ? "connected" : "none";
    if (item.action === "upgrade") return "upgrade";
    if (!item.wired) return "coming";
    return "none";
  }

  function onAction(item: CatalogItem) {
    if (item.id === "sentry" || item.id === "posthog" || item.id === "slack") {
      setExpanded((prev) => (prev === item.id ? null : item.id));
      return;
    }
    if (item.action === "upgrade") {
      router.push("/app/settings/billing");
    }
  }

  function actionLabel(item: CatalogItem) {
    if (item.action === "upgrade") return "Upgrade";
    if (item.action === "add") return "Add";
    if (item.id === "slack" || item.id === "sentry" || item.id === "posthog") {
      return expanded === item.id ? "Close" : "Configure";
    }
    return "Configure";
  }

  const notify = CATALOG.filter((i) => i.group === "notify");
  const debug = CATALOG.filter((i) => i.group === "debug");

  return (
    <div className="box-border flex min-h-screen w-full bg-white">
      <aside className="flex h-screen w-[248px] shrink-0 flex-col gap-0.5 border-r border-[#17171714] bg-[#FAFAFA] p-3">
        <ProjectSwitcher
          projectName={projectName}
          plan={plan}
          email={email}
          usage={me?.usage}
        />
        <nav className="mt-3 flex flex-1 flex-col gap-0.5 overflow-y-auto">
          <NavItem href="/app/inbox" label="Inbox" />
          <NavItem href="/app/auto-pr" label="Auto PR runs" />
          <NavItem href="/app/board" label="Public board" />
          <SectionLabel>Setup</SectionLabel>
          <NavItem href="/app/install" label="Install widget" />
          <NavItem href="/app/mcp" label="MCP server" />
          <SectionLabel>Settings</SectionLabel>
          <NavItem href="/app/settings" label="Project" />
          <NavItem href="/app/settings/integrations" label="Integrations" active />
          <NavItem href="/app/settings/team" label="Team" />
          <NavItem href="/app/settings/billing" label="Billing" />
        </nav>
        <div className="mt-auto flex flex-col gap-2">
          {me?.usage && (
            <div className="rounded-[10px] border border-[#17171714] bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-ds-ui text-[11px] text-[#737373]">Reports this month</span>
                <span className="font-ds-ui text-[11px] font-medium text-[#171717]">
                  {formatUsage(me.usage.reports)}
                </span>
              </div>
            </div>
          )}
          {email && (
            <div className="flex items-center gap-2.5 px-1.5 py-1">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#171717]">
                {me?.user?.avatar_url ? (
                  <img src={me.user.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="font-ds-sans text-[11px] font-medium text-white">
                    {initials(email)}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-ds-ui text-[13px] font-medium text-[#171717]">
                  {me?.user?.name || displayName(email)}
                </div>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="cursor-pointer font-ds-ui text-[11px] text-[#A3A3A3] hover:text-[#171717]"
                >
                  Log out
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

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
                {notify.map((item) => (
                  <IntegrationCard
                    key={item.id}
                    item={item}
                    status={statusFor(item)}
                    actionLabel={actionLabel(item)}
                    primary={item.action === "upgrade" || item.action === "add"}
                    onAction={() => onAction(item)}
                  />
                ))}
              </IntegrationGroup>

              <IntegrationGroup title="Debugging context">
                {debug.map((item) => (
                  <IntegrationCard
                    key={item.id}
                    item={item}
                    status={statusFor(item)}
                    actionLabel={actionLabel(item)}
                    primary={item.action === "add"}
                    onAction={() => onAction(item)}
                  />
                ))}
              </IntegrationGroup>

              {expanded === "slack" && (
                <div className="flex flex-col gap-5 rounded-xl border border-[#17171714] bg-[#FAFAFA] p-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-sm">
                    <h3 className="font-ds-sans text-[15px] font-semibold text-[#171717]">
                      Slack · #feedback
                    </h3>
                    <p className="mt-1 font-ds-ui text-[12.5px] text-[#737373]">
                      Choose which events post to the channel. OAuth connect ships with F8.
                    </p>
                  </div>
                  <div className="flex min-w-[280px] flex-1 flex-col gap-1">
                    {SLACK_EVENTS.map((event) => (
                      <label
                        key={event.id}
                        className="flex h-10 cursor-pointer items-center justify-between gap-4 rounded-md px-2 hover:bg-white"
                      >
                        <span className="font-ds-ui text-[13.5px] text-[#171717]">
                          {event.label}
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={slackEvents[event.id]}
                          onClick={() =>
                            setSlackEvents((prev) => ({
                              ...prev,
                              [event.id]: !prev[event.id],
                            }))
                          }
                          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                            slackEvents[event.id] ? "bg-[#171717]" : "bg-[#E5E5E5]"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                              slackEvents[event.id] ? "left-4" : "left-0.5"
                            }`}
                          />
                        </button>
                      </label>
                    ))}
                  </div>
                </div>
              )}

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
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{children}</div>
    </section>
  );
}

function IntegrationCard({
  item,
  status,
  actionLabel,
  primary,
  onAction,
}: {
  item: CatalogItem;
  status: "connected" | "coming" | "upgrade" | "none";
  actionLabel: string;
  primary: boolean;
  onAction: () => void;
}) {
  const canOpen =
    item.id === "slack" ||
    item.id === "sentry" ||
    item.id === "posthog" ||
    item.action === "upgrade" ||
    item.action === "add";

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
        {item.planBadge && (
          <span className="font-ds-ui text-[11px] font-medium text-[#A3A3A3]">
            {item.planBadge}
          </span>
        )}
        {status === "coming" && !item.planBadge && item.id !== "slack" && (
          <span className="font-ds-ui text-[11px] text-[#A3A3A3]">Soon</span>
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
        disabled={!canOpen && item.action === "configure"}
        className={`mt-4 inline-flex h-8 w-fit cursor-pointer items-center rounded-md px-3 font-ds-sans text-[13px] font-medium disabled:cursor-default disabled:opacity-50 ${
          primary
            ? "bg-[#171717] text-white"
            : "border border-[#1717171F] bg-white text-[#171717] hover:bg-[#FAFAFA]"
        }`}
      >
        {!canOpen && item.action === "configure" ? "Coming later" : actionLabel}
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

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mt-3 px-1.5 pb-1 pt-2 font-ds-ui text-[11px] font-medium uppercase tracking-[0.04em] text-[#A3A3A3]">
      {children}
    </div>
  );
}

function NavItem({
  href,
  label,
  active = false,
}: {
  href: string;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex h-8 items-center rounded-md px-2.5 font-ds-ui text-[13px] ${
        active
          ? "bg-[#F5F5F5] font-medium text-[#171717]"
          : "text-[#737373] hover:bg-[#1717170A] hover:text-[#171717]"
      }`}
    >
      {label}
    </Link>
  );
}
