"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CloseloopLogo } from "@/components/CloseloopLogo";
import { API_URL, api } from "@/lib/api";

export function ConnectMCP() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<"token" | "config" | "">("");
  const [error, setError] = useState("");

  const config = useMemo(
    () =>
      JSON.stringify(
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
      ),
    [token],
  );

  async function createToken() {
    const projectId = localStorage.getItem("closeloop_project");
    if (!projectId) {
      router.replace("/app/onboarding");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await api<{ token: string }>(`/api/projects/${projectId}/mcp-tokens`, {
        method: "POST",
      });
      setToken(res.token);
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
        <button
          type="button"
          onClick={() => router.push("/app/inbox")}
          className="cursor-pointer text-[13px] text-[#737373] hover:text-[#171717]"
        >
          Skip setup
        </button>
      </header>

      <div className="flex flex-1 justify-center px-4 py-14">
        <div className="w-full max-w-[640px] overflow-hidden rounded-2xl border border-[#17171714] bg-white shadow-[0_4px_4px_#1717170A]">
          <div className="flex flex-col gap-6 p-8">
            <div>
              <h1 className="font-ds-sans text-[26px] font-medium tracking-[-0.6px] text-[#171717]">
                Create a token
              </h1>
              <p className="mt-1.5 text-sm text-[#737373]">
                Copy it now — we store only a hash and can&apos;t show it again. You can rotate or revoke
                later in settings.
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
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[13px] font-medium text-[#171717]">Cursor / Claude config</span>
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
