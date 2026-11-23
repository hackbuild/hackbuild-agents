# @hackbuild/drives

Drives, choice, learning, sleep and memory for simulated animals. The core
is the Rust crate `crates/drives` compiled to wasm32 with SIMD128; this
package loads it and wraps it with named options and an injected `Rng`.
Task gating and inference scheduling are plain TypeScript. Written for
this library from the HACKLE brain (`driveD`, `gain`, `choose`, `set`,
`cue`, `learnTrace`, `bodyClock`, `sleepRun`, `remember` and the retrieval
in `think`).

What is in it:

- `Drives`: drive reduction reward over named deficits (Keramati and
  Gutkin 2011), with the scale on reductions HACKLE uses for nearness and
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
- From the HACKLE lessons: `Completion` binds a done flag to the goal it
  was raised for, `settled` checks the real condition (heading error under
  0.12 rad, angular speed under 0.4 rad/s) with a timeout, `LayerGate`
  releases blocking layers a new task does not declare, and
  `InferenceScheduler` starts a model call only after a minimum interval,
  while idle, inside a frame budget, one at a time, with a state to show.

Not in it: HACKLE's 22 executors, its `EFFECT` values, dialogue and
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

## Parity with HACKLE

The legacy code was read, never run. The test carries a hand
transcription of `driveD`, `gain` and `choose` and feeds both it and the
wasm build the same inputs. The inputs are 339 drive states (hunger,
fatigue, play, social) recorded in the dog-simulator golden traces of the
seeded HACKLE build, every 3 sim s of 18 scenarios (`test/fixtures`), with
curiosity 0.5 and prey 0, scored for a yard with food out, a ball in view
and the human near. Each state is decided from idle with the act done,
30 seeds per state.

| check | tolerance | measured 2026-11-22 |
|---|---|---|
| reward per act, max difference | under 1e-12 | passes |
| same act from the same seeded stream | at least 99.5 percent | 10,170 of 10,170 |
| choice distribution, total variation | under 0.01 | 0.0000 |

The learner drops one random draw HACKLE made in its ignore test (an
always true condition, defect 17 of the plan), so cue responses do not
replay HACKLE's stream; the learner was checked against conditioning
results instead.

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

- Behaviour in a running sim: no scenario drives an animal with this
  package yet.
- Blocking, which the plan lists among the conditioning results, is not
  modelled: each cue learns alone.
- Choice parity covers decisions from a finished act; dwell timing and the
  pending latency path are checked by unit tests, not against HACKLE.

## Size budget

| file | raw | gzip |
|---|---|---|
| `drives_bg.wasm` | 112,142 bytes | 48,779 bytes |
| `drives.iife.js` (wasm inlined as base64) | 190,224 bytes | 75,209 bytes |

Measured 2026-11-22 from the build log. Budget: wasm under 128 KB raw.
Most of the size is string formatting for the why sentences (inferred).

## Licence

Code MIT (`LICENSE` at the repository root). This README is CC-BY-4.0, its
code samples also MIT.
