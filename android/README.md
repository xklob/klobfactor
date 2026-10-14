# Vulcan Tech Gospel (Trainer)

Website: **[vulcantech.klob.io](https://vulcantech.klob.io)**

Native Android lesson navigation, search, practice records, settings, and local source-video playback. The 3D renderer, motion lab, and reference diagrams are shared with the web app and run from bundled assets in Android WebView.

- Package: `app.segfaultlabs.vulcan_tech_trainer`
- Android 9 or later, with an up-to-date Android System WebView.
- All 21 lessons and 150 sections, including the full descriptions, grip and stance cues, steps, source times, setup notes, and limitations.
- Offline prop diagrams and static references, free camera, thumb/pinky end markers, independent staff visibility, expanded view, seeking, stepping, speed, loops, and automatic advancement.
- 3D studies are the default lesson view; source demonstrations are one tab away. Native local video playback includes seeking, quarter-second steps, speed, segment loops, automatic advancement, and a same-frame close-up. Choose a downloaded video using Android's file picker. Access survives restarts when the provider supports persistent access.
- Saved progress, last section, dark/light mode, keep-screen-awake, and optional maximum brightness while practicing.
- The motion lab, VTG relationships, glossary, source list, and diagram limits are bundled unchanged from the web build.

The app requests no Internet access or broad storage permission. YouTube and the original poster open in a separate browser. Source videos are not included. The diagrams show prop geometry and stationary references. The unreliable human animation has been withdrawn; a full-body 3D trainer is still unfinished. Source-only movements and discrete studies retain the same scope as the website.

## Build

Use Node.js 22+, Java 17, Android SDK 36, and the included Gradle wrapper:

```sh
# Repository root
npm ci
cd android
ANDROID_HOME=/path/to/Android/Sdk ./gradlew testDebugUnitTest lintDebug assembleDebug
```

`prepareTrainerAssets` builds the website and copies its complete output into generated Android assets. It also writes a curriculum hash and verifies the expected lesson/section counts. Generated assets are not checked into Git. Changes to the curriculum or renderer flow into the next Android build automatically.

## Device checks

The runner uses FFmpeg to generate its disposable test video. It accepts only an explicitly selected emulator and clears only this app's debug data:

```sh
cd android
./gradlew assembleDebug assembleDebugAndroidTest
cd ..
python3 scripts/run-android-device-tests.py --serial emulator-5560
```

For a Windows emulator from WSL, pass `--adb /mnt/c/.../platform-tools/adb.exe --stage /mnt/c/.../Temp/vulcan-trainer-qa`. Tests disable the emulator's Wi-Fi and mobile data during offline checks and restore them afterward.

## Signing and distribution

Create a local signing key once with `python3 scripts/create-android-signing-key.py`. It writes only to `~/.config/vulcan-tech-trainer/`, with private file permissions. Never regenerate or overwrite the key for an existing release.

```sh
cd android
./gradlew assembleRelease lintRelease
```

`VULCAN_SIGNING_PROPERTIES` can point to another private properties file with `storeFile`, `storePassword`, `keyAlias`, and `keyPassword`. The keystore path is relative to that file. Keep the same certificate and increase `versionCode` for updates. Signed universal APKs are published to Klobfactor's GitHub Releases and tracked by Klobstore. Play Store publication remains a later step; keep signing continuity in mind when configuring Play App Signing.

The Google Play Console entry is **Vulcan Tech Gospel (Trainer)** with package ID **`app.segfaultlabs.vulcan_tech_trainer`**. This repository does not publish to Google Play automatically.
