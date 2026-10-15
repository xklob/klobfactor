# Antispin review preview

[Open the hosted review](https://vulcan-antispin-preview.deep-krill-3494.chatgpt.site).

This is the first Blender animation review, for **thumb-led antispin, split time /
same direction**. It is separate from the released web app and Android package.
Stop after publishing this preview and wait for Caleb's feedback before authoring
other movements or promoting it into a release.

Reference: DrexFactor's demonstration at
[8:25](https://www.youtube.com/watch?v=pRoRKPIewhE&t=505s), sampled through 8:27.33.
The candidate loop uses the first 34 source frames at 15 fps, approximately
2.267 seconds. Monocular depth estimates are a guide, not measured depth.

The editable `.blend` scene contains a skinned performer, separate hand and elbow
controls, Blender two-bone IK, animated finger support, and two staff objects
attached to the hand bones. The GLB contains a single baked animation for the body
and both staves. The browser uses Three.js to play it; it does not solve the arms.

## Build

To serve the checked-in preview locally:

```sh
npm ci
node scripts/build-antispin-preview.mjs
python3 -m http.server 4174 --directory .artifacts/antispin-preview-dist
```

Open `http://localhost:4174/`. To regenerate the Blender scene:

Blender 4.5 LTS is installed locally at `~/.local/bin/blender`. Authoring data and
intermediate reconstruction files are in `.artifacts/body-restoration/`.

```sh
blender --background --factory-startup --python scripts/blender-antispin.py -- \
  --guide preview/antispin/source/guide.json \
  --grips preview/antispin/source/grips.json \
  --rig preview/antispin/source/rig.json \
  --output .artifacts/body-restoration/blender-antispin
```

The scene uses source-derived torso and stance tracks. Wrist targets, staff
angles, support changes, and elbow controls remain editable. Staff depth and
reach accommodations are authored choices that need technique review.

The preview includes orbit/zoom, seeking in both directions, frame steps,
0.25x/0.5x/1x/2x playback, independent staff visibility, fullscreen, and a grip
inset whose viewing direction matches the main camera.

Do not treat a geometry check as proof of correct technique. Compare the entire
cycle with the source, especially the thumb/pinky side of each elbow.

Browser checks passed for desktop and a 390px phone viewport, including reverse
seeking, speed control, both visibility toggles, camera orbit/reset, fullscreen,
and the inset camera orientation. The geometry check sampled 480 intervals plus
the loop endpoint and found no staff/body or staff/staff intersections.

This checkpoint is a preview branch. The stable web and Android release remains
v0.3.1 pending review of the animation.
