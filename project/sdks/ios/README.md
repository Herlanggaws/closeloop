# Saidloop iOS SDK

In-app bug reports and feedback for iOS that your coding agent can fix via MCP.

Users shake the phone (or you call `Saidloop.show()`), the key window is captured with sensitive views masked, and the report lands in your Saidloop project with device, app version and screen context. Offline reports are queued on disk and sent when the network is back. Users can draw on the screenshot before sending.

- iOS 15+, Swift 5.9+
- Swift Package Manager and CocoaPods

## Install

### Swift Package Manager

In Xcode: **File → Add Package Dependencies…**, paste

```
https://github.com/XERV-Project/saidloop-ios
```

and add the `Saidloop` product to your app target.

Or in `Package.swift`:

```swift
dependencies: [
    .package(url: "https://github.com/XERV-Project/saidloop-ios", from: "0.1.0"),
],
targets: [
    .target(name: "MyApp", dependencies: [
        .product(name: "Saidloop", package: "saidloop-ios"),
    ]),
]
```

### CocoaPods

```ruby
pod 'Saidloop', :git => 'https://github.com/XERV-Project/saidloop-ios.git', :tag => '0.1.0'
```

Then run `pod install`.

## Quick start

Get your project's public key (`pk_…`) from the install page in the Saidloop dashboard.

```swift
import Saidloop

// App launch, e.g. in application(_:didFinishLaunchingWithOptions:)
Saidloop.start(key: "pk_…")

// After sign-in (all fields optional)
Saidloop.identify(userId: user.id, email: user.email, appVersion: "2.4.1")

// Open the report sheet yourself, or let users shake the phone
Saidloop.show()
```

### Masking

Text fields and text views are covered in screenshots by default. Hide any other view:

```swift
balanceLabel.closeloopMask = true
```

### Options

```swift
Saidloop.start(
    key: "pk_…",
    api: URL(string: "https://api.saidloop.com")!, // default; set it for a self-hosted API
    shakeToReport: true,   // false to only open the sheet with show()
    maskTextInputs: true   // false to stop masking text inputs automatically
)
```

## Modules

- `SaidloopCore`: Foundation only. Payload, offline queue, API client, shake detection.
- `Saidloop`: UIKit report sheet, screenshots with masking, CoreMotion shake, network monitoring to flush the queue.

With Swift Package Manager you only add the `Saidloop` product. CocoaPods ships both as one `Saidloop` module.

## Develop

```bash
swift test                     # SaidloopCore tests on macOS
xcodebuild -scheme Saidloop -destination 'generic/platform=iOS Simulator' build
```

`Example/` is a small UIKit app that uses the package from this folder. Pass `SAIDLOOP_KEY` and `SAIDLOOP_API` as environment variables when launching it (`SIMCTL_CHILD_SAIDLOOP_KEY=pk_… xcrun simctl launch …`).

## License

MIT. See [LICENSE](LICENSE).
