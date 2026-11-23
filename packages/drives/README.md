# @hackbuild/drives

Drives, choice, learning, sleep and memory for simulated animals. The core
is the Rust crate `crates/drives` compiled to wasm32 with SIMD128; this
package loads it and wraps it with named options and an injected `Rng`.
Task gating and inference scheduling are plain TypeScript. Written for
this library from the brain of the earlier dog simulator whose code is
public in [dog-simulator/legacy](https://github.com/hackbuild/dog-simulator/tree/main/legacy), called the legacy brain below (`driveD`, `gain`, `choose`, `set`,
`cue`, `learnTrace`, `bodyClock`, `sleepRun`, `remember` and the retrieval
in `think`).

What is in it:

- `Drives`: drive reduction reward over named deficits (Keramati and
  Gutkin 2011), with the scale on reductions the legacy simulator uses for nearness and
  the secure base.
- `Chooser`: reactive switches after an ex-Gaussian latency for options
  that cannot wait, otherwise softmax sampling with a commitment bonus only
  when the act is done or its dwell ran out; argmax with hysteresis when
  sampling is off. Every decision returns a `why` sentence, the reason,
  the sampling probability and the full utility vector.
- `CueLearner`: excitation and separate inhibition per cue and action,
  Pearce Kaye Hall associability, eligibility traces (a late reward
  credits less), massed practice damping, inhibition that decays faster
  than excitation, free operant offers, everyday non compliance, and a
  versioned `toJSON` and `load`.
- `Sleep` and `bodyClock`: pressure up awake and down asleep, a body
  clock with activity peaks near 7 and 19, a stage machine (onset, NREM,
  REM, brief wake) with a hypnogram and wake thresholds by stage.
- `MemoryStream`: recency, importance and relevance scoring (Park et al.
  2023) with an importance budget for reflection; `GoalBoost` for a goal
  from a slow deliberation with an expiry.
- From lessons of earlier builds: `Completion` binds a done flag to the
  goal it was raised for (the same goal begun again after it was done
  starts anew), `settled` checks the real condition (heading error under
  0.12 rad, angular speed under 0.4 rad/s) with a timeout, `LayerGate`
  releases blocking layers a new task does not declare, and
  `InferenceScheduler` starts a model call only after a minimum interval,
  while idle, inside a frame budget, one at a time, with a state to show.

Not in it: the legacy simulator's 22 executors, its `EFFECT` values, dialogue and
prompts stay in the app. The top 3 planner from the human agent is not
written.

## Install

Not published yet. From a clone:

    npm ci && npm run build -w @hackbuild/drives

## Use

```ts
import { load, Chooser, Drives, seededRng } from "@hackbuild/drives";

await load();
const rng = seededRng(42);
const drives = new Drives({ hunger: 1, fatigue: 1, play: 0.8, social: 0.9 });
const choose = new Chooser({ rng, options: ["idle", "eat", "fetch", "rest"] as const });

drives.set({ hunger: 0.7, play: 0.4 });
const d = choose.update(now, {
  idle: 0.12,
  eat: drives.rewardOf({ hunger: -0.5 }),
  fetch: drives.rewardOf({ play: -0.4, fatigue: 0.05 }),
  rest: drives.rewardOf({ fatigue: -0.25 }),
}, ["fetch"]);
if (d.pending) turnHeadTo(d.pending.id);
log(d.why); // "eat: top score 0.42 (p 0.81), latency 230 ms"
```

`dist/drives.iife.js` is the single file build: a classic script that
defines `HackbuildDrives` with the wasm inlined, for pages opened from
file://.

## Develop

    source ~/.nvm/nvm.sh && nvm use 22.18.0
    npx -y npm@11.21.0 install
    npm run build -w @hackbuild/drives
    npx vitest run packages/drives
    cargo test -p hackbuild-drives
    HB_REGEN_GOLDEN=1 cargo test -p hackbuild-drives   # after a deliberate numeric change

## Parity with the legacy dog simulator

The drives and chooser follow the brain of the earlier dog simulator
whose code is public in
[dog-simulator/legacy](https://github.com/hackbuild/dog-simulator/tree/main/legacy)
(MIT parts only). Two kinds of test compare the wasm build with it:

- fixtures from the running legacy code: `test/fixtures/legacy-brain.json`
  holds the numbers the legacy JavaScript itself produced (legacy/det at
  commit bc2cf6c, `brain.gain`, `brain.choose` and `brain.bodyClock` run
  in a Node vm with stubs for the page globals) on the seeded inputs in
  `test/parity-inputs.ts`. Only the numbers are committed;
- a hand transcription of `driveD`, `gain` and `choose`, fed 339 drive
  states recorded in the dog-simulator golden traces
  (`test/fixtures/recorded-drive-states.json`, curiosity 0.5, prey 0),
  each decided from idle with the act done, 30 seeds per state.

| check | tolerance | measured 2026-11-23 |
|---|---|---|
| reward for all 13 legacy effects at scales 1, 0.35 and 1.25, 150 random states (fixture) | under 1e-13 | 4.4e-15, including the 15 digit rounding of the fixture |
| act and reaction latency on every choice path: done or not, dwell out or not, any current act, 6,000 decisions (fixture) | same act; latency within 1e-11 s | 6,000 of 6,000, latency within 5.0e-13 s |
| body clock, 1,000 hours and every hour of 2,000,000 scanned where it differs (fixture) | under 2.3e-16 absolute | 126 of 2,000,000 hours differ, each by one ulp, at most 2.22e-16 |
| reward per act on the recorded states (transcription) | under 1e-12 | 5.6e-16 |
| same act from the same seeded stream (transcription) | at least 99.5 percent | 10,170 of 10,170 |
| choice distribution, total variation (transcription) | under 0.01 | 0.0000 |

The body clock goes through libm `exp` so native and wasm agree; V8's
`Math.exp` differs from it by one ulp for some arguments, so against a
JavaScript engine the wasm `bodyClock` is within 2.3e-16 absolute
(measured), not bit identical. An app that hashes JavaScript state can
use `bodyClockJs`, plain TypeScript with `Math.exp` that needs no
`load()`: on the same engine and platform it is bit identical to the
legacy JavaScript (all 1,126 fixture hours on V8, macOS arm64,
measured). `Math.exp` itself differs across platforms: on V8 under Linux
x64 (CI) the 126 hours gave the libm values instead (measured), so a
JavaScript hash holds only on one platform.

The learner drops one random draw the legacy brain made in its ignore
test (an always true condition), so cue responses do not replay the
legacy stream; the learner was checked against conditioning results
instead.

## What is verified, and what is not

### Verified on this machine

- 2026-11-22: `cargo test -p hackbuild-drives` passed 12 of 12 tests
  (counted): acquisition, extinction and spontaneous recovery, delay of
  reinforcement, non compliance rate against distraction, offered trick
  credit, softmax ratio, reactive latency and commitment, the canned
  argmax path, body clock shape, a night of sleep stages, memory ranking,
  and the golden trace. Clippy clean natively and for wasm32.
- 2026-11-22: `npx vitest run packages/drives` passed 13 of 13 tests
  (counted), including the parity table above, the golden trace (175
  values, seed 20261122) bit identical between the native and the wasm
  build, the why sentences, learner state round trip, and the task gating
  and scheduling rules.

### Not verified by anything

- Behaviour in a running sim beyond the example page: the drives example
  drives an animal (docs/browser-checks.md row 9), but no lockstep
  scenario does.
- Blocking, which the plan lists among the conditioning results, is not
  modelled: each cue learns alone.
- Choice parity covers single decisions on every path (fixture); a
  multi step replay against the legacy stream diverges after the first
  switch, since the legacy `brain.set` draws one more number for a speech
  line.

## Size budget

| file | raw | gzip |
|---|---|---|
| `drives_bg.wasm` | 111,903 bytes | 48,773 bytes |
| `drives.iife.js` (wasm inlined as base64) | 191,407 bytes | 76,176 bytes |

Measured 2026-11-23 by tools/check-sizes.mjs (gzip level 9). Budget: wasm under 128 KB raw.
Most of the size is string formatting for the why sentences (inferred).

## Licence

Code MIT (`LICENSE`, a copy of the repository root one). This README is CC-BY-4.0, its
code samples also MIT. The wasm contains compiled libm (MIT) and
wasm-bindgen (MIT or Apache-2.0) code; `THIRD-PARTY-NOTICES.txt` carries
their notices.
