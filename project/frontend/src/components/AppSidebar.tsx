"use client";

import type { ReactNode, SVGProps } from "react";
import Link from "next/link";
import { ProjectSwitcher } from "@/components/ProjectSwitcher";
import { logout } from "@/lib/api";
import { displayName, initials } from "@/lib/tickets";
import { AUTO_PR_VISIBLE, businessSurfacesVisible } from "@/lib/plans";
import { formatUsage, type OrgUsage } from "@/lib/usage";

export type AppSidebarActive =
  | "inbox"
  | "board"
  | "install"
  | "mcp"
  | "settings"
  | "integrations"
  | "team"
  | "billing"
  | "sso"
  | "auto-pr";

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
  searchValue?: string;
  onSearchChange?: (value: string) => void;
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
  showUsageCard = true,
  searchValue,
  onSearchChange,
  afterSwitcher,
}: Props) {
  const reportsPct =
    usage && usage.reports.limit > 0
      ? Math.min(100, Math.round((usage.reports.used / usage.reports.limit) * 100))
      : usage
        ? 8
        : 0;

  return (
    <aside
      data-pencil-name="Sidebar"
      className="box-border flex h-screen w-[248px] shrink-0 flex-col items-start gap-[2px] border-r border-[#17171714] bg-[#FAFAFA] p-3"
    >
      <ProjectSwitcher projectName={projectName} plan={plan} email={email} usage={usage} />

      {afterSwitcher ?? (
        <div data-pencil-name="Search Wrap" className="flex w-full shrink-0 items-start p-[8px_0]">
          <label
            data-pencil-name="Search"
            className="flex h-8 w-full flex-1 cursor-text items-center gap-2 rounded-[6px] bg-white px-2.5 shadow-[0px_1px_2px_#0000000A] outline outline-1 outline-offset-[-0.5px] outline-[#1717171F]"
          >
            <IconSearch className="h-3.5 w-3.5 shrink-0 text-[#A3A3A3]" />
            <input
              value={searchValue ?? ""}
              onChange={(e) => onSearchChange?.(e.target.value)}
              readOnly={!onSearchChange}
              placeholder="Search reports"
              className="min-w-0 flex-1 bg-transparent font-ds-ui text-[13px] text-[#171717] outline-none placeholder:text-[#A3A3A3]"
            />
            <kbd
              data-pencil-name="Kbd"
              className="rounded-[4px] bg-[#F5F5F5] px-[5px] py-px font-ds-mono text-[10px] text-[#737373] outline outline-1 outline-offset-[-0.5px] outline-[#17171714]"
            >
              ⌘K
            </kbd>
          </label>
        </div>
      )}

      <nav className="flex min-h-0 w-full flex-1 flex-col gap-[2px] overflow-y-auto">
        <NavItem
          href="/app/inbox"
          label="Inbox"
          active={active === "inbox"}
          count={inboxCount}
          icon={<IconInbox />}
        />
        <NavItem
          href="/app/auto-pr"
          label="Auto PR runs"
          active={active === "auto-pr"}
          icon={<IconPullRequest />}
          comingSoon={!AUTO_PR_VISIBLE}
        />
        <NavItem
          href="/app/board"
          label="Public board"
          active={active === "board"}
          icon={<IconLayoutList />}
        />

        <SectionLabel>Setup</SectionLabel>
        <NavItem
          href="/app/install"
          label="Install widget"
          active={active === "install"}
          icon={<IconCode />}
        />
        <NavItem
          href="/app/mcp"
          label="MCP server"
          active={active === "mcp"}
          icon={<IconPlugZap />}
        />

        <SectionLabel>Settings</SectionLabel>
        <NavItem
          href="/app/settings"
          label="Project"
          active={active === "settings"}
          icon={<IconSettings />}
        />
        <NavItem
          href="/app/settings/integrations"
          label="Integrations"
          active={active === "integrations"}
          icon={<IconBlocks />}
        />
        <NavItem
          href="/app/settings/team"
          label="Team"
          active={active === "team"}
          icon={<IconUsers />}
        />
        <NavItem
          href="/app/settings/billing"
          label="Billing"
          active={active === "billing"}
          icon={<IconCreditCard />}
        />
        {businessSurfacesVisible(plan) && (
          <NavItem
            href="/app/settings/sso"
            label="SSO & audit"
            active={active === "sso"}
            icon={<IconShield />}
          />
        )}
      </nav>

      <div className="mt-auto flex w-full flex-col gap-2">
        {showUsageCard && usage && (
          <div
            data-pencil-name="Credits Card"
            className="flex w-full flex-col gap-2 rounded-[10px] bg-white p-3 outline outline-1 outline-offset-[-0.5px] outline-[#17171714]"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-ds-ui text-[11px] text-[#737373]">Reports this month</span>
              <span className="font-ds-mono text-[11px] font-medium text-[#171717]">
                {formatUsage(usage.reports)}
              </span>
            </div>
            <div
              data-pencil-name="Track"
              className="relative h-1 w-full overflow-hidden rounded-[2px] bg-[#F5F5F5]"
            >
              <div
                data-pencil-name="Fill"
                className="absolute left-0 top-0 h-1 bg-[#171717]"
                style={{ width: `${reportsPct}%` }}
              />
            </div>
            {/* Free has no auto PR credits, so the line stays hidden there (D-02). */}
            {/* Auto PR is Coming soon (D-24): no credit line until the runner ships. */}
            {AUTO_PR_VISIBLE && ((usage.auto_pr_credits ?? 0) > 0 || (usage.plan || plan) !== "free") ? (
              <div className="font-ds-ui text-[11px] text-[#A3A3A3]">
                {typeof usage.auto_pr_credits === "number"
                  ? `${usage.auto_pr_credits} auto PR credit${usage.auto_pr_credits === 1 ? "" : "s"} left`
                  : "Auto PR credits"}
              </div>
            ) : null}
          </div>
        )}

        {email && (
          <div
            data-pencil-name="User"
            className="flex w-full items-center gap-2.5 px-1.5 pb-0.5 pt-2.5"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#171717]">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="font-ds-sans text-[11px] font-medium text-white">
                  {initials(userName || email)}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1 truncate font-ds-ui text-[13px] font-medium text-[#171717]">
              {userName || displayName(email)}
            </div>
            <button
              type="button"
              onClick={() => logout()}
              title="Log out"
              aria-label="Log out"
              className="flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-[#A3A3A3] hover:text-[#171717]"
            >
              <IconEllipsis className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div
      data-pencil-name={`Label ${children}`}
      className="flex w-full shrink-0 items-start px-2 pb-1 pt-3"
    >
      <span className="font-ds-ui text-[11px] text-[#A3A3A3]">{children}</span>
    </div>
  );
}

function NavItem({
  href,
  label,
  active,
  count,
  icon,
  comingSoon,
}: {
  href: string;
  label: string;
  active?: boolean;
  count?: number;
  icon: ReactNode;
  comingSoon?: boolean;
}) {
  const className = `box-border flex w-full shrink-0 cursor-pointer items-center gap-2 rounded-[6px] p-[7px_8px] no-underline transition-opacity duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:opacity-80 ${
    active ? "bg-[#F5F5F5]" : "bg-transparent"
  } ${comingSoon ? "opacity-70" : ""}`;

  const body = (
    <>
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center ${
          active ? "text-[#171717]" : "text-[#737373]"
        }`}
      >
        {icon}
      </span>
      <span
        className={`min-w-0 flex-1 font-ds-ui text-[13px] ${
          active ? "font-medium text-[#171717]" : "font-normal text-[#737373]"
        }`}
      >
        {label}
      </span>
      {comingSoon ? (
        <span className="font-ds-mono text-[10px] text-[#A3A3A3]">Soon</span>
      ) : typeof count === "number" ? (
        <span className="font-ds-mono text-[11px] text-[#A3A3A3]">{count}</span>
      ) : null}
    </>
  );

  if (comingSoon) {
    return (
      <span data-pencil-name={`Nav ${label}`} className={className} title="Coming soon">
        {body}
      </span>
    );
  }

  return (
    <Link href={href} data-pencil-name={`Nav ${label}`} className={className}>
      {body}
    </Link>
  );
}

function iconProps(props: SVGProps<SVGSVGElement>) {
  return {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
    ...props,
    className: `h-4 w-4 ${props.className ?? ""}`,
  };
}

function IconSearch(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps({ ...props, className: props.className ?? "h-3.5 w-3.5" })}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function IconInbox(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)}>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

function IconPullRequest(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)}>
      <circle cx="18" cy="18" r="3" />
      <circle cx="6" cy="6" r="3" />
      <path d="M13 6h3a2 2 0 0 1 2 2v7" />
      <path d="M6 9v12" />
    </svg>
  );
}

function IconLayoutList(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)}>
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
      <path d="M14 4h7" />
      <path d="M14 9h7" />
      <path d="M14 15h7" />
      <path d="M14 20h7" />
    </svg>
  );
}

function IconCode(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)}>
      <path d="m16 18 6-6-6-6" />
      <path d="m8 6-6 6 6 6" />
    </svg>
  );
}

function IconPlugZap(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)}>
      <path d="M6.3 20.3a2.4 2.4 0 0 0 3.4 0L12 18l-6-6-2.3 2.3a2.4 2.4 0 0 0 0 3.4Z" />
      <path d="m2 22 3-3" />
      <path d="M7.5 13.5 10 11" />
      <path d="M10.5 16.5 13 14" />
      <path d="m18 3-4 4h6l-4 4" />
    </svg>
  );
}

function IconSettings(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconBlocks(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)}>
      <rect width="7" height="7" x="14" y="3" rx="1" />
      <path d="M10 21V8a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1H3" />
    </svg>
  );
}

function IconUsers(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconShield(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
    </svg>
  );
}

function IconCreditCard(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)}>
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <path d="M2 10h20" />
    </svg>
  );
}

function IconEllipsis(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps(props)}>
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
