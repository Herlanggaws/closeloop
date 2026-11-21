"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiRequestError, api } from "@/lib/api";
import {
  REPO_PLATFORMS,
  platformOwner,
  repoCounter,
  repoLimitReached,
  repoPlatformLabel,
  repositoriesSubtitle,
  type ProjectRepo,
  type RepoPlatform,
  type ReposResponse,
} from "@/lib/repos";

// S-13 v2 Repositories (ho9Yy, dmcSk), Add repository (DMYRO), downgrade (vZyTd).

type GitHubRepoOption = { full_name: string; default_branch: string };

export function RepositoriesSection({
  projectId,
  projectName,
  installationId,
  accountLogin,
  addRequest = 0,
}: {
  projectId: string;
  projectName: string;
  installationId: number;
  accountLogin: string;
  /** Bumped by the page (e.g. right after the GitHub App install) to open Add repository. */
  addRequest?: number;
}) {
  const [data, setData] = useState<ReposResponse | null>(null);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      setData(await api<ReposResponse>(`/api/projects/${projectId}/repos`));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load repositories");
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load, installationId]);

  useEffect(() => {
    if (addRequest > 0 && installationId) setAdding(true);
  }, [addRequest, installationId]);

  if (!data) {
    return error ? <p className="font-ds-ui text-sm text-[#DA314A]">{error}</p> : null;
  }

  const { used, limit } = data.usage;
  const full = repoLimitReached(used, limit);
  const overLimit = limit > 0 && used > limit;
  const activeCount = data.repos.filter((r) => !r.routing_paused).length;

  async function toggleCrossRead() {
    try {
      setData(
        await api<ReposResponse>(`/api/projects/${projectId}/repos/settings`, {
          method: "PATCH",
          body: JSON.stringify({ allow_cross_repo_read: !data?.allow_cross_repo_read }),
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
  }

  async function makeFallback(repo: ProjectRepo) {
    setMenuFor(null);
    try {
      await api(`/api/projects/${projectId}/repos/${repo.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_fallback: true }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
  }

  async function removeRepo(repo: ProjectRepo) {
    setMenuFor(null);
    const msg = repo.is_fallback
      ? `Remove ${repo.full_name}? It is the fallback, so platforms with no repo will have nowhere to go until you pick a new fallback.`
      : `Remove ${repo.full_name}? Its tickets stay, with no repo until you pick one.`;
    if (!window.confirm(msg)) return;
    try {
      await api(`/api/projects/${projectId}/repos/${repo.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove");
    }
  }

  return (
    <section data-tour="integrations-repos" className="flex flex-col gap-3">
      <h2 className="font-ds-ui text-xs font-medium text-[#A3A3A3]">Repositories</h2>
      <div
        data-pencil-name="Repositories"
        className="overflow-hidden rounded-xl border border-[#17171714] bg-white"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#17171714] px-5 py-4">
          <div className="min-w-0">
            <div className="font-ds-sans text-[15px] font-semibold text-[#171717]">Repositories</div>
            <p className="mt-0.5 font-ds-ui text-[12.5px] text-[#737373]">
              {repositoriesSubtitle(data.plan, used, limit)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-ds-mono text-[12px] text-[#737373]">{repoCounter(used, limit)}</span>
            <button
              type="button"
              disabled={full || !installationId}
              title={!installationId ? "Connect the GitHub App first" : undefined}
              onClick={() => setAdding(true)}
              className="inline-flex h-8 cursor-pointer items-center rounded-md bg-[#171717] px-3 font-ds-sans text-[13px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              + Add repository
            </button>
          </div>
        </div>

        {overLimit && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F59E0B33] bg-[#FFFBEB] px-5 py-3 font-ds-ui text-[12.5px] text-[#92400E]">
            <span>
              {projectName} has {used} repos, more than your plan includes. {activeCount} keep routing.
            </span>
            <button
              type="button"
              onClick={() => setChoosing(true)}
              className="cursor-pointer font-medium underline"
            >
              Choose repos to keep routing
            </button>
          </div>
        )}

        {data.repos.length === 0 ? (
          <p className="px-5 py-6 font-ds-ui text-[13px] text-[#737373]">
            {installationId
              ? "No repos yet. Add one so reports reach the right codebase."
              : "Connect the GitHub App below, then add the repos this project ships from."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="bg-[#FAFAFA] text-left font-ds-ui text-[11px] font-medium text-[#A3A3A3]">
                  <th className="px-5 py-2 font-medium">Repository</th>
                  <th className="px-3 py-2 font-medium">Platforms and paths</th>
                  <th className="px-3 py-2 font-medium">Branch</th>
                  <th className="px-3 py-2 font-medium">Routing</th>
                  <th className="w-10 px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {data.repos.map((repo) => (
                  <tr
                    key={repo.id}
                    data-pencil-name={repo.full_name}
                    className={`border-t border-[#17171714] align-top ${repo.routing_paused ? "opacity-60" : ""}`}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <GitHubMark />
                        <div className="min-w-0">
                          <div className="truncate font-ds-mono text-[12.5px] text-[#171717]">
                            {repo.full_name}
                          </div>
                          <div className="font-ds-ui text-[11px] text-[#A3A3A3]">
                            GitHub App · {repo.account_login || repo.full_name.split("/")[0]}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {repo.routes.length === 0 ? (
                          <span className="font-ds-ui text-[12px] text-[#A3A3A3]">
                            {repo.is_fallback ? "Everything without a repo" : "No platforms"}
                          </span>
                        ) : (
                          repo.routes.map((rt) => (
                            <span
                              key={rt.platform}
                              className="inline-flex items-center gap-1.5 rounded-md border border-[#1717171F] bg-[#FAFAFA] px-2 py-0.5 font-ds-ui text-[11.5px] text-[#171717]"
                            >
                              <PlatformIcon platform={rt.platform} />
                              {repoPlatformLabel(rt.platform)}
                              {rt.path && (
                                <span className="font-ds-mono text-[11px] text-[#A3A3A3]">{rt.path}</span>
                              )}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 font-ds-mono text-[12px] text-[#737373]">
                      {repo.default_branch}
                    </td>
                    <td className="px-3 py-3">
                      {repo.routing_paused ? (
                        <span className="rounded-md bg-[#F5F5F5] px-1.5 py-0.5 font-ds-ui text-[11px] text-[#A3A3A3]">
                          Paused
                        </span>
                      ) : repo.is_fallback ? (
                        <span className="rounded-md bg-[#EFF6FF] px-1.5 py-0.5 font-ds-ui text-[11px] font-medium text-[#266DF0]">
                          Fallback
                        </span>
                      ) : (
                        <span className="font-ds-ui text-[12px] text-[#737373]">Platform</span>
                      )}
                    </td>
                    <td className="relative px-3 py-3 text-right">
                      <button
                        type="button"
                        aria-label={`Actions for ${repo.full_name}`}
                        onClick={() => setMenuFor(menuFor === repo.id ? null : repo.id)}
                        className="cursor-pointer rounded px-1.5 font-ds-ui text-[15px] text-[#737373] hover:bg-[#F5F5F5]"
                      >
                        ⋯
                      </button>
                      {menuFor === repo.id && (
                        <div className="absolute right-3 top-9 z-10 flex w-44 flex-col rounded-lg border border-[#1717171F] bg-white py-1 text-left shadow-[0_8px_24px_#1717171A]">
                          {!repo.is_fallback && (
                            <button
                              type="button"
                              onClick={() => void makeFallback(repo)}
                              className="cursor-pointer px-3 py-1.5 text-left font-ds-ui text-[12.5px] text-[#171717] hover:bg-[#FAFAFA]"
                            >
                              Use as fallback
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void removeRepo(repo)}
                            className="cursor-pointer px-3 py-1.5 text-left font-ds-ui text-[12.5px] text-[#DA314A] hover:bg-[#FEF2F2]"
                          >
                            Remove repository
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <label
          data-pencil-name="Read Access"
          className="flex cursor-pointer items-start gap-3 border-t border-[#17171714] px-5 py-4"
        >
          <input
            type="checkbox"
            role="switch"
            className="mt-0.5 h-4 w-7 cursor-pointer accent-[#171717]"
            checked={data.allow_cross_repo_read}
            onChange={() => void toggleCrossRead()}
          />
          <span>
            <span className="block font-ds-ui text-[13px] font-medium text-[#171717]">
              Let auto PR agents read other repos in this project
            </span>
            <span className="block font-ds-ui text-[12px] text-[#737373]">
              Gives the runner read-only context, like your backend. Write access is always limited to
              the ticket&apos;s repo.
            </span>
          </span>
        </label>
      </div>
      {full && data.plan !== "studio" && data.plan !== "business" && (
        <Link
          href="/app/settings/billing"
          className="w-fit font-ds-ui text-[12px] text-[#737373] underline"
        >
          See plans
        </Link>
      )}
      {error && <p className="font-ds-ui text-[12.5px] text-[#DA314A]">{error}</p>}

      {adding && (
        <AddRepositoryModal
          projectId={projectId}
          installationId={installationId}
          accountLogin={accountLogin}
          data={data}
          onClose={() => setAdding(false)}
          onAdded={async () => {
            setAdding(false);
            await load();
          }}
        />
      )}
      {choosing && (
        <KeepReposModal
          projectId={projectId}
          projectName={projectName}
          data={data}
          onClose={() => setChoosing(false)}
          onSaved={(next) => {
            setData(next);
            setChoosing(false);
          }}
        />
      )}
    </section>
  );
}

function AddRepositoryModal({
  projectId,
  installationId,
  accountLogin,
  data,
  onClose,
  onAdded,
}: {
  projectId: string;
  installationId: number;
  accountLogin: string;
  data: ReposResponse;
  onClose: () => void;
  onAdded: () => Promise<void>;
}) {
  const [options, setOptions] = useState<GitHubRepoOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<GitHubRepoOption | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [paths, setPaths] = useState<Record<string, string>>({});
  const [fallback, setFallback] = useState(data.repos.length === 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api<{ repos: GitHubRepoOption[] }>(
      `/api/projects/${projectId}/integrations/github_app/repos?installation_id=${installationId}`,
    )
      .then((res) => !cancelled && setOptions(res.repos || []))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Could not list repos"))
      .finally(() => !cancelled && setLoadingOptions(false));
    return () => {
      cancelled = true;
    };
  }, [projectId, installationId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const connected = useMemo(() => new Set(data.repos.map((r) => r.full_name.toLowerCase())), [data.repos]);
  const filtered = options.filter((o) => o.full_name.toLowerCase().includes(query.trim().toLowerCase()));
  const currentFallback = data.repos.find((r) => r.is_fallback);
  const conflicts = REPO_PLATFORMS.filter((p) => checked[p]).map((p) => ({
    platform: p,
    owner: platformOwner(data.repos, p),
  })).filter((c) => c.owner);

  async function submit() {
    if (!picked) return;
    setSaving(true);
    setError("");
    try {
      await api(`/api/projects/${projectId}/repos`, {
        method: "POST",
        body: JSON.stringify({
          installation_id: installationId,
          account_login: accountLogin,
          full_name: picked.full_name,
          default_branch: picked.default_branch,
          is_fallback: fallback,
          routes: REPO_PLATFORMS.filter((p) => checked[p]).map((p) => ({ platform: p, path: paths[p] || "" })),
        }),
      });
      await onAdded();
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === "REPO_LIMIT") {
        setError("This project already has as many repos as your plan includes.");
      } else {
        setError(err instanceof Error ? err.message : "Could not add repository");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A0A0A66] p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-repo-title"
        className="flex max-h-[90vh] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_64px_#17171740]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#17171714] px-6 py-5">
          <div>
            <h3 id="add-repo-title" className="font-ds-sans text-[17px] font-semibold text-[#171717]">
              Add a repository
            </h3>
            <p className="mt-1 font-ds-ui text-[13px] text-[#737373]">
              Pick a repo from your GitHub App installations, then choose the platforms it serves.{" "}
              {repoCounter(data.usage.used, data.usage.limit).replace(" repos", " repos used")}.
            </p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="cursor-pointer text-[#737373]">
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-5 overflow-y-auto px-6 py-5">
          <div className="flex flex-col gap-2">
            <span className="font-ds-ui text-[12px] font-medium text-[#171717]">Repository</span>
            <div className="overflow-hidden rounded-lg border border-[#1717171F]">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search repositories"
                className="w-full border-b border-[#17171714] px-3 py-2 font-ds-ui text-[13px] outline-none"
              />
              <div className="max-h-48 overflow-y-auto">
                <div className="bg-[#FAFAFA] px-3 py-1.5 font-ds-ui text-[11px] text-[#A3A3A3]">
                  {accountLogin || "GitHub App"} · installation
                </div>
                {loadingOptions ? (
                  <p className="px-3 py-2 font-ds-ui text-[12.5px] text-[#737373]">Loading…</p>
                ) : filtered.length === 0 ? (
                  <p className="px-3 py-2 font-ds-ui text-[12.5px] text-[#737373]">No repositories match.</p>
                ) : (
                  filtered.map((o) => {
                    const isConnected = connected.has(o.full_name.toLowerCase());
                    return (
                      <label
                        key={o.full_name}
                        className={`flex items-center gap-2.5 px-3 py-2 ${
                          isConnected ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-[#FAFAFA]"
                        }`}
                      >
                        <input
                          type="radio"
                          name="repo"
                          disabled={isConnected}
                          checked={picked?.full_name === o.full_name}
                          onChange={() => setPicked(o)}
                        />
                        <span className="flex-1 font-ds-mono text-[12.5px] text-[#171717]">{o.full_name}</span>
                        {isConnected && (
                          <span className="font-ds-ui text-[11px] text-[#A3A3A3]">Already connected</span>
                        )}
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div>
              <div className="font-ds-ui text-[12px] font-medium text-[#171717]">Platforms this repo serves</div>
              <div className="font-ds-ui text-[12px] text-[#737373]">
                Each platform routes to one repo. For a monorepo, add the folder path.
              </div>
            </div>
            <div className="flex flex-col divide-y divide-[#17171714] rounded-lg border border-[#1717171F]">
              {REPO_PLATFORMS.map((p) => {
                const owner = checked[p] ? platformOwner(data.repos, p) : undefined;
                return (
                  <div key={p} className={`flex flex-col gap-1 px-3 py-2 ${owner ? "bg-[#FEF2F2]" : ""}`}>
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        aria-label={repoPlatformLabel(p)}
                        checked={!!checked[p]}
                        onChange={(e) => setChecked((prev) => ({ ...prev, [p]: e.target.checked }))}
                      />
                      <PlatformIcon platform={p} />
                      <span className="w-20 font-ds-ui text-[13px] text-[#171717]">{repoPlatformLabel(p)}</span>
                      <input
                        value={paths[p] || ""}
                        onChange={(e) => setPaths((prev) => ({ ...prev, [p]: e.target.value }))}
                        placeholder={`Path (optional), e.g. apps/${p}`}
                        className="min-w-0 flex-1 rounded-md border border-[#1717171F] px-2 py-1 font-ds-mono text-[12px] outline-none"
                      />
                    </div>
                    {owner && (
                      <p className="pl-6 font-ds-ui text-[11.5px] text-[#DA314A]">
                        {repoPlatformLabel(p)} already routes to {owner.full_name}. Remove it there first, or
                        uncheck it here.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-2.5">
            <input type="checkbox" checked={fallback} onChange={(e) => setFallback(e.target.checked)} />
            <span>
              <span className="block font-ds-ui text-[13px] font-medium text-[#171717]">Use as fallback</span>
              <span className="block font-ds-ui text-[12px] text-[#737373]">
                Reports from platforms with no repo land here.
                {currentFallback ? ` Replaces ${currentFallback.full_name}.` : ""}
              </span>
            </span>
          </label>

          {error && <p className="font-ds-ui text-[12.5px] text-[#DA314A]">{error}</p>}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[#17171714] bg-[#FAFAFA] px-6 py-4">
          <span className="font-ds-ui text-[12px] text-[#737373]">A monorepo counts as one repo toward your plan.</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 cursor-pointer rounded-md border border-[#1717171F] bg-white px-3 font-ds-sans text-[13px] font-medium text-[#171717]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!picked || saving || conflicts.length > 0}
              onClick={() => void submit()}
              className="h-9 cursor-pointer rounded-md bg-[#171717] px-3 font-ds-sans text-[13px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? "Adding…" : "Add repository"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function KeepReposModal({
  projectId,
  projectName,
  data,
  onClose,
  onSaved,
}: {
  projectId: string;
  projectName: string;
  data: ReposResponse;
  onClose: () => void;
  onSaved: (next: ReposResponse) => void;
}) {
  const limit = data.usage.limit;
  const [keep, setKeep] = useState<Set<string>>(
    () => new Set(data.repos.filter((r) => r.is_fallback || !r.routing_paused).slice(0, limit).map((r) => r.id)),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const planName = data.plan.charAt(0).toUpperCase() + data.plan.slice(1);

  function toggle(repo: ProjectRepo) {
    if (repo.is_fallback) return;
    setKeep((prev) => {
      const next = new Set(prev);
      if (next.has(repo.id)) next.delete(repo.id);
      else if (next.size < limit) next.add(repo.id);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      onSaved(
        await api<ReposResponse>(`/api/projects/${projectId}/repos/active`, {
          method: "POST",
          body: JSON.stringify({ keep: Array.from(keep) }),
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A0A0A66] p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="keep-repos-title"
        className="flex w-full max-w-[520px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_64px_#17171740]"
      >
        <div className="border-b border-[#17171714] px-6 py-5">
          <h3 id="keep-repos-title" className="font-ds-sans text-[17px] font-semibold text-[#171717]">
            Choose {limit} repos to keep routing
          </h3>
          <p className="mt-1 font-ds-ui text-[13px] text-[#737373]">
            {projectName} moved to {planName}, which includes {limit} repos per project. This project has{" "}
            {data.repos.length}.
          </p>
        </div>
        <div className="flex flex-col divide-y divide-[#17171714] px-6">
          {data.repos.map((repo) => {
            const on = keep.has(repo.id);
            return (
              <label key={repo.id} className="flex cursor-pointer items-center gap-3 py-3">
                <input
                  type="checkbox"
                  checked={on}
                  disabled={repo.is_fallback || (!on && keep.size >= limit)}
                  onChange={() => toggle(repo)}
                />
                <span className="flex-1 font-ds-mono text-[12.5px] text-[#171717]">{repo.full_name}</span>
                <span className={`font-ds-ui text-[11.5px] ${on ? "text-[#16A34A]" : "text-[#A3A3A3]"}`}>
                  {repo.is_fallback ? "Fallback stays on" : on ? "Keeps routing" : "Paused"}
                </span>
              </label>
            );
          })}
        </div>
        <p className="mx-6 mb-4 rounded-lg bg-[#FAFAFA] p-3 font-ds-ui text-[12px] text-[#737373]">
          Paused repos stay connected but stop receiving reports. New tickets for their platforms go to the
          fallback. Nothing is deleted, and upgrading turns routing back on.
        </p>
        {error && <p className="mx-6 mb-3 font-ds-ui text-[12.5px] text-[#DA314A]">{error}</p>}
        <div className="flex items-center justify-between gap-3 border-t border-[#17171714] bg-[#FAFAFA] px-6 py-4">
          <span className="font-ds-mono text-[12px] text-[#737373]">
            {keep.size} of {limit} selected
          </span>
          <div className="flex gap-2">
            <Link
              href="/app/settings/billing"
              onClick={onClose}
              className="inline-flex h-9 items-center rounded-md border border-[#1717171F] bg-white px-3 font-ds-sans text-[13px] font-medium text-[#171717] no-underline"
            >
              Change plan
            </Link>
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="h-9 cursor-pointer rounded-md bg-[#171717] px-3 font-ds-sans text-[13px] font-medium text-white disabled:opacity-40"
            >
              {saving ? "Saving…" : `Keep these ${keep.size}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function GitHubMark() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" aria-hidden fill="#171717">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

export function PlatformIcon({ platform }: { platform: RepoPlatform | string }) {
  const glyph: Record<string, string> = { web: "◍", android: "▯", ios: "◉", backend: "▤", shared: "◇" };
  return (
    <span aria-hidden className="font-ds-ui text-[11px] text-[#737373]">
      {glyph[platform] || "•"}
    </span>
  );
}
