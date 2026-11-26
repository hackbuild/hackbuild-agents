# @hackbuild/drives

Drives, choice with a reason, cue learning, sleep and a memory stream for simulated animals, on a Rust core in wasm.

[![npm](https://img.shields.io/npm/v/@hackbuild/drives)](https://www.npmjs.com/package/@hackbuild/drives) [![licence MIT](https://img.shields.io/badge/licence-MIT-blue)](../../LICENSE) ![gzip 76.3 kB measured](https://img.shields.io/badge/gzip-76.3%20kB-blue) ![types included](https://img.shields.io/badge/types-included-blue)

## What it does

- Scores each act by how much it would reduce the animal's needs (drive reduction reward over named deficits).
- Picks an act by softmax with a commitment bonus, switches after a short latency for options that cannot wait, and returns a why sentence with every decision.
- Learns which cue goes with which act, with associability, eligibility traces, inhibition that fades and everyday non compliance; the state saves to JSON.
- Runs sleep pressure, a body clock and a sleep stage machine with a hypnogram, and ranks memories by recency, importance and relevance.
- Gates task layers and schedules heavy model calls so they start only when idle and inside a frame budget.

## Install

```sh
npm install @hackbuild/drives
```

No peers and no dependencies. The wasm core ships inlined as base64, and `load()` with no argument decodes it, so it works from file:// with no fetch. The raw wasm is also exported as `@hackbuild/drives/wasm` if you would rather fetch it.

## Quick start

```ts
import { Chooser, Drives, load, seededRng } from "@hackbuild/drives";

// the wasm core is inlined; load it once before any class
await load();
const drives = new Drives({ hunger: 1, fatigue: 1, play: 0.8 });
const chooser = new Chooser({ rng: seededRng(42), options: ["idle", "eat", "fetch", "rest"] as const });

// a minute of a sim at 10 Hz: needs grow, each act is scored by how much it would reduce them
for (let t = 0; t <= 60; t += 0.1) {
  drives.grow(0.1, { hunger: 0.02, fatigue: 0.01, play: 0.03 });
  const d = chooser.update(t, {
    idle: 0.05,
    eat: drives.rewardOf({ hunger: -0.5 }),
    fetch: drives.rewardOf({ play: -0.4, fatigue: 0.05 }),
    rest: drives.rewardOf({ fatigue: -0.25 }),
  });
  if (d.switched) console.log(t.toFixed(1), d.current, d.why);
}
```

## Live example

The [drives page](https://hackbuild.github.io/hackbuild-agents/drives/) runs a dog in a yard on these drives: needs grow, the chooser logs why, and a thrown ball makes fetch reactive. The suite example [a creature with drives](https://hackbuild.github.io/hackbuild-suite/#/examples/think/drives) shows the same brain with its bars, and the [dog simulator](https://hackbuild.github.io/dog-simulator/) runs its dog on this package.

## Concepts

### load once, then construct

The core is the Rust crate `crates/drives` built for wasm32 with SIMD128 and no threads. `await load()` instantiates it once; later calls return the first load. Pass a URL, a `Response`, bytes or a compiled `WebAssembly.Module` to load from elsewhere, or call `loadSync(bytes)` where you cannot await. The task and scheduling helpers and `bodyClockJs` are plain TypeScript and need no load.

### randomness is injected

Every class that draws numbers takes `rng: Rng`, a `() => number` in [0, 1). It draws one 32 bit seed from it (`seedFrom`) and runs its own Mulberry32 stream in the core, the same stream `seededRng` gives in TypeScript. The same seed replays the same choices, in Node and in the browser.

### drives and reward

`new Drives(weights)` holds one deficit per name. `rewardOf(effect, scale)` is how much the expected effect of an act would lower the total drive, so eating is worth most when hunger is high. `grow(dt, rates)` raises the deficits over time and `set` writes them directly. `scale` lets you weigh reductions, for example by how near the food is.

### choosing with a why

`new Chooser({ rng, options })` keeps the current act. Each `update(now, utilities, reactive, forced)` either holds it, samples a new act by softmax over the utilities (the current one gets a commitment bonus while it is not done), or, for an option named in `reactive`, sets a pending switch after an ex-Gaussian latency. The `Decision` carries the reason, the sampling probability, every utility and a `why` such as `fetch: top switch after 217 ms, utility now 0.10`. Pass `sample: false` and `noise: false` for argmax with hysteresis and no latencies.

```ts
const d = chooser.update(now, utilities, ["fetch"]);
if (d.pending) lookAt(d.pending.id);
if (d.switched) log(d.why);
```

### learning cues

`CueLearner` keeps excitation and a separate inhibition per cue and action. `respond(cue, now)` returns ignored, none or an act with a latency; `reward(r, now)` credits the last act, less when the reward comes late; `decay(dt)` lets inhibition fade faster than excitation, so an extinguished trick can come back. `toJSON()` writes a versioned state and `load(state)` reads it.

### sleep and the body clock

`bodyClock(hour)` is sleepiness from the time of day, with activity peaks near 7 and 19. `Sleep` adds pressure that rises awake and falls asleep, and a stage machine (onset, NREM, REM, brief wake) whose `hypnogram()` records each stage and whose `wakeThreshold()` depends on it. `bodyClockJs` is the same formula with `Math.exp`, for apps that hash JavaScript state.

### memory, goals and slow models

`MemoryStream` ranks memories by recency, importance and relevance to cue words, and `shouldReflect(budget)` says when enough has happened to summarise. `GoalBoost` adds a bonus to one option until it expires, for a goal from a slow deliberation such as a language model. `InferenceScheduler` starts such a call only after a minimum interval, optionally only while idle and while the smoothed frame time is inside a budget, one call at a time, with a state you can show.

### tasks that finish for real

`Completion` binds a done flag to the goal it was raised for, so a flag left over from the last goal never ends the next one. `settled` checks the real condition, such as a heading error under 0.12 rad and an angular speed under 0.4 rad/s, with a timeout. `LayerGate` releases the blocking layers a new task does not declare.

## API overview

| export | what it does |
|---|---|
| [`load`](../../docs/api/drives/README.md#load) | load the wasm core once |
| [`seededRng`](../../docs/api/drives/README.md#seededrng) | a seeded Mulberry32 `Rng` |
| [`Drives`](../../docs/api/drives/README.md#drives) | named deficits and drive reduction reward |
| [`Chooser`](../../docs/api/drives/README.md#chooser) | softmax choice with commitment, latencies and a why |
| [`Decision`](../../docs/api/drives/README.md#decision) | what one chooser update returns |
| [`CueLearner`](../../docs/api/drives/README.md#cuelearner) | cue and act learning with a saved state |
| [`Sleep`](../../docs/api/drives/README.md#sleep) | sleep pressure and the stage machine |
| [`bodyClock`](../../docs/api/drives/README.md#bodyclock) | sleepiness from the hour, in wasm; `bodyClockJs` in TypeScript |
| [`MemoryStream`](../../docs/api/drives/README.md#memorystream) | memories ranked by recency, importance and relevance |
| [`GoalBoost`](../../docs/api/drives/README.md#goalboost) | a bonus on one option until it expires |
| [`InferenceScheduler`](../../docs/api/drives/README.md#inferencescheduler) | start a model call only when it will not stall the frame |
| [`Completion`](../../docs/api/drives/README.md#completion) | a done flag bound to its goal |
| [`settled`](../../docs/api/drives/README.md#settled) | the real end condition of a step, with a timeout |
| [`LayerGate`](../../docs/api/drives/README.md#layergate) | which layers a task blocks |

The full reference is in [docs/api/drives](../../docs/api/drives/README.md).

## Browser support

| feature | needs | Chrome | Safari | Firefox | phone |
|---|---|---|---|---|---|
| the core | WebAssembly with SIMD128 | yes | 16.4 and later (inferred) | yes (inferred) | yes on current iOS and Android (inferred) |
| WASM threads | none; the core is single threaded | not needed | not needed | not needed | not needed |
| file:// | the inlined wasm or `dist/drives.iife.js` | yes | yes (inferred) | yes (inferred) | not tested |

`dist/drives.iife.js` is a classic script that defines `HackbuildDrives` with the wasm inlined, for a page opened from disk where module scripts are refused. There is no fallback without WebAssembly.

## Errors and troubleshooting

| message | cause | what to do |
|---|---|---|
| `@hackbuild/drives: wasm not loaded. call load() first.` | a class or `bodyClock` was used before the core loaded | `await load()` once at start |
| `@hackbuild/drives: start option <id> is not in the list` | `ChooserOptions.start` is not one of `options` | pass one of the option names |
| `@hackbuild/drives: no option named <id>` | `set`, `update` reactive or forced named an unknown option | use the names given to the chooser |
| `@hackbuild/drives: no action named <id>` | a learner call named an unknown action | use the names given to the learner |
| `@hackbuild/drives: learner state version <n> is not 1` | `CueLearner.load` got a state of another version | save the state again with `toJSON()` |

A failed fetch or compile in `load(url)` rejects with the browser's own error, and the next `load()` tries again.

## Works with

- [@hackbuild/senses](../senses/README.md) gives what the animal perceives, which you turn into utilities and cues.
- [@hackbuild/agents-views](../agents-views/README.md) draws the chooser's decision and the drives as bars, and the learner as a cues by acts table.
- [@hackbuild/mover](../mover/README.md) moves the agent toward the act it chose.
- [@hackbuild/tunables](../tunables/README.md) holds temperature, commitment and growth rates for A/B work.
- [@hackbuild/scenario](../scenario/README.md) replays a seeded run in lockstep and compares it with a golden trace.

## Changelog and licences

Changes are in the repository [CHANGELOG](../../CHANGELOG.md). Code is MIT ([LICENSE](../../LICENSE)); this README is CC-BY-4.0 with its code samples also MIT. The wasm contains compiled libm (MIT) and wasm-bindgen (MIT or Apache-2.0) code; [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt) carries their notices. No model or weight file is involved.

## What is verified, and what is not

### Verified

| date | check | result |
|---|---|---|
| 2026-11-22 | `cargo test -p hackbuild-drives`: acquisition, extinction and spontaneous recovery, delay of reinforcement, non compliance against distraction, offered trick credit, softmax ratio, reactive latency and commitment, argmax path, body clock shape, a night of sleep stages, memory ranking, golden trace | 12 of 12 pass; clippy clean natively and for wasm32 |
| 2026-11-22 | `npx vitest run packages/drives`: parity, golden trace, why sentences, learner round trip, task gating and scheduling | 13 of 13 pass |
| 2026-11-22 | golden trace, seed 20261122, 175 values | bit identical between the native and the wasm build |

### Parity with the dog-simulator legacy brain

The drives and chooser follow the brain of the public [dog-simulator/legacy](https://github.com/hackbuild/dog-simulator/tree/main/legacy) code (MIT parts only). Fixtures hold numbers that code produced on seeded inputs (`test/fixtures/legacy-brain.json`); a hand transcription is fed 339 recorded drive states (`test/fixtures/recorded-drive-states.json`), 30 seeds per state.

| check | tolerance | result, 2026-11-23 |
|---|---|---|
| reward for all 13 effects at scales 1, 0.35 and 1.25, 150 random states (fixture) | under 1e-13 | 4.4e-15 (measured) |
| act and reaction latency on every choice path, 6,000 decisions (fixture) | same act; latency within 1e-11 s | 6,000 of 6,000, latency within 5.0e-13 s (measured) |
| body clock, 1,000 hours, and 2,000,000 hours scanned (fixture) | under 2.3e-16 absolute | 126 hours differ by one ulp, at most 2.22e-16 (measured) |
| reward per act on the recorded states (transcription) | under 1e-12 | 5.6e-16 (measured) |
| same act from the same seeded stream (transcription) | at least 99.5 percent | 10,170 of 10,170 (measured) |
| choice distribution, total variation (transcription) | under 0.01 | 0.0000 (measured) |
| `bodyClockJs` against the fixture hours on V8, macOS arm64 | bit identical | 1,126 of 1,126 (measured); on Linux x64 the 126 hours differ by one ulp (measured) |

The body clock goes through libm `exp`, so native and wasm agree with each other; `Math.exp` differs from it by one ulp for some arguments and across platforms. The learner drops one random draw the reference made in an always true test, so cue responses do not replay its stream; it was checked against conditioning results instead.

### Not verified by anything

- Behaviour in a running sim beyond the drives page: no lockstep scenario drives an animal on this package.
- Blocking between cues: each cue learns alone.
- A multi step replay against the reference stream: it diverges after the first switch, since the reference draws one more number for a speech line.

## Size budget

| file | gzip (measured) | ceiling |
|---|---|---|
| `dist/index.js` (main entry, imports external) | 76,285 bytes | 80,099 bytes |
| `dist/wasm/drives_bg.wasm` | 48,773 bytes | 51,211 bytes |
| `dist/drives.iife.js` (single file build) | 76,410 bytes | 80,230 bytes |

Measured 2026-11-26 by `node tools/lint-packages.mjs` (gzip level 9) from the packed
tarball. Generated from `tools/size-budget.json`; CI fails when a file moves more than
5 percent from its row.
