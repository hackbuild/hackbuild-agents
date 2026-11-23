# @hackbuild/cameras

Gameplay cameras that share damping, shake and occlusion handling. They
drive any camera with `position.set`, `lookAt`, `fov` and `aspect` (a
three PerspectiveCamera fits) and import nothing at runtime. Group framing
is written for this library from the shared camera of [crownfall](https://github.com/virgilvox/crownfall) (MIT, same
author).

What is in it:

- `Follow`: third person behind a heading with damped target and yaw; a
  `clear(from, dir, max)` callback (your raycast) pulls the camera in at
  once when something blocks the view and eases it back out.
- `Group`: keeps every point on screen at a fixed pitch and yaw. The
  centre is pulled toward the arena centre first; the distance is then
  solved so every corner of the padded box round the points (`pad` in x
  and z, 1 m above and below) projects inside the screen band. Points
  can leave the screen only when `maxDistance` clamps the distance.
- `Orbit`: a free orbit driven by deltas (rotate, zoom, pan); input
  binding stays with the app.
- `FirstPerson`: an eye on an agent's head that scales the head to 0.001
  for its render only (learned in earlier builds: hiding the head object would
  hide the whole subtree).
- `Shake`: seeded value noise with decaying trauma (`Rng` injected). It
  draws only while shaking and holds two knots. Give it an Rng stream of
  its own, never the sim's: how many draws fall before a given sim time
  depends on the frame steps.
- `splitViewports`: one to four views, with the y flipped for three.
- `damp`: frame rate independent exponential damping.

Not written: the two shot and duel cameras of the games survey, and
shared shadow maps for split views.

## Use

```ts
import { Follow, Shake } from "@hackbuild/cameras";

const follow = new Follow(camera, { distance: 4, clear: (from, dir, max) => raycast(from, dir, max) });
const shake = new Shake(shakeRng); // a stream of its own, never the sim rng
follow.update(dog.position, dog.yaw, dt);
const s = shake.step(dt);
camera.position.x += s.x;
```

`dist/cameras.iife.js` is the single file build, a classic script that
defines `HackbuildCameras`.

## What is verified, and what is not

### Verified on this machine

- 2026-11-23: group framing over random point sets: 1,500 sets per
  camera, six cameras (fov 40 to 70, aspect 9:16 to 21:9, centre pull 0
  to 0.3, groups up to 20 m from the origin, three yaw and pitch pairs),
  39,650 points projected with three.js, the worst at 0.876 of the half
  screen (measured). Shake never kicked draws nothing over ten minutes
  at 60 Hz (before: 32,403 draws and 10,801 knots held, measured); kicked
  once at 0.5 it draws under 90 numbers (counted).
  Before the distance was solved from projected
  corners, 379 of 13,414 points left the screen at fov 50 and 16:9 with
  no centre pull, worst 1.29 (measured in an audit).
- 2026-11-22: `npx vitest run packages/cameras` passed 7 of 7 tests
  (counted): damping agrees at 60 and 30 Hz to 1e-9, group framing keeps
  three spread points inside the three.js frustum, follow sits behind the
  heading and pulls in to 1.2 m behind a wall at 1.5 m, shake replays from
  a seed and decays, orbit pans to the view's right, the first person
  render hides and restores the head, split viewports for 1, 3 and 4.

### Not verified by anything

- Any camera in a real browser at real frame rate: nobody has looked.
- Shake feel and follow smoothing values are starting values (inferred).

## Size budget

| file | raw | gzip |
|---|---|---|
| `cameras.iife.js` | 10,133 bytes | 3,378 bytes |

Measured 2026-11-23 by tools/check-sizes.mjs (gzip level 9).

## Licence

Code MIT (`LICENSE`, a copy of the repository root one). This README is CC-BY-4.0, its
code samples also MIT.
