"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { ApiRequestError, api } from "@/lib/api";
import { planAtLeast } from "@/lib/plans";
import { memberSummary, seatLimitBanner, seatSubtitle } from "@/lib/seats";
import {
  avatarTone,
  drainInviteDraft,
  isLikelyEmail,
  mergeInviteEmails,
} from "@/lib/inviteEmails";
import { displayName, initials } from "@/lib/tickets";
import {
  formatUsage,
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

type RosterRow =
  | { kind: "member"; member: Member }
  | { kind: "invite"; invite: Invite };

function relativeInvite(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "Invite sent just now";
  if (mins < 60) return `Invite sent ${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `Invite sent ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Invite sent ${days}d ago`;
}

export function Team() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [projectName, setProjectName] = useState("Project");
  const [members, setMembers] = useState<Member[]>([]);
  const [seatRefused, setSeatRefused] = useState(false);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [usage, setUsage] = useState<OrgUsage | null>(null);
  const [inviteEmails, setInviteEmails] = useState<string[]>([]);
  const [inviteDraft, setInviteDraft] = useState("");
  const [role, setRole] = useState<"member" | "viewer">("member");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviteNotice, setInviteNotice] = useState("");
  const inviteInputRef = useRef<HTMLInputElement>(null);

  const isOwner = (me?.role || "") === "owner";

  function commitInviteDraft(mode: "delimiter" | "all") {
    const { completed, remainder } = drainInviteDraft(inviteDraft, mode);
    if (completed.length > 0) {
      setInviteEmails((prev) => mergeInviteEmails(prev, completed));
    }
    setInviteDraft(remainder);
  }

  function removeInviteEmail(email: string) {
    setInviteEmails((prev) => prev.filter((item) => item !== email));
  }

  async function reload() {
    const projectId = localStorage.getItem("closeloop_project");
    if (!projectId) {
      router.replace("/app/onboarding");
      return;
    }

    const [meSettled, projectSettled, teamSettled] = await Promise.allSettled([
      api<MeResponse>("/api/me"),
      api<{ project: { name: string } }>(`/api/projects/${projectId}`),
      api<{ members: Member[]; invites: Invite[]; usage: OrgUsage }>("/api/org/members"),
    ]);

    if (meSettled.status === "rejected" && teamSettled.status === "rejected") {
      const reason = meSettled.reason;
      throw reason instanceof Error ? reason : new Error("Failed to load team");
    }

    if (meSettled.status === "fulfilled") setMe(meSettled.value);
    if (projectSettled.status === "fulfilled") {
      setProjectName(projectSettled.value.project.name || "Project");
    }
    if (teamSettled.status === "fulfilled") {
      setMembers(teamSettled.value.members || []);
      setInvites(teamSettled.value.invites || []);
      const meUsage = meSettled.status === "fulfilled" ? meSettled.value.usage : null;
      setUsage(teamSettled.value.usage || meUsage || null);
    } else if (meSettled.status === "fulfilled") {
      setUsage(meSettled.value.usage || null);
    }

    const firstFailure = [teamSettled, meSettled, projectSettled].find(
      (r) => r.status === "rejected",
    );
    if (firstFailure && firstFailure.status === "rejected") {
      throw firstFailure.reason instanceof Error
        ? firstFailure.reason
        : new Error("Failed to load team");
    }
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
    const { completed } = drainInviteDraft(inviteDraft, "all");
    const list = mergeInviteEmails(inviteEmails, completed);
    if (list.length === 0) {
      setInviteError("Enter at least one email");
      return;
    }
    setSaving(true);
    setInviteError("");
    setInviteNotice("");
    try {
      await api("/api/org/invites", {
        method: "POST",
        body: JSON.stringify({ emails: list, role }),
      });
      setInviteEmails([]);
      setInviteDraft("");
      setInviteNotice(`Invite sent to ${list.length} address${list.length === 1 ? "" : "es"}`);
      await reload();
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === "SEAT_LIMIT") {
        setSeatRefused(true);
        return;
      }
      setInviteError(err instanceof Error ? err.message : "Could not send invites");
    } finally {
      setSaving(false);
    }
  }

  function onInviteKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === "Tab" || event.key === ",") {
      event.preventDefault();
      commitInviteDraft("all");
      return;
    }
    if (event.key === "Backspace" && !inviteDraft && inviteEmails.length > 0) {
      event.preventDefault();
      setInviteEmails((prev) => prev.slice(0, -1));
      return;
    }
    if (event.key === " " && isLikelyEmail(inviteDraft)) {
      event.preventDefault();
      commitInviteDraft("all");
    }
  }

  async function resend(id: string) {
    setSaving(true);
    setInviteError("");
    try {
      await api(`/api/org/invites/${id}/resend`, { method: "POST" });
      setInviteNotice("Invite resent");
      await reload();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Could not resend");
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
  const roster: RosterRow[] = [
    ...members.map((member) => ({ kind: "member" as const, member })),
    ...invites.map((invite) => ({ kind: "invite" as const, invite })),
  ];
  const subtitle = seatSubtitle(plan, seats);
  const summary = memberSummary(plan, members.length, invites.length, seats);
  // Someone other than the current user, named in the S-14 v2 seat banner.
  const otherMember = members.find((m) => m.email !== me?.user.email);
  const banner = seatLimitBanner(plan, seats, otherMember ? otherMember.name || displayName(otherMember.email) : undefined);
  const showStudioUpsell = !planAtLeast(plan, "studio");

  return (
    <div className="box-border flex min-h-screen w-full bg-white">
      <AppSidebar
        projectName={projectName}
        plan={plan}
        email={email}
        usage={usage || me?.usage}
        userName={me?.user?.name}
        avatarUrl={me?.user?.avatar_url}
        active="team"
        showUsageCard
      />

      <main className="flex min-h-screen min-w-0 flex-1 flex-col overflow-y-auto bg-white">
        <header className="flex shrink-0 items-end justify-between border-b border-[#17171714] px-10 pb-6 pt-7">
          <div className="flex flex-col gap-1">
            <h1 className="font-ds-sans text-2xl font-medium tracking-[-0.4px] text-[#171717]">
              Team
            </h1>
            <p className="font-ds-ui text-[13.5px] text-[#737373]">{subtitle}</p>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-6 px-10 pb-10 pt-7">
          {loading ? (
            <p className="font-ds-ui text-sm text-[#737373]">Loading…</p>
          ) : (
            <>
              {error && <p className="font-ds-ui text-sm text-[#DA314A]">{error}</p>}

              {isOwner && (
                <section className="flex flex-wrap items-center gap-2 rounded-xl border border-[#17171714] bg-[#FAFAFA] p-4">
                  {atCap || seatRefused ? (
                    <div
                      data-pencil-name="Seat limit"
                      className="flex w-full flex-wrap items-center justify-between gap-3 rounded-lg border border-[#DA314A33] bg-[#FEF2F2] px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="font-ds-ui text-[13px] font-semibold text-[#991B1B]">{banner.title}</p>
                        <p className="font-ds-ui text-[12.5px] text-[#991B1B]">
                          {showStudioUpsell ? banner.body : `Seat limit reached (${formatUsage(seats)}).`}
                        </p>
                      </div>
                      <Link
                        href="/app/settings/billing"
                        className="inline-flex h-8 shrink-0 items-center rounded-md bg-[#171717] px-3 font-ds-sans text-[13px] font-medium text-white no-underline"
                      >
                        {showStudioUpsell ? banner.cta : "Upgrade on Billing"}
                      </Link>
                    </div>
                  ) : (
                    <>
                      <div
                        role="group"
                        aria-label="Invite emails"
                        onClick={() => inviteInputRef.current?.focus()}
                        className={`flex min-h-9 min-w-[220px] flex-1 cursor-text flex-wrap items-center gap-1.5 rounded-md border bg-white px-2.5 py-1 focus-within:border-[#171717] ${
                          inviteError ? "border-[#DA314A]" : "border-[#1717171F]"
                        }`}
                      >
                        {inviteEmails.map((addr) => (
                          <span
                            key={addr}
                            className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#D4D4D4] bg-[#F5F5F5] py-0.5 pl-0.5 pr-1.5"
                          >
                            <span
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium text-white"
                              style={{ backgroundColor: avatarTone(addr) }}
                              aria-hidden
                            >
                              {addr.slice(0, 1).toUpperCase()}
                            </span>
                            <span className="truncate font-ds-ui text-[12px] text-[#171717]">
                              {addr}
                            </span>
                            <button
                              type="button"
                              aria-label={`Remove ${addr}`}
                              disabled={saving}
                              onClick={(e) => {
                                e.stopPropagation();
                                removeInviteEmail(addr);
                              }}
                              className="flex h-4 w-4 cursor-pointer items-center justify-center rounded-full text-[#737373] hover:bg-[#17171714] hover:text-[#171717]"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        <input
                          ref={inviteInputRef}
                          value={inviteDraft}
                          disabled={saving}
                          spellCheck={false}
                          autoComplete="off"
                          placeholder={
                            inviteEmails.length === 0
                              ? "name@studio.com, another@studio.com"
                              : ""
                          }
                          onChange={(e) => {
                            if (inviteError) setInviteError("");
                            const next = e.target.value;
                            if (/[,;]/.test(next)) {
                              const { completed, remainder } = drainInviteDraft(next, "delimiter");
                              if (completed.length > 0) {
                                setInviteEmails((prev) => mergeInviteEmails(prev, completed));
                              }
                              setInviteDraft(remainder);
                              return;
                            }
                            setInviteDraft(next);
                          }}
                          onKeyDown={onInviteKeyDown}
                          onBlur={() => commitInviteDraft("all")}
                          onPaste={(e) => {
                            const text = e.clipboardData.getData("text");
                            if (!text || !/[,;\s]/.test(text)) return;
                            e.preventDefault();
                            const { completed } = drainInviteDraft(
                              `${inviteDraft}${text}`,
                              "all",
                            );
                            if (completed.length > 0) {
                              setInviteEmails((prev) => mergeInviteEmails(prev, completed));
                            }
                            setInviteDraft("");
                          }}
                          className="min-w-[140px] flex-1 border-0 bg-transparent py-1 font-ds-ui text-[13px] text-[#171717] outline-none placeholder:text-[#A3A3A3]"
                        />
                      </div>
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value as "member" | "viewer")}
                        className="h-8 w-[120px] rounded-md border border-[#1717171F] bg-white px-2.5 font-ds-ui text-[13px] text-[#171717]"
                      >
                        <option value="member">Member</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <button
                        type="button"
                        disabled={saving || (inviteEmails.length === 0 && !inviteDraft.trim())}
                        onClick={() => void sendInvites()}
                        className="inline-flex h-9 cursor-pointer items-center rounded-md bg-[#171717] px-4 font-ds-sans text-[13px] font-medium text-white disabled:opacity-50"
                      >
                        {saving ? "Sending…" : "Send invite"}
                      </button>
                    </>
                  )}
                  {inviteError && (
                    <p className="w-full font-ds-ui text-[13px] text-[#DA314A]">{inviteError}</p>
                  )}
                  {inviteNotice && !inviteError && (
                    <p className="w-full font-ds-ui text-[13px] text-[#16A34A]">{inviteNotice}</p>
                  )}
                </section>
              )}

              <section className="overflow-hidden rounded-xl border border-[#17171714] bg-white">
                <div className="flex items-center justify-between gap-3 border-b border-[#17171714] px-[18px] py-3.5">
                  <h2 className="font-ds-sans text-[13px] font-semibold text-[#171717]">Members</h2>
                  <span className="font-ds-ui text-xs text-[#A3A3A3]">{summary}</span>
                </div>
                <div className="flex flex-col">
                  {roster.length === 0 ? (
                    <p className="px-[18px] py-6 font-ds-ui text-[13px] text-[#737373]">
                      No members yet.
                    </p>
                  ) : (
                    roster.map((row) =>
                      row.kind === "member" ? (
                        <div
                          key={row.member.user_id}
                          className="flex flex-wrap items-center gap-3 border-b border-[#17171714] px-[18px] py-3.5 last:border-b-0"
                        >
                          <Avatar name={row.member.name || row.member.email} url={row.member.avatar_url} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-ds-ui text-[13.5px] font-medium text-[#171717]">
                              {row.member.name || displayName(row.member.email)}
                            </div>
                            <div className="truncate font-ds-ui text-xs text-[#A3A3A3]">
                              {row.member.email}
                            </div>
                          </div>
                          <span className="font-ds-ui text-xs text-[#A3A3A3]">Active</span>
                          {isOwner && row.member.role !== "owner" ? (
                            <select
                              value={row.member.role}
                              disabled={saving}
                              onChange={(e) => void changeRole(row.member.user_id, e.target.value)}
                              className="h-8 w-[120px] rounded-md border border-[#1717171F] bg-white px-2.5 font-ds-ui text-[13px] text-[#171717]"
                            >
                              <option value="member">Member</option>
                              <option value="viewer">Viewer</option>
                              <option value="owner">Owner</option>
                            </select>
                          ) : (
                            <span className="w-[120px] font-ds-ui text-[13px] capitalize text-[#737373]">
                              {row.member.role}
                            </span>
                          )}
                          {isOwner && row.member.role !== "owner" && (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => void removeMember(row.member.user_id)}
                              className="cursor-pointer font-ds-ui text-xs text-[#A3A3A3] hover:text-[#DA314A]"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      ) : (
                        <div
                          key={row.invite.id}
                          className="flex flex-wrap items-center gap-3 border-b border-[#17171714] px-[18px] py-3.5 last:border-b-0"
                        >
                          <Avatar name={row.invite.email} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-ds-ui text-[13.5px] font-medium text-[#171717]">
                              {row.invite.email}
                            </div>
                            <div className="truncate font-ds-ui text-xs text-[#A3A3A3]">
                              {relativeInvite(row.invite.created_at)}
                            </div>
                          </div>
                          <span className="font-ds-ui text-xs text-[#EA6C0C]">Pending</span>
                          <span className="w-[120px] font-ds-ui text-[13px] capitalize text-[#171717]">
                            {row.invite.role}
                          </span>
                          {isOwner && (
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => void resend(row.invite.id)}
                                className="cursor-pointer font-ds-ui text-xs text-[#2563eb]"
                              >
                                Resend
                              </button>
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => void revoke(row.invite.id)}
                                className="cursor-pointer font-ds-ui text-xs text-[#A3A3A3] hover:text-[#DA314A]"
                              >
                                Revoke
                              </button>
                            </div>
                          )}
                        </div>
                      ),
                    )
                  )}
                </div>
              </section>

              <section className="overflow-hidden rounded-xl border border-[#17171714] bg-white">
                <div className="border-b border-[#17171714] px-[18px] py-3.5">
                  <h2 className="font-ds-sans text-[13px] font-semibold text-[#171717]">
                    What each role can do
                  </h2>
                </div>
                <div className="grid gap-0 md:grid-cols-3">
                  <RoleCard
                    title="Owner"
                    body="Everything, plus billing, SSO, deleting projects and managing tokens."
                  />
                  <RoleCard
                    title="Member"
                    body="Triage reports, change status, merge, add notes, run auto PR, create MCP tokens."
                  />
                  <RoleCard
                    title="Viewer"
                    body="Read reports and the public board. Can't change anything."
                  />
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function Avatar({ name, url }: { name: string; url?: string }) {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#171717]">
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="font-ds-sans text-xs font-medium text-white">{initials(name)}</span>
      )}
    </div>
  );
}

function RoleCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-b border-[#17171714] px-[18px] py-4 md:border-b-0 md:border-r md:last:border-r-0">
      <div className="font-ds-sans text-sm font-semibold text-[#171717]">{title}</div>
      <p className="mt-1.5 font-ds-ui text-[12.5px] leading-[18px] text-[#737373]">{body}</p>
    </div>
  );
}
