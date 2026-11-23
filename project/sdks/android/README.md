# Saidloop Android SDK

In-app bug reports and feedback for Android that your coding agent can fix via MCP.

Users shake the phone (or you call `Saidloop.show()`), the current screen is captured with sensitive views masked, and the report lands in your Saidloop project with device, app version and screen context. Offline reports are queued on disk and sent by WorkManager when the device is back online. Users can draw on the screenshot before sending.

- `minSdk` 24, Kotlin and Java
- Screenshots use PixelCopy on API 26+, `View.draw` below that

## Install

The SDK is on Maven Central, so the default `mavenCentral()` repository is enough.

```kotlin
// app/build.gradle.kts
dependencies {
    implementation("com.saidloop:android:0.1.0")
}
```

Groovy:

```groovy
implementation 'com.saidloop:android:0.1.0'
```

## Quick start

Get your project's public key (`pk_…`) from the install page in the Saidloop dashboard.

```kotlin
import com.saidloop.sdk.Saidloop

class App : Application() {
    override fun onCreate() {
        super.onCreate()
        Saidloop.init(this, "pk_…")
    }
}

// After sign-in (all fields optional)
Saidloop.identify(userId = user.id, email = user.email, appVersion = "2.4.1")

// Open the report sheet yourself, or let users shake the phone
Saidloop.show()
```

### Masking

`EditText`s are covered in screenshots by default. Hide any other view:

```kotlin
import com.saidloop.sdk.saidloopMask

balanceView.saidloopMask = true
```

### Options

```kotlin
Saidloop.init(
    this,
    "pk_…",
    api = "https://api.saidloop.com", // default; set it for a self-hosted API
    shakeToReport = true,             // false to only open the sheet with show()
    maskTextInputs = true,            // false to stop masking EditTexts automatically
)
```

Reports are sent with `platform: "android"` to the same ingest API as the web widget.

## Develop

```bash
./gradlew :sdk:testDebugUnitTest :sdk:assembleRelease
./gradlew :sample:installDebug -Psaidloop.key=pk_… -Psaidloop.api=http://10.0.2.2:8080
./gradlew :sdk:publishToMavenLocal   # com.saidloop:android in ~/.m2, used by the Flutter and React Native wrappers
```

`sample/` is a small app that uses the SDK from this folder.

### Release to Maven Central

1. Bump `VERSION_NAME` in `gradle.properties`.
2. Put the Central Portal token and the signing key in `~/.gradle/gradle.properties` (never in this repo):
   ```properties
   mavenCentralUsername=…
   mavenCentralPassword=…
   signingInMemoryKey=…          # ASCII-armored GPG private key
   signingInMemoryKeyPassword=…
   ```
3. `./gradlew :sdk:publishAndReleaseToMavenCentral`
4. Tag the release with the same plain version (`0.1.0`).

## License

MIT. See [LICENSE](LICENSE).
