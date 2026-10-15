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

The refined performer has 443,724 surface triangles, including fitted nail
plates on all ten fingers. Imported shading seams are welded before subdivision.
The elbow controls keep the wrist closer to the forearm, and a forearm roll bone
spreads rotation through the skin. Blender's **Preserve Volume** deformation is
matched by `volume-skinning.mjs` in the browser, including shadows and ray picking.
Other glTF viewers that use ordinary linear skinning may show wrist pinching.
The editable Blender scene retains the volume-preserving armature setting.

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
inset whose viewing direction matches the main camera. The inset is larger and
centered on the hand for close inspection of the thumb, fingers, and wrist.

To check the rendered surfaces and browser controls:

```sh
node scripts/audit-antispin-preview.mjs
# With the local preview server running:
node tests/antispin-preview.mjs
```

The surface audit includes the fingers and fingernails, measures wrist bend, and
compares the first and last deformed surfaces. It uses the same volume-preserving
deformation as the renderer. `preview/antispin/validation.json` records the result.

Do not treat a geometry check as proof of correct technique. Compare the entire
cycle with the source, especially the thumb/pinky side of each elbow.

Browser checks passed for desktop and a 390px phone viewport, including reverse
seeking, speed control, both visibility toggles, camera orbit/reset, fullscreen,
and the inset camera orientation. The geometry check samples 480 intervals plus
the loop endpoint. A separate comparison of 585 hand and forearm points against
Blender's evaluated mesh found a maximum difference of 0.002 mm.

This checkpoint is a preview branch. The stable web and Android release remains
v0.3.1 pending review of the animation.
