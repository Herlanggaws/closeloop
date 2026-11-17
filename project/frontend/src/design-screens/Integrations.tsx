"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ProjectSwitcher } from "@/components/ProjectSwitcher";
import { api, logout } from "@/lib/api";
import { displayName, initials } from "@/lib/tickets";
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
        {email && (
          <div className="mt-auto flex flex-col gap-1">
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
                <div className="truncate font-ds-ui text-[12px] font-medium text-[#171717]">
                  {me?.user?.name || displayName(email)}
                </div>
                <div className="truncate font-ds-ui text-[11px] text-[#A3A3A3]">{email}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => logout()}
              className="cursor-pointer rounded-md px-1.5 py-1 text-left font-ds-ui text-[12px] text-[#737373] hover:bg-[#1717170A]"
            >
              Log out
            </button>
          </div>
        )}
      </aside>

      <main className="flex min-h-screen flex-1 flex-col overflow-y-auto bg-[#F7F7F7]">
        <header className="flex h-14 shrink-0 items-center border-b border-[#17171714] bg-white px-8">
          <h1 className="font-ds-sans text-[15px] font-semibold tracking-[-0.2px] text-[#171717]">
            Integrations
          </h1>
        </header>

        <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 px-8 py-8">
          <p className="font-ds-ui text-[13px] text-[#737373]">
            Paste Sentry and PostHog project details to turn report context IDs into deep links on
            ticket detail. OAuth sync ships later.
          </p>
          {loading ? (
            <p className="font-ds-ui text-sm text-[#737373]">Loading…</p>
          ) : (
            <>
              {error && <p className="text-sm text-[#DA314A]">{error}</p>}

              <section className="rounded-2xl border border-[#17171714] bg-white p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-ds-sans text-[16px] font-medium text-[#171717]">Sentry</h2>
                    <p className="mt-1 font-ds-ui text-[13px] text-[#737373]">
                      Links use <code className="font-ds-mono text-[12px]">sentry_event_id</code> from
                      the report context.
                    </p>
                  </div>
                  {(sentryOrg || sentryProject) && (
                    <button
                      type="button"
                      disabled={saving === "sentry"}
                      onClick={() => clearProvider("sentry")}
                      className="cursor-pointer font-ds-ui text-[12px] text-[#737373] hover:text-[#171717]"
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
                    saveProvider("sentry", {
                      org: sentryOrg.trim(),
                      project: sentryProject.trim(),
                    })
                  }
                  className="mt-4 inline-flex h-9 cursor-pointer items-center rounded-md bg-[#171717] px-3 font-ds-sans text-[13px] font-medium text-white disabled:opacity-50"
                >
                  {saving === "sentry" ? "Saving…" : "Save Sentry"}
                </button>
              </section>

              <section className="rounded-2xl border border-[#17171714] bg-white p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-ds-sans text-[16px] font-medium text-[#171717]">PostHog</h2>
                    <p className="mt-1 font-ds-ui text-[13px] text-[#737373]">
                      Links use <code className="font-ds-mono text-[12px]">posthog_session_id</code>{" "}
                      from the report context.
                    </p>
                  </div>
                  {(posthogHost || posthogProject) && (
                    <button
                      type="button"
                      disabled={saving === "posthog"}
                      onClick={() => clearProvider("posthog")}
                      className="cursor-pointer font-ds-ui text-[12px] text-[#737373] hover:text-[#171717]"
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
                  disabled={saving === "posthog" || !posthogHost.trim() || !posthogProject.trim()}
                  onClick={() =>
                    saveProvider("posthog", {
                      host: posthogHost.trim().replace(/\/$/, ""),
                      project_id: posthogProject.trim(),
                    })
                  }
                  className="mt-4 inline-flex h-9 cursor-pointer items-center rounded-md bg-[#171717] px-3 font-ds-sans text-[13px] font-medium text-white disabled:opacity-50"
                >
                  {saving === "posthog" ? "Saving…" : "Save PostHog"}
                </button>
              </section>

              <section className="rounded-2xl border border-dashed border-[#1717171F] bg-white p-6">
                <h2 className="font-ds-sans text-[16px] font-medium text-[#171717]">Coming later</h2>
                <p className="mt-1 font-ds-ui text-[13px] text-[#737373]">
                  Slack, GitHub Issues, Linear, and Jira OAuth connect in M3.
                </p>
              </section>
            </>
          )}
        </div>
      </main>
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
      <span className="font-ds-ui text-[12px] font-medium text-[#171717]">{label}</span>
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
          ? "bg-[#171717] font-medium text-white"
          : "text-[#525252] hover:bg-[#1717170A] hover:text-[#171717]"
      }`}
    >
      {label}
    </Link>
  );
}
