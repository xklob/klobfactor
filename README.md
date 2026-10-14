# Klobfactor

Website: **[vulcantech.klob.io](https://vulcantech.klob.io)**

Double staff lessons, interactive diagrams, and timestamped DrexFactor tutorials.

- 21 lesson pages from 20 distinct videos in two playlists.
- 150 ordered move and study sections with grip, stance, focus, practice cues, and source timestamps.
- Source demonstrations first, with separate 3D pattern studies and static spatial references.
- Scrubbing, forward/backward steps, looping, automatic move advancement, and 0.25× through 2× playback.
- Isometric default with free orbit, zoom, and pan; front, side, top, and mirrored presets.
- Theater and full-screen views. Downloaded videos have a live close-up with selectable area, pan, and zoom.
- Identical colored thumb/pinky end shapes, black shafts and grips, white center marks, optional tip paths, and independent staff visibility. Coincident patterns use separate physical planes.
- Neutral charcoal dark mode by default, with a saved light/dark preference.
- A motion lab, searchable curriculum, VTG reference, and browser-local practice records.

The teaching is credited to DrexFactor. This is an independent companion, without affiliation or endorsement.

## Android

[Vulcan Tech Gospel (Trainer)](android/README.md) includes the complete web curriculum and major practice features, with native Android navigation, saved progress, offline local video playback, and outdoor display controls. It bundles all lesson text, diagrams, the motion lab, VTG relationships, and reference pages from the same source as the website. Source videos can be selected from device storage.

- [Signed Android APK](https://github.com/xklob/klobfactor/releases/latest), also available through Klobstore.
- Android 9 or newer. Package ID: `app.segfaultlabs.vulcan_tech_trainer`.
- A Google Play Console entry exists under **Vulcan Tech Gospel (Trainer)**. Public Play Store publication is planned separately.

## Run locally

Use Node.js 22 or newer.

```sh
npm ci
npm run build
npm run dev
```

Open <http://127.0.0.1:4173>. Rebuild after editing content or source files. The build produces a static `dist/` directory, with a separate HTML page for each lesson. There is no application server or database in production.

## Source videos

The curriculum preserves these playlist orders:

1. [DrexFactor's double staff beginner series](https://www.youtube.com/playlist?list=PLGRWu2f31dFWXowRJ4cpC7Zkf-3IRx-Xn), beginning with [grip, timing, and direction](https://www.youtube.com/watch?v=tqJoUgprXws).
2. [The supplied antibrid series](https://www.youtube.com/playlist?list=PLGRWu2f31dFVkZv9jONCwGuA4zb8mZrLi).

Both playlists include the one-minute basic antibrids clip. Winter Tech is a performance study; its five viewing windows are editorial observations, not invented tutorial chapters.

The [VTG reference poster](https://flowartsinstitute.com/wp-content/uploads/2015/02/VTGpostersmall.jpg) credits David Cantor and Noel Yee, with artwork by Forest Stearns, and is hosted by Flow Arts Institute. The site uses original diagrams and links to the poster.

Source playback loads YouTube only when requested. You can also select a downloaded file in the browser. That file stays on your device. For local development, the server automatically finds `source-videos/<video-id>.mp4` and supports seeking through HTTP range requests.

An optional download command, using a cookie export outside the repository:

```sh
mkdir -p source-videos
yt-dlp --cookies "$HOME/cookies.txt" --js-runtimes node \
  -f 'bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720][ext=mp4]' \
  --merge-output-format mp4 -o 'source-videos/%(id)s.%(ext)s' \
  'https://www.youtube.com/watch?v=tqJoUgprXws'
```

Videos, full captions, raw download metadata, cookies, and local test artifacts are excluded from Git and deployment. The repository contains original lesson notes and a sanitized source catalog.

## Diagram scope

[Movement sequences](docs/movement-sequences.md) records the ordered actions and source timestamps for every section, including the separate thumb-led and pinky-led elbow passages.

The 3D studies show prop geometry and static spatial landmarks. They do not animate a human body. The previous mannequin, hand animation, and interpolated archer weave were withdrawn because their wrist motion, elbow routes, and clearance were not reliable. A full-body 3D trainer is still unfinished.

Isolation pins the chosen end; extension carries the prop around a larger orbit; antispin opposes the hand and shaft rotations; R-type holds the shaft angle. The inspin study uses an inferred three-turn shaft ratio and identifies that assumption. The front crank and antibrid box preserve the demonstrated hand-to-end alignment in projection, with the solid staves separated in depth. These diagrams do not establish a grip change, elbow passage, shoulder clearance, or body turn.

Archer weaves and other body passages use the actual demonstration plus discrete reference positions. Still references have no play bar. Every section retains its source playback and teaching cues, including thumb/pinky inside-versus-outside elbow placement. The text distinguishes observed stance from footwork explicitly taught in the videos.

The video close-up crops the original frame with the same orientation. It is available for locally selected videos and the local development media. YouTube embeds retain their own player; use a downloaded file for the close-up. No tutorial videos are rehosted or bundled.

## Validate

```sh
npm run build
npm test
npx playwright install chromium
npm run dev
# In a second terminal:
npm run test:browser
```

The math/content suite checks staff rigidity, isolation pivots, antispin paths, crank and box contact constraints, continuity, playlist coverage, and source timestamps. Browser checks exercise all 21 lessons and 150 sections, controls, automatic advancement, search, saved progress, and responsive layouts. Native source-video checks run when the first downloaded video is present. YouTube availability still depends on its embedding and browser policies.

`PLAYWRIGHT_EXECUTABLE_PATH` can select an existing Chromium binary. GitHub Actions runs the portable checks without downloaded tutorial media.

## Project layout

| Path | Purpose |
| --- | --- |
| `content/catalog.json` | Playlist identity and original ordering |
| `content/research/` | Original lesson notes, timestamps, evidence, and limitations |
| `android/` | Native companion and Android build |
| `scripts/build-android-assets.mjs` | Shared offline content bundle |
| `src/motion.mjs` | Pure geometric models |
| `src/studies.mjs` | Verified poses and spatial study definitions |
| `src/player.mjs` | Playback, camera UI, theater and full screen |
| `src/scene.mjs` | Depth-tested prop renderer and stationary spatial references |
| `src/source-focus.mjs` | Live close-up of the original local video frame |
| `src/movement-guides.mjs` | Observed movement checkpoints and source timestamps |
| `src/app.mjs` | Lessons, search, source playback, and practice records |
| `scripts/build.mjs` | Static page generation |
| `scripts/serve.mjs` | Local server and optional local-media playback |
| `.openai/hosting.json` | Sites project identity and static output directory |

Major changes are validated, committed, pushed to [GitHub](https://github.com/xklob/klobfactor), and released. Web release assets contain the built static site. Android releases contain a signed universal APK. Neither includes the original tutorial media.
