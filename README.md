# Klobfactor

A double staff and Vulcan Tech Gospel practice companion. Follow DrexFactor's tutorials in order, inspect the hand and staff relationships, and loop the original demonstrations at your own pace.

- 21 lesson pages from 20 distinct videos in two playlists.
- 150 ordered move and study sections with grip, stance, focus, practice cues, and source timestamps.
- Interactive geometric diagrams, verified pose checkpoints, and spatial maps.
- Scrubbing, forward/backward steps, looping, automatic move advancement, and 0.25× through 2× playback.
- Front, side, top, oblique 3D, and mirrored views; optional tip paths and body guide.
- Dark mode by default, with a visible light/dark toggle and a saved preference across pages and visits.
- A motion lab, searchable curriculum, VTG reference, and browser-local practice records.

The teaching is credited to DrexFactor. This is an independent companion, without affiliation or endorsement.

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

The diagrams are teaching models, not motion capture. Isolation pins the chosen end; extension carries a staff around with the arm; antispin opposes the hand and shaft rotations; R-type holds the shaft angle. The inspin model uses an inferred three-turn shaft ratio and identifies that assumption in the interface.

The front crank and antibrid box preserve the demonstrated hand-to-end connections. Their geometry does not reconstruct the reel's depth or shoulder clearance. Complex body tracing, reels, archers, crossers, 3D passages, hand-tracer boxes, and tutting use annotated poses or spatial references where continuous movement has not been verified. Mixed transitions and briefly demonstrated combinations point to the timestamped source. Discrete checkpoints are never interpolated into an invented body path.

Every move has source playback and teaching cues. Consult the source for exact grip changes, body turns, and front/back clearance. The text distinguishes observed stance from footwork explicitly taught in the videos.

## Validate

```sh
npm test
npm run build
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
| `src/motion.mjs` | Pure geometric models |
| `src/studies.mjs` | Verified poses and spatial study definitions |
| `src/player.mjs` | Diagram playback and rendering |
| `src/app.mjs` | Lessons, search, source playback, and practice records |
| `scripts/build.mjs` | Static page generation |
| `scripts/serve.mjs` | Local server and optional local-media playback |
| `.openai/hosting.json` | Sites project identity and static output directory |

Major changes are validated, committed, pushed to [GitHub](https://github.com/xklob/klobfactor), and released. Release assets contain the built static site without the original tutorial media.
