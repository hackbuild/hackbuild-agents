# @hackbuild/mover

A kinematic capsule mover and steering for agents that share space, with a grid path planner over the world colliders.

[![npm](https://img.shields.io/npm/v/@hackbuild/mover)](https://www.npmjs.com/package/@hackbuild/mover) [![licence MIT](https://img.shields.io/badge/licence-MIT-blue)](../../LICENSE) ![gzip 7.3 kB measured](https://img.shields.io/badge/gzip-7.3%20kB-blue) ![types included](https://img.shields.io/badge/types-included-blue)

## What it does

- Moves capsules against axis aligned boxes and vertical cylinders, with step up, ceilings, wall sliding, substeps by distance and moving platform carry.
- Steers each agent among the others: a passing side per neighbour held for at least a second, so two agents head on each keep right instead of turning away and standing still.
- Keeps contact as a constraint, yields on a timer with a cool down, and inserts a side waypoint when an agent stalls.
- Plans a path round walls with A* on a grid over the colliders, pulled straight, for the steerer to walk.
- Draws no random numbers: the same inputs give the same steps.

## Install

```sh
npm install @hackbuild/mover
```

No dependencies and no peers. It works on plain numbers, so a three scene, another renderer or none at all fits. `dist/mover.iife.js` is the single file build, a classic script that defines `HackbuildMover` for pages opened from file://.

## Quick start

```ts
import { type Actor, Steerer, World, box } from "@hackbuild/mover";

// two walkers head on in a 20 m yard; each keeps right and both arrive
const world = new World([box(0, 0, 0, 20, 20)]);
const walkers = [-4, 4].map((z, i) => {
  const steer = new Steerer(`w${i}`);
  steer.setGoal(0, -z);
  const body: Actor = { pos: { x: 0, y: 0, z }, vel: { x: 0, y: 0, z: 0 }, radius: 0.3, height: 1.7, grounded: true };
  return { steer, body, state: { id: `w${i}`, x: 0, z, vx: 0, vz: 0, radius: 0.3 } };
});
for (let t = 0, dt = 1 / 60; t < 12; t += dt) {
  const states = walkers.map((w) => w.state);
  for (const { steer, body, state } of walkers) {
    const out = steer.update(t, state, states);
    Object.assign(body.vel, { x: out.vx, z: out.vz });
    world.step(body, dt);
    Object.assign(state, { x: body.pos.x, z: body.pos.z, vx: out.vx, vz: out.vz });
  }
}
console.log(walkers.map((w) => `${w.state.id} at ${w.state.x.toFixed(2)}, ${w.state.z.toFixed(2)}`).join("; "));
```

## Live example

The [mover page](https://hackbuild.github.io/hackbuild-agents/mover/) runs capsule movers in a yard: a held passing side, timed yields, a bench of several parts and the stall detector, with the code beside it.

## Concepts

### a world of capsules and colliders

`World` holds `box`, `cyl`, `wallBox` and `wallCyl` colliders. `step(actor, dt)` moves one `Actor` (feet position, velocity, radius, height) in up to 6 substeps of at most 0.3 m each. Tops up to `STEP_UP` (0.36 m) above the feet are walked onto; wall colliders only push sideways and are never stood on. To carry actors on a platform, call `moveCollider` on it before stepping and `endFrame()` once after every actor has stepped.

### one steerer per agent

A `Steerer` reads flat `AgentState` records of every agent each step and returns a velocity, a mode (`arrived`, `go`, `pass` or `yield`) and a `why` string. You apply the velocity yourself, with a `World` or any other mover, and write the new position back into the state. `setGoal` resets the stall history, so a completion from the last goal never carries over.

### passing sides and contact

For each neighbour the steerer picks a side from where the other will stand at closest approach and holds it at least `holdSide` seconds (1 s), renewed while that approach is ahead and dropped once it is behind. Neighbours bend the heading along a tangent on the held side, and the goal always keeps a share of the heading. Inside the clearance (0.25 m) of a neighbour the part of the heading toward it is removed and an outward push added, for every neighbour.

### yields and stalls

An agent with no goal, or a lower `priority` (ties by id), steps off the path of one whose closest approach comes within reach. A yield lasts at most `yieldTimeout` (1.5 s), then cools down for `yieldCooldown` (2 s), so two yielders cannot wait on each other. With a goal and under 0.2 m covered in 2 s, a side waypoint is inserted on the held side; after `maxStalls` (8) on one goal, `unreachable` reads true until the next `setGoal`.

### footprints and filters

Obstacles are `Footprint`s of several circles or capsules, such as a bench with two ends; the inward part of the heading goes and a tangent on the held side comes in. Pass an `ignore` set to `update` for the goal object or the agent's own body. `follow: id` names a leader: a target within 1.3 m of it switches off the leader's bend, so a follower can reach a spot beside it.

### paths round walls

The steerer bends round one obstacle at a time, so a wall across the line to the goal costs it repeated stalls. `planPath` grows every collider the actor cannot step onto by its radius and a margin, runs A* on the grid with 8 way moves and no corner cutting, then pulls the path straight. Hand the waypoints to `setPath`.

```ts
import { planPath, Steerer, World, box, wallBox } from "@hackbuild/mover";

const world = new World([box(0, 0, 0, 12, 12), wallBox(0, 0, 6, 0.2, 0, 2)]);
const p = planPath(world, { x: 0, z: -2 }, { x: 0, z: 2 }, { radius: 0.3, cell: 0.2 });
const steer = new Steerer("walker");
if (p.ok) steer.setPath(p.waypoints);
else console.log(p.reason, p.why); // "goal-blocked", "no-way" or "too-large"
```

Options: `cell` (0.2 m), `radius` (0.3 m), `margin` (0.12 m), `y` and `height` for the band a collider must cross to block (0 and 1.7 m), `stepUp` (the world's), `bounds` (default the box round every enabled collider and both ends) and `maxCells` (250,000). The goal must clear the grown colliders; the start may sit inside the pad. A gap within one cell of `2 * (radius + margin)` may read as shut, so use a smaller `cell` there. `blockers` and `clearAt` give the same tests the planner uses. The plan is static: plan again after colliders move.

## API overview

| export | what it does |
|---|---|
| [`World`](../../docs/api/mover/README.md#world) | moves capsule actors against the colliders |
| [`box`](../../docs/api/mover/README.md#box), [`cyl`](../../docs/api/mover/README.md#cyl) | colliders you can stand on |
| [`wallBox`](../../docs/api/mover/README.md#wallbox), [`wallCyl`](../../docs/api/mover/README.md#wallcyl) | colliders that only push sideways |
| [`moveCollider`](../../docs/api/mover/README.md#movecollider) | move a collider and record the motion for carry |
| [`STEP_UP`](../../docs/api/mover/README.md#step_up) | the default step height, 0.36 m |
| [`Steerer`](../../docs/api/mover/README.md#steerer) | steering for one agent among others |
| [`nearest`](../../docs/api/mover/README.md#nearest) | surface distance and normal to a footprint |
| [`planPath`](../../docs/api/mover/README.md#planpath) | A* path round the colliders, pulled straight |
| [`blockers`](../../docs/api/mover/README.md#blockers), [`clearAt`](../../docs/api/mover/README.md#clearat) | the planner's blocking colliders and clearance test |

The full reference is in [docs/api/mover](../../docs/api/mover/README.md).

## Browser support

| feature | needs | Chrome | Safari | Firefox | phone |
|---|---|---|---|---|---|
| `World`, `Steerer`, `planPath` | ES2022, plain TypeScript | yes | yes | yes | yes |
| `dist/mover.iife.js` from file:// | a classic script | yes | yes | yes | yes |

The package uses no browser API, so it runs the same in Node, a worker or a page.

## Errors and troubleshooting

The package throws no errors of its own. What can go wrong shows in its results:

| message | cause | what to do |
|---|---|---|
| `planPath` result `reason: "goal-blocked"` | the goal sits inside a grown collider | move the goal clear of colliders by the radius plus margin |
| `planPath` result `reason: "no-way"` | no route on the grid, or a gap narrower than one cell over the pad | use a smaller `cell`, or open the gap |
| `planPath` result `reason: "too-large"` | the grid would pass `maxCells` | pass tighter `bounds` or a larger `cell` |
| `steerer.unreachable` is true | 8 stalls on one goal | plan a path with `planPath`, or pick another goal |
| an actor sinks or floats | no collider top under it, or `grounded` left false | put a floor `box` under the yard |

## Works with

- [@hackbuild/drives](../drives/README.md) picks the act; the mover walks to where the act happens.
- [@hackbuild/senses](../senses/README.md) gives the occupancy and saliency an agent heads for.
- [@hackbuild/cameras](../cameras/README.md) follows or frames the agents the mover moves.
- [@hackbuild/scenario](../scenario/README.md) runs lockstep scenarios such as a corridor pass and checks the motion metrics.

## Changelog and licences

Changes are in the repository [CHANGELOG](../../CHANGELOG.md). Code is MIT ([LICENSE](../../LICENSE)); `World` is written from the character physics of [crownfall](https://github.com/virgilvox/crownfall) (MIT, same author). This README is CC-BY-4.0 with its code samples also MIT.

## What is verified, and what is not

### Verified on this machine

| date | check | result |
|---|---|---|
| 2026-11-22 | head on corridor pass and a dog parked in the walker's path | 0 to 1 s of stall (bound 1 s), no overlap (measured) |
| 2026-11-22 | passing side held while the other drifts across; yield timeout; follow spot; a bench of three parts passed without contact and ignorable; stall side waypoint; step onto 0.3 m, stop at 0.6 m, wall slide, moving platform | 9 of 9 tests pass (counted) |
| 2026-11-23 | four agents crossing at right angles, 60 Hz | no overlap, closest gap 0.47 m (measured) |
| 2026-11-23 | 1,000 seeded two agent crossings at 20 to 180 degrees, 60 Hz | all arrive, none overlap, closest gap 0.166 m (measured) |
| 2026-11-23 | 200 seeded layouts of 2 to 6 agents crossing a 10 m ring, 60 Hz | all arrive, none overlap, closest gap 0.165 m (measured) |
| 2026-11-23 | the same layouts at 20, 30, 144 and 240 Hz, 500 and 100 layouts per rate | all arrive, none overlap (measured) |
| 2026-11-23 | a goal in a closed pocket for 120 s | at most one side waypoint, then `unreachable` (measured) |
| 2026-11-23 | a yielding dog beside a bench | ends touching its surface, 0 m inside (measured) |
| 2026-11-24 | round a 6 m wall, 60 Hz | planned walk arrives in 7.22 s, steerer alone in 23.80 s (measured) |
| 2026-11-24 | a 1.2 m gap, a 0.6 m gap, a closed pen, a goal inside a wall, a 0.3 m step, two equal runs | planned and walked; `no-way`; `no-way`; `goal-blocked`; walked over; equal. 20 of 20 tests pass (counted) |

### Not verified by anything

- The corridor pass and parked in path scenarios of the dog simulator with this package.
- Turn rate limits: the tests move point agents with a 0.15 s velocity lag and no heading dynamics.
- Motion in a real browser beyond the package page.
- The planner against moving colliders, agents as obstacles, or worlds over 250,000 cells.
- A triangle mesh collider and raycasts: not written.

## Size budget

| file | gzip (measured) | ceiling |
|---|---|---|
| `dist/index.js` (main entry, imports external) | 7,317 bytes | 7,682 bytes |
| `dist/mover.iife.js` (single file build) | 7,458 bytes | 7,830 bytes |

Measured 2026-11-26 by `node tools/lint-packages.mjs` (gzip level 9) from the packed
tarball. Generated from `tools/size-budget.json`; CI fails when a file moves more than
5 percent from its row.
