import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  bodyClock,
  bodyClockJs,
  Chooser,
  Completion,
  CueLearner,
  Drives,
  GoalBoost,
  goldenTrace,
  InferenceScheduler,
  LayerGate,
  load,
  MemoryStream,
  seededRng,
  settled,
  Sleep,
} from "../src/index.js";

import { ACTS, clockHour, DECISIONS, decision, REACTIVE_ACTS, REWARD_STATES, rewardState, SCALES, WEIGHTS } from "./parity-inputs.js";

const here = import.meta.dirname;

beforeAll(async () => {
  await load(readFileSync(join(here, "../src/wasm/drives_bg.wasm")));
});

describe("native and wasm agree", () => {
  it("golden trace is bit identical to the native build", () => {
    const g = JSON.parse(readFileSync(join(here, "../../../crates/drives/tests/golden.json"), "utf8"));
    expect(Array.from(goldenTrace(g.seed))).toEqual(g.values);
  });
});

// ---- parity reference: legacy brain.driveD, gain and choose, transcribed by hand for the test ----
const W = { hunger: 1, fatigue: 1, play: 0.8, social: 0.9, curiosity: 0.6, prey: 1.1 };
type K = keyof typeof W;
const KEYS = Object.keys(W) as K[];
const EFFECT: Record<string, Partial<Record<K, number>>> = {
  explore: { curiosity: -0.35, fatigue: 0.03 },
  sniff: { curiosity: -0.2 },
  eat: { hunger: -0.5 },
  fetch: { play: -0.4, social: -0.1, fatigue: 0.05 },
  greet: { social: -0.45 },
  playbow: { play: -0.25, social: -0.15 },
  rest: { fatigue: -0.25 },
  sleep: { fatigue: -0.7 },
};
const BEH = ["idle", "explore", "sniff", "eat", "fetch", "greet", "playbow", "rest", "sleep"] as const;
type B = (typeof BEH)[number];
const REACTIVE = new Set<B>(["fetch", "greet"]);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const driveD = (h: Record<K, number>) => {
  let s = 0;
  for (const k of KEYS) s += W[k] * Math.pow(Math.max(h[k] || 0, 0), 3);
  return Math.pow(s, 1 / 4);
};
const gain = (d: Record<K, number>, K2: Partial<Record<K, number>>, scale = 1) => {
  const h = { ...d };
  for (const k in K2) {
    const kk = k as K;
    const v = K2[kk] as number;
    h[kk] = clamp(h[kk] + v * (v < 0 ? scale : 1), 0, 1);
  }
  return 2.4 * (driveD(d) - driveD(h));
};
const exgRef = (rng: () => number, mu: number, sigma: number, tau: number) => {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  const g = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.max(0.02, mu + sigma * g - tau * Math.log(1 - rng()));
};
/** The utilities the legacy brain gives with drives on, for a yard with food out, a ball in view and the human near. */
function utilities(d: Record<K, number>, gainOf: (e: Partial<Record<K, number>>, s?: number) => number): Record<B, number> {
  const G = (b: string, s = 1) => gainOf(EFFECT[b] as Partial<Record<K, number>>, s);
  // the legacy brain clamps every utility at 0 after scoring
  const U: Record<B, number> = {
    idle: 0.12,
    explore: G("explore", 1.25),
    sniff: G("sniff") * 0.3,
    eat: gainOf({ hunger: -0.5 }),
    fetch: G("fetch"),
    greet: G("greet", 0.35),
    playbow: d.play > 0.45 ? G("playbow") * 1.2 : 0,
    rest: d.fatigue > 0.4 ? G("rest") : 0,
    sleep: d.fatigue > 0.72 ? 0.4 + G("sleep") : 0,
  };
  for (const b of BEH) U[b] = Math.max(0, U[b]);
  return U;
}
/** legacy choose() from idle with the current act done, then the pending switch; returns the act picked. */
function legacyChoose(U: Record<B, number>, rng: () => number): B {
  const cur: B = "idle";
  let best: B = "idle";
  let bv = -1;
  for (const b of BEH) if (U[b] > bv) {
    bv = U[b];
    best = b;
  }
  const curU = U[cur] - 1;
  if (best !== cur && bv > curU + 0.05 && REACTIVE.has(best)) {
    exgRef(rng, 0.3, 0.06, 0.3);
    return best;
  }
  const ex = BEH.map((b) => [b, Math.exp(((b === cur ? curU : U[b]) - bv) / 0.06)] as const);
  const tot = ex.reduce((s, x) => s + x[1], 0);
  let r = rng() * tot;
  let pick: B = best;
  for (const [b, wgt] of ex)
    if ((r -= wgt) <= 0) {
      pick = b;
      break;
    }
  return pick;
}

describe("choice parity with the legacy brain on recorded drive states", () => {
  const fx = JSON.parse(readFileSync(join(here, "fixtures/recorded-drive-states.json"), "utf8")) as { states: number[][] };
  const states = fx.states.map(([hunger, fatigue, play, social]) => ({ hunger, fatigue, play, social, curiosity: 0.5, prey: 0 }) as Record<K, number>);

  it("rewards match the original arithmetic", () => {
    const dr = new Drives(W);
    let d = 0;
    for (const s of states) {
      dr.set(s);
      for (const e of Object.values(EFFECT)) d = Math.max(d, Math.abs(dr.rewardOf(e) - gain(s, e)));
      d = Math.max(d, Math.abs(dr.rewardOf(EFFECT.greet as Partial<Record<K, number>>, 0.35) - gain(s, EFFECT.greet as Partial<Record<K, number>>, 0.35)));
    }
    // libm pow against Math.pow; recorded tolerance 1e-12
    console.log(`reward parity on recorded states: max difference ${d.toExponential(2)} (measured)`);
    expect(d).toBeLessThan(1e-12);
  });

  it("picks the same act from the same stream and matches the choice distribution", () => {
    const dr = new Drives(W);
    const seeds = 30;
    const ours: Record<string, number> = {};
    const theirs: Record<string, number> = {};
    let agree = 0;
    let n = 0;
    for (const s of states) {
      dr.set(s);
      const U = utilities(s, (e, sc = 1) => dr.rewardOf(e, sc));
      const Uref = utilities(s, (e, sc = 1) => gain(s, e, sc));
      for (let k = 0; k < seeds; k++) {
        const seed = (n * 2654435761) >>> 0;
        const c = new Chooser({ rng: () => seed / 4294967296, options: BEH, start: "idle" });
        c.markDone();
        const d = c.update(0, U, [...REACTIVE]);
        const pick = d.pending?.id ?? d.current;
        const ref = legacyChoose(Uref, seededRng(seed));
        ours[pick] = (ours[pick] ?? 0) + 1;
        theirs[ref] = (theirs[ref] ?? 0) + 1;
        if (pick === ref) agree++;
        n++;
      }
    }
    let tvd = 0;
    for (const b of BEH) tvd += Math.abs((ours[b] ?? 0) - (theirs[b] ?? 0)) / n / 2;
    // tolerances recorded in the README: same act from the same stream in at least 99.5 percent, distributions within 0.01 total variation
    expect(agree / n).toBeGreaterThanOrEqual(0.995);
    expect(tvd).toBeLessThan(0.01);
    console.log(`choice parity: ${agree}/${n} same act, total variation ${tvd.toFixed(4)}, ours ${JSON.stringify(ours)} (measured)`);
  });
});

// Fixtures from the legacy code itself: fixtures/legacy-brain.json holds
// the numbers the legacy dog simulator's JavaScript (legacy/det in the
// public dog-simulator repository, commit in the file) produced on the
// seeded inputs in parity-inputs.ts. Only the numbers are committed.
describe("parity with fixtures from the running legacy code", () => {
  const ref = JSON.parse(readFileSync(join(here, "fixtures/legacy-brain.json"), "utf8")) as {
    effects: string[];
    effectTable: Record<string, Record<string, number>>;
    rewards: number[][];
    choices: [number, number | null][];
    clock: [number, number][];
  };

  it("rewards match brain.gain for every legacy effect and scale", () => {
    const dr = new Drives(WEIGHTS);
    let d = 0;
    for (let k = 0; k < REWARD_STATES; k++) {
      dr.set(rewardState(k));
      const row = ref.rewards[k] as number[];
      let j = 0;
      for (const e of ref.effects) for (const sc of SCALES) d = Math.max(d, Math.abs(dr.rewardOf(ref.effectTable[e] as Record<string, number>, sc) - (row[j++] as number)));
    }
    // libm pow against Math.pow, and the fixture keeps 15 significant digits
    console.log(`legacy reward parity: max difference ${d.toExponential(2)} (measured)`);
    expect(d).toBeLessThan(1e-13);
  });

  it("choose picks the same act and latency on every path", () => {
    const paths: Record<string, [number, number]> = {};
    let maxLat = 0;
    for (let k = 0; k < DECISIONS; k++) {
      const q = decision(k);
      const c = new Chooser({ rng: () => q.seed / 4294967296, options: ACTS, start: q.current });
      if (q.done) c.markDone();
      const d = c.update(q.now, q.utilities, [...REACTIVE_ACTS]);
      const [act, lat] = ref.choices[k] as [number, number | null];
      const path = `${q.done ? "done" : "not done"}, ${q.now ? "dwell out" : "in dwell"}`;
      const p = (paths[path] ??= [0, 0]);
      p[1]++;
      const pick = d.pending?.id ?? d.current;
      if (pick === ACTS[act] && (lat === null) === (d.pending === null)) {
        p[0]++;
        if (lat !== null && d.pending) maxLat = Math.max(maxLat, Math.abs(d.pending.at - q.now - lat));
      }
    }
    for (const [path, [ok, n]] of Object.entries(paths)) expect(ok, path).toBe(n);
    expect(Object.keys(paths).length).toBe(4);
    // the fixture keeps the latency to 13 significant digits
    expect(maxLat).toBeLessThan(1e-11);
    console.log(`legacy choice parity: ${DECISIONS} decisions ${JSON.stringify(paths)}, max latency difference ${maxLat.toExponential(2)} s (measured)`);
  });

  it("the wasm body clock is within 2.3e-16 of the legacy JavaScript", () => {
    let worst = 0;
    let differ = 0;
    for (const [k, v] of ref.clock) {
      const d = Math.abs(bodyClock(clockHour(k)) - v);
      if (d > 0) differ++;
      worst = Math.max(worst, d);
    }
    // the fixture keeps 1,000 hours and every one of 2,000,000 scanned where libm exp and V8 Math.exp differed
    expect(differ).toBe(126);
    expect(worst).toBeLessThanOrEqual(2.3e-16);
  });

  it("bodyClockJs is bit identical to the legacy JavaScript", () => {
    const off = ref.clock.filter(([k, v]) => bodyClockJs(clockHour(k)) !== v);
    expect(off).toEqual([]);
    expect(ref.clock.length).toBe(1126);
  });
});

describe("chooser", () => {
  const opts = ["idle", "fetch", "rest"] as const;
  it("every decision carries a why and the utility vector", () => {
    const c = new Chooser({ rng: seededRng(3), options: opts });
    c.markDone();
    const d = c.update(0, { idle: 0.1, fetch: 0.7, rest: 0.2 }, ["fetch"]);
    expect(d.why).toMatch(/^fetch: reactive switch, 0\.70 over idle/);
    expect(d.utilities.rest).toBe(0.2);
    const at = d.pending?.at ?? 0;
    const f = c.update(at, { idle: 0.1, fetch: 0.7, rest: 0.2 }, ["fetch"]);
    expect(f.switched).toBe(true);
    expect(f.reason).toBe("fired");
    expect(f.why).toMatch(/^fetch: reactive switch after \d+ ms/);
  });

  it("a goal change resets the completion flag", () => {
    const c = new Chooser({ rng: seededRng(4), options: opts });
    c.markDone();
    expect(c.done).toBe(true);
    c.set("rest", 1);
    expect(c.done).toBe(false);
  });

  it("a cortex goal adds its bonus until it expires", () => {
    const g = new GoalBoost<(typeof opts)[number]>();
    g.set("rest", 0, 20, "tired after the walk");
    expect(g.apply(5, { rest: 0.1 }).rest).toBeCloseTo(0.45);
    expect(g.apply(21, { rest: 0.1 }).rest).toBe(0.1);
  });
});

describe("learner, sleep and memory", () => {
  it("learns a cue and round trips its state", () => {
    const acts = ["sit", "down", "spin"] as const;
    const l = new CueLearner({ rng: seededRng(5), actions: acts, noise: false });
    let t = 0;
    const trial = (r: number) => {
      l.offerTrick("sit", t);
      // a cued trial: respond until the dog sits, then reward 0.3 s after it finishes
      l.prior("sit", "sit", Math.max(0.3, l.value("sit", "sit")));
      const res = l.respond("sit", t);
      if (res.kind === "act") {
        l.markDone(res.action, t + 0.5);
        l.reward(res.action === "sit" ? r : -0.3, t + 0.8);
      }
      t += 200;
    };
    for (let k = 0; k < 10; k++) trial(1);
    const acquired = l.value("sit", "sit");
    expect(acquired).toBeGreaterThan(0.7);
    const s = l.toJSON();
    const m = new CueLearner({ rng: seededRng(9), actions: acts });
    m.load(s);
    expect(m.value("sit", "sit")).toBe(acquired);
    expect(JSON.parse(JSON.stringify(s)).ver).toBe(1);
  });

  it("sleep goes through nrem and rem and records a hypnogram", () => {
    const s = new Sleep({ rng: seededRng(6), pressure: 0.9 });
    s.lieDown();
    const seen = new Set<string>();
    for (let k = 0; k < 600; k++) {
      s.step(0.5, 23);
      if (k % 10 === 0) s.sample();
      seen.add(s.stage);
    }
    expect(seen.has("nrem") && seen.has("rem")).toBe(true);
    expect(s.hypnogram().length).toBe(60);
  });

  it("memory retrieval ranks a relevant important memory first", () => {
    const m = new MemoryStream();
    m.add("saw a squirrel", 1, 0);
    m.add("my human came home", 6, 20);
    m.add("sniffed the fence", 0.5, 30);
    expect(m.retrieve(30, ["squirrel"], 2)).toEqual(["my human came home", "saw a squirrel"]);
    expect(m.shouldReflect(5)).toBe(true);
  });
});

describe("task gating and scheduling (stale completion flags and blocking layers in earlier builds)", () => {
  it("a late done report for an old goal does not complete the new one", () => {
    const c = new Completion<string>();
    c.begin("walk to bench", 0);
    c.begin("turn to sit", 1);
    expect(c.report("walk to bench")).toBe(false);
    expect(c.isDone("turn to sit")).toBe(false);
    c.report("turn to sit");
    expect(c.isDone("turn to sit")).toBe(true);
  });

  it("the same goal begun again after it was done starts anew", () => {
    // before: begin with an equal goal kept done true, so a second walk to
    // the bench completed at once
    const c = new Completion<string>();
    c.begin("walk to bench", 0);
    expect(c.begin("walk to bench", 0.5)).toBe(false);
    c.report("walk to bench");
    expect(c.begin("walk to bench", 9)).toBe(true);
    expect(c.isDone("walk to bench")).toBe(false);
    expect(c.elapsed(10)).toBe(1);
  });

  it("settles on the real condition or a timeout", () => {
    expect(settled({ error: 0.1, rate: 0.2, elapsed: 0.5 })).toEqual({ done: true, timedOut: false });
    expect(settled({ error: 0.5, rate: 0.2, elapsed: 0.5 })).toEqual({ done: false, timedOut: false });
    expect(settled({ error: 0.5, rate: 0.2, elapsed: 3.5 })).toEqual({ done: true, timedOut: true });
    expect(settled({ error: 0.05, rate: 0.6, elapsed: 1 }).done).toBe(false);
  });

  it("starting a task releases blocking layers it does not declare", () => {
    const g = new LayerGate<"seated" | "holding" | "crouched">();
    g.hold("seated");
    g.hold("holding");
    expect(g.startTask("throw", ["holding"])).toEqual(["seated"]);
    expect(g.layers).toEqual(["holding"]);
    g.startTask("pet", ["crouched"]);
    expect(g.missing()).toEqual(["crouched"]);
  });

  it("runs inference after the interval, while idle, inside the frame budget, one at a time", async () => {
    const s = new InferenceScheduler({ minInterval: 25, idleOnly: true, frameBudgetMs: 20 });
    s.frame(12);
    expect(s.state(0, false)).toBe("waiting for idle");
    let release: () => void = () => {};
    const p = s.run(0, true, () => new Promise<number>((r) => (release = () => r(7))));
    expect(s.state(1, true)).toBe("busy");
    expect(await s.run(1, true, async () => 1)).toBeNull();
    release();
    expect(await p).toBe(7);
    expect(s.state(10, true)).toBe("cooling down");
    for (let k = 0; k < 40; k++) s.frame(40);
    expect(s.state(30, true)).toBe("over frame budget");
    expect(s.calls).toBe(1);
    expect(s.skipped).toBe(1);
  });
});
