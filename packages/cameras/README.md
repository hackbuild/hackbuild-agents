# @hackbuild/cameras

Gameplay cameras that share damping, shake and occlusion handling. They
drive any camera with `position.set`, `lookAt`, `fov` and `aspect` (a
three PerspectiveCamera fits) and import nothing at runtime. Group framing
is written for this library from the crownfall shared camera (MIT, same
author).

What is in it:

- `Follow`: third person behind a heading with damped target and yaw; a
  `clear(from, dir, max)` callback (your raycast) pulls the camera in at
  once when something blocks the view and eases it back out.
- `Group`: keeps every point on screen at a fixed pitch, solving the
  distance from the field of view, padding and a usable screen band, with
  a pull toward the arena centre.
- `Orbit`: a free orbit driven by deltas (rotate, zoom, pan); input
  binding stays with the app.
- `FirstPerson`: an eye on an agent's head that scales the head to 0.001
  for its render only (the HACKLE lesson: hiding the head object would
  hide the whole subtree).
- `Shake`: seeded value noise with decaying trauma (`Rng` injected).
- `splitViewports`: one to four views, with the y flipped for three.
- `damp`: frame rate independent exponential damping.

Not written: the two shot and duel cameras of the games survey, and
shared shadow maps for split views.

## Use

```ts
import { Follow, Shake } from "@hackbuild/cameras";

const follow = new Follow(camera, { distance: 4, clear: (from, dir, max) => raycast(from, dir, max) });
const shake = new Shake(rng);
follow.update(dog.position, dog.yaw, dt);
const s = shake.step(dt);
camera.position.x += s.x;
```

`dist/cameras.iife.js` is the single file build, a classic script that
defines `HackbuildCameras`.

## What is verified, and what is not

### Verified on this machine

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
| `cameras.iife.js` | 9,033 bytes | 3,030 bytes |

Measured 2026-11-22 from the build log.

## Licence

Code MIT (`LICENSE` at the repository root). This README is CC-BY-4.0, its
code samples also MIT.
