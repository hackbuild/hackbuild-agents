# @hackbuild/cameras

Gameplay cameras for a browser sim: follow, group framing, orbit, first person and split views, with shared damping, seeded shake and occlusion pull in.

[![npm](https://img.shields.io/npm/v/@hackbuild/cameras)](https://www.npmjs.com/package/@hackbuild/cameras) [![licence MIT](https://img.shields.io/badge/licence-MIT-blue)](../../LICENSE) ![gzip 3.3 kB measured](https://img.shields.io/badge/gzip-3.3%20kB-blue) ![types included](https://img.shields.io/badge/types-included-blue)

## What it does

- Follows a moving target from behind its heading, and pulls in at once when your raycast says something blocks the view.
- Frames a group of points so every one stays on screen at a fixed pitch and yaw.
- Orbits, zooms and pans from deltas, so input binding stays with your app.
- Puts an eye on an agent's head and hides that head for its own render only.
- Shakes with seeded value noise and decaying trauma, and splits the screen into one to four views.

## Install

```sh
npm install @hackbuild/cameras three
```

The package imports nothing at run time. It writes `position.set`, `lookAt`, `fov` and `aspect` on the camera you pass, so a three `PerspectiveCamera` fits; three (`>=0.186.1 <0.188.0`) is a peer only for its types and for your scene. The quick start below uses three for the camera.

## Quick start

```ts
import { Follow, Shake } from "@hackbuild/cameras";
import { PerspectiveCamera } from "three";

const camera = new PerspectiveCamera(50, 16 / 9, 0.1, 200);
// your raycast: here a wall 2 m behind the look target, along -z
const clear = (from: { z: number }, dir: { z: number }, max: number) => (dir.z < 0 ? Math.min(max, 2 / -dir.z) : max);
const follow = new Follow(camera, { distance: 4, clear });

// shake takes a seeded stream of its own, never the sim's
let seed = 7;
const shake = new Shake(() => ((seed = (seed * 16807) % 2147483647) / 2147483647));
shake.kick(0.4);

const dog = { x: 0, y: 0, z: 0, yaw: 0 };
for (let frame = 0; frame < 60; frame++) {
  dog.z += 0.02;
  follow.update(dog, dog.yaw, 1 / 60);
  camera.position.add(shake.step(1 / 60));
}
console.log(camera.position.toArray(), follow.dist);
```

## Live example

- The package page runs every rig on one moving target: [hackbuild-agents/cameras](https://hackbuild.github.io/hackbuild-agents/cameras/).
- The suite example: [a camera that follows](https://hackbuild.github.io/hackbuild-suite/#/examples/think/cameras).
- The [dog simulator](https://hackbuild.github.io/dog-simulator/) uses the follow camera for its side view.

## Concepts

### a camera you pass in

Every rig takes a `CameraLike`: an object with `position.set`, `lookAt`, `fov` and `aspect`. The package never imports three, so it adds about 3 kB to a page that already has a renderer, and a test can pass a plain object.

### damping that ignores the frame rate

`damp(from, to, rate, dt)` is exponential damping toward a target at a rate per second. Two runs at 60 Hz and 30 Hz land on the same value, so the camera feels the same on a slow phone.

### follow and occlusion

`Follow` sits behind the target's heading (yaw 0 faces +Z), with the target and the yaw damped on their own rates. Pass `clear(from, dir, max)`, your raycast from the look target toward the camera; when the free distance is shorter than `distance`, the camera moves in at once to that distance less `backoff`, never closer than `minDistance`, and eases back out when the view clears.

### group framing

`Group` keeps every point on screen. The framing centre is pulled toward `center` by `centerPull` first; the distance is then solved so every corner of the padded box round the points (`pad` in x and z, 1 m above and below) projects inside the screen band. Points can leave the screen only when `maxDistance` clamps the distance. `solve(points)` gives the target and distance without damping.

### orbit, first person and split views

`Orbit` takes `rotate`, `zoom` and `pan` deltas and clamps pitch and distance; call `apply()` after. `FirstPerson` places an eye a little forward and up from the head; `render(draw)` scales the head to 0.001 for that draw and restores it after, since hiding the head object would hide its whole subtree. `splitViewports(n, width, height)` gives one to four rectangles with `yGl` flipped for three's bottom left origin; with three views the third spans the bottom row.

### shake on its own stream

`Shake` draws three numbers per knot, `frequency` knots a second, and only while it shakes. How many draws fall before a given sim time depends on the frame steps, so give it an `Rng` of its own; sharing the sim's stream would tie the sim to the frame rate.

## API overview

| export | what it does |
|---|---|
| [`Follow`](../../docs/api/cameras/README.md#follow) | third person follow with occlusion pull in |
| [`Group`](../../docs/api/cameras/README.md#group) | keep every point of a group on screen |
| [`Orbit`](../../docs/api/cameras/README.md#orbit) | free orbit from rotate, zoom and pan deltas |
| [`FirstPerson`](../../docs/api/cameras/README.md#firstperson) | an eye on a head that hides the head for its render |
| [`Shake`](../../docs/api/cameras/README.md#shake) | seeded value noise shake with decaying trauma |
| [`splitViewports`](../../docs/api/cameras/README.md#splitviewports) | one to four split view rectangles |
| [`damp`](../../docs/api/cameras/README.md#damp) | frame rate independent exponential damping |
| [`orbitPosition`](../../docs/api/cameras/README.md#orbitposition) | a camera point on an orbit round a target |
| [`CameraLike`](../../docs/api/cameras/README.md#cameralike) | the camera surface the rigs write |

The full reference is in [docs/api/cameras](../../docs/api/cameras/README.md).

## Browser support

| feature | needs | Chrome | Safari | Firefox | phone |
|---|---|---|---|---|---|
| every rig | plain JavaScript, no DOM | yes | yes (inferred) | yes (inferred) | yes (inferred) |
| page opened from file:// | the classic script `dist/cameras.iife.js`, global `HackbuildCameras` | yes | yes (inferred) | yes (inferred) | unknown |

No WebGPU, wasm or worker is used. Rendering is your renderer's.

## Errors and troubleshooting

The package throws no errors of its own. What goes wrong is configuration:

- The camera snaps to the target every frame: `snap` is passed on every `update`. Pass it only on the first frame or after a teleport.
- The follow camera clips into walls: there is no `clear` callback. Pass your raycast as `clear(from, dir, max)`.
- A seeded replay drifts once the camera shakes: `Shake` shares the sim's rng. Give it a stream of its own.
- A split view is upside down in three: the top left `y` went to `setViewport`. Use `yGl` for three.

## Works with

- [@hackbuild/senses](../senses/README.md) renders its eye from a head point; `FirstPerson` is the same idea for the player's view.
- [@hackbuild/agents-views](../agents-views/README.md) draws the eye card through `FirstPerson`, so the dog's own head is hidden in its view.
- [@hackbuild/mover](../mover/README.md) moves the agents the cameras follow.
- [@hackbuild/tunables](../tunables/README.md) exposes damping and distance values to a panel for tuning.

## Changelog and licences

Changes are in the repository [CHANGELOG](../../CHANGELOG.md). Code is MIT ([LICENSE](../../LICENSE)); this README is CC-BY-4.0 with its code samples also MIT. Group framing is written for this library from the shared camera of [crownfall](https://github.com/virgilvox/crownfall) (MIT, same author).

## What is verified, and what is not

| date | check | result |
|---|---|---|
| 2026-11-25 | `npx vitest run packages/cameras` | 9 of 9 tests pass (counted) |
| 2026-11-23 | group framing over random point sets: 1,500 sets per camera, six cameras (fov 40 to 70, aspect 9:16 to 21:9, centre pull 0 to 0.3, groups up to 20 m from the origin), 39,650 points projected with three.js | worst point at 0.876 of the half screen (measured) |
| 2026-11-23 | the same sets before the distance was solved from projected corners | 379 of 13,414 points off screen at fov 50 and 16:9, worst 1.29 (measured) |
| 2026-11-23 | shake never kicked, ten minutes at 60 Hz | no draws (counted) |
| 2026-11-23 | shake kicked once at 0.5 | under 90 draws (counted) |
| 2026-11-22 | damping at 60 and 30 Hz | agrees to 1e-9 (measured) |
| 2026-11-22 | follow behind a wall at 1.5 m | pulls in to 1.2 m (measured) |
| 2026-11-22 | first person render, orbit pan, split viewports for 1, 3 and 4 | head hidden and restored; pan goes to the view's right; rectangles as expected |

Not verified by anything:

- Any camera in a real browser at a real frame rate has not been looked at by a person.
- Shake feel and follow smoothing values are starting values, not tuned against users.
- The two shot and duel cameras, and shared shadow maps for split views, are not written.

## Size budget

| file | gzip (measured) | ceiling |
|---|---|---|
| `dist/index.js` (main entry, imports external) | 3,251 bytes | 3,413 bytes |
| `dist/cameras.iife.js` (single file build) | 3,366 bytes | 3,534 bytes |

Measured 2026-11-26 by `node tools/lint-packages.mjs` (gzip level 9) from the packed
tarball. Generated from `tools/size-budget.json`; CI fails when a file moves more than
5 percent from its row.
