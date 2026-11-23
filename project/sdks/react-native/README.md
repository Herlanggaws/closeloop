# Saidloop for React Native

In-app bug reports and feedback for React Native apps that your coding agent can fix via MCP.

Users shake the phone (or you call `Saidloop.show()`), the screen is captured with sensitive views masked, and the report lands in your Saidloop project with device, app version and screen context. Offline reports are queued and sent when the network is back. This package is a thin wrapper over the native Saidloop Android and iOS SDKs.

- React Native (tested on 0.76, bridgeless) and Expo (config plugin + dev build)
- Android minSdk 24, iOS 15+

## Install

```bash
npm install @saidloop/react-native
# or
yarn add @saidloop/react-native
```

### Native SDKs (early access)

The native SDKs are not on Maven Central or the CocoaPods trunk yet, so the app has to point at them for now:

- **iOS**: add the Saidloop pod to your app's `ios/Podfile`, then run `pod install`:

  ```ruby
  pod 'Saidloop', :git => 'https://github.com/XERV-Project/saidloop-ios.git', :tag => '0.1.0'
  ```

- **Android**: the module depends on `com.saidloop:android:0.1.0` and resolves it from `mavenLocal()`. Until it is published, run `./gradlew publishToMavenLocal` in the Saidloop Android SDK and add `mavenLocal()` to your app's repositories.

This section goes away once the native SDKs are published.

### Expo

Add the config plugin to `app.json`, then make a dev build (Expo Go can't load native modules):

```json
{
  "expo": {
    "plugins": ["@saidloop/react-native"]
  }
}
```

The plugin raises Android minSdk to 24 and the iOS deployment target to 15 when they are lower. It never lowers them.

## Quick start

Get your project's public key (`pk_…`) from the install page in the Saidloop dashboard.

```tsx
import { Saidloop, SaidloopMask } from "@saidloop/react-native";

// App start
Saidloop.init({ key: "pk_…" });

// After sign-in (all fields optional)
Saidloop.identify({ userId: user.id, email: user.email, appVersion: "2.4.1" });

// Open the report sheet yourself, or let users shake the phone
Saidloop.show();
```

### Masking

Text inputs are covered in screenshots by default. Wrap anything else you want hidden:

```tsx
<SaidloopMask>
  <Text>{formatBalance(balance)}</Text>
</SaidloopMask>
```

### Options

```tsx
Saidloop.init({
  key: "pk_…",
  api: "https://api.saidloop.com", // default; set it for a self-hosted API
  shakeToReport: true,             // false to only open the sheet with show()
  maskTextInputs: true,            // false to stop masking text inputs automatically
});
```

## Develop

```bash
npm install
npm test           # JS tests
npm run typecheck
```

## License

MIT. See [LICENSE](LICENSE).
