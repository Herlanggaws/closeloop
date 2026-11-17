"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ProjectSwitcher } from "@/components/ProjectSwitcher";
import { api, logout } from "@/lib/api";
import { displayName, initials } from "@/lib/tickets";
import {
  formatUsage,
  planLabel,
  type MeResponse,
  type OrgUsage,
} from "@/lib/usage";

type Member = {
  user_id: string;
  email: string;
  name: string;
  avatar_url?: string;
  role: string;
};

type Invite = {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  created_at: string;
};

export function Team() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [projectName, setProjectName] = useState("Project");
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [usage, setUsage] = useState<OrgUsage | null>(null);
  const [emails, setEmails] = useState("");
  const [role, setRole] = useState<"member" | "viewer">("member");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const isOwner = (me?.role || "") === "owner";

  async function reload() {
    const projectId = localStorage.getItem("closeloop_project");
    if (!projectId) {
      router.replace("/app/onboarding");
      return;
    }
    const [meRes, projectRes, teamRes] = await Promise.all([
      api<MeResponse>("/api/me"),
      api<{ project: { name: string } }>(`/api/projects/${projectId}`),
      api<{ members: Member[]; invites: Invite[]; usage: OrgUsage }>("/api/org/members"),
    ]);
    setMe(meRes);
    setProjectName(projectRes.project.name || "Project");
    setMembers(teamRes.members || []);
    setInvites(teamRes.invites || []);
    setUsage(teamRes.usage || meRes.usage || null);
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    reload()
      .then(() => {
        if (!cancelled) setError("");
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load team");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function sendInvites() {
    if (!isOwner) return;
    const list = emails
      .split(/[\s,;]+/)
      .map((e) => e.trim())
      .filter(Boolean);
    if (list.length === 0) {
      setError("Enter at least one email");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await api("/api/org/invites", {
        method: "POST",
        body: JSON.stringify({ emails: list, role }),
      });
      setEmails("");
      setNotice(`Invite sent to ${list.length} address${list.length === 1 ? "" : "es"}`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send invites");
    } finally {
      setSaving(false);
    }
  }

  async function resend(id: string) {
    setSaving(true);
    setError("");
    try {
      await api(`/api/org/invites/${id}/resend`, { method: "POST" });
      setNotice("Invite resent");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend");
    } finally {
      setSaving(false);
    }
  }

  async function revoke(id: string) {
    setSaving(true);
    setError("");
    try {
      await api(`/api/org/invites/${id}`, { method: "DELETE" });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not revoke");
    } finally {
      setSaving(false);
    }
  }

  async function changeRole(userId: string, next: string) {
    setSaving(true);
    setError("");
    try {
      await api(`/api/org/members/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ role: next }),
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update role");
    } finally {
      setSaving(false);
    }
  }

  async function removeMember(userId: string) {
    setSaving(true);
    setError("");
    try {
      await api(`/api/org/members/${userId}`, { method: "DELETE" });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove member");
    } finally {
      setSaving(false);
    }
  }

  const plan = usage?.plan || me?.org.plan || "free";
  const email = me?.user.email || "";
  const seats = usage?.seats || { used: members.length, limit: 1 };
  const atCap = seats.limit !== 0 && seats.used >= seats.limit;

  return (
    <div className="box-border flex min-h-screen w-full bg-white">
      <aside className="flex h-screen w-[248px] shrink-0 flex-col gap-0.5 border-r border-[#17171714] bg-[#FAFAFA] p-3">
        <ProjectSwitcher
          projectName={projectName}
          plan={plan}
          email={email}
          usage={usage || me?.usage}
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
          <NavItem href="/app/settings/integrations" label="Integrations" />
          <NavItem href="/app/settings/team" label="Team" active />
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
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#17171714] bg-white px-8">
          <h1 className="font-ds-sans text-[15px] font-semibold tracking-[-0.2px] text-[#171717]">
            Team & roles
          </h1>
          <span className="font-ds-ui text-[12px] text-[#737373]">
            {planLabel(plan)} · {formatUsage(seats)} seats
          </span>
        </header>

        <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5 px-8 py-8">
          {loading ? (
            <p className="font-ds-ui text-sm text-[#737373]">Loading…</p>
          ) : (
            <>
              {error && <p className="text-sm text-[#DA314A]">{error}</p>}
              {notice && <p className="text-sm text-[#16A34A]">{notice}</p>}

              {isOwner && (
                <section className="rounded-2xl border border-[#17171714] bg-white p-6">
                  <h2 className="font-ds-sans text-[16px] font-medium text-[#171717]">
                    Invite teammates
                  </h2>
                  <p className="mt-1 font-ds-ui text-[13px] text-[#737373]">
                    Free includes 1 seat. Indie 3, Studio 5. Upgrade on Billing if you hit the cap.
                  </p>
                  {atCap ? (
                    <div className="mt-4 rounded-[10px] border border-[#1717171F] bg-[#FAFAFA] p-4">
                      <p className="font-ds-ui text-sm text-[#171717]">Seat limit reached.</p>
                      <Link
                        href="/app/settings/billing"
                        className="mt-2 inline-block font-ds-ui text-[13px] text-[#2563eb]"
                      >
                        Upgrade plan →
                      </Link>
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-col gap-3">
                      <textarea
                        value={emails}
                        onChange={(e) => setEmails(e.target.value)}
                        rows={2}
                        placeholder="teammate@company.com, other@company.com"
                        className="w-full rounded-md border border-[#1717171F] px-3 py-2 font-ds-ui text-[13px] outline-none focus:border-[#171717]"
                      />
                      <div className="flex flex-wrap items-center gap-3">
                        <select
                          value={role}
                          onChange={(e) => setRole(e.target.value as "member" | "viewer")}
                          className="h-9 rounded-md border border-[#1717171F] bg-white px-2 font-ds-ui text-[13px]"
                        >
                          <option value="member">Member</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void sendInvites()}
                          className="inline-flex h-9 cursor-pointer items-center rounded-md bg-[#171717] px-3 font-ds-sans text-[13px] font-medium text-white disabled:opacity-50"
                        >
                          {saving ? "Sending…" : "Send invite"}
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              )}

              <section className="rounded-2xl border border-[#17171714] bg-white p-6">
                <h2 className="font-ds-sans text-[16px] font-medium text-[#171717]">Members</h2>
                <div className="mt-4 flex flex-col gap-2">
                  {members.map((m) => (
                    <div
                      key={m.user_id}
                      className="flex flex-wrap items-center gap-3 rounded-[10px] border border-[#17171714] px-3 py-2.5"
                    >
                      <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[#171717]">
                        {m.avatar_url ? (
                          <img src={m.avatar_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="font-ds-sans text-[11px] text-white">
                            {initials(m.email)}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-ds-ui text-[13px] font-medium text-[#171717]">
                          {m.name || displayName(m.email)}
                        </div>
                        <div className="truncate font-ds-ui text-[11px] text-[#A3A3A3]">{m.email}</div>
                      </div>
                      {isOwner && m.role !== "owner" ? (
                        <select
                          value={m.role}
                          disabled={saving}
                          onChange={(e) => void changeRole(m.user_id, e.target.value)}
                          className="h-8 rounded-md border border-[#1717171F] bg-white px-2 font-ds-ui text-[12px]"
                        >
                          <option value="member">Member</option>
                          <option value="viewer">Viewer</option>
                          <option value="owner">Owner</option>
                        </select>
                      ) : (
                        <span className="rounded-full bg-[#F5F5F5] px-2 py-1 font-ds-ui text-[11px] capitalize text-[#737373]">
                          {m.role}
                        </span>
                      )}
                      {isOwner && m.role !== "owner" && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void removeMember(m.user_id)}
                          className="cursor-pointer font-ds-ui text-[12px] text-[#737373] hover:text-[#DA314A]"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {invites.length > 0 && (
                <section className="rounded-2xl border border-[#17171714] bg-white p-6">
                  <h2 className="font-ds-sans text-[16px] font-medium text-[#171717]">
                    Pending invites
                  </h2>
                  <div className="mt-4 flex flex-col gap-2">
                    {invites.map((inv) => (
                      <div
                        key={inv.id}
                        className="flex flex-wrap items-center gap-3 rounded-[10px] border border-dashed border-[#1717171F] px-3 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-ds-ui text-[13px] text-[#171717]">
                            {inv.email}
                          </div>
                          <div className="font-ds-ui text-[11px] capitalize text-[#A3A3A3]">
                            {inv.role} · expires {new Date(inv.expires_at).toLocaleDateString()}
                          </div>
                        </div>
                        {isOwner && (
                          <>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => void resend(inv.id)}
                              className="cursor-pointer font-ds-ui text-[12px] text-[#2563eb]"
                            >
                              Resend
                            </button>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => void revoke(inv.id)}
                              className="cursor-pointer font-ds-ui text-[12px] text-[#737373] hover:text-[#DA314A]"
                            >
                              Revoke
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="rounded-2xl border border-[#17171714] bg-white p-6">
                <h2 className="font-ds-sans text-[16px] font-medium text-[#171717]">Role matrix</h2>
                <ul className="mt-3 space-y-2 font-ds-ui text-[13px] text-[#525252]">
                  <li>
                    <strong className="text-[#171717]">Owner</strong> — billing, invites, delete
                    projects, all triage
                  </li>
                  <li>
                    <strong className="text-[#171717]">Member</strong> — triage, status, notes,
                    merge, MCP tokens
                  </li>
                  <li>
                    <strong className="text-[#171717]">Viewer</strong> — read inbox and tickets only
                  </li>
                </ul>
              </section>
            </>
          )}
        </div>
      </main>
    </div>
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
