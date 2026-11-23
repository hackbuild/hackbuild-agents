# @hackbuild/senses

Perception for simulated animals. The core is the Rust crate
`crates/senses` compiled to wasm32 with SIMD128; this package loads it,
wraps it in option objects that take an injected `Rng`, and adds a
three.js eye under `/three`. Written for this library from the HACKLE
senses (`attention`, `loomCheck`, `sense`, `memPos`, the nose) and the
ARBOR perception pass and grid.

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
file://. It reads `THREE` from the page.

## Develop

    source ~/.nvm/nvm.sh && nvm use 22.18.0
    npx -y npm@11.21.0 install
    npm run build -w @hackbuild/senses   # wasm-pack, tsc, iife
    npx vitest run packages/senses
    cargo test -p hackbuild-senses
    HB_REGEN_GOLDEN=1 cargo test -p hackbuild-senses   # after a deliberate numeric change

## Parity with HACKLE

The legacy code was read, never run. The tests carry hand transcriptions
of the HACKLE arithmetic (`test/legacy-ref.ts` for the attention update,
an inline one for `plumeTick`) and compare the wasm build to them on the
same inputs. The inputs are 240 synthetic seeded eye frames at 320 by 160
(sky, ground, noise, up to three moving coloured patches, a top down blob
on every third frame); no eye frames were recorded from a HACKLE run.

| check | tolerance | measured 2026-11-22 |
|---|---|---|
| saliency winner cell, frame by frame | at least 99 percent agree | 240 of 240 |
| saliency map, max difference over max value | under 1e-6 | 0 (bit identical f32 maps) |
| plume puff positions after 10 s, same seeded stream | under 1e-9 m | 8.9e-16 m, 50 of 50 puffs |

Inhibition of return is checked for behaviour (it follows the world
direction across a head turn), not against the original projection.

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
  async pass returns the same sighting, and materials are restored. CI
  has no Chrome at that path and skips it.

### Not verified by anything

- Nobody has looked at the eye, the plume or the saliency map in a real
  browser at real frame rate.
- Behavioural parity of the tracker and sniffer with a running HACKLE:
  they follow the same draw order and formulas, but no recorded run was
  compared.
- The saliency in Chrome fixated the ground at the left edge of the test
  scene, not the box; fixation quality on real scenes is unknown.
- The WebGPU saliency path in the plan (pyramid from mip levels, no
  readback) is not written.
- The IIFE bundle on a page opened from file:// outside the test fixture
  (the fixture loads it from file:// with `--allow-file-access-from-files`).

## Size budget

| file | raw | gzip |
|---|---|---|
| `senses_bg.wasm` | 105,359 bytes | 45,699 bytes |
| `senses.iife.js` (wasm inlined as base64) | 188,900 bytes | 73,245 bytes |

Measured 2026-11-22 from the build log, wasm-opt from wasm-pack 0.13.1.
Budget: wasm under 128 KB raw; a change that crosses it says why.

## Licence

Code MIT (`LICENSE` at the repository root). This README is CC-BY-4.0, its
code samples also MIT.
