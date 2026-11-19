"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ReposResponse } from "@/lib/repos";

// S-05 v2 (G05BeG): only shown when a project has more than one repo (D-17, US-52).
export function RepoAgentHint() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const projectId = localStorage.getItem("closeloop_project");
    if (!projectId) return;
    let cancelled = false;
    api<ReposResponse>(`/api/projects/${projectId}/repos`)
      .then((res) => !cancelled && setCount(res.repos?.length || 0))
      .catch(() => !cancelled && setCount(0));
    return () => {
      cancelled = true;
    };
  }, []);

  if (count < 2) return null;

  return (
    <div
      data-pencil-name="Repo hint"
      className="flex flex-col gap-2 rounded-[10px] border border-[#17171714] bg-[#FAFAFA] p-4"
    >
      <p className="font-ds-ui text-[13px] font-medium text-[#171717]">
        This project has {count} repos. Tell your agent which one it&apos;s in.
      </p>
      <pre className="overflow-x-auto rounded-lg bg-[#0A0A0A] p-3 text-xs leading-[18px] text-[#E5E5E5]">
        <span className="text-[#737373]"># AGENTS.md or .cursor/rules</span>
        {"\n"}When calling list_open_feedback, pass repo from
        {"\n"}`git remote get-url origin` (owner/name).
      </pre>
      <p className="font-ds-ui text-[12px] text-[#737373]">
        Without it, the agent sees reports for every repo in the project.
      </p>
    </div>
  );
}
