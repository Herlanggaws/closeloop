"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CloseloopLogo } from "@/components/CloseloopLogo";
import { API_URL, api, logout } from "@/lib/api";

type ClientTab = "cursor" | "claude";

type CreateTokenResponse = {
  token: string;
  prefix?: string;
  scopes?: string[];
};

type McpRpcResponse = {
  result?: {
    tools?: { name: string }[];
    content?: { type: string; text?: string }[];
    isError?: boolean;
  };
  error?: { message?: string };
};

function buildConfig(token: string) {
  return JSON.stringify(
    {
      mcpServers: {
        closeloop: {
          url: `${API_URL}/mcp`,
          headers: { Authorization: `Bearer ${token || "cl_mcp_…"}` },
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

export function ConnectMCP() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState("");
  const [scopes, setScopes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState<"token" | "config" | "">("");
  const [clientTab, setClientTab] = useState<ClientTab>("cursor");
  const [error, setError] = useState("");
  const [testStatus, setTestStatus] = useState<"idle" | "ok" | "fail">("idle");
  const [testMessage, setTestMessage] = useState("");

  useEffect(() => {
    if (!localStorage.getItem("closeloop_project")) {
      router.replace("/app/onboarding");
      return;
    }
    setReady(true);
  }, [router]);

  const config = useMemo(() => buildConfig(token), [token]);
  const canWrite = scopes.includes("write");
  const scopeLabel = canWrite ? "Read + write" : "Read-only · Free plan";

  async function createToken() {
    const projectId = localStorage.getItem("closeloop_project");
    if (!projectId) {
      router.replace("/app/onboarding");
      return;
    }
    setLoading(true);
    setError("");
    setTestStatus("idle");
    setTestMessage("");
    try {
      const res = await api<CreateTokenResponse>(`/api/projects/${projectId}/mcp-tokens`, {
        method: "POST",
      });
      setToken(res.token);
      setScopes(res.scopes || ["read"]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create token");
    } finally {
      setLoading(false);
    }
  }

  async function copy(kind: "token" | "config", value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    setTimeout(() => setCopied(""), 1500);
  }

  async function testConnection() {
    if (!token || testing) return;
    setTesting(true);
    setError("");
    setTestStatus("idle");
    setTestMessage("");
    try {
      await mcpRpc(token, "initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "closeloop-web", version: "0.1.0" },
      });
      const listed = await mcpRpc(token, "tools/list", undefined, 2);
      const tools = listed.result?.tools || [];
      const called = await mcpRpc(
        token,
        "tools/call",
        { name: "list_open_feedback", arguments: { status: "open", limit: 1 } },
        3,
      );
      if (called.result?.isError) {
        throw new Error(called.result.content?.[0]?.text || "list_open_feedback failed");
      }
      let ticketHint = "";
      const text = called.result?.content?.[0]?.text || "";
      try {
        const parsed = JSON.parse(text) as unknown;
        if (Array.isArray(parsed)) {
          ticketHint = ` · ${parsed.length} open ticket${parsed.length === 1 ? "" : "s"}`;
        }
      } catch {
        // text may not be JSON; ignore
      }
      setTestStatus("ok");
      setTestMessage(`Connected · ${tools.length} tools${ticketHint}`);
    } catch (err) {
      setTestStatus("fail");
      setTestMessage(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setTesting(false);
    }
  }

  if (!ready) {
    return (
      <div className="box-border flex min-h-screen w-full items-center justify-center bg-[#F7F7F7]">
        <p className="font-ds-ui text-sm text-[#737373]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="box-border flex min-h-screen w-full flex-col bg-[#F7F7F7]">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#17171714] bg-white px-8">
        <CloseloopLogo />
        <nav className="flex items-center gap-2 text-[13px]">
          <StepDone label="Create project" />
          <span className="h-px w-10 bg-[#1717171F]" />
          <StepDone label="Install" />
          <span className="h-px w-10 bg-[#1717171F]" />
          <Step n={3} label="Connect agent" active />
        </nav>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => logout()}
            className="cursor-pointer text-[13px] text-[#737373] hover:text-[#171717]"
          >
            Log out
          </button>
          <button
            type="button"
            onClick={() => router.push("/app/inbox")}
            className="cursor-pointer text-[13px] text-[#737373] hover:text-[#171717]"
          >
            Skip setup
          </button>
        </div>
      </header>

      <div className="flex flex-1 justify-center px-4 py-14">
        <div className="w-full max-w-[640px] overflow-hidden rounded-2xl border border-[#17171714] bg-white shadow-[0_4px_4px_#1717170A]">
          <div className="flex flex-col gap-6 p-8">
            <div>
              <h1 className="font-ds-sans text-[26px] font-medium tracking-[-0.6px] text-[#171717]">
                Connect an agent
              </h1>
              <p className="mt-1.5 text-sm text-[#737373]">
                Create a token, copy the config into Cursor or Claude Code, then test the connection.
                We store only a hash — the full token is shown once.
              </p>
            </div>

            {!token ? (
              <button
                type="button"
                disabled={loading}
                onClick={createToken}
                className="inline-flex h-10 w-fit cursor-pointer items-center rounded-md bg-[#171717] px-4 text-sm font-medium text-white disabled:opacity-50"
              >
                {loading ? "Creating…" : "Generate MCP token"}
              </button>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md border border-[#1717171F] bg-[#FAFAFA] px-2 py-1 font-ds-ui text-[12px] font-medium text-[#171717]">
                    {scopeLabel}
                  </span>
                  {!canWrite && (
                    <span className="font-ds-ui text-[12px] text-[#A3A3A3]">
                      Upgrade later to let agents change status and mark fixed.
                    </span>
                  )}
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[13px] font-medium text-[#171717]">Token</span>
                    <button
                      type="button"
                      onClick={() => copy("token", token)}
                      className="cursor-pointer text-[13px] font-medium underline-offset-2 hover:underline"
                    >
                      {copied === "token" ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <code className="block break-all rounded-lg bg-[#FAFAFA] p-3 text-xs text-[#171717]">
                    {token}
                  </code>
                </div>

                <div>
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
                      ? "Paste into Cursor Settings → MCP → mcp.json (or project .cursor/mcp.json)."
                      : "Paste into your Claude Code MCP config (claude_desktop_config / MCP servers)."}
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
                  className={`flex flex-col gap-3 rounded-[10px] border p-4 ${
                    testStatus === "ok"
                      ? "border-[#16A34A33] bg-[#F0FDF4]"
                      : testStatus === "fail"
                        ? "border-[#DA314A33] bg-[#FEF2F2]"
                        : "border-[#17171714] bg-[#FAFAFA]"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-ds-ui text-[13px] font-medium text-[#171717]">
                        {testStatus === "ok"
                          ? "Connection OK"
                          : testStatus === "fail"
                            ? "Connection failed"
                            : "Test connection"}
                      </p>
                      <p className="mt-0.5 font-ds-ui text-[12px] text-[#737373]">
                        {testMessage ||
                          "Calls initialize, tools/list, and list_open_feedback against your project."}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={testing}
                      onClick={testConnection}
                      className="inline-flex h-9 shrink-0 cursor-pointer items-center rounded-md border border-[#1717171F] bg-white px-3 text-[13px] font-medium text-[#171717] disabled:opacity-50"
                    >
                      {testing ? "Testing…" : testStatus === "ok" ? "Test again" : "Test connection"}
                    </button>
                  </div>
                </div>
              </>
            )}

            {error && <p className="text-sm text-[#DA314A]">{error}</p>}
          </div>

          <div className="flex items-center justify-end border-t border-[#17171714] bg-[#FAFAFA] px-8 py-4">
            <button
              type="button"
              onClick={() => router.push("/app/inbox")}
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md bg-[#171717] px-4 text-sm font-medium text-white"
            >
              Open inbox
              <span aria-hidden>→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Step({ n, label, active = false }: { n: number; label: string; active?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`flex h-[22px] w-[22px] items-center justify-center rounded-full font-ds-mono text-[11px] font-medium ${
          active ? "bg-[#171717] text-white" : "bg-white text-[#A3A3A3] outline outline-1 outline-[#1717171F]"
        }`}
      >
        {n}
      </span>
      <span className={`text-[13px] ${active ? "font-semibold text-[#171717]" : "font-medium text-[#A3A3A3]"}`}>
        {label}
      </span>
    </div>
  );
}

function StepDone({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#16A34A] text-[11px] text-white">
        ✓
      </span>
      <span className="text-[13px] font-medium text-[#171717]">{label}</span>
    </div>
  );
}
