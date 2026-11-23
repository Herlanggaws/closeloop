# Saidloop for Flutter

In-app bug reports and feedback for Flutter apps that your coding agent can fix via MCP.

Users shake the phone (or you call `Saidloop.show()`), the screen is captured with sensitive widgets masked, and the report lands in your Saidloop project with device, app version and screen context. Offline reports are queued and sent when the network is back.

This package forwards to the native Saidloop SDKs:

- iOS: [saidloop-ios](https://github.com/XERV-Project/saidloop-ios) (iOS 15+)
- Android: the Saidloop Android SDK (minSdk 24)

## Install

```yaml
dependencies:
  saidloop_flutter: ^0.1.0
```

Then `flutter pub get`.

### iOS

The native iOS SDK is not on CocoaPods trunk yet, so point your app's `ios/Podfile` at the release repo, inside the `Runner` target:

```ruby
target 'Runner' do
  use_frameworks!
  flutter_install_all_ios_pods File.dirname(File.realpath(__FILE__))
  pod 'Saidloop', :git => 'https://github.com/XERV-Project/saidloop-ios.git', :tag => '0.1.0'
end
```

Set `platform :ios, '15.0'` (or higher) at the top of the Podfile, then `cd ios && pod install`.

### Android

The native Android SDK (`com.saidloop:android`) is not on Maven Central yet. Until it is, Android builds need it in your local Maven repository (`mavenLocal()`). This section will be replaced with a one-line install once it is published.

## Quick start

Get your project's public key (`pk_…`) from the install page in the Saidloop dashboard.

```dart
import 'package:saidloop_flutter/saidloop_flutter.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Saidloop.init(key: "pk_…");
  runApp(const MyApp());
}

// After sign-in (all fields optional)
Saidloop.identify(userId: user.id, email: user.email, appVersion: "2.4.1");

// Open the report sheet yourself, or let users shake the phone
Saidloop.show();
```

### Masking

Text inputs are covered in screenshots by default. Hide any other widget:

```dart
SaidloopMask(
  child: Text(formatIDR(balance)),
)
```

Flutter widgets are not native views, so `SaidloopMask` sends its on-screen rectangle to the native SDK just before a screenshot.

### Options

```dart
await Saidloop.init(
  key: "pk_…",
  api: "https://api.saidloop.com", // default; set it for a self-hosted API
  shakeToReport: true,             // false to only open the sheet with show()
  maskTextInputs: true,            // false to stop masking text inputs automatically
);
```

`init` only accepts a public key (`pk_…`). Never put a secret key in your app.

## Example

`example/` is a small app that uses the package:

```bash
cd example
flutter run --dart-define=SAIDLOOP_KEY=pk_… --dart-define=SAIDLOOP_API=http://10.0.2.2:8080
```

## Develop

```bash
flutter test
```

## License

MIT, see [LICENSE](LICENSE).
