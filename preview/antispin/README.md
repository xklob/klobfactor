# Antispin review

[Try the preview](https://vulcan-antispin-preview.deep-krill-3494.chatgpt.site) · [Released website](https://vulcantech.klob.io)

This branch contains a revised **thumb-led antispin, split time / same direction**
study. It is a review draft, separate from the released web and Android apps.
Wait for Caleb's feedback before authoring other movements or promoting this
animation into the curriculum.

The figure now uses Blender Studio's anatomical male base mesh, with sculpted
hands, knuckles, and nail beds. A fitted Rigify rig deforms the shoulders, elbows,
forearms, wrists, and fingers. The browser plays a baked animation using standard
glTF skinning; it does not reconstruct the body or solve joints at runtime.
The editable Blender file retains the rig and sculpted surface. Continuous
twist tracks prevent the segmented arm rig from spinning between baked poses;
regenerate those tracks with the scene script after changing the controls.

## Movement reference

DrexFactor's [split-same demonstration at 8:25](https://www.youtube.com/watch?v=pRoRKPIewhE&t=505s)
is the body and timing reference. The first 34 samples at 15 fps form a 2.267-second
loop. His [open-support explanation at 2:14](https://www.youtube.com/watch?v=pRoRKPIewhE&t=134s)
is the grip reference: the vertical positions use thumb-joint support with the
fingers directed toward the pinky end. They are not a closed fist throughout.

The source capture supplies body turns, stance, and projected arm paths. Depth,
wrist orientations, finger poses, and staff contact are authored. In particular:

- The staves occupy separate parallel planes around the turning body.
- Elbows stay on the body side of those planes; the reconstructed elbow depth
  was unreliable and could put an upper arm across a staff.
- A cyclic pose fit smooths flexion, forearm roll, and sideways wrist movement.
  It does not force straight wrists or make the hand follow a full staff turn.
- Small baked staff offsets maintain the demonstrated thumb support.

These accommodations are explicit design choices, not recovered measurements.
The animation still needs technique review, particularly the support transitions
and the thumb/pinky passage around each elbow. Collision checks alone cannot
approve the movement.

## View locally

```sh
npm ci
node scripts/build-antispin-preview.mjs
python3 -m http.server 4174 --directory .artifacts/antispin-preview-dist
```

Open `http://localhost:4174/`. For an offline copy:

```sh
node scripts/build-antispin-offline.mjs
```

Open `.artifacts/antispin-offline/Antispin preview.html` directly in a browser.
The viewer includes orbit/zoom, fullscreen, reverse seeking, frame steps,
0.25x/0.5x/1x/2x playback, separate staff visibility, and a grip inset that matches
the main camera's orientation.

## Rebuild

Requires Blender 4.5 LTS with Rigify, Node, and `uv` for the SciPy pose fit.
After dependencies are cached, add `--offline` to rebuild without network access.
`source/character.blend` is the fitted, unanimated character. To regenerate it,
download the [CC0 Blender Studio Human Base Meshes 1.4.1 bundle](https://download.blender.org/demo/asset-bundles/human-base-meshes/human-base-meshes-bundle-v1.4.1.zip)
and run:

```sh
blender --background --factory-startup --python-exit-code 1 --python scripts/blender-character.py -- \
  --asset /path/to/human_base_meshes_bundle.blend --output /path/to/character
```

To regenerate the checked-in motion:

```sh
blender --background --factory-startup --python-exit-code 1 --python scripts/blender-antispin-rigify.py -- \
  --character preview/antispin/source/character.blend \
  --guide preview/antispin/source/rigify-guide.json \
  --contacts preview/antispin/source/support.json \
  --output .artifacts/antispin-rebuild
```

If changing the character or hand poses, first export without `--contacts`, then
run `scripts/fit-antispin-support.mjs` with that GLB and its authoring report.
Rebuild with the resulting contact file. Review the exported geometry and motion
after every such change; the contact fitter uses conservative triangle projections at baked keys.
The independent 3D audit also checks the interpolation between those keys.

## Validation

```sh
node scripts/audit-antispin-preview.mjs
# With the local preview server running:
node tests/antispin-preview.mjs
```

The surface audit checks both staff volumes against the complete exported body,
clothing, fingers, and nails, plus staff/staff clearance, loop closure, wrist bend,
arm extension, and abrupt rotations between frames. `validation.json` records the measured result. This audit does
not test every kind of body self-intersection or establish correct technique.

The current geometry result covers 481 samples: minimum staff/body clearance
1.05 mm, staff/staff clearance 62.5 cm, and loop closure within 0.002 mm. The
exported body and clothing contain 450,960 triangles. No abrupt arm twist was
detected. These are geometry and continuity checks, not technique approval.

The browser check covers seeking, playback speed, visibility, orbit/reset,
fullscreen, matching inset orientation, and mobile layout.

Character attribution and terms are in [MODEL-LICENSE.txt](MODEL-LICENSE.txt).
Downloaded source video and cookies are excluded from the repository and preview.
