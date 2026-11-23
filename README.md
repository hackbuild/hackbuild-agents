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
| [`@hackbuild/mover`](packages/mover) | TS | kinematic capsule mover, steering with a held passing side, timed yields, multi part footprints and a stall detector | 9 vitest |

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

### Not verified by anything

- No package has been looked at in a real browser at real frame rate.

## Licence

| path | licence |
|---|---|
| code | MIT (LICENSE) |
| README, CHANGELOG, docs | CC-BY-4.0 (LICENSES/CC-BY-4.0.txt), code samples also MIT |
