# Android validation

## 0.1.1

Validated on 14 October 2026 on the same Android 16 / API 36 emulator used for 0.1.0.

- The three offline device flows passed with the explicit 3D-tab selections removed: lessons and Continue now open the renderer by default. Source selection, actual local-video playback, activity recreation, and all 150 bundled sections still pass.
- Android unit tests, debug/release builds, and debug/release lint passed. The web suite passed all 13 motion/content tests and browser checks, including the default tab in all 21 lessons.
- The signed APK has version code 2 and version name 0.1.1, retains the 0.1.0 release certificate, and passes 16 KB alignment verification. All 17 shared assets match the web build byte for byte.

## 0.1.0

Validated on 14 October 2026 with Android 16 / API 36 on a dedicated emulator, using Android System WebView 133.0.6943.137.

- The shared web suite passed all 13 motion/content tests, including complete-catalog staff separation and reverse traversal. The web release also passed browser checks covering the 21 lessons and 150 sections, actual source-video decoding and seeking, segment loops and advancement, the live close-up, and source/diagram enlargement.
- Three Android unit tests verify byte-identical curriculum packaging, all 21 lessons / 150 sections and playlist order, search and timestamps, local renderer dependencies, and exclusion of tutorial media.
- Debug and release builds and lint passed. The APK uses the requested package ID, Android version code 1, version name 0.1.0, and minimum API 28.
- The signed, minified release APK was installed separately and checked offline for the two-staff renderer, expanded view, Back navigation, and motion lab, including rendered screenshots. All 17 shared web assets and the curriculum match the web build byte for byte.
- Three device test flows passed with Wi-Fi and mobile data disabled. They load all 150 move specifications, exercise native navigation, touch orbit, two-staff visibility, source-first navigation, playback, expansion and Back, saved practice/section state across recreation, the lab, VTG page, and reference page.
- Full-screen checks wait for an Android WebView visual frame, verify native and canvas dimensions, and inspect screenshot color variation to reject a blank viewer.
- The local-video flow uses Android's document picker and a generated test clip. It verifies actual media decoding, source timestamp seeking, playback, 0.25× speed, stepping, persistent file access after activity recreation, full screen, and forgetting the selected file. The live close-up is checked for actual nonblank source pixels, area selection, and visibility in a screenshot.
- Release signature and 16 KB alignment are verified before publication. The release certificate SHA-256 is `c789c820ffb986cf1e2a204e5952f53b5553d1b3c6140964548d6debe644d11c`.

The app requests no Internet permission. Linked YouTube pages and the original poster are handled by the external browser. Source tutorial videos are not packaged. Android 9–15 and physical-device GPU behavior have not been tested in this release; the renderer reports unavailable 3D support and retains source access if initialization fails.
