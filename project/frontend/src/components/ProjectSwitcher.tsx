"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { projectInitial, displayName } from "@/lib/tickets";
import {
  canCreateProject,
  planLabel,
  type MeResponse,
  type OrgUsage,
} from "@/lib/usage";

type ProjectRow = { id?: string; ID?: string; name?: string; Name?: string; frozen?: boolean };

function idOf(p: ProjectRow) {
  return p.id || p.ID || "";
}

function nameOf(p: ProjectRow) {
  return p.name || p.Name || "Project";
}

type Props = {
  projectName: string;
  plan?: string;
  email?: string;
  usage?: OrgUsage;
  loading?: boolean;
};

export function ProjectSwitcherSkeleton() {
  return (
    <div
      data-testid="project-switcher-skeleton"
      className="flex w-full items-center gap-2.5 rounded-md p-1.5"
      aria-hidden="true"
    >
      <div className="h-7 w-7 shrink-0 animate-pulse rounded-md bg-[#1717170D]" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="h-3.5 w-24 animate-pulse rounded bg-[#1717170D]" />
        <div className="h-2.5 w-16 animate-pulse rounded bg-[#17171708]" />
      </div>
      <div className="h-3.5 w-3.5 shrink-0 animate-pulse rounded bg-[#17171708]" />
    </div>
  );
}

export function ProjectSwitcher({
  projectName,
  plan = "free",
  email = "",
  usage,
  loading = false,
}: Props) {
  if (loading) {
    return <ProjectSwitcherSkeleton />;
  }

  return (
    <ProjectSwitcherMenu
      projectName={projectName}
      plan={plan}
      email={email}
      usage={usage}
    />
  );
}

function ProjectSwitcherMenu({
  projectName,
  plan = "free",
  email = "",
  usage,
}: Omit<Props, "loading">) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [fetchedUsage, setFetchedUsage] = useState<OrgUsage | undefined>(usage);
  const [menuLoading, setMenuLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedId =
    typeof window !== "undefined" ? localStorage.getItem("closeloop_project") || "" : "";

  const subtitle = email
    ? `${displayName(email).split(" ")[0]} · ${planLabel(plan)}`
    : planLabel(plan);
  const effectiveUsage = fetchedUsage || usage;

  useEffect(() => {
    setFetchedUsage(usage);
  }, [usage]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  async function loadMenu() {
    setMenuLoading(true);
    try {
      const [listRes, meRes] = await Promise.all([
        api<{ projects: ProjectRow[] }>("/api/projects"),
        api<MeResponse>("/api/me"),
      ]);
      setProjects(listRes.projects || []);
      if (meRes.usage) setFetchedUsage(meRes.usage);
    } catch {
      setProjects([]);
    } finally {
      setMenuLoading(false);
    }
  }

  function openMenu() {
    const next = !open;
    setOpen(next);
    if (next) void loadMenu();
  }

  function switchTo(id: string) {
    if (!id) return;
    localStorage.setItem("closeloop_project", id);
    localStorage.removeItem("closeloop_public_key");
    setOpen(false);
    window.location.assign("/app/inbox");
  }

  function onNewProject() {
    if (!canCreateProject(effectiveUsage)) {
      setOpen(false);
      router.push("/app/settings/billing");
      return;
    }
    localStorage.removeItem("closeloop_project");
    localStorage.removeItem("closeloop_public_key");
    localStorage.removeItem("closeloop_platforms");
    setOpen(false);
    router.push("/app/onboarding");
  }

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        type="button"
        onClick={openMenu}
        className="flex w-full cursor-pointer items-center gap-2.5 rounded-md p-1.5 text-left hover:bg-[#1717170A]"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#F59E0B]">
          <span className="font-ds-sans text-[13px] font-semibold text-white">
            {projectInitial(projectName)}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-ds-ui text-[13px] font-semibold text-[#171717]">
            {projectName}
          </div>
          <div className="truncate font-ds-ui text-[11px] text-[#A3A3A3]">{subtitle}</div>
        </div>
        <svg
          viewBox="0 0 14 14"
          className="h-3.5 w-3.5 shrink-0 text-[#A3A3A3]"
          aria-hidden
        >
          <path
            d="M4 5.2 7 2.5l3 2.7M4 8.8 7 11.5l3-2.7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-lg border border-[#1717171F] bg-white shadow-[0_8px_24px_#00000014]"
        >
          <div className="max-h-56 overflow-y-auto py-1">
            {menuLoading && (
              <div className="px-3 py-2 font-ds-ui text-[12px] text-[#A3A3A3]">Loading…</div>
            )}
            {!menuLoading &&
              projects.map((p) => {
                const id = idOf(p);
                const name = nameOf(p);
                const active = id === selectedId;
                return (
                  <button
                    key={id || name}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => switchTo(id)}
                    className={`flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left hover:bg-[#FAFAFA] ${
                      active ? "bg-[#FAFAFA]" : ""
                    }`}
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-[#F59E0B] font-ds-sans text-[11px] font-semibold text-white">
                      {projectInitial(name)}
                    </span>
                    <span className="truncate font-ds-ui text-[13px] text-[#171717]">{name}</span>
                    {p.frozen && (
                      <span
                        className="ml-auto shrink-0 rounded bg-[#FEF3C7] px-1.5 font-ds-ui text-[11px] text-[#B45309]"
                        title="Over your plan's project limit: no new reports until you upgrade."
                      >
                        Paused
                      </span>
                    )}
                  </button>
                );
              })}
          </div>
          <div className="border-t border-[#17171714]">
            <button
              type="button"
              onClick={onNewProject}
              className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left font-ds-ui text-[13px] text-[#171717] hover:bg-[#FAFAFA]"
            >
              <span className="text-[#737373]">+</span>
              {canCreateProject(effectiveUsage) ? "New project" : "Upgrade to add project"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
