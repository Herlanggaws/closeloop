"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CloseloopLogo } from "@/components/CloseloopLogo";
import { api } from "@/lib/api";

const PLATFORMS = [
  { id: "web", label: "Web", hint: "Script tag or npm" },
  { id: "android", label: "Android", hint: "Kotlin · Maven Central" },
  { id: "ios", label: "iOS", hint: "Swift Package" },
  { id: "flutter", label: "Flutter", hint: "pub.dev package" },
  { id: "react-native", label: "React Native", hint: "npm · Expo supported" },
] as const;

export function CreateProject() {
  const router = useRouter();
  const [name, setName] = useState("Bear Budget Web");
  const [selected, setSelected] = useState<string[]>(["web"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("closeloop_project")) {
      router.replace("/app/install");
      return;
    }
    setReady(true);
  }, [router]);

  function togglePlatform(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }

  async function onContinue() {
    if (!name.trim() || selected.length === 0) {
      setError("Name and at least one platform are required.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await api<{ project: { id: string }; public_key: string }>("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), platforms: selected }),
      });
      localStorage.setItem("closeloop_project", res.project.id);
      localStorage.setItem("closeloop_public_key", res.public_key);
      localStorage.setItem("closeloop_platforms", JSON.stringify(selected));
      router.push("/app/install");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create project");
    } finally {
      setLoading(false);
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
          <Step n={1} label="Create project" active />
          <span className="h-px w-10 bg-[#1717171F]" />
          <Step n={2} label="Install" />
          <span className="h-px w-10 bg-[#1717171F]" />
          <Step n={3} label="Connect agent" />
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
        <div className="w-full max-w-[600px] overflow-hidden rounded-2xl border border-[#17171714] bg-white shadow-[0_4px_4px_#1717170A]">
          <div className="flex flex-col gap-6 p-8">
            <div>
              <h1 className="font-ds-sans text-[26px] font-medium tracking-[-0.6px] text-[#171717]">
                Create your first project
              </h1>
              <p className="mt-1.5 text-sm text-[#737373]">
                One project per app. Each gets its own inbox, public key and MCP token.
              </p>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-[#171717]">Project name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-10 rounded-md border border-[#1717171F] px-3 text-sm outline-none focus:border-[#171717]"
                placeholder="My app"
              />
            </label>

            <div>
              <p className="mb-2.5 text-[13px] font-medium text-[#171717]">Where does your app run?</p>
              <div className="grid grid-cols-3 gap-2.5">
                {PLATFORMS.map((p) => {
                  const on = selected.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePlatform(p.id)}
                      className={`cursor-pointer rounded-[10px] p-3.5 text-left transition ${
                        on
                          ? "bg-[#FAFAFA] outline outline-[1.5px] outline-[#171717]"
                          : "bg-white outline outline-1 outline-[#1717171F] hover:bg-[#FAFAFA]"
                      }`}
                    >
                      <div className="mb-3 flex justify-end">
                        <span
                          className={`flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10px] text-white ${
                            on ? "bg-[#171717]" : "bg-transparent outline outline-1 outline-[#1717171F]"
                          }`}
                        >
                          {on ? "✓" : ""}
                        </span>
                      </div>
                      <div className="text-sm font-semibold text-[#171717]">{p.label}</div>
                      <div className="text-xs text-[#A3A3A3]">{p.hint}</div>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-[#A3A3A3]">You can add more platforms to this project later.</p>
            </div>

            {error && <p className="text-sm text-[#DA314A]">{error}</p>}
          </div>

          <div className="flex items-center justify-between border-t border-[#17171714] bg-[#FAFAFA] px-8 py-4">
            <span className="text-xs text-[#A3A3A3]">Free plan · 1 of 1 projects</span>
            <button
              type="button"
              disabled={loading}
              onClick={onContinue}
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md bg-[#171717] px-4 text-sm font-medium text-white shadow-[0_4px_4px_#1717170A] disabled:opacity-50"
            >
              {loading ? "Creating…" : "Continue"}
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
