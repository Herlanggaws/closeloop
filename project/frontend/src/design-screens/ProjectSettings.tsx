"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { api, clearProjectSelection, logout } from "@/lib/api";
import {
  displayName,
  initials,
  projectInitial,
} from "@/lib/tickets";

type ProjectInfo = {
  id: string;
  name: string;
  platforms?: string[];
  notify_enabled: boolean;
  sensitive_selectors?: string[];
};

type MeResponse = {
  user: { email: string };
  org: { name: string; plan: string };
};

type ProjectResponse = {
  public_key: string;
  project: ProjectInfo;
};

const PLATFORM_LABELS: Record<string, string> = {
  web: "Web",
  android: "Android",
  ios: "iOS",
  flutter: "Flutter",
};

export function ProjectSettings() {
  const router = useRouter();
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [publicKey, setPublicKey] = useState("");
  const [notifyEnabled, setNotifyEnabled] = useState(true);
  const [savingNotify, setSavingNotify] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const projectId = localStorage.getItem("closeloop_project");
    if (!projectId) {
      router.replace("/app/onboarding");
      return;
    }

    let cancelled = false;
    setLoading(true);

    Promise.all([
      api<ProjectResponse>(`/api/projects/${projectId}`),
      api<MeResponse>("/api/me"),
    ])
      .then(([projectRes, meRes]) => {
        if (cancelled) return;
        setProject(projectRes.project);
        setMe(meRes);
        setPublicKey(projectRes.public_key);
        setNotifyEnabled(projectRes.project.notify_enabled);
        localStorage.setItem("closeloop_public_key", projectRes.public_key);
        setError("");
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load settings";
        setError(message);
        if (/not found|forbidden/i.test(message)) {
          clearProjectSelection();
          router.replace("/app/onboarding");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  const projectName = project?.name || "Project";
  const plan = me?.org.plan || "Indie";
  const email = me?.user.email || "";
  const platforms = project?.platforms?.length ? project.platforms : ["web"];
  const selectors = project?.sensitive_selectors?.length
    ? project.sensitive_selectors
    : ["[data-closeloop-mask]"];

  async function copyPublicKey() {
    if (!publicKey) return;
    await navigator.clipboard.writeText(publicKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function toggleNotify() {
    if (!project || savingNotify) return;
    const next = !notifyEnabled;
    const previous = notifyEnabled;
    setNotifyEnabled(next);
    setSavingNotify(true);
    setError("");
    try {
      const res = await api<{ project: ProjectInfo }>(`/api/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({ notify_enabled: next }),
      });
      setProject(res.project);
      setNotifyEnabled(res.project.notify_enabled);
    } catch (err) {
      setNotifyEnabled(previous);
      setError(err instanceof Error ? err.message : "Failed to update notifications");
    } finally {
      setSavingNotify(false);
    }
  }

  return (
    <div className="box-border flex min-h-screen w-full bg-white">
      <aside className="flex h-screen w-[248px] shrink-0 flex-col gap-0.5 border-r border-[#17171714] bg-[#FAFAFA] p-3">
        <div className="flex items-center gap-2.5 rounded-md p-1.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#F59E0B]">
            <span className="font-ds-sans text-[13px] font-semibold text-white">
              {projectInitial(projectName)}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-ds-ui text-[13px] font-semibold text-[#171717]">
              {projectName}
            </div>
            <div className="truncate font-ds-ui text-[11px] text-[#A3A3A3]">
              {email ? `${displayName(email).split(" ")[0]} · ${plan}` : plan}
            </div>
          </div>
        </div>

        <nav className="mt-3 flex flex-1 flex-col gap-0.5 overflow-y-auto">
          <NavItem href="/app/inbox" label="Inbox" />
          <NavItem href="/app/auto-pr" label="Auto PR runs" />
          <NavItem href="/app/board" label="Public board" />
          <SectionLabel>Setup</SectionLabel>
          <NavItem href="/app/install" label="Install widget" />
          <NavItem href="/app/mcp" label="MCP server" />
          <SectionLabel>Settings</SectionLabel>
          <NavItem href="/app/settings" label="Project" active />
          <NavItem href="/app/settings/integrations" label="Integrations" />
          <NavItem href="/app/settings/team" label="Team" />
          <NavItem href="/app/settings/billing" label="Billing" />
        </nav>

        {email && (
          <div className="mt-auto flex items-center gap-2.5 px-1.5 py-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#171717]">
              <span className="font-ds-sans text-[11px] font-medium text-white">
                {initials(email)}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-ds-ui text-[13px] font-medium text-[#171717]">
                {displayName(email)}
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
      </aside>

      <main className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="flex h-[60px] shrink-0 items-center border-b border-[#17171714] px-6">
          <h1 className="font-ds-sans text-lg font-semibold tracking-[-0.36px] text-[#171717]">
            Project settings
          </h1>
        </header>

        <div className="flex flex-1 flex-col overflow-y-auto px-6 py-2 pb-10">
          {loading ? (
            <p className="py-6 font-ds-ui text-sm text-[#737373]">Loading…</p>
          ) : (
            <>
              {error && (
                <div className="mt-4 rounded-md bg-[#FEF2F2] px-3 py-2 font-ds-ui text-[13px] text-[#DA314A]">
                  {error}
                </div>
              )}

              <SettingsSection
                title="General"
                description="Name and platforms for this project."
              >
                <Field label="Project name">
                  <div className="flex h-9 items-center rounded-md border border-[#1717171F] bg-white px-2.5 font-ds-ui text-[13px] text-[#171717]">
                    {projectName}
                  </div>
                </Field>
                <div className="flex flex-wrap gap-2">
                  {platforms.map((id) => (
                    <span
                      key={id}
                      className="rounded-md border border-[#1717171F] bg-white px-2 py-1 font-ds-sans text-[13px] font-medium tracking-[-0.2px] text-[#171717]"
                    >
                      {PLATFORM_LABELS[id] || id}
                    </span>
                  ))}
                  <button
                    type="button"
                    disabled
                    className="cursor-not-allowed rounded-md border border-[#1717171F] bg-white px-3 py-1 font-ds-sans text-[13px] font-medium tracking-[-0.2px] text-[#A3A3A3]"
                  >
                    Add platform
                  </button>
                </div>
              </SettingsSection>

              <SettingsSection
                title="Keys"
                description="The public key ships in your app and can only create reports."
              >
                <Field label="Public key">
                  <div className="flex h-9 items-center gap-2 rounded-md border border-[#1717171F] bg-white px-2.5">
                    <code className="min-w-0 flex-1 truncate font-ds-mono text-[13px] text-[#171717]">
                      {publicKey || "—"}
                    </code>
                    <button
                      type="button"
                      disabled={!publicKey}
                      onClick={copyPublicKey}
                      className="cursor-pointer font-ds-ui text-[12px] font-medium text-[#171717] underline-offset-2 hover:underline disabled:opacity-50"
                    >
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                </Field>
                <p className="font-ds-ui text-[12px] text-[#A3A3A3]">
                  MCP tokens are managed on the{" "}
                  <Link
                    href="/app/mcp"
                    className="text-[#171717] underline-offset-2 hover:underline"
                  >
                    MCP server
                  </Link>{" "}
                  page.
                </p>
              </SettingsSection>

              <SettingsSection
                title="Privacy and masking"
                description="Masked content is blurred on the device. It never reaches our servers."
              >
                <ToggleRow
                  title="Mask all text inputs"
                  description="Passwords and card fields are always masked"
                  checked
                  disabled
                />
                <Field label="Also mask these selectors">
                  <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-[#1717171F] p-2">
                    {selectors.map((selector) => (
                      <span
                        key={selector}
                        className="rounded bg-[#F5F5F5] px-2 py-0.5 font-ds-mono text-[11.5px] text-[#171717]"
                      >
                        {selector}
                      </span>
                    ))}
                  </div>
                  <p className="mt-1.5 font-ds-ui text-[12px] text-[#A3A3A3]">
                    Editing selectors comes next — values already saved on the project are shown.
                  </p>
                </Field>
              </SettingsSection>

              <SettingsSection
                title="Reporter notifications"
                description="Who hears back when a ticket is marked fixed."
              >
                <ToggleRow
                  title="Email reporters who left an address"
                  description="Sent when a ticket is marked fixed"
                  checked={notifyEnabled}
                  disabled={savingNotify || !project}
                  onToggle={toggleNotify}
                />
                <ToggleRow
                  title="Show an in-app banner"
                  description="Coming later — shown once the next time they open your app"
                  checked={false}
                  disabled
                />
                <ToggleRow
                  title="Notify voters on the public board"
                  description="Coming later — when an idea moves to Released"
                  checked={false}
                  disabled
                />
              </SettingsSection>

              <SettingsSection
                title="Public board domain"
                description="Where visitors see ideas and the roadmap."
              >
                <Field label="Custom domain">
                  <div className="flex h-9 items-center rounded-md border border-[#1717171F] bg-[#FAFAFA] px-2.5 font-ds-ui text-[13px] text-[#A3A3A3]">
                    board.yourapp.com
                  </div>
                  <p className="mt-1.5 font-ds-ui text-[12px] text-[#A3A3A3]">
                    Coming with the public board (S-11 / F9).
                  </p>
                </Field>
              </SettingsSection>

              <SettingsSection
                title="Delete project"
                description="Removes reports, tokens, and keys for this project."
              >
                <button
                  type="button"
                  disabled
                  className="h-9 cursor-not-allowed rounded-md border border-[#DA314A33] bg-white px-3 font-ds-sans text-[13px] font-medium text-[#DA314A] opacity-60"
                >
                  Delete project
                </button>
              </SettingsSection>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-6 border-b border-[#17171714] py-7 sm:flex-row sm:gap-12">
      <div className="w-full shrink-0 sm:w-[280px]">
        <h2 className="font-ds-sans text-[15px] font-semibold tracking-[-0.2px] text-[#171717]">
          {title}
        </h2>
        <p className="mt-1 font-ds-ui text-[12.5px] leading-[19px] text-[#737373]">
          {description}
        </p>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3.5">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 font-ds-ui text-[12.5px] font-medium text-[#171717]">{label}</div>
      {children}
    </div>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  disabled = false,
  onToggle,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className="font-ds-ui text-[13.5px] font-medium text-[#171717]">{title}</div>
        <div className="font-ds-ui text-[12px] text-[#A3A3A3]">{description}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        disabled={disabled}
        onClick={onToggle}
        className={`flex h-[18px] w-8 shrink-0 cursor-pointer items-start rounded-full p-0.5 transition disabled:cursor-not-allowed disabled:opacity-60 ${
          checked ? "justify-end bg-[#16A34A]" : "justify-start bg-[#D4D4D4]"
        }`}
      >
        <span className="h-3.5 w-3.5 rounded-full bg-white" />
      </button>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mt-3 px-2 pb-1 pt-2 font-ds-ui text-[11px] font-medium uppercase tracking-[0.04em] text-[#A3A3A3]">
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
      className={`flex items-center rounded-md px-2 py-1.5 font-ds-ui text-[13px] no-underline transition ${
        active
          ? "bg-white font-semibold text-[#171717] shadow-[0_1px_2px_#17171714]"
          : "font-medium text-[#737373] hover:bg-white/70 hover:text-[#171717]"
      }`}
    >
      {label}
    </Link>
  );
}
