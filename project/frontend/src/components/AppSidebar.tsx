"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ProjectSwitcher } from "@/components/ProjectSwitcher";
import { logout } from "@/lib/api";
import { displayName, initials } from "@/lib/tickets";
import { formatUsage, type OrgUsage } from "@/lib/usage";

export type AppSidebarActive =
  | "inbox"
  | "board"
  | "install"
  | "mcp"
  | "settings"
  | "integrations"
  | "team"
  | "billing";

type Props = {
  projectName: string;
  plan?: string;
  email?: string;
  usage?: OrgUsage;
  userName?: string;
  avatarUrl?: string;
  active: AppSidebarActive;
  inboxCount?: number;
  showUsageCard?: boolean;
  afterSwitcher?: ReactNode;
};

export function AppSidebar({
  projectName,
  plan = "free",
  email = "",
  usage,
  userName,
  avatarUrl,
  active,
  inboxCount,
  showUsageCard,
  afterSwitcher,
}: Props) {
  return (
    <aside className="flex h-screen w-[248px] shrink-0 flex-col gap-0.5 border-r border-[#17171714] bg-[#FAFAFA] p-3">
      <ProjectSwitcher projectName={projectName} plan={plan} email={email} usage={usage} />
      {afterSwitcher}
      <nav
        className={`${afterSwitcher ? "mt-1" : "mt-3"} flex flex-1 flex-col gap-0.5 overflow-y-auto`}
      >
        <NavItem
          href="/app/inbox"
          label="Inbox"
          active={active === "inbox"}
          count={inboxCount}
        />
        <NavItem href="/app/board" label="Public board" active={active === "board"} />
        <SectionLabel>Setup</SectionLabel>
        <NavItem href="/app/install" label="Install widget" active={active === "install"} />
        <NavItem href="/app/mcp" label="MCP server" active={active === "mcp"} />
        <SectionLabel>Settings</SectionLabel>
        <NavItem href="/app/settings" label="Project" active={active === "settings"} />
        <NavItem
          href="/app/settings/integrations"
          label="Integrations"
          active={active === "integrations"}
        />
        <NavItem href="/app/settings/team" label="Team" active={active === "team"} />
        <NavItem href="/app/settings/billing" label="Billing" active={active === "billing"} />
      </nav>

      <div className="mt-auto flex flex-col gap-2">
        {showUsageCard && usage && (
          <div className="rounded-[10px] border border-[#17171714] bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-ds-ui text-[11px] text-[#737373]">Reports this month</span>
              <span className="font-ds-ui text-[11px] font-medium text-[#171717]">
                {formatUsage(usage.reports)}
              </span>
            </div>
          </div>
        )}
        {email && (
          <div className="flex items-center gap-2.5 px-1.5 py-1">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#171717]">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="font-ds-sans text-[11px] font-medium text-white">
                  {initials(email)}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-ds-ui text-[13px] font-medium text-[#171717]">
                {userName || displayName(email)}
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
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-2 pt-3 pb-1 font-ds-ui text-[11px] text-[#A3A3A3]">{children}</div>
  );
}

function NavItem({
  href,
  label,
  active,
  count,
}: {
  href: string;
  label: string;
  active?: boolean;
  count?: number;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 rounded-md px-2 py-[7px] no-underline transition-opacity hover:opacity-80 ${
        active ? "bg-[#F5F5F5]" : "bg-transparent"
      }`}
    >
      <span
        className={`flex-1 font-ds-ui text-[13px] ${
          active ? "font-medium text-[#171717]" : "font-normal text-[#737373]"
        }`}
      >
        {label}
      </span>
      {typeof count === "number" && (
        <span className="font-ds-mono text-[11px] text-[#A3A3A3]">{count}</span>
      )}
    </Link>
  );
}
