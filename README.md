# hackbuild-agents

Embodied agent building blocks for browser sims and games: senses, drives, tunable parameters, movers, cameras and a lockstep scenario test runner.

Live examples: <https://hackbuild.github.io/hackbuild-agents/>

Status: phase A, 2026-11-22. Packages land in `packages/` as they pass
their tests; the table below grows with them.

| package | lang | what | tests |
|---|---|---|---|
| [`@hackbuild/tunables`](packages/tunables) | TS | parameter registry, layer switches, presets, URL hash sharing, panel binding | 17 vitest |
| [`@hackbuild/senses`](packages/senses) | Rust + TS | Itti Koch saliency, looming, odour plume and trail tracking, hearing, field of view memory, eye renders to an occupancy grid | 19 cargo, 17 vitest (2 in Chrome) |
| [`@hackbuild/drives`](packages/drives) | Rust + TS | drive reduction reward, softmax choice with commitment and a why, cue learning, sleep and body clock, memory stream, task gating, inference scheduling | 13 cargo, 19 vitest |
| [`@hackbuild/scenario`](packages/scenario) | Node TS | lockstep scenario runner on puppeteer-core and the system Chrome, routed pinned requests, goldens, motion metrics, frame sampler, profiler, check message reports | 16 vitest (8 in Chrome) |
| [`@hackbuild/mover`](packages/mover) | TS | kinematic capsule mover, steering with a held passing side, timed yields, multi part footprints and a stall detector | 15 vitest |
| [`@hackbuild/cameras`](packages/cameras) | TS | follow with occlusion pull in, group framing, orbit, first person eye, seeded shake, split views | 9 vitest |

Counted 2026-11-23. The shared `crates/rng` crate adds 2 cargo tests, and
`tools/test` 48 node tests for the hooks, the voice and author linters
and the package metadata.

## Install

Not on npm yet. From a clone, with Node 22.18 and the Rust toolchain in
CONTRIBUTING.md:

    npm ci && npm run build

Each package's `dist/` then holds ES modules with types, and a single
file classic script (`dist/<name>.iife.js`) for pages opened from
file://; senses and drives inline their wasm there.

## Use

```ts
import { createRegistry } from "@hackbuild/tunables";
import { load as loadSenses, Saliency, seededRng } from "@hackbuild/senses";
import { load as loadDrives, Drives } from "@hackbuild/drives";
import { Steerer } from "@hackbuild/mover";

await Promise.all([loadSenses(), loadDrives()]); // no argument: the inlined wasm; or pass a URL or bytes
const rng = seededRng(7); // inject one Rng; no package calls Math.random
const sal = new Saliency({ rng });
const drives = new Drives({ hunger: 1, play: 0.8 });
const steer = new Steerer("dog");
```

Each package README has a Use section of its own.

## Examples

One page per package, built from `examples/` and published at
<https://hackbuild.github.io/hackbuild-agents/>. Every shape is built in
code; no model, asset or weight file is loaded. `npm run examples` builds
them into `_site/`, and into `_site/single/` one HTML per page that opens
from disk; `npm run examples:check` runs the browser checks.

## Develop

    source ~/.nvm/nvm.sh && nvm use
    npm ci
    npm test

`npm ci` sets `core.hooksPath` to `.githooks`. Rules for every change are
in RULES.md and CONTRIBUTING.md.

## What is verified, and what is not

Each package README carries its own dated list. Across the repository:

Parity with the earlier dog simulator the senses, drives and tunables
were written from (its code is public in
[dog-simulator/legacy](https://github.com/hackbuild/dog-simulator/tree/main/legacy)),
measured against fixtures produced by running that code on seeded inputs
(tolerances in each README): saliency maps bit identical on 300 frames of
five sizes; 360 fixation frames with top down bias and inhibition of
return, 36 of 36 shifts at the same frames; plume puffs within 3.6e-15
up to the 600 puff cap; 6,000 behaviour choices over every path, the same
act each time; body clock within 2.22e-16.

### Verified on this machine

- 2026-11-23: senses, drives, mover, cameras and the tunables panel ran
  in Chrome 150 on an Apple M1 at real frame rate (59.88 fps p50 on every
  page, measured) through the example pages; results per check are in
  [docs/browser-checks.md](docs/browser-checks.md). The automated pass
  measured them; the owner has not looked yet.

### Not verified by anything

- Nobody has looked at any package in a real browser. The rows that need
  a person, Safari or another browser are listed in
  [docs/browser-checks.md](docs/browser-checks.md) as not run.

## Licence

| path | licence |
|---|---|
| code | MIT (LICENSE) |
| README, CHANGELOG, docs | CC-BY-4.0 (LICENSES/CC-BY-4.0.txt), code samples also MIT |
