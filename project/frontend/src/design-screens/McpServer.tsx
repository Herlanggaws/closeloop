"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { API_URL, api, clearProjectSelection, logout } from "@/lib/api";
import {
  displayName,
  initials,
  projectInitial,
  relativeTime,
} from "@/lib/tickets";

type ProjectInfo = { id: string; name: string };
type MeResponse = { user: { email: string; name?: string; avatar_url?: string }; org: { name: string; plan: string } };

type McpTokenRow = {
  id: string;
  prefix: string;
  scopes: string[];
  last_used_at: string | null;
  created_at: string;
};

type ClientTab = "cursor" | "claude";

const INSTALL_CLIENTS: {
  id: ClientTab;
  label: string;
  hint: string;
}[] = [
  {
    id: "cursor",
    label: "Cursor",
    hint: "Paste into Cursor Settings → MCP → mcp.json (or project .cursor/mcp.json).",
  },
  {
    id: "claude",
    label: "Claude Code",
    hint: "Paste into your Claude Code MCP config (claude_desktop_config / MCP servers).",
  },
];

type McpRpcResponse = {
  result?: {
    tools?: { name: string }[];
    content?: { type: string; text?: string }[];
    isError?: boolean;
  };
  error?: { message?: string };
};

function buildConfig(tokenPlaceholder: string) {
  return JSON.stringify(
    {
      mcpServers: {
        closeloop: {
          url: `${API_URL}/mcp`,
          headers: { Authorization: `Bearer ${tokenPlaceholder}` },
        },
      },
    },
    null,
    2,
  );
}

async function mcpRpc(
  token: string,
  method: string,
  params?: Record<string, unknown>,
  id = 1,
): Promise<McpRpcResponse> {
  const res = await fetch(`${API_URL}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      ...(params ? { params } : {}),
    }),
  });
  const data = (await res.json().catch(() => ({}))) as McpRpcResponse;
  if (!res.ok) {
    throw new Error(data.error?.message || `MCP HTTP ${res.status}`);
  }
  if (data.error?.message) {
    throw new Error(data.error.message);
  }
  return data;
}

function scopesLabel(scopes: string[]) {
  return scopes.includes("write") ? "Read + write" : "Read-only";
}

function lastUsedLabel(iso: string | null) {
  if (!iso) return "Never used";
  return `Last used ${relativeTime(iso)}`;
}

export function McpServer() {
  const router = useRouter();
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [tokens, setTokens] = useState<McpTokenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [creating, setCreating] = useState(false);
  const [freshToken, setFreshToken] = useState("");
  const [freshScopes, setFreshScopes] = useState<string[]>([]);
  const [clientTab, setClientTab] = useState<ClientTab>("cursor");
  const [copied, setCopied] = useState<"token" | "config" | "">("");
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "ok" | "fail">("idle");
  const [testMessage, setTestMessage] = useState("");
  const [revokingId, setRevokingId] = useState("");

  async function loadTokens(projectId: string) {
    const data = await api<{ tokens: McpTokenRow[] }>(`/api/projects/${projectId}/mcp-tokens`);
    setTokens(data.tokens || []);
  }

  useEffect(() => {
    const projectId = localStorage.getItem("closeloop_project");
    if (!projectId) {
      router.replace("/app/onboarding");
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const [projectRes, meRes] = await Promise.all([
          api<{ project: ProjectInfo }>(`/api/projects/${projectId}`),
          api<MeResponse>("/api/me"),
        ]);
        if (cancelled) return;
        setProject(projectRes.project);
        setMe(meRes);
        setError("");

        try {
          const tokensRes = await api<{ tokens: McpTokenRow[] }>(
            `/api/projects/${projectId}/mcp-tokens`,
          );
          if (!cancelled) setTokens(tokensRes.tokens || []);
        } catch (tokenErr) {
          if (!cancelled) {
            setTokens([]);
            setError(
              tokenErr instanceof Error
                ? tokenErr.message
                : "Failed to load MCP tokens",
            );
          }
        }
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load MCP server";
        setError(message);
        if (/not found|forbidden/i.test(message)) {
          clearProjectSelection();
          router.replace("/app/onboarding");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const config = useMemo(
    () => buildConfig(freshToken || "cl_mcp_…"),
    [freshToken],
  );

  const connected = tokens.length > 0;
  const latestUsed = useMemo(() => {
    const used = tokens
      .filter((t) => t.last_used_at)
      .sort(
        (a, b) =>
          new Date(b.last_used_at || 0).getTime() - new Date(a.last_used_at || 0).getTime(),
      );
    return used[0]?.last_used_at || null;
  }, [tokens]);

  const anyWrite = tokens.some((t) => t.scopes.includes("write"));
  const projectName = project?.name || "Project";
  const plan = me?.org.plan || "Indie";
  const email = me?.user.email || "";
  const activeInstall = INSTALL_CLIENTS.find((c) => c.id === clientTab) || INSTALL_CLIENTS[0];

  async function createToken() {
    if (!project || creating) return;
    setCreating(true);
    setError("");
    setTestStatus("idle");
    setTestMessage("");
    try {
      const res = await api<{ token: string; scopes?: string[] }>(
        `/api/projects/${project.id}/mcp-tokens`,
        { method: "POST" },
      );
      setFreshToken(res.token);
      setFreshScopes(res.scopes || ["read"]);
      await loadTokens(project.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create token");
    } finally {
      setCreating(false);
    }
  }

  async function revokeToken(tokenId: string) {
    if (!project || revokingId) return;
    setRevokingId(tokenId);
    setError("");
    try {
      await api(`/api/projects/${project.id}/mcp-tokens/${tokenId}`, { method: "DELETE" });
      if (freshToken) setFreshToken("");
      await loadTokens(project.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke token");
    } finally {
      setRevokingId("");
    }
  }

  async function copy(kind: "token" | "config", value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    setTimeout(() => setCopied(""), 1500);
  }

  async function testConnection() {
    if (!freshToken || testing) return;
    setTesting(true);
    setTestStatus("idle");
    setTestMessage("");
    try {
      await mcpRpc(freshToken, "initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "closeloop-web", version: "0.1.0" },
      });
      const listed = await mcpRpc(freshToken, "tools/list", undefined, 2);
      const tools = listed.result?.tools || [];
      const called = await mcpRpc(
        freshToken,
        "tools/call",
        { name: "list_open_feedback", arguments: { status: "open", limit: 1 } },
        3,
      );
      if (called.result?.isError) {
        throw new Error(called.result.content?.[0]?.text || "list_open_feedback failed");
      }
      setTestStatus("ok");
      setTestMessage(`Connected · ${tools.length} tools`);
    } catch (err) {
      setTestStatus("fail");
      setTestMessage(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setTesting(false);
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
          <NavItem href="/app/mcp" label="MCP server" active />
          <SectionLabel>Settings</SectionLabel>
          <NavItem href="/app/settings" label="Project" />
          <NavItem href="/app/settings/integrations" label="Integrations" />
          <NavItem href="/app/settings/team" label="Team" />
          <NavItem href="/app/settings/billing" label="Billing" />
        </nav>

        {email && (
          <div className="mt-auto flex items-center gap-2.5 px-1.5 py-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#171717] overflow-hidden shrink-0">
              {me?.user?.avatar_url ? (
                <img src={me.user.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="font-ds-sans text-[11px] font-medium text-white">
                  {initials(email)}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-ds-ui text-[13px] font-medium text-[#171717]">
                {me?.user?.name || displayName(email)}
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
        <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-[#17171714] px-6">
          <h1 className="font-ds-sans text-lg font-semibold tracking-[-0.36px] text-[#171717]">
            MCP server
          </h1>
          <button
            type="button"
            disabled={creating || loading}
            onClick={createToken}
            className="h-8 cursor-pointer rounded-md bg-[#171717] px-4 font-ds-sans text-[13px] font-medium text-white disabled:opacity-50"
          >
            {creating ? "Creating…" : connected ? "Generate new token" : "Generate token"}
          </button>
        </header>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-6">
          {loading ? (
            <p className="font-ds-ui text-sm text-[#737373]">Loading…</p>
          ) : (
            <>
              {error && (
                <div className="rounded-md bg-[#FEF2F2] px-3 py-2 font-ds-ui text-[13px] text-[#DA314A]">
                  {error}
                </div>
              )}

              <section
                className={`rounded-2xl border p-5 ${
                  connected
                    ? "border-[#16A34A33] bg-[#F0FDF4]"
                    : "border-[#17171714] bg-[#FAFAFA]"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                          connected
                            ? "bg-[#16A34A] text-white"
                            : "bg-white text-[#A3A3A3] outline outline-1 outline-[#1717171F]"
                        }`}
                      >
                        {connected ? "✓" : "·"}
                      </span>
                      <h2 className="font-ds-ui text-[15px] font-semibold text-[#171717]">
                        {connected ? "Connected" : "Not connected"}
                      </h2>
                    </div>
                    <p className="mt-1.5 font-ds-ui text-[13px] text-[#737373]">
                      {connected
                        ? `${tokens.length} active token${tokens.length === 1 ? "" : "s"} · ${
                            anyWrite ? "Read + write" : "Read-only"
                          } · ${lastUsedLabel(latestUsed)}`
                        : "Generate a token and paste the config into Cursor or Claude Code so agents can read your inbox."}
                    </p>
                  </div>
                </div>
              </section>

              {freshToken && (
                <section className="rounded-2xl border border-[#17171714] bg-white p-5 shadow-[0_4px_4px_#1717170A]">
                  <h3 className="font-ds-ui text-[14px] font-semibold text-[#171717]">
                    New token — copy now
                  </h3>
                  <p className="mt-1 font-ds-ui text-[12px] text-[#737373]">
                    Shown once. Scopes: {scopesLabel(freshScopes)}.
                  </p>
                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[13px] font-medium text-[#171717]">Token</span>
                      <button
                        type="button"
                        onClick={() => copy("token", freshToken)}
                        className="cursor-pointer text-[13px] font-medium underline-offset-2 hover:underline"
                      >
                        {copied === "token" ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <code className="block break-all rounded-lg bg-[#FAFAFA] p-3 text-xs text-[#171717]">
                      {freshToken}
                    </code>
                  </div>

                  <div className="mt-4">
                    <div className="mb-2 flex flex-wrap gap-1.5 rounded-[10px] bg-[#F5F5F5] p-1">
                      {(
                        [
                          { id: "cursor", label: "Cursor" },
                          { id: "claude", label: "Claude Code" },
                        ] as const
                      ).map((tab) => {
                        const active = clientTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setClientTab(tab.id)}
                            className={`cursor-pointer rounded-md px-3 py-1.5 text-[13px] font-medium transition ${
                              active
                                ? "bg-white text-[#171717] shadow-[0_1px_2px_#17171714]"
                                : "text-[#737373] hover:text-[#171717]"
                            }`}
                          >
                            {tab.label}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mb-2 font-ds-ui text-[12px] text-[#737373]">
                      {clientTab === "cursor"
                        ? "Paste into Cursor Settings → MCP → mcp.json."
                        : "Paste into your Claude Code MCP config."}
                    </p>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[13px] font-medium text-[#171717]">Config</span>
                      <button
                        type="button"
                        onClick={() => copy("config", config)}
                        className="cursor-pointer text-[13px] font-medium underline-offset-2 hover:underline"
                      >
                        {copied === "config" ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <pre className="overflow-x-auto rounded-lg bg-[#0A0A0A] p-4 text-xs text-[#86EFAC]">
                      {config}
                    </pre>
                  </div>

                  <div
                    className={`mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border p-3 ${
                      testStatus === "ok"
                        ? "border-[#16A34A33] bg-[#F0FDF4]"
                        : testStatus === "fail"
                          ? "border-[#DA314A33] bg-[#FEF2F2]"
                          : "border-[#17171714] bg-[#FAFAFA]"
                    }`}
                  >
                    <p className="font-ds-ui text-[12px] text-[#737373]">
                      {testMessage || "Verify this token against /mcp before leaving this page."}
                    </p>
                    <button
                      type="button"
                      disabled={testing}
                      onClick={testConnection}
                      className="h-8 shrink-0 cursor-pointer rounded-md border border-[#1717171F] bg-white px-3 text-[13px] font-medium text-[#171717] disabled:opacity-50"
                    >
                      {testing ? "Testing…" : "Test connection"}
                    </button>
                  </div>
                </section>
              )}

              {connected && (
                <section className="overflow-hidden rounded-2xl border border-[#17171714]">
                  <div className="border-b border-[#17171714] bg-[#FAFAFA] px-4 py-3">
                    <h3 className="font-ds-ui text-[13px] font-semibold text-[#171717]">Tokens</h3>
                  </div>
                  <div className="divide-y divide-[#17171714]">
                    {tokens.map((token) => (
                      <div
                        key={token.id}
                        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <div className="font-ds-mono text-[13px] text-[#171717]">
                            {token.prefix}…
                          </div>
                          <div className="mt-0.5 font-ds-ui text-[12px] text-[#A3A3A3]">
                            {scopesLabel(token.scopes)} · created {relativeTime(token.created_at)} ·{" "}
                            {lastUsedLabel(token.last_used_at)}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={revokingId === token.id}
                          onClick={() => revokeToken(token.id)}
                          className="h-8 cursor-pointer rounded-md border border-[#1717171F] bg-white px-3 font-ds-ui text-[13px] font-medium text-[#DA314A] disabled:opacity-50"
                        >
                          {revokingId === token.id ? "Revoking…" : "Revoke"}
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section
                id="mcp-install-clients"
                className="rounded-2xl border border-[#17171714] bg-white p-5"
              >
                <h3 className="font-ds-ui text-[14px] font-semibold text-[#171717]">
                  Install in another client
                </h3>
                <p className="mt-1 font-ds-ui text-[12px] text-[#737373]">
                  One token works in both Cursor and Claude Code. Paste the same secret into the
                  second app, or generate a fresh token above if you no longer have it. Endpoint{" "}
                  <code className="text-[#171717]">{API_URL}/mcp</code>.
                </p>

                <div className="mt-4 mb-2 flex flex-wrap gap-1.5 rounded-[10px] bg-[#F5F5F5] p-1">
                  {INSTALL_CLIENTS.map((tab) => {
                    const active = clientTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setClientTab(tab.id)}
                        className={`cursor-pointer rounded-md px-3 py-1.5 text-[13px] font-medium transition ${
                          active
                            ? "bg-white text-[#171717] shadow-[0_1px_2px_#17171714]"
                            : "text-[#737373] hover:text-[#171717]"
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
                <p className="mb-2 font-ds-ui text-[12px] text-[#737373]">{activeInstall.hint}</p>
                {!freshToken && (
                  <p className="mb-2 font-ds-ui text-[12px] text-[#A3A3A3]">
                    Replace <code className="text-[#171717]">cl_mcp_…</code> with your saved token,
                    or click Generate new token.
                  </p>
                )}
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[13px] font-medium text-[#171717]">
                    {activeInstall.label} config
                  </span>
                  <button
                    type="button"
                    onClick={() => copy("config", config)}
                    className="cursor-pointer text-[13px] font-medium underline-offset-2 hover:underline"
                  >
                    {copied === "config" ? "Copied" : "Copy"}
                  </button>
                </div>
                <pre className="overflow-x-auto rounded-lg bg-[#0A0A0A] p-4 text-xs text-[#86EFAC]">
                  {config}
                </pre>
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
