# @hackbuild/senses

Perception for simulated animals. The core is the Rust crate
`crates/senses` compiled to wasm32 with SIMD128; this package loads it,
wraps it in option objects that take an injected `Rng`, and adds a
three.js eye under `/three`. Written for this library from the senses
of the earlier dog simulator whose code is public in
[dog-simulator/legacy](https://github.com/hackbuild/dog-simulator/tree/main/legacy) (`attention`,
`loomCheck`, `sense`, `memPos`, the nose; called the legacy senses below)
and from the perception pass and grid of an earlier unpublished
prototype by the same author, who releases this code under MIT.

What is in it:

- `Saliency`: Itti Koch saliency on an RGBA eye frame (intensity, blue
  yellow, edges, motion; red green dropped for a dichromat), the N()
  normalization, top down bias at a world point or image point, winner
  take all, lognormal fixation dwell, and inhibition of return stored as
  world directions so it survives head turns.
- `Looming`, `timeToContact`, `angularSize`: tau from angular size growth,
  a startle under a threshold with a refractory window.
- `OdourField`: an intermittent puff plume in a meandering wind (struct of
  arrays with a spatial hash, no object per puff) plus a ground trail grid
  with timestamps, decay and a fresher end direction.
- `Sniffer` (two nostrils, bouts) and `Tracker` (decide, trail, surge and
  cast modes; returns a waypoint, a speed and a stop distance).
- `localizeSound`: azimuth error per animal with front back confusion.
- `PerceptMemory`: geometric field of view vision (range by size, motion
  and daylight; occlusion answered by the caller) and remembered
  positions whose error grows with the square root of age.
- `OccupancyGrid`: integrates eye depth, A* paths with no corner cutting
  and line of sight smoothing, frontiers, bumps.
- `/three`: `Eye` renders an object ID buffer and an RG packed depth
  buffer from the agent's head and reads them back (sync, or async with a
  busy flag), `colorFrame` for saliency, `cameraFromThree`.

Sources: Itti, Koch and Niebur 1998; Lee 1976 (tau); Celani, Villermaux
and Vergassola 2014 (plumes); Craven 2010 and Thesen 1993 (sniffing);
Hepper and Wells 2005 (trail direction); Guerineau 2022 (dog azimuth
error); Fiset 2003 (memory drift); Barber 2016 (fixation duration).

## Install

Not published yet. From a clone:

    npm ci && npm run build -w @hackbuild/senses

## Use

```ts
import { load, OdourField, Saliency, Sniffer, Tracker, seededRng } from "@hackbuild/senses";
import { Eye, cameraFromThree } from "@hackbuild/senses/three";

await load(); // inlined wasm; or load(url) or load(bytes)
const rng = seededRng(7);
const sal = new Saliency({ rng });
const eye = new Eye(renderer, scene);
eye.place(head, yaw, pitch);
const cam = cameraFromThree(eye.camera);
sal.biasPoint(ball.position, 0.6 * wantBall);
sal.update(eye.colorFrame(320, 160), 320, 160, now, cam);
if (sal.ready(now)) look(sal.shift(now, cam, objects, arousal));

const field = new OdourField({ rng });
field.step(dt, [{ id: 0, x: bowl.x, z: bowl.z, strength: 1 }]);
```

`dist/senses.iife.js` is the single file build: a classic script that
defines `HackbuildSenses` with the wasm inlined, for pages opened from
file://. It needs nothing on the page. The eye and `cameraFromThree` are
a second classic script, `dist/senses-three.iife.js`
(`@hackbuild/senses/three-iife`), that defines `HackbuildSensesThree`
and reads `THREE` from the page; three 0.186 ships no classic script, so
that page has to set `window.THREE` from a module first.

## Develop

    source ~/.nvm/nvm.sh && nvm use 22.18.0
    npx -y npm@11.21.0 install
    npm run build -w @hackbuild/senses   # wasm-pack, tsc, iife
    npx vitest run packages/senses
    cargo test -p hackbuild-senses
    HB_REGEN_GOLDEN=1 cargo test -p hackbuild-senses   # after a deliberate numeric change

## Parity with the legacy dog simulator

The senses follow the attention, nose and hearing of the earlier dog
simulator whose code is public in
[dog-simulator/legacy](https://github.com/hackbuild/dog-simulator/tree/main/legacy)
(MIT parts only). Two kinds of test compare the wasm build with it:

- fixtures from the running legacy code: `test/fixtures/legacy-*.json`
  hold the numbers the legacy JavaScript itself produced (legacy/det at
  commit bc2cf6c, run in a Node vm with stubs for the page globals) on
  the seeded inputs in `test/parity-inputs.ts`. Only the numbers are
  committed;
- hand transcriptions (`test/legacy-ref.ts`, an inline plume) on 240
  synthetic eye frames, kept as a second check.

| check | tolerance | measured 2026-11-23 |
|---|---|---|
| saliency map and winner, 300 frames at 320x160, 640x320, 200x100, 321x163 and 97x61, flat frames included (fixture) | bit identical | 300 of 300 maps and winners |
| three fixation sequences, 360 frames: top down bias from percepts, inhibition of return across head turns, shifts, dwell and snapping (fixture) | winner equal, map sums within 1e-6, fixation within 1e-9 m | 360 of 360 winners, 36 of 36 shifts at the same frames, map sums equal, fixation points within 1.2e-14 m |
| plume, three runs of 2,400 to 3,000 steps, 1 to 12 sources, mixed 1/60 and 1/30 s steps, one at the 600 puff cap (fixture) | puff count equal every step, values within 1e-9 | counts equal, 3.6e-15 |
| saliency on 240 frames with top down blobs (transcription) | winner 99 percent, map 1e-6 of max | 240 of 240, 0 |
| plume after 10 s, one source (transcription) | under 1e-9 m | 8.9e-16 m |

## What is verified, and what is not

### Verified on this machine

- 2026-11-22: `cargo test -p hackbuild-senses` passed 18 of 18 tests, and the shared
  `hackbuild-agent-rng` crate 2 of 2
  (counted), clippy clean natively and for wasm32 with the wasm feature.
- 2026-11-22: `npx vitest run packages/senses` passed 11 of 11 tests
  (counted), including the parity table above and the golden trace (64
  values over every module, seed 20261122) bit identical between the
  native and the wasm build.
- 2026-11-22: the eye in headless Chrome 150 with swiftshader
  (`test/browser.test.ts`): the tracked box is seen at 276 pixels and
  1.90 m (computed 1.9 m), four wall cells are marked from depth, the
  async pass returns the same sighting, and materials are restored.
- 2026-11-23: the same test with an instanced box and a skinned box posed
  by its bone: 131 pixels at 2.93 m and 48 pixels at 3.54 m (measured;
  computed about 2.9 m and 3.5 m). Before the depth pass applied
  instancing and skinning, the instanced box read 4.12 m (measured), the
  depth behind it.
- 2026-11-23: `test/fixtures/iife.html` from file:// in headless Chrome
  with no `THREE` on the page: the tunables, senses (wasm inlined),
  drives (wasm inlined), mover and cameras IIFEs all load and run.
  Before the eye moved to its own IIFE, `senses.iife.js` threw
  `ReferenceError: THREE is not defined` there.

### Not verified by anything

- Nobody has looked at the eye, the plume or the saliency map in a real
  browser at real frame rate.
- Behavioural parity of the tracker and sniffer with the running legacy simulator:
  they follow the same draw order and formulas, but no recorded run was
  compared.
- The saliency in Chrome fixated the ground at the left edge of the test
  scene, not the box; fixation quality on real scenes is unknown.
- The WebGPU saliency path in the plan (pyramid from mip levels, no
  readback) is not written.
- The IIFE bundles on a page opened from file:// by double click: the
  fixtures load them from file:// with `--allow-file-access-from-files`.

## Size budget

| file | raw | gzip |
|---|---|---|
| `senses_bg.wasm` | 106,982 bytes | 46,483 bytes |
| `senses.iife.js` (wasm inlined as base64) | 182,855 bytes | 71,763 bytes |
| `senses-three.iife.js` | 10,144 bytes | 3,543 bytes |

Measured 2026-11-23 by tools/check-sizes.mjs (gzip level 9), wasm-opt from wasm-pack 0.13.1.
Budget: wasm under 128 KB raw; a change that crosses it says why.

## Licence

Code MIT (`LICENSE`, a copy of the repository root one). This README is CC-BY-4.0, its
code samples also MIT. The wasm contains compiled libm (MIT) and
wasm-bindgen (MIT or Apache-2.0) code; `THIRD-PARTY-NOTICES.txt` carries
their notices.
