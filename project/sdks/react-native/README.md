# Saidloop for React Native

Forwards to the native Saidloop SDKs (`project/sdks/android`, `project/sdks/ios`).

```tsx
import { Saidloop, SaidloopMask } from "@closeloop/react-native";

Saidloop.init({ key: "pk_…", api: "https://<your API host>" });
Saidloop.identify({ userId: user.id, email: user.email, appVersion: "2.4.1" });
Saidloop.show(); // or shake

<SaidloopMask><Text>{formatIDR(balance)}</Text></SaidloopMask>
```

Expo: add `"plugins": ["@closeloop/react-native"]` (sets Android minSdk 24 and iOS 15), then make a dev build.

## Develop (before the native SDKs are published)

- Android: `(cd ../android && ./gradlew :sdk:publishToMavenLocal)` and add `mavenLocal()` to the app's `allprojects.repositories`.
- iOS: in the app Podfile, `pod 'Saidloop', :path => '<repo>/project/sdks/ios'`.
- `npm test` runs the JS tests.

Tested on an Android emulator with a React Native 0.76 app (bridgeless): report sent, `SaidloopMask` covered, offline queue flushed. iOS builds and launches but the report flow was not tested yet.
