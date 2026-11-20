# Saidloop for Flutter

Forwards to the native Saidloop SDKs (`project/sdks/android`, `project/sdks/ios`): users shake the phone or you call `Saidloop.show()`, the screen is attached with sensitive widgets hidden, and reports made offline are sent when the connection returns.

```yaml
dependencies:
  closeloop: ^0.1.0
```

```dart
await Saidloop.init(key: "pk_…", api: "https://<your API host>");
Saidloop.identify(userId: user.id, email: user.email, appVersion: "2.4.1");
Saidloop.show(); // or shake

SaidloopMask(child: Text(formatIDR(balance))) // hidden in screenshots
```

Flutter widgets are not native views, so `SaidloopMask` sends its on-screen rectangle to the native SDK.

## Develop (before the native SDKs are published)

```bash
# Android SDK into ~/.m2 (the plugin reads mavenLocal)
(cd ../android && ./gradlew :sdk:publishToMavenLocal)

flutter test
cd example
flutter run --dart-define=SAIDLOOP_KEY=pk_… --dart-define=SAIDLOOP_API=http://10.0.2.2:8080
```

The example's iOS Podfile points `pod 'Saidloop'` at `../../../ios`.

Not done yet: publishing to pub.dev (needs the native SDKs on Maven Central and CocoaPods first).
