# @hackbuild/senses

Perception for simulated animals: saliency, looming, an odour plume and scent tracking, hearing error, field of view vision and an occupancy grid from eye depth, on a Rust core in wasm.

[![npm](https://img.shields.io/npm/v/@hackbuild/senses)](https://www.npmjs.com/package/@hackbuild/senses) [![licence MIT](https://img.shields.io/badge/licence-MIT-blue)](../../LICENSE) ![gzip 71.7 kB measured](https://img.shields.io/badge/gzip-71.7%20kB-blue) ![types included](https://img.shields.io/badge/types-included-blue)

## What it does

- Finds where the eye goes next: Itti Koch saliency on a rendered frame with top down bias, fixation dwell and inhibition of return that survives head turns.
- Smells: a puff plume in a meandering wind and a ground trail grid, two nostril sniffing in bouts, and a tracker that follows a trail, surges upwind and casts crosswind.
- Sees and remembers: field of view vision with range by size, motion and daylight, and remembered positions whose error grows with age.
- Hears with error: sound azimuth with front back confusion, and startles on looming objects.
- Maps: integrates eye depth into an occupancy grid with A* paths and frontiers; `/three` renders the eye's ID and depth buffers from a three scene.

## Install

```sh
npm install @hackbuild/senses
```

The main entry has no dependencies and no peers; the wasm is inlined, so `await load()` needs no file. The `/three` entry (`Eye`, `cameraFromThree`) takes three (`>=0.186.1 <0.188.0`) as a peer: `npm install @hackbuild/senses three`.

## Quick start

```ts
import { load, OdourField, Sniffer, Tracker, seededRng } from "@hackbuild/senses";

// the inlined wasm; load(url) or load(bytes) also work
await load();
const rng = seededRng(7);
// wind heading is measured from +x, so -pi/2 blows from the bowl toward the dog
const field = new OdourField({ rng, windHeading: -Math.PI / 2 });
const sniffer = new Sniffer({ rng });
const tracker = new Tracker({ rng });

const bowl = { id: 0, x: 0, z: 6, strength: 1 };
const dog = { x: 0, z: 0, heading: 0 };
let arrived = false;
for (let t = 0; t < 30; t += 1 / 30) {
  field.step(1 / 30, [bowl]);
  sniffer.tick(field, 1 / 30, t, true, { x: dog.x, z: dog.z + 0.3 }, { x: 0.03, z: 0 });
  const s = tracker.step(field, sniffer, 1 / 30, t, dog, dog.heading, arrived);
  // walk toward the waypoint at the speed the tracker asks for
  const to = s.waypoint ?? dog;
  const d = Math.hypot(to.x - dog.x, to.z - dog.z);
  arrived = d <= s.stopDist;
  if (!arrived) [dog.x, dog.z, dog.heading] = [dog.x + ((to.x - dog.x) / d) * s.speed / 30, dog.z + ((to.z - dog.z) / d) * s.speed / 30, Math.atan2(to.x - dog.x, to.z - dog.z)];
}
console.log(`dog at ${dog.x.toFixed(2)}, ${dog.z.toFixed(2)}; the bowl is at 0, 6`);
```

## Live example

- The package page shows the saliency map on a rendered view, eye depth into the grid, percept memory, the plume and the tracker: [hackbuild-agents/senses](https://hackbuild.github.io/hackbuild-agents/senses/).
- The [dog simulator](https://hackbuild.github.io/dog-simulator/) uses `localizeSound`, `angularSize` and `timeToContact` for hearing and startles.

## Concepts

### load once, then construct

The classes wrap wasm objects, so `await load()` comes before the first `new`. With no argument the inlined base64 copy is decoded, which works from file://; `load(url)`, `load(bytes)` and `loadSync(bytes)` take the `dist/wasm/senses_bg.wasm` file instead. Later calls return the first load. Call `free()` on an object you drop early; the garbage collector frees it otherwise.

### injected randomness

Every class that draws numbers takes `rng: () => number` and seeds its own wasm stream from one draw of it (`seedFrom`). `seededRng(seed)` is Mulberry32, the same stream as the Rust crate, so a seed replays the same plume, fixations and sniffs in Node, the browser and native tests. Never pass `Math.random` where you want a replay.

### the camera as 16 numbers

Saliency and the grid take a `CameraArray`: position, right, up and back vectors, vertical fov in degrees, aspect, near and far. `cameraLook(pos, yaw, pitch, fov, aspect)` builds one from a head pose; `cameraFromThree(camera)` in `/three` builds one from a PerspectiveCamera. Yaw 0 faces +Z and pitch is up positive throughout.

### saliency and fixation

`Saliency.update(frame, width, height, now, camera)` samples an RGBA frame (top row first) to an 80 by 40 grid and builds the map from intensity, blue yellow, edges and motion; red green is dropped for a dichromat. `biasPoint` and `biasUv` add top down interest for the next update. When `ready(now)` says the dwell is over, `shift(now, camera, objects, arousal)` picks the winner, snaps it to an object within `snapAngle` of its ray, and inhibits that world direction for `iorSeconds`, so the inhibition holds when the head turns.

### the nose

`OdourField.step(dt, sources)` emits puffs per source in a meandering wind (`windHeading` from +x) and keeps a ground trail grid you `deposit` into and `decayTrail`. `Sniffer.tick` samples two nostrils in bouts; `Tracker.step` reads both and returns a mode (decide, trail, surge or cast), a waypoint, a speed and a stop distance. Pass `arrived` true once the agent is within `stopDist`, so the tracker hands out the next waypoint. Your path finding keeps the waypoint clear of obstacles; `setWaypoint` replaces it.

### vision, memory and hearing

`PerceptMemory.sense(id, eye, yaw, sighting, light, t)` answers whether an object is visible from the field of view, its size, motion and the daylight; occlusion is yours to answer in `sighting.occluded`. `recall(id, now)` gives the remembered position with an error that grows with the square root of its age. `localizeSound` adds per animal azimuth error and front back confusion. `Looming.observe(id, size, dist, now)` returns tau when an object grows fast enough to startle, with a refractory window.

### the eye and the grid

`Eye` in `/three` places a camera on the head, renders an object ID buffer and an RG packed depth buffer, and reads them back: `pass(tracked)` synchronously, or `passAsync(tracked)`, which returns null while a pass is in flight. Instanced and skinned meshes land where the ID pass draws them. `OccupancyGrid.integrate(camera, depth, ...)` turns that depth into free and occupied cells; `path(a, b)` runs A* with no corner cutting and line of sight smoothing, and `frontiers(p)` lists the edges of what is known.

### pages opened from file://

`dist/senses.iife.js` is a classic script that defines `HackbuildSenses` with the wasm inlined and needs nothing on the page. The eye is a second classic script, `dist/senses-three.iife.js` (`@hackbuild/senses/three-iife`), that defines `HackbuildSensesThree` and reads `THREE` from the page; three 0.186 ships no classic script, so set `window.THREE` from a module first.

## API overview

| export | what it does |
|---|---|
| [`load`](../../docs/api/senses/index.md#load) | instantiate the wasm, inlined or from a url or bytes |
| [`seededRng`](../../docs/api/senses/index.md#seededrng) | Mulberry32, the stream the crate uses |
| [`Saliency`](../../docs/api/senses/index.md#saliency) | saliency map, fixation and inhibition of return |
| [`cameraLook`](../../docs/api/senses/index.md#cameralook) | a camera array from a head pose |
| [`Looming`](../../docs/api/senses/index.md#looming) | startle on a looming object |
| [`OdourField`](../../docs/api/senses/index.md#odourfield) | puff plume and ground trail grid |
| [`Sniffer`](../../docs/api/senses/index.md#sniffer) | two nostril sniffing in bouts |
| [`Tracker`](../../docs/api/senses/index.md#tracker) | scent tracking with trail, surge and cast |
| [`PerceptMemory`](../../docs/api/senses/index.md#perceptmemory) | field of view vision and remembered positions |
| [`localizeSound`](../../docs/api/senses/index.md#localizesound) | sound azimuth with error |
| [`timeToContact`](../../docs/api/senses/index.md#timetocontact) | tau from angular size growth |
| [`OccupancyGrid`](../../docs/api/senses/index.md#occupancygrid) | grid from eye depth, A* paths, frontiers |
| [`Eye`](../../docs/api/senses/three.md#eye) | the three eye: ID and depth renders read back |
| [`cameraFromThree`](../../docs/api/senses/three.md#camerafromthree) | a camera array from a PerspectiveCamera |

The full reference is in [docs/api/senses](../../docs/api/senses/README.md).

## Browser support

| feature | needs | Chrome | Safari | Firefox | phone |
|---|---|---|---|---|---|
| every class in the main entry | wasm with SIMD128, no threads | yes | 16.4 and later (inferred) | yes (inferred) | yes (inferred) |
| `Eye` in `/three` | WebGL2 through three | yes | yes (inferred) | yes (inferred) | yes (inferred) |
| `Eye.passAsync` | `readRenderTargetPixelsAsync` in three | yes | unknown | unknown | unknown |
| page opened from file:// | the classic scripts `senses.iife.js` and `senses-three.iife.js` | yes | unknown | unknown | unknown |

No wasm threads are used, so no page needs cross origin isolation.

## Errors and troubleshooting

| message | cause | what to do |
|---|---|---|
| `@hackbuild/senses: wasm not loaded. call load() first.` | a class or `cameraLook` ran before the wasm loaded | `await load()` once before constructing |
| `saliency grid must be at least 8 by 8` | `Saliency` got `width` or `height` under 8 | use a grid of 8 by 8 or more; the default is 80 by 40 |
| `frame is shorter than width * height * 4` | `Saliency.update` got a frame smaller than its size says | pass RGBA bytes of exactly width by height |
| `camera needs 16 numbers: position, right, up, back, fov, aspect, near, far` | a camera array of the wrong length | build it with `cameraLook` or `cameraFromThree` |
| `depth is shorter than width * height` | `OccupancyGrid.integrate` got a short depth buffer | pass the `depth` of an `EyePass` with its `depthWidth` and `depthHeight` |

The wasm messages arrive as `Error` objects thrown from the wasm glue. If `load(url)` fails, the error is the browser's fetch or WebAssembly compile error; check the URL serves `senses_bg.wasm`, or call `load()` with no argument for the inlined copy.

## Works with

- [@hackbuild/drives](../drives/README.md) turns what the senses report into drives and a choice.
- [@hackbuild/mover](../mover/README.md) walks the agent to the tracker's waypoint or along a grid path.
- [@hackbuild/cameras](../cameras/README.md) frames the scene the eye looks at, and its first person eye hides the head the same way.
- [@hackbuild/tunables](../tunables/README.md) puts the saliency and plume options on a panel.
- [@hackbuild/scenario](../scenario/README.md) runs a sim that uses them in lockstep and compares traces.

## Changelog and licences

Changes are in the repository [CHANGELOG](../../CHANGELOG.md). Code is MIT ([LICENSE](../../LICENSE)); this README is CC-BY-4.0 with its code samples also MIT. The wasm contains compiled libm (MIT) and wasm-bindgen (MIT or Apache-2.0) code; [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt) carries their notices. The models follow Itti, Koch and Niebur 1998; Lee 1976 (tau); Celani, Villermaux and Vergassola 2014 (plumes); Craven 2010 and Thesen 1993 (sniffing); Hepper and Wells 2005 (trail direction); Guerineau 2022 (dog azimuth error); Fiset 2003 (memory drift); Barber 2016 (fixation duration).

## What is verified, and what is not

### Verified

| date | check | result |
|---|---|---|
| 2026-11-25 | `npx vitest run packages/senses` | 17 of 17 tests pass (counted) |
| 2026-11-22 | `cargo test -p hackbuild-senses`, and the shared `hackbuild-agent-rng` crate | 18 of 18 and 2 of 2 pass (counted); clippy clean natively and for wasm32 |
| 2026-11-22 | golden trace, 64 values over every module, seed 20261122 | bit identical between the native and the wasm build |
| 2026-11-22 | the eye in headless Chrome 150 with swiftshader | tracked box seen at 276 pixels and 1.90 m (computed 1.9 m); four wall cells marked from depth; the async pass returns the same sighting |
| 2026-11-23 | the eye on an instanced box and a skinned box posed by its bone | 131 pixels at 2.93 m and 48 pixels at 3.54 m (measured; computed about 2.9 m and 3.5 m) |
| 2026-11-23 | the classic scripts from file:// in headless Chrome with no `THREE` on the page | the tunables, senses, drives, mover and cameras scripts load and run |

### Parity with the dog-simulator legacy senses

The attention, nose and hearing follow the public [dog-simulator legacy](https://github.com/hackbuild/dog-simulator/tree/main/legacy) code (MIT parts). Fixtures hold numbers that code produced at commit bc2cf6c on the seeded inputs in `test/parity-inputs.ts`; hand transcriptions are a second check.

| date | check | tolerance | result |
|---|---|---|---|
| 2026-11-23 | saliency map and winner, 300 frames at five sizes, flat frames included (fixture) | bit identical | 300 of 300 maps and winners |
| 2026-11-23 | three fixation sequences, 360 frames: top down bias, inhibition of return across head turns, shifts, dwell, snapping (fixture) | winner equal, map sums within 1e-6, fixation within 1e-9 m | 360 of 360 winners, 36 of 36 shifts, fixation within 1.2e-14 m (measured) |
| 2026-11-23 | plume, three runs of 2,400 to 3,000 steps, 1 to 12 sources, at the 600 puff cap (fixture) | puff count equal every step, values within 1e-9 | counts equal, 3.6e-15 (measured) |
| 2026-11-23 | saliency on 240 frames with top down blobs (transcription) | winner 99 percent, map 1e-6 of max | 240 of 240, 0 |
| 2026-11-23 | plume after 10 s, one source (transcription) | under 1e-9 m | 8.9e-16 m (measured) |

### Not verified by anything

- Nobody has looked at the eye, the plume or the saliency map in a real browser at a real frame rate.
- The tracker and sniffer follow the same draw order and formulas as the legacy code, but no recorded run was compared.
- In the Chrome test the saliency fixated the ground at the left edge of the scene, not the box; fixation quality on real scenes is unknown.
- A WebGPU saliency path (pyramid from mip levels, no readback) is not written.
- The classic scripts on a page opened by double click: the fixtures load them with `--allow-file-access-from-files`.

## Size budget

| file | gzip (measured) | ceiling |
|---|---|---|
| `dist/index.js` (main entry, imports external) | 71,667 bytes | 75,250 bytes |
| `dist/wasm/senses_bg.wasm` | 46,483 bytes | 48,807 bytes |
| `dist/senses.iife.js` (single file build) | 71,794 bytes | 75,383 bytes |

Measured 2026-11-26 by `node tools/lint-packages.mjs` (gzip level 9) from the packed
tarball. Generated from `tools/size-budget.json`; CI fails when a file moves more than
5 percent from its row.
