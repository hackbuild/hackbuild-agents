# hackbuild-agents

Embodied agent building blocks for browser sims and games: senses, drives, tunable parameters, seeded worlds, movers, cameras and a lockstep scenario test runner.

Status: phase A, 2026-11-22. Packages land in `packages/` as they pass
their tests; the table below grows with them.

| package | lang | what | tests |
|---|---|---|---|
| [`@hackbuild/tunables`](packages/tunables) | TS | parameter registry, layer switches, presets, URL hash sharing, panel binding | 15 vitest |
| [`@hackbuild/senses`](packages/senses) | Rust + TS | Itti Koch saliency, looming, odour plume and trail tracking, hearing, field of view memory, eye renders to an occupancy grid | 18 cargo, 11 vitest |
| [`@hackbuild/drives`](packages/drives) | Rust + TS | drive reduction reward, softmax choice with commitment and a why, cue learning, sleep and body clock, memory stream, task gating, inference scheduling | 12 cargo, 13 vitest |
| [`@hackbuild/scenario`](packages/scenario) | Node TS | lockstep scenario runner on puppeteer-core and the system Chrome, routed pinned requests, goldens, motion metrics, frame sampler, profiler, check message reports | 11 vitest |
| [`@hackbuild/mover`](packages/mover) | TS | kinematic capsule mover, steering with a held passing side, timed yields, multi part footprints and a stall detector | 10 vitest |
| [`@hackbuild/cameras`](packages/cameras) | TS | follow with occlusion pull in, group framing, orbit, first person eye, seeded shake, split views | 7 vitest |

## Examples

One page per package, built from `examples/` and published at
<https://hackbuild.github.io/hackbuild-agents/>. Every shape is built in
code; no model, asset or weight file is loaded. `npm run examples` builds
them into `_site/`; `npm run examples:check` runs the browser checks.

## Develop

    source ~/.nvm/nvm.sh && nvm use
    npm ci
    npm test

`npm ci` sets `core.hooksPath` to `.githooks`. Rules for every change are
in RULES.md and CONTRIBUTING.md.

## What is verified, and what is not

Each package README carries its own dated list. Across the repository:

Parity with the HACKLE code it was written from (measured on synthetic
seeded inputs against hand transcriptions; tolerances in each README):
saliency winners 240 of 240, maps bit identical; plume puffs within
8.9e-16 m; behaviour choice on 339 recorded HACKLE drive states, 10,170
of 10,170 decisions the same from the same seeded stream.

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
