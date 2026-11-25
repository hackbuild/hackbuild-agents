// how this works, @hackbuild/drives: the fold on the package page and in the suite.
// Data only, kept out of the runtime entry; tsconfig.how.json checks it.
export default {
  name: "@hackbuild/drives",
  what: "drives, choice with a why, cue learning, sleep and a memory stream for simulated animals. rust core in wasm.",
  how: [
    "the core is the rust crate crates/drives compiled to wasm32 with simd128. load() reads the inlined wasm, a url or bytes; every class takes an injected rng, so a seed replays the same choices.",
    "Drives holds named deficits and scores an act by how much it would reduce them (drive reduction reward). Chooser samples an act with softmax and a commitment bonus, switches at once for options that cannot wait, and returns a why sentence with the reason, the probability and every utility.",
    "CueLearner keeps excitation and inhibition per cue and action with associability and eligibility traces, so a late reward credits less. Sleep and bodyClock run pressure, a body clock and a stage machine with a hypnogram. MemoryStream scores memories by recency, importance and relevance.",
    "task gating and inference scheduling are plain typescript: LayerGate releases layers a new task does not declare, and InferenceScheduler starts a model call only when idle, inside a frame budget, one at a time.",
  ],
  packages: ["@hackbuild/drives"],
  install: "npm install @hackbuild/drives",
  today: "git clone https://github.com/hackbuild/hackbuild-agents && cd hackbuild-agents && npm ci && npm run build -w @hackbuild/drives",
  published: false,
  lang: "ts",
  code: `import { load, Chooser, Drives, seededRng } from "@hackbuild/drives";

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
log(d.why); // "eat: top score 0.42 (p 0.81), latency 230 ms"`,
  links: {
    page: "https://hackbuild.github.io/hackbuild-agents/drives/",
    source: "https://github.com/hackbuild/hackbuild-agents/tree/main/packages/drives",
  },
};
