# @hackbuild/mover

A kinematic capsule mover and steering for agents that share space.
`World` is written for this library from the character physics of
[crownfall](https://github.com/virgilvox/crownfall) (MIT, same author). `Steerer` is new, written
against an avoidance stall of the earlier dog simulator in
[dog-simulator/legacy](https://github.com/hackbuild/dog-simulator/tree/main/legacy): two agents
facing each other each turned away and stood still. It also carries
lessons of earlier builds on obstacles and footprints.

What is in it:

- `World`: capsules against axis aligned boxes and vertical cylinders,
  step up (0.36 m by default), ceilings, wall sliding, up to 6 substeps by
  distance, wall only colliders, and moving platform carry
  (`moveCollider`, then `endFrame`).
- `Steerer`, one per agent:
  - a passing side per neighbour, chosen from where the other will stand
    at closest approach (head on, each keeps right), held at least 1 s,
    renewed only while that approach is ahead and dropped once it is
    behind;
  - neighbours bend the heading along a tangent round the neighbour on
    the held side; the goal always keeps a share of the heading, so the
    bend never turns the agent away and stops it;
  - contact as a constraint: inside the clearance (0.25 m) of a
    neighbour the part of the heading toward it is removed and an
    outward push added, for every neighbour, the leader included;
  - yields: an agent with no goal, or a lower priority (ties by id),
    steps off the path of an agent whose closest approach comes within
    reach, under the same contact and footprint constraints; a yield
    times out (1.5 s) and then cools down, so two yielders cannot wait
    on each other;
  - a stall detector: with a goal and under 0.2 m in 2 s, a side
    waypoint is inserted on the held side, replacing the previous one;
    after 8 stalls on one goal (`maxStalls`) `unreachable` is true until
    the next `setGoal`;
  - `follow: id` names a leader; a target within 1.3 m of it switches
    off the leader's bend (the follow spot beside a leader);
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
// the steerer reads flat agent states; the world moves a capsule actor
const human = { id: "human", x: 0, z: -4, vx: 0, vz: 0, radius: 0.3, priority: 1 };
const body = { pos: { x: 0, y: 0, z: -4 }, vel: { x: 0, y: 0, z: 0 }, radius: 0.3, height: 1.7, grounded: true };
const out = steer.update(now, human, [human, dog], [benchFootprint], new Set(["ball"]));
body.vel.x = out.vx;
body.vel.z = out.vz;
world.step(body, dt);
Object.assign(human, { x: body.pos.x, z: body.pos.z, vx: body.vel.x, vz: body.vel.z });
```

`dist/mover.iife.js` is the single file build, a classic script that
defines `HackbuildMover`.

## Develop

    source ~/.nvm/nvm.sh && nvm use 22.18.0
    npm run build -w @hackbuild/mover
    npx vitest run packages/mover

## What is verified, and what is not

### Verified on this machine

- 2026-11-23, after the passing side fix: `npx vitest run
  packages/mover` passed 15 of 15 tests (counted), adding 1,000 seeded
  two agent crossings at 20 to 180 degrees with lateral and timing
  offsets, and 200 seeded layouts of 2 to 6 agents crossing a 10 m ring,
  all at 60 Hz: every agent arrived and none overlapped (closest gap
  0.166 m and 0.165 m, measured). The same layouts at 20, 30, 144 and
  240 Hz: no overlap, every agent arrived (measured, 500 and 100 layouts
  per rate). A goal in a closed pocket holds at most one side waypoint
  over 120 s and turns unreachable (before: one more waypoint per stall,
  11 after 120 s, measured). Before, 164 of the 1,000 and 61 of the 200 overlapped by
  more than 5 cm, worst 0.639 m (measured). A yielding dog beside a
  bench ends touching its surface, 0 m inside (before: 0.397 m inside, measured).
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
  scenarios with this package. A transcription of the legacy field with a
  parked dog did not stall in isolation either (measured, offsets 0 to
  0.3 m), so the stall needs the moving dog to appear.
- Turn rate limits: the tests move point agents with a 0.15 s velocity
  lag and no heading dynamics.
- Motion in a real browser: nobody has looked at it.
- The triangle mesh collider and raycasts listed in the games survey are
  not written.

## Size budget

| file | gzip (measured) | ceiling |
|---|---|---|
| `dist/index.js` (main entry, imports external) | 4,761 bytes | 4,999 bytes |
| `dist/mover.iife.js` (single file build) | 4,883 bytes | 5,127 bytes |

Measured 2026-11-23 by `node tools/lint-packages.mjs` (gzip level 9) from the packed
tarball. Generated from `tools/size-budget.json`; CI fails when a file moves more than
5 percent from its row.

## Licence

Code MIT (`LICENSE`, a copy of the repository root one). This README is CC-BY-4.0, its
code samples also MIT.
