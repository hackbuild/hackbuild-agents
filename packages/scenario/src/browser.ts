// @hackbuild/scenario/browser: the same lockstep core, metrics and reports
// for a sim that runs in the page itself. No Node imports, no puppeteer.
// A scenario is loaded from JSON (`parseScenario`), stepped against the sim
// object (`runScenario`, events streamed through `onEvent`), judged
// (`runScenarios` returns a report for `formatReport` and `reportPasses`),
// and two traces are compared (`diffRows`, `diffMessage`).
import { type Code, type Driver, diffTraces, drive, type LockstepOptions, type Scenario, type SimTrace, type Trace } from "./core.js";
import * as metrics from "./metrics.js";
import type { Check, Report, ScenarioResult } from "./report.js";

export * from "./core.js";
export * from "./metrics.js";
export * from "./profiler.js";
export * from "./report.js";

/** The sim contract: the same as `window.__sim` for the Node runner. */
export interface Sim {
  step(n: number): unknown;
  trace(): SimTrace | Promise<SimTrace>;
  render?(): unknown;
}

export interface BrowserRunOptions extends Omit<LockstepOptions, "api" | "handle"> {
  /** what `h` is bound to in actions and probes (default the sim) */
  handle?: unknown;
  /** give the event loop a turn after each chunk so the page stays live (default true) */
  yield?: boolean;
  /** called after `render()` for each shot; capture the canvas here */
  onShot?: (path: string) => unknown;
}

const compiled = new Map<string, (h: unknown) => unknown>();
function compile(c: string, expr: boolean): (h: unknown) => unknown {
  const key = `${expr ? "e" : "b"}${c}`;
  let f = compiled.get(key);
  if (!f) {
    f = new Function("h", expr ? `return (${c});` : c) as (h: unknown) => unknown;
    compiled.set(key, f);
  }
  return f;
}

const turn = () => new Promise<void>((r) => setTimeout(r, 0));

/** A driver over a sim object in this page. */
export function simDriver(sim: Sim, o: BrowserRunOptions = {}): Driver {
  const h = o.handle ?? sim;
  const run = (c: Code, expr: boolean) => (typeof c === "string" ? compile(c, expr)(h) : c(h));
  const yieldTurn = o.yield ?? typeof setTimeout === "function";
  return {
    act: (c) => run(c, false),
    read: (c) => run(c, true),
    async step(n) {
      await sim.step(n);
      if (yieldTurn) await turn();
    },
    trace: () => sim.trace(),
    async shot(path) {
      if (sim.render) await sim.render();
      if (o.onShot) await o.onShot(path);
    },
  };
}

/** Runs one scenario against a sim made with the scenario's seed. */
export function runScenario(sim: Sim, sc: Scenario, o: BrowserRunOptions = {}): Promise<Trace> {
  const { handle: _h, ...rest } = o;
  return drive(simDriver(sim, o), sc, rest);
}

/** A check in a scenario file: `js` is an expression of `t` (the trace) and `m` (the metrics) giving a number. */
export interface CheckSpec extends Omit<Check, "measured"> {
  js: string;
}

const fail = (msg: string): never => {
  throw new Error(msg);
};
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const list = (v: unknown, what: string): Record<string, unknown>[] => {
  if (v === undefined) return [];
  if (!Array.isArray(v) || !v.every(isObj)) fail(`${what} must be a list of objects`);
  return v as Record<string, unknown>[];
};
const str = (v: unknown, what: string): string => (typeof v === "string" && v.length ? v : fail(`${what} must be text`));
const num = (v: unknown, what: string): number => (typeof v === "number" && Number.isFinite(v) ? v : fail(`${what} must be a number`));

/** Measures a check spec against a trace; a throw or a non number reads as not run. */
export function measureCheck(spec: CheckSpec, t: Trace): Check {
  const { js, ...rest } = spec;
  let measured: number | null = null;
  try {
    const v = (new Function("t", "m", `return (${js});`) as (t: Trace, m: typeof metrics) => unknown)(t, metrics);
    if (typeof v === "number") measured = v;
  } catch {
    measured = null;
  }
  return { ...rest, measured };
}

/**
 * A scenario from JSON text or a parsed object: name, seed, seconds,
 * actions, probes, shots and check specs. Code fields are strings run with
 * `new Function`, so load only files you trust in this page.
 */
export function parseScenario(input: string | unknown): Scenario {
  let o: unknown = input;
  if (typeof input === "string") {
    try {
      o = JSON.parse(input);
    } catch (e) {
      fail(`scenario is not json: ${(e as Error).message}`);
    }
  }
  if (!isObj(o)) return fail("scenario must be an object");
  const name = str(o.name, "scenario name");
  const seed = num(o.seed, `${name}: seed`);
  if (!Number.isInteger(seed)) fail(`${name}: seed must be a whole number`);
  const seconds = num(o.seconds, `${name}: seconds`);
  if (seconds <= 0) fail(`${name}: seconds must be above 0`);
  const sc: Scenario = { name, seed, seconds };
  const actions = list(o.actions, `${name}: actions`).map((a, i) => {
    const js = str(a.js, `${name}: action ${i} js`);
    if (a.when !== undefined) return { when: str(a.when, `${name}: action ${i} when`), js };
    return { at: num(a.at ?? 0, `${name}: action ${i} at`), js };
  });
  if (actions.length) sc.actions = actions;
  const probes = list(o.probes, `${name}: probes`).map((p, i) => ({ every: num(p.every, `${name}: probe ${i} every`), js: str(p.js, `${name}: probe ${i} js`) }));
  if (probes.length) sc.probes = probes;
  const shots = list(o.shots, `${name}: shots`).map((s, i) => ({ at: num(s.at, `${name}: shot ${i} at`), path: str(s.path, `${name}: shot ${i} path`), ...(s.js !== undefined ? { js: str(s.js, `${name}: shot ${i} js`) } : {}) }));
  if (shots.length) sc.shots = shots;
  if (o.hash !== undefined) sc.hash = str(o.hash, `${name}: hash`);
  const specs = list(o.checks, `${name}: checks`).map((c, i) => {
    const what = str(c.what, `${name}: check ${i} what`);
    if (!isObj(c.legal)) fail(`${name}: check ${what} needs legal with min or max`);
    return { ...(c as object), what, js: str(c.js, `${name}: check ${what} js`), constraint: str(c.constraint, `${name}: check ${what} constraint`) } as CheckSpec;
  });
  if (specs.length) sc.checks = (t) => specs.map((s) => measureCheck(s, t));
  return sc;
}

/** A trace or golden file from JSON text or an object: rows, and cols, hash, probes, fired when present. */
export function parseTrace(input: string | unknown): Trace {
  let o: unknown = input;
  if (typeof input === "string") {
    try {
      o = JSON.parse(input);
    } catch (e) {
      fail(`trace is not json: ${(e as Error).message}`);
    }
  }
  if (!isObj(o) || !Array.isArray(o.rows) || !o.rows.every(Array.isArray)) return fail("trace needs rows, a list of lists");
  const t: Trace = { rows: o.rows as unknown[][], probes: Array.isArray(o.probes) ? (o.probes as [number, unknown][]) : [], fired: Array.isArray(o.fired) ? (o.fired as [number, string][]) : [], wallSeconds: typeof o.wallSeconds === "number" ? o.wallSeconds : 0 };
  if (Array.isArray(o.cols)) t.cols = o.cols as string[];
  if (typeof o.hash === "string") t.hash = o.hash;
  return t;
}

export interface BrowserSuiteOptions extends BrowserRunOptions {
  scenarios: Scenario[];
  /** a fresh sim seeded for the scenario */
  makeSim: (seed: number, sc: Scenario) => Sim | Promise<Sim>;
  /** golden traces by scenario name; with them each result says identical, differs or missing */
  goldens?: Record<string, { rows: unknown[][]; hash?: string | null }>;
  /** the report's browser line (default the user agent) */
  browser?: string;
  date?: string;
  /** called as each scenario finishes */
  onResult?: (r: ScenarioResult, t: Trace | null) => void;
}

/** Runs scenarios one after another in this page and returns a report with the traces. */
export async function runScenarios(o: BrowserSuiteOptions): Promise<Report & { traces: Record<string, Trace> }> {
  const results: ScenarioResult[] = [];
  const traces: Record<string, Trace> = {};
  for (const sc of o.scenarios) {
    const res: ScenarioResult = { name: sc.name, seed: sc.seed, checks: [], errors: [], blocked: [] };
    let tr: Trace | null = null;
    try {
      tr = await runScenario(await o.makeSim(sc.seed, sc), sc, o);
      traces[sc.name] = tr;
      res.checks = sc.checks ? sc.checks(tr) : [];
      if (o.goldens) {
        const g = o.goldens[sc.name];
        if (!g) res.golden = "missing";
        else {
          const d = diffTraces(g, tr);
          res.golden = d ? "differs" : "identical";
          if (d) res.firstDifference = d;
        }
      }
    } catch (e) {
      res.errors.push(`runner: ${(e as Error).message}`);
    }
    results.push(res);
    o.onResult?.(res, tr);
  }
  const ua = typeof navigator === "object" && navigator ? navigator.userAgent : "unknown";
  return { date: o.date ?? new Date().toISOString().slice(0, 10), chrome: o.browser ?? ua, results, traces };
}
