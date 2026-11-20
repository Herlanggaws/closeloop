# Saidloop Android SDK

Native report sheet for Android (S-22): shake or call `show()`, the current screen is captured with sensitive views masked, and the report is queued on disk and sent by WorkManager when the device is online.

```kotlin
// build.gradle.kts
implementation("ai.closeloop:sdk:0.1.0")

// Application.onCreate
Saidloop.init(this, "pk_…", api = "https://<your API host>")
Saidloop.identify(userId = user.id, email = user.email, appVersion = "2.4.1")

// Open the sheet yourself, or let users shake the phone
Saidloop.show()

// Hide a view in screenshots (EditTexts are masked by default)
balanceView.closeloopMask = true
```

- `minSdk` 24. Screenshots use PixelCopy on API 26+, `View.draw` below that.
- Shake detection can be turned off: `Saidloop.init(this, key, shakeToReport = false)`.
- Reports are sent with `platform: "android"` to the same ingest API as the web widget.

## Develop

```bash
./gradlew :sdk:testDebugUnitTest :sdk:assembleRelease
./gradlew :sample:installDebug -Psaidloop.key=pk_… -Psaidloop.api=http://10.0.2.2:8080
```

Users can draw on the screenshot before sending (tap the thumbnail).

Not done yet: publishing to Maven Central.
