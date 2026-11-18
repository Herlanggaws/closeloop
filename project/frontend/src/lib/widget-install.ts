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
  web: "Drop this script on your site. Reports land in your Saidloop inbox with screenshot and context.",
  android: "Add the Kotlin SDK, then init with your public key. Shake or call show() to open the report sheet.",
  ios: "Add the Swift Package, then start with your public key. Shake or call show() to open the report sheet.",
  flutter: "Add the Flutter package; it forwards to the native Android and iOS SDKs.",
  "react-native": "Install the npm package; it wraps the native SDKs (Expo config plugin supported).",
};

export type InstallMethod =
  | "script"
  | "npm"
  | "android"
  | "ios"
  | "flutter"
  | "react-native";

export const INSTALL_METHOD_ORDER: InstallMethod[] = [
  "script",
  "npm",
  "android",
  "ios",
  "flutter",
  "react-native",
];

export const INSTALL_METHOD_LABELS: Record<InstallMethod, string> = {
  script: "Script tag",
  npm: "npm",
  android: "Android",
  ios: "iOS",
  flutter: "Flutter",
  "react-native": "RN",
};

export type InstallStep = {
  number: 1 | 2 | 3;
  title: string;
  description: string;
  fileLabel: string;
  code: string;
  tourTarget?: "install-script" | "install-mask";
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

export function methodsForPlatforms(platforms: string[]): InstallMethod[] {
  const methods: InstallMethod[] = [];
  if (platforms.includes("web")) {
    methods.push("script", "npm");
  }
  if (platforms.includes("android")) methods.push("android");
  if (platforms.includes("ios")) methods.push("ios");
  if (platforms.includes("flutter")) methods.push("flutter");
  if (platforms.includes("react-native")) methods.push("react-native");
  return methods.length > 0 ? methods : ["script"];
}

export function pickDefaultMethod(methods: InstallMethod[]): InstallMethod {
  if (methods.includes("script")) return "script";
  return methods[0] ?? "script";
}

export function platformLabelForMethod(method: InstallMethod): string {
  if (method === "script" || method === "npm") return "Web";
  if (method === "react-native") return "React Native";
  return INSTALL_METHOD_LABELS[method];
}

export function isWebInstallMethod(method: InstallMethod): boolean {
  return method === "script" || method === "npm";
}

export function widgetScriptBase(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_WIDGET_CDN_URL || "").replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost:3000";
}

function keyOrPlaceholder(publicKey: string): string {
  return publicKey || "pk_…";
}

function buildAddSnippet(method: InstallMethod, publicKey: string): { fileLabel: string; code: string; description: string } {
  const key = keyOrPlaceholder(publicKey);
  const origin = widgetScriptBase();

  switch (method) {
    case "npm":
      return {
        fileLabel: "app.ts",
        description:
          "Install the package, then init early in your app. It's under 30 KB gzipped and loads the replay module only if enabled.",
        code: `npm install @closeloop/widget

import { Saidloop } from "@closeloop/widget";

Saidloop.init({ key: "${key}", api: "${API_URL}" });`,
      };
    case "android":
      return {
        fileLabel: "build.gradle.kts",
        description: "Add the Kotlin SDK, then init with your public key in Application.onCreate.",
        code: `implementation("ai.closeloop:sdk:0.1.0")

// Application.onCreate
Saidloop.init(this, "${key}")`,
      };
    case "ios":
      return {
        fileLabel: "AppDelegate.swift",
        description: "Add the Swift Package, then start with your public key.",
        code: `// Package.swift / Xcode → Add Package
// https://github.com/closeloop/closeloop-ios

import Saidloop

Saidloop.start(key: "${key}")`,
      };
    case "flutter":
      return {
        fileLabel: "pubspec.yaml",
        description: "Add the Flutter package; it forwards to the native Android and iOS SDKs.",
        code: `dependencies:
  closeloop: ^0.1.0

// main.dart
await Saidloop.init(key: "${key}");`,
      };
    case "react-native":
      return {
        fileLabel: "App.tsx",
        description: "Install the npm package; it wraps the native SDKs (Expo config plugin supported).",
        code: `npm install @closeloop/react-native

import { Saidloop } from "@closeloop/react-native";

Saidloop.init({ key: "${key}" });`,
      };
    case "script":
    default:
      return {
        fileLabel: "index.html",
        description:
          "Paste before </body>. It's under 30 KB gzipped and loads the replay module only if enabled.",
        code: `<script src="${origin}/w.js"
  data-key="${key}" data-api="${API_URL}" async></script>`,
      };
  }
}

function buildIdentifySnippet(method: InstallMethod): { fileLabel: string; code: string } {
  switch (method) {
    case "android":
      return {
        fileLabel: "MainActivity.kt",
        code: `Saidloop.identify(userId = user.id, email = user.email, appVersion = "2.4.1")`,
      };
    case "ios":
      return {
        fileLabel: "Session.swift",
        code: `Saidloop.identify(userId: user.id, email: user.email, appVersion: "2.4.1")`,
      };
    case "flutter":
      return {
        fileLabel: "main.dart",
        code: `Saidloop.identify(userId: user.id, email: user.email, appVersion: "2.4.1");`,
      };
    case "react-native":
      return {
        fileLabel: "App.tsx",
        code: `Saidloop.identify({ userId: user.id, email: user.email, appVersion: "2.4.1" });`,
      };
    case "npm":
    case "script":
    default:
      return {
        fileLabel: "app.ts",
        code: `Saidloop.identify({ userId: user.id, email: user.email, appVersion: "2.4.1" })`,
      };
  }
}

function buildMaskSnippet(method: InstallMethod): { fileLabel: string; code: string } {
  switch (method) {
    case "android":
      return {
        fileLabel: "BalanceView.kt",
        code: `// Mark the view before capture
view.closeloopMask = true`,
      };
    case "ios":
      return {
        fileLabel: "BalanceView.swift",
        code: `// Mark the view before capture
view.closeloopMask = true`,
      };
    case "flutter":
      return {
        fileLabel: "balance.dart",
        code: `SaidloopMask(
  child: Text(formatIDR(balance)),
)`,
      };
    case "react-native":
      return {
        fileLabel: "Balance.tsx",
        code: `<SaidloopMask>
  <Text>{formatIDR(balance)}</Text>
</SaidloopMask>`,
      };
    case "npm":
    case "script":
    default:
      return {
        fileLabel: "Balance.tsx",
        code: `<span data-closeloop-mask>{formatIDR(balance)}</span>`,
      };
  }
}

export function buildInstallSteps(method: InstallMethod, publicKey: string): InstallStep[] {
  const add = buildAddSnippet(method, publicKey);
  const identify = buildIdentifySnippet(method);
  const mask = buildMaskSnippet(method);

  return [
    {
      number: 1,
      title: "Add the widget",
      description: add.description,
      fileLabel: add.fileLabel,
      code: add.code,
      tourTarget: "install-script",
    },
    {
      number: 2,
      title: "Identify the user",
      description:
        "Tie reports to an account and a release so you can reply and spot regressions.",
      fileLabel: identify.fileLabel,
      code: identify.code,
    },
    {
      number: 3,
      title: "Mask sensitive elements",
      description:
        "Anything with this attribute is blurred on the device before the screenshot leaves it.",
      fileLabel: mask.fileLabel,
      code: mask.code,
      tourTarget: "install-mask",
    },
  ];
}

export function buildSnippet(platform: string, publicKey: string): string {
  const key = keyOrPlaceholder(publicKey);
  const origin = widgetScriptBase();

  switch (platform) {
    case "android":
      return `// build.gradle.kts
implementation("ai.closeloop:sdk:0.1.0")

// Application.onCreate
Saidloop.init(this, "${key}")
Saidloop.identify(userId = "user_123", appVersion = "1.0.0")
// Saidloop.show() // or enable shake`;
    case "ios":
      return `// Package.swift / Xcode → Add Package
// https://github.com/closeloop/closeloop-ios

import Saidloop

Saidloop.start(key: "${key}")
Saidloop.identify(userId: "user_123", appVersion: "1.0.0")
// Saidloop.show() // or enable shake`;
    case "flutter":
      return `# pubspec.yaml
dependencies:
  closeloop: ^0.1.0

// main.dart
await Saidloop.init(key: "${key}");
Saidloop.identify(userId: "user_123", appVersion: "1.0.0");
// Saidloop.show();`;
    case "react-native":
      return `npm install @closeloop/react-native

import { Saidloop } from "@closeloop/react-native";

Saidloop.init({ key: "${key}" });
Saidloop.identify({ userId: "user_123", appVersion: "1.0.0" });
// Saidloop.show();`;
    case "web":
    default:
      return `<script src="${origin}/w.js" data-key="${key}" data-api="${API_URL}" async></script>`;
  }
}
