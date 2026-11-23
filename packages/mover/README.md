# @hackbuild/mover

A kinematic capsule mover and steering for agents that share space.
`World` is written for this library from the crownfall character physics
(MIT, same author); `Steerer` is new, written against the HACKLE
avoidance stall (hackle-plan 5.4 item 3) and the HACKLE lessons on
obstacles and footprints.

What is in it:

- `World`: capsules against axis aligned boxes and vertical cylinders,
  step up (0.36 m by default), ceilings, wall sliding, up to 6 substeps by
  distance, wall only colliders, and moving platform carry
  (`moveCollider`, then `endFrame`).
- `Steerer`, one per agent:
  - a passing side per neighbour, chosen from where the other stands
    (head on, each keeps right) and held at least 1 s;
  - neighbours bend the heading tangentially; the radial push only acts
    inside the clearance and the goal always keeps a share of the
    heading, so the push never turns the agent away and stops it;
  - yields: an agent with no goal, or a lower priority (ties by id),
    steps off the path of an agent whose closest approach comes within
    reach; a yield times out (1.5 s) and then cools down, so two
    yielders cannot wait on each other;
  - a stall detector: with a goal and under 0.2 m in 2 s, a side
    waypoint is inserted on the held side;
  - a target within 1.3 m of a neighbour switches off its push (the
    follow spot beside a leader);
  - footprints of several circles or capsules per object (a bench with
    two ends), handled as constraints: the inward part of the heading
    goes and a tangent on the held side comes in;
  - per agent filters: an `ignore` set for the goal object or the
    agent's own body;
  - a `why` string per step.
- No random draws: the same inputs give the same steps.

## Install

Not published yet. From a clone:

    npm ci && npm run build -w @hackbuild/mover

## Use

```ts
import { Steerer, World, box } from "@hackbuild/mover";

const world = new World([box(0, 0, 0, 40, 40)]);
const steer = new Steerer("human");
steer.setGoal(0, 4);
const out = steer.update(now, human, [human, dog], [benchFootprint], new Set(["ball"]));
human.vel.x = out.vx;
human.vel.z = out.vz;
world.step(human, dt);
```

`dist/mover.iife.js` is the single file build, a classic script that
defines `HackbuildMover`.

## Develop

    source ~/.nvm/nvm.sh && nvm use 22.18.0
    npm run build -w @hackbuild/mover
    npx vitest run packages/mover

## What is verified, and what is not

### Verified on this machine

- 2026-11-23: `npx vitest run packages/mover` passed 10 of 10 tests
  (counted), the 9 below and four agents crossing at right angles with
  no overlap (closest gap 0.47 m at 60 Hz, measured; before the passing
  side was chosen at closest approach they overlapped by 0.13 m).
- 2026-11-22: 9 of 9 tests (counted): a head on corridor pass and a dog parked in the walker's path
  both finish with 0 to 1 s of stall (bound 1 s) and no overlap; the
  passing side holds for a second while the other drifts across; a yield
  times out; the follow spot is exempt; a bench of three parts is passed
  without contact and can be ignored; a stall against a wall inserts a
  side waypoint; the capsule steps onto 0.3 m, stops at 0.6 m, slides
  along a wall and rides a moving platform.

### Not verified by anything

- The fix for the logged stall itself: dog-simulator recorded the stall in
  corridor-pass seed 21 and parked-in-path seed 21; nobody has run those
  scenarios with this package. A transcription of the HACKLE field with a
  parked dog did not stall in isolation either (measured, offsets 0 to
  0.3 m), so the stall needs the moving dog to appear.
- Turn rate limits: the tests move point agents with a 0.15 s velocity
  lag and no heading dynamics.
- Motion in a real browser: nobody has looked at it.
- The triangle mesh collider and raycasts listed in the games survey are
  not written.

## Size budget

| file | raw | gzip |
|---|---|---|
| `mover.iife.js` | 13,480 bytes | 4,324 bytes |

Measured 2026-11-22 from the build log.

## Licence

Code MIT (`LICENSE` at the repository root). This README is CC-BY-4.0, its
code samples also MIT.
