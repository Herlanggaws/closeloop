"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CloseloopLogo } from "@/components/CloseloopLogo";
import { API_URL, api } from "@/lib/api";

const PLATFORM_ORDER = ["web", "android", "ios", "flutter", "react-native"] as const;

const PLATFORM_LABELS: Record<string, string> = {
  web: "Web",
  android: "Android",
  ios: "iOS",
  flutter: "Flutter",
  "react-native": "React Native",
};

const PLATFORM_SUBTITLES: Record<string, string> = {
  web: "Drop this script on your site. Reports land in your Closeloop inbox with screenshot and context.",
  android: "Add the Kotlin SDK, then init with your public key. Shake or call show() to open the report sheet.",
  ios: "Add the Swift Package, then start with your public key. Shake or call show() to open the report sheet.",
  flutter: "Add the Flutter package; it forwards to the native Android and iOS SDKs.",
  "react-native": "Install the npm package; it wraps the native SDKs (Expo config plugin supported).",
};

type ProjectResponse = {
  public_key: string;
  project: { platforms?: string[] };
};

function normalizePlatforms(raw: string[] | null | undefined): string[] {
  if (!raw || raw.length === 0) return ["web"];
  const known = PLATFORM_ORDER.filter((id) => raw.includes(id));
  return known.length > 0 ? [...known] : ["web"];
}

function readCachedPlatforms(): string[] {
  try {
    const raw = localStorage.getItem("closeloop_platforms");
    if (!raw) return ["web"];
    return normalizePlatforms(JSON.parse(raw) as string[]);
  } catch {
    return ["web"];
  }
}

function pickDefaultPlatform(platforms: string[]): string {
  if (platforms.includes("web")) return "web";
  return platforms[0] ?? "web";
}

function buildSnippet(platform: string, publicKey: string): string {
  const key = publicKey || "pk_…";
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

  switch (platform) {
    case "android":
      return `// build.gradle.kts
implementation("ai.closeloop:sdk:0.1.0")

// Application.onCreate
Closeloop.init(this, "${key}")
Closeloop.identify(userId = "user_123", appVersion = "1.0.0")
// Closeloop.show() // or enable shake`;
    case "ios":
      return `// Package.swift / Xcode → Add Package
// https://github.com/closeloop/closeloop-ios

import Closeloop

Closeloop.start(key: "${key}")
Closeloop.identify(userId: "user_123", appVersion: "1.0.0")
// Closeloop.show() // or enable shake`;
    case "flutter":
      return `# pubspec.yaml
dependencies:
  closeloop: ^0.1.0

// main.dart
await Closeloop.init(key: "${key}");
Closeloop.identify(userId: "user_123", appVersion: "1.0.0");
// Closeloop.show();`;
    case "react-native":
      return `npm install @closeloop/react-native

import { Closeloop } from "@closeloop/react-native";

Closeloop.init({ key: "${key}" });
Closeloop.identify({ userId: "user_123", appVersion: "1.0.0" });
// Closeloop.show();`;
    case "web":
    default:
      return `<script src="${origin}/w.js" data-key="${key}" data-api="${API_URL}" async></script>`;
  }
}

export function InstallWidget() {
  const router = useRouter();
  const [publicKey, setPublicKey] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(["web"]);
  const [activePlatform, setActivePlatform] = useState("web");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const cachedKey = localStorage.getItem("closeloop_public_key");
    const cachedPlatforms = readCachedPlatforms();
    if (cachedKey) setPublicKey(cachedKey);
    setPlatforms(cachedPlatforms);
    setActivePlatform(pickDefaultPlatform(cachedPlatforms));

    const projectId = localStorage.getItem("closeloop_project");
    if (!projectId) {
      if (!cachedKey) router.replace("/app/onboarding");
      return;
    }

    api<ProjectResponse>(`/api/projects/${projectId}`)
      .then((res) => {
        setPublicKey(res.public_key);
        localStorage.setItem("closeloop_public_key", res.public_key);
        const next = normalizePlatforms(res.project.platforms);
        setPlatforms(next);
        localStorage.setItem("closeloop_platforms", JSON.stringify(next));
        setActivePlatform((current) =>
          next.includes(current) ? current : pickDefaultPlatform(next),
        );
      })
      .catch(() => {
        if (!cachedKey) router.replace("/app/onboarding");
      });
  }, [router]);

  const snippet = useMemo(
    () => buildSnippet(activePlatform, publicKey),
    [activePlatform, publicKey],
  );

  const webOnly = platforms.length === 1 && platforms[0] === "web";
  const title = webOnly ? "Install the widget" : "Install Closeloop";
  const subtitle = PLATFORM_SUBTITLES[activePlatform] ?? PLATFORM_SUBTITLES.web;
  const showTabs = platforms.length > 1;

  async function copySnippet() {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="box-border flex min-h-screen w-full flex-col bg-[#F7F7F7]">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#17171714] bg-white px-8">
        <CloseloopLogo />
        <nav className="flex items-center gap-2 text-[13px]">
          <StepDone label="Create project" />
          <span className="h-px w-10 bg-[#1717171F]" />
          <Step n={2} label="Install" active />
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
        <div className="w-full max-w-[640px] overflow-hidden rounded-2xl border border-[#17171714] bg-white shadow-[0_4px_4px_#1717170A]">
          <div className="flex flex-col gap-6 p-8">
            <div>
              <h1 className="font-ds-sans text-[26px] font-medium tracking-[-0.6px] text-[#171717]">
                {title}
              </h1>
              <p className="mt-1.5 text-sm text-[#737373]">{subtitle}</p>
            </div>

            {showTabs && (
              <div className="flex flex-wrap gap-1.5 rounded-[10px] bg-[#F5F5F5] p-1">
                {platforms.map((id) => {
                  const active = id === activePlatform;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setActivePlatform(id);
                        setCopied(false);
                      }}
                      className={`cursor-pointer rounded-md px-3 py-1.5 text-[13px] font-medium transition ${
                        active
                          ? "bg-white text-[#171717] shadow-[0_1px_2px_#17171714]"
                          : "text-[#737373] hover:text-[#171717]"
                      }`}
                    >
                      {PLATFORM_LABELS[id] ?? id}
                    </button>
                  );
                })}
              </div>
            )}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[13px] font-medium text-[#171717]">
                  {activePlatform === "web" ? "Snippet" : "Install"}
                </span>
                <button
                  type="button"
                  onClick={copySnippet}
                  className="cursor-pointer text-[13px] font-medium text-[#171717] underline-offset-2 hover:underline"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-[#0A0A0A] p-4 text-xs leading-relaxed text-[#86EFAC]">
                {snippet}
              </pre>
              <p className="mt-2 text-xs text-[#A3A3A3]">Public key: {publicKey || "…"}</p>
            </div>

            {activePlatform === "web" && (
              <div className="rounded-[10px] border border-[#17171714] bg-[#FAFAFA] p-4 text-sm text-[#737373]">
                Demo page:{" "}
                <a
                  className="font-medium text-[#171717] underline"
                  href={`/demo.html?key=${encodeURIComponent(publicKey)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  /demo.html?key=…
                </a>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end border-t border-[#17171714] bg-[#FAFAFA] px-8 py-4">
            <button
              type="button"
              onClick={() => router.push("/app/mcp")}
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md bg-[#171717] px-4 text-sm font-medium text-white"
            >
              Continue to agent setup
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
