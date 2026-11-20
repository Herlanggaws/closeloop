# Saidloop iOS SDK

Native report sheet for iOS (S-22): shake or call `show()`, the key window is captured with sensitive views covered, and reports are queued on disk and sent when the network is back.

```swift
// Xcode → Add Package → this repo, product "Saidloop"
import Saidloop

// App launch
Saidloop.start(key: "pk_…", api: URL(string: "https://<your API host>")!)
Saidloop.identify(userId: user.id, email: user.email, appVersion: "2.4.1")

// Open the sheet yourself, or let users shake the phone
Saidloop.show()

// Hide a view in screenshots (text fields and text views are masked by default)
balanceLabel.closeloopMask = true
```

- iOS 15+. Two targets: `SaidloopCore` (Foundation only: payload, offline queue, API client, shake detection) and `Saidloop` (UIKit sheet, screenshots, CoreMotion shake, NWPathMonitor flush).
- Shake detection can be turned off: `Saidloop.start(key:api:shakeToReport: false)`.

## Develop

```bash
swift test                     # SaidloopCore tests on macOS
xcodebuild -scheme Saidloop -destination 'generic/platform=iOS Simulator' build
```

`Example/` is a tiny UIKit app that uses the package. Pass `SAIDLOOP_KEY` and `SAIDLOOP_API` as environment variables when launching it (`SIMCTL_CHILD_SAIDLOOP_KEY=pk_… xcrun simctl launch …`).

Users can draw on the screenshot before sending (tap the thumbnail).

Not done yet: a separate release repo for Swift Package Manager.
