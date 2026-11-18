"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { api, clearProjectSelection } from "@/lib/api";
import type { MeResponse } from "@/lib/usage";

type ProjectInfo = {
  id: string;
  name: string;
  platforms?: string[];
  notify_enabled: boolean;
  banner_enabled: boolean;
  mask_text_inputs: boolean;
  sensitive_selectors?: string[];
};

type ProjectResponse = {
  public_key: string;
  project: ProjectInfo;
};

const PLATFORM_OPTIONS = [
  { id: "web", label: "Web" },
  { id: "android", label: "Android" },
  { id: "ios", label: "iOS" },
] as const;

const ALLOWED_PLATFORMS = new Set(PLATFORM_OPTIONS.map((option) => option.id));

function normalizePlatforms(value?: string[]) {
  const next = (value || []).filter((id) => ALLOWED_PLATFORMS.has(id as "web" | "android" | "ios"));
  return next.length > 0 ? next : (["web"] as string[]);
}

export function ProjectSettings() {
  const router = useRouter();
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [publicKey, setPublicKey] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(["web"]);
  const [notifyEnabled, setNotifyEnabled] = useState(true);
  const [bannerEnabled, setBannerEnabled] = useState(true);
  const [maskTextInputs, setMaskTextInputs] = useState(true);
  const [savingNotify, setSavingNotify] = useState(false);
  const [savingBanner, setSavingBanner] = useState(false);
  const [savingMask, setSavingMask] = useState(false);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [selectors, setSelectors] = useState<string[]>([]);
  const [selectorDraft, setSelectorDraft] = useState("");
  const [savingSelectors, setSavingSelectors] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);

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
        setNameDraft(projectRes.project.name || "");
        const nextPlatforms = normalizePlatforms(projectRes.project.platforms);
        setPlatforms(nextPlatforms);
        setNotifyEnabled(projectRes.project.notify_enabled);
        setBannerEnabled(projectRes.project.banner_enabled !== false);
        setMaskTextInputs(projectRes.project.mask_text_inputs !== false);
        setSelectors(projectRes.project.sensitive_selectors || []);
        localStorage.setItem("closeloop_public_key", projectRes.public_key);
        localStorage.setItem(
          "closeloop_platforms",
          JSON.stringify(nextPlatforms),
        );
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
  const plan = me?.org.plan || "free";
  const email = me?.user.email || "";

  async function copyPublicKey() {
    if (!publicKey) return;
    await navigator.clipboard.writeText(publicKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function saveName() {
    if (!project || savingGeneral) return;
    const next = nameDraft.trim();
    if (!next) {
      setNameDraft(project.name);
      setError("Name is required");
      return;
    }
    if (next === project.name) return;

    const previous = project.name;
    setSavingGeneral(true);
    setError("");
    try {
      const res = await api<{ project: ProjectInfo }>(`/api/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: next }),
      });
      setProject(res.project);
      setNameDraft(res.project.name);
    } catch (err) {
      setNameDraft(previous);
      setError(err instanceof Error ? err.message : "Failed to update name");
    } finally {
      setSavingGeneral(false);
    }
  }

  async function togglePlatform(id: string) {
    if (!project || savingGeneral) return;
    const next = platforms.includes(id)
      ? platforms.filter((platform) => platform !== id)
      : [...platforms, id];
    if (next.length === 0) {
      setError("At least one platform is required");
      return;
    }

    const previous = platforms;
    setPlatforms(next);
    setSavingGeneral(true);
    setError("");
    try {
      const res = await api<{ project: ProjectInfo }>(`/api/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({ platforms: next }),
      });
      const saved = normalizePlatforms(res.project.platforms);
      setProject(res.project);
      setPlatforms(saved);
      localStorage.setItem("closeloop_platforms", JSON.stringify(saved));
    } catch (err) {
      setPlatforms(previous);
      setError(err instanceof Error ? err.message : "Failed to update platforms");
    } finally {
      setSavingGeneral(false);
    }
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

  async function toggleBanner() {
    if (!project || savingBanner) return;
    const next = !bannerEnabled;
    const previous = bannerEnabled;
    setBannerEnabled(next);
    setSavingBanner(true);
    setError("");
    try {
      const res = await api<{ project: ProjectInfo }>(`/api/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({ banner_enabled: next }),
      });
      setProject(res.project);
      setBannerEnabled(res.project.banner_enabled);
    } catch (err) {
      setBannerEnabled(previous);
      setError(err instanceof Error ? err.message : "Failed to update banner setting");
    } finally {
      setSavingBanner(false);
    }
  }

  async function toggleMaskTextInputs() {
    if (!project || savingMask) return;
    const next = !maskTextInputs;
    const previous = maskTextInputs;
    setMaskTextInputs(next);
    setSavingMask(true);
    setError("");
    try {
      const res = await api<{ project: ProjectInfo }>(`/api/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({ mask_text_inputs: next }),
      });
      setProject(res.project);
      setMaskTextInputs(res.project.mask_text_inputs);
    } catch (err) {
      setMaskTextInputs(previous);
      setError(err instanceof Error ? err.message : "Failed to update masking");
    } finally {
      setSavingMask(false);
    }
  }

  async function saveSelectors(next: string[]) {
    if (!project || savingSelectors) return;
    const previous = selectors;
    setSelectors(next);
    setSavingSelectors(true);
    setError("");
    try {
      const res = await api<{ project: ProjectInfo }>(`/api/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({ sensitive_selectors: next }),
      });
      setProject(res.project);
      setSelectors(res.project.sensitive_selectors || []);
    } catch (err) {
      setSelectors(previous);
      setError(err instanceof Error ? err.message : "Failed to update selectors");
    } finally {
      setSavingSelectors(false);
    }
  }

  function addSelector() {
    const value = selectorDraft.trim();
    if (!value || !project || savingSelectors) return;
    if (selectors.includes(value)) {
      setSelectorDraft("");
      return;
    }
    setSelectorDraft("");
    void saveSelectors([...selectors, value]);
  }

  function removeSelector(selector: string) {
    if (!project || savingSelectors) return;
    void saveSelectors(selectors.filter((item) => item !== selector));
  }

  async function deleteProject() {
    if (!project || deleting) return;
    if (deleteConfirmName.trim() !== project.name) {
      setError("Type the project name exactly to confirm delete");
      return;
    }

    setDeleting(true);
    setError("");
    try {
      await api(`/api/projects/${project.id}`, { method: "DELETE" });
      clearProjectSelection();
      const remaining = await api<{ projects: ProjectInfo[] }>("/api/projects");
      const next = remaining.projects?.[0];
      if (next) {
        localStorage.setItem("closeloop_project", next.id);
        router.replace("/app/inbox");
        return;
      }
      router.replace("/app/onboarding");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete project");
      setDeleting(false);
    }
  }

  const canDelete =
    !!project &&
    deleteConfirmName.trim() === project.name &&
    !deleting;

  return (
    <div className="box-border flex min-h-screen w-full bg-white">
      <AppSidebar
        projectName={projectName}
        plan={plan}
        email={email}
        usage={me?.usage}
        userName={me?.user?.name}
        avatarUrl={me?.user?.avatar_url}
        active="settings"
      />

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
                  <div className="flex h-9 items-center gap-2 rounded-md border border-[#1717171F] bg-white px-2.5">
                    <input
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void saveName();
                        }
                      }}
                      disabled={savingGeneral}
                      className="min-w-0 flex-1 bg-transparent font-ds-ui text-[13px] text-[#171717] outline-none disabled:opacity-60"
                      placeholder="My app"
                    />
                    <button
                      type="button"
                      disabled={
                        savingGeneral ||
                        !nameDraft.trim() ||
                        nameDraft.trim() === (project?.name || "")
                      }
                      onClick={() => void saveName()}
                      className="cursor-pointer font-ds-ui text-[12px] font-medium text-[#171717] underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:text-[#A3A3A3] disabled:no-underline"
                    >
                      Save
                    </button>
                  </div>
                </Field>
                <div className="flex flex-wrap gap-2">
                  {PLATFORM_OPTIONS.map((option) => {
                    const selected = platforms.includes(option.id);
                    return (
                      <button
                        key={option.id}
                        type="button"
                        disabled={savingGeneral}
                        onClick={() => void togglePlatform(option.id)}
                        className={`cursor-pointer rounded-md border px-3 py-1 font-ds-sans text-[13px] font-medium tracking-[-0.2px] transition disabled:opacity-60 ${
                          selected
                            ? "border-[#171717] bg-[#FAFAFA] text-[#171717]"
                            : "border-[#1717171F] bg-white text-[#A3A3A3] hover:text-[#171717]"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
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
                  checked={maskTextInputs}
                  disabled={savingMask || !project}
                  onToggle={toggleMaskTextInputs}
                />
                <Field label="Also mask these selectors">
                  <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-[#1717171F] p-2">
                    {selectors.map((selector) => (
                      <span
                        key={selector}
                        className="inline-flex items-center gap-1 rounded bg-[#F5F5F5] px-2 py-0.5 font-ds-mono text-[11.5px] text-[#171717]"
                      >
                        {selector}
                        <button
                          type="button"
                          aria-label={`Remove ${selector}`}
                          disabled={savingSelectors || !project}
                          onClick={() => removeSelector(selector)}
                          className="cursor-pointer text-[#A3A3A3] hover:text-[#171717] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <input
                      type="text"
                      value={selectorDraft}
                      disabled={savingSelectors || !project}
                      placeholder=".secret, #card, …"
                      onChange={(e) => setSelectorDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addSelector();
                        }
                      }}
                      className="min-w-[140px] flex-1 border-0 bg-transparent font-ds-mono text-[11.5px] text-[#171717] outline-none placeholder:text-[#A3A3A3] disabled:opacity-50"
                    />
                    <button
                      type="button"
                      disabled={savingSelectors || !project || !selectorDraft.trim()}
                      onClick={addSelector}
                      className="cursor-pointer font-ds-ui text-[12px] font-medium text-[#171717] underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {savingSelectors ? "Saving…" : "Add"}
                    </button>
                  </div>
                  <p className="mt-1.5 font-ds-ui text-[12px] text-[#A3A3A3]">
                    CSS selectors blurred before screenshot.{" "}
                    <code className="font-ds-mono text-[11px]">[data-closeloop-mask]</code> is always
                    included.
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
                  description="Shown once the next time they open your app"
                  checked={bannerEnabled}
                  disabled={savingBanner || !project}
                  onToggle={toggleBanner}
                />
              </SettingsSection>

              <SettingsSection
                title="Delete project"
                description="Soft-deletes this project now (keys and MCP tokens stop working). Reports and uploads are permanently removed after 30 days."
              >
                <Field label={`Type “${projectName}” to confirm`}>
                  <input
                    type="text"
                    value={deleteConfirmName}
                    onChange={(e) => setDeleteConfirmName(e.target.value)}
                    disabled={deleting || !project}
                    placeholder={projectName}
                    className="box-border h-9 w-full rounded-md border border-[#1717171F] bg-white px-2.5 font-ds-ui text-[13px] text-[#171717] outline-none placeholder:text-[#A3A3A3] focus:border-[#17171766] disabled:opacity-50"
                  />
                </Field>
                <button
                  type="button"
                  disabled={!canDelete}
                  onClick={() => void deleteProject()}
                  className="h-9 rounded-md border border-[#DA314A33] bg-white px-3 font-ds-sans text-[13px] font-medium text-[#DA314A] enabled:cursor-pointer enabled:hover:bg-[#DA314A0A] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deleting ? "Deleting…" : "Delete project"}
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
