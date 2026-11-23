# hackbuild-agents

Embodied agent building blocks for browser sims and games: senses, drives, tunable parameters, seeded worlds, movers, cameras and a lockstep scenario test runner.

Status: phase A, 2026-11-22. Packages land in `packages/` as they pass
their tests; the table below grows with them.

| package | lang | what | tests |
|---|---|---|---|
| [`@hackbuild/tunables`](packages/tunables) | TS | parameter registry, layer switches, presets, URL hash sharing, panel binding | 15 vitest |
| [`@hackbuild/senses`](packages/senses) | Rust + TS | Itti Koch saliency, looming, odour plume and trail tracking, hearing, field of view memory, eye renders to an occupancy grid | 18 cargo, 11 vitest |

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
8.9e-16 m.

### Not verified by anything

- No package has been looked at in a real browser at real frame rate.

## Licence

| path | licence |
|---|---|
| code | MIT (LICENSE) |
| README, CHANGELOG, docs | CC-BY-4.0 (LICENSES/CC-BY-4.0.txt), code samples also MIT |
