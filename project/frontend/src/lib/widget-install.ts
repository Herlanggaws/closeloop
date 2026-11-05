import { API_URL } from "@/lib/api";

export const PLATFORM_ORDER = ["web", "android", "ios", "flutter", "react-native"] as const;

export const PLATFORM_LABELS: Record<string, string> = {
  web: "Web",
  android: "Android",
  ios: "iOS",
  flutter: "Flutter",
  "react-native": "React Native",
};

export const PLATFORM_SUBTITLES: Record<string, string> = {
  web: "Drop this script on your site. Reports land in your Closeloop inbox with screenshot and context.",
  android: "Add the Kotlin SDK, then init with your public key. Shake or call show() to open the report sheet.",
  ios: "Add the Swift Package, then start with your public key. Shake or call show() to open the report sheet.",
  flutter: "Add the Flutter package; it forwards to the native Android and iOS SDKs.",
  "react-native": "Install the npm package; it wraps the native SDKs (Expo config plugin supported).",
};

export function normalizePlatforms(raw: string[] | null | undefined): string[] {
  if (!raw || raw.length === 0) return ["web"];
  const known = PLATFORM_ORDER.filter((id) => raw.includes(id));
  return known.length > 0 ? [...known] : ["web"];
}

export function readCachedPlatforms(): string[] {
  try {
    const raw = localStorage.getItem("closeloop_platforms");
    if (!raw) return ["web"];
    return normalizePlatforms(JSON.parse(raw) as string[]);
  } catch {
    return ["web"];
  }
}

export function pickDefaultPlatform(platforms: string[]): string {
  if (platforms.includes("web")) return "web";
  return platforms[0] ?? "web";
}

export function buildSnippet(platform: string, publicKey: string): string {
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
