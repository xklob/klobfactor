# Klobfactor

An independent, source-backed learning companion for double staff and Vulcan Tech Gospel.

- Hosted website: https://vulcantech.klob.io
- Repository: https://github.com/xklob/klobfactor
- After each major feature or update, validate it, commit and push it, and publish a GitHub release, as requested by Caleb.
- Keep downloaded videos, full captions, raw download metadata, and cookies out of Git and deployment archives. Cookies remain outside this checkout.
- Ground lesson instructions and ordering in DrexFactor's videos. Cite the video and relevant timestamps. Distinguish teaching diagrams from motion capture.
- Preserve the beginner series order and the supplied antibrid playlist order. Prerequisite links may cross that order.
- Keep the interface minimal, accessible, responsive, and usable with a keyboard. Playback needs seeking, stepping, looping, and adjustable speeds including 0.25x, 0.5x, and 1x.

- Keep UI copy short and literal; preserve technical explanations. Default to neutral charcoal dark surfaces and an isometric camera. Keep secondary controls and long move lists collapsed.
- Google Play app identity: Vulcan Tech Gospel (Trainer), `app.segfaultlabs.vulcan_tech_trainer`. The Android companion includes all lesson content and major web features, supports offline practice, and is distributed through Klobstore. Generate its assets from the shared web content; never maintain a separate reduced curriculum. Keep its signing material outside the checkout and preserve its release certificate.

- Stable GitHub releases must include the signed Android APK now that Klobstore tracks this repository. Keep Android assets in sync with the released web curriculum, and increment Android versionCode when those assets or the app change.

- Treat source footage as the movement reference. Prop curves and collision checks alone do not validate human technique. Do not restore generated body animation without reviewing the complete motion against source checkpoints, including hand support, thumb/pinky elbow passages, torso turns, and clearance. Static references have no play bar.
