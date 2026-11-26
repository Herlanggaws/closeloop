// Mobile SDK setup shown on the Integrations page. Snippets mirror the README of each
// SDK in project/sdks/*; keep them in sync when an SDK's public API changes.

export type MobileSdkId = "ios" | "android" | "flutter" | "react-native";

export const MOBILE_SDK_ORDER: MobileSdkId[] = ["ios", "android", "flutter", "react-native"];

/** Default ingest API baked into every SDK. Snippets only pass `api` when it differs. */
export const SDK_DEFAULT_API = "https://api.saidloop.com";

/**
 * Flip to true once @saidloop/react-native is on npm. Until then the tab shows "Soon"
 * and no install command, so nobody copies an `npm install` that 404s.
 */
export const REACT_NATIVE_PUBLISHED = false;

export type MobileSdkStep = {
  title: string;
  description: string;
  fileLabel: string;
  code: string;
};

export type MobileSdkGuide = {
  id: MobileSdkId;
  label: string;
  summary: string;
  repoUrl: string;
  available: boolean;
  /** Install, init with the project key, open the report sheet. Empty when not available. */
  steps: MobileSdkStep[];
};

function keyOrPlaceholder(publicKey: string): string {
  return publicKey || "pk_…";
}

function customApi(api: string | undefined): string | null {
  const trimmed = (api || "").replace(/\/$/, "");
  if (!trimmed || trimmed === SDK_DEFAULT_API) return null;
  return trimmed;
}

const IOS_POD = `pod 'Saidloop', :git => 'https://github.com/XERV-Project/saidloop-ios.git', :tag => '0.1.0'`;

function iosGuide(key: string, api: string | null): MobileSdkGuide {
  const start = api
    ? `Saidloop.start(key: "${key}", api: URL(string: "${api}")!)`
    : `Saidloop.start(key: "${key}")`;
  return {
    id: "ios",
    label: "iOS",
    summary: "Swift Package for iOS 15+. Users shake the phone or you call show() to open the report sheet.",
    repoUrl: "https://github.com/XERV-Project/saidloop-ios",
    available: true,
    steps: [
      {
        title: "Install the SDK",
        description:
          "In Xcode: File → Add Package Dependencies, paste the URL and add the Saidloop product. CocoaPods works too: add the pod, then run pod install.",
        fileLabel: "Swift Package Manager",
        code: `https://github.com/XERV-Project/saidloop-ios  (from 0.1.0)

# Or with CocoaPods, in your Podfile
${IOS_POD}`,
      },
      {
        title: "Start with your public key",
        description: "Call start once at app launch.",
        fileLabel: "AppDelegate.swift",
        code: `import Saidloop

// application(_:didFinishLaunchingWithOptions:)
${start}`,
      },
      {
        title: "Open the feedback sheet",
        description: "Shake to report is on by default. Call show() to open it from your own button.",
        fileLabel: "SettingsView.swift",
        code: `// After sign-in (all fields optional)
Saidloop.identify(userId: user.id, email: user.email, appVersion: "2.4.1")

Saidloop.show()`,
      },
    ],
  };
}

function androidGuide(key: string, api: string | null): MobileSdkGuide {
  const init = api ? `Saidloop.init(this, "${key}", api = "${api}")` : `Saidloop.init(this, "${key}")`;
  return {
    id: "android",
    label: "Android",
    summary: "Kotlin SDK for minSdk 24, on Maven Central. Users shake the phone or you call show().",
    repoUrl: "https://github.com/XERV-Project/saidloop-android",
    available: true,
    steps: [
      {
        title: "Install the SDK",
        description: "It's on Maven Central, so the default mavenCentral() repository is enough.",
        fileLabel: "app/build.gradle.kts",
        code: `dependencies {
    implementation("com.saidloop:android:0.1.0")
}`,
      },
      {
        title: "Init with your public key",
        description: "Call init once in Application.onCreate.",
        fileLabel: "App.kt",
        code: `import com.saidloop.sdk.Saidloop

class App : Application() {
    override fun onCreate() {
        super.onCreate()
        ${init}
    }
}`,
      },
      {
        title: "Open the feedback sheet",
        description: "Shake to report is on by default. Call show() to open it from your own button.",
        fileLabel: "MainActivity.kt",
        code: `// After sign-in (all fields optional)
Saidloop.identify(userId = user.id, email = user.email, appVersion = "2.4.1")

Saidloop.show()`,
      },
    ],
  };
}

function flutterGuide(key: string, api: string | null): MobileSdkGuide {
  const init = api ? `await Saidloop.init(key: "${key}", api: "${api}");` : `await Saidloop.init(key: "${key}");`;
  return {
    id: "flutter",
    label: "Flutter",
    summary: "Flutter package on pub.dev. It forwards to the native Android and iOS SDKs.",
    repoUrl: "https://github.com/XERV-Project/saidloop-flutter",
    available: true,
    steps: [
      {
        title: "Install the package",
        description:
          "Add it to pubspec.yaml and run flutter pub get. On iOS, also add the pod inside the Runner target of ios/Podfile (iOS 15+), then pod install.",
        fileLabel: "pubspec.yaml",
        code: `dependencies:
  saidloop_flutter: ^0.1.0

# ios/Podfile, inside target 'Runner'
${IOS_POD}`,
      },
      {
        title: "Init with your public key",
        description: "Call init before runApp.",
        fileLabel: "main.dart",
        code: `import 'package:saidloop_flutter/saidloop_flutter.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  ${init}
  runApp(const MyApp());
}`,
      },
      {
        title: "Open the feedback sheet",
        description: "Shake to report is on by default. Call show() to open it from your own button.",
        fileLabel: "settings_page.dart",
        code: `// After sign-in (all fields optional)
Saidloop.identify(userId: user.id, email: user.email, appVersion: "2.4.1");

Saidloop.show();`,
      },
    ],
  };
}

function reactNativeGuide(key: string, api: string | null): MobileSdkGuide {
  const init = api ? `Saidloop.init({ key: "${key}", api: "${api}" });` : `Saidloop.init({ key: "${key}" });`;
  const base = {
    id: "react-native" as const,
    label: "React Native",
    summary: "Wraps the native Android and iOS SDKs. Works with Expo through a config plugin and a dev build.",
    repoUrl: "https://github.com/XERV-Project/saidloop-react-native",
  };
  if (!REACT_NATIVE_PUBLISHED) {
    return { ...base, available: false, steps: [] };
  }
  return {
    ...base,
    available: true,
    steps: [
      {
        title: "Install the package",
        description: "Install from npm. On iOS, also add the pod to ios/Podfile and run pod install.",
        fileLabel: "Terminal",
        code: `npm install @saidloop/react-native

# ios/Podfile
${IOS_POD}`,
      },
      {
        title: "Init with your public key",
        description: "Call init once when the app starts.",
        fileLabel: "App.tsx",
        code: `import { Saidloop } from "@saidloop/react-native";

${init}`,
      },
      {
        title: "Open the feedback sheet",
        description: "Shake to report is on by default. Call show() to open it from your own button.",
        fileLabel: "Settings.tsx",
        code: `// After sign-in (all fields optional)
Saidloop.identify({ userId: user.id, email: user.email, appVersion: "2.4.1" });

Saidloop.show();`,
      },
    ],
  };
}

export function buildMobileSdkGuides(publicKey: string, api?: string): MobileSdkGuide[] {
  const key = keyOrPlaceholder(publicKey);
  const apiOverride = customApi(api);
  const byId: Record<MobileSdkId, MobileSdkGuide> = {
    ios: iosGuide(key, apiOverride),
    android: androidGuide(key, apiOverride),
    flutter: flutterGuide(key, apiOverride),
    "react-native": reactNativeGuide(key, apiOverride),
  };
  return MOBILE_SDK_ORDER.map((id) => byId[id]);
}
