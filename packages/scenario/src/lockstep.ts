// Lockstep driver: the page opened with a test hash does not run its own
// loop; the runner advances whole fixed steps through the page's test API
// and reads the trace. Generalized from the dog-simulator runner.
//
// Page contract (`window.__sim` unless named otherwise):
//   step(n)   advance n fixed steps
//   trace()   { rows: unknown[][], cols?: string[], hash?: string }
//   render()  optional, draw the current state before a screenshot
// Actions and probes are page code run with `h` bound to the handle
// expression (default `window.__sim`).
import { mkdirSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Page } from "puppeteer-core";
import { open, type OpenOptions, waitFor } from "./chrome.js";
import type { Check, Report, ScenarioResult } from "./report.js";
import type { Route } from "./routes.js";

export interface Action {
  /** sim seconds; or `when`, a page condition checked every `whenEvery` steps, fired once */
  at?: number;
  when?: string;
  js: string;
}

export interface Probe {
  every: number;
  /** an expression returning JSON */
  js: string;
}

export interface Shot {
  at: number;
  path: string;
  js?: string;
}

export interface Trace {
  rows: unknown[][];
  cols?: string[];
  hash?: string;
  probes: [number, unknown][];
  fired: [number, string][];
  wallSeconds: number;
}

export interface Scenario {
  name: string;
  seed: number;
  seconds: number;
  actions?: Action[];
  probes?: Probe[];
  shots?: Shot[];
  /** extra hash fields after `#test&seed=N`, such as `off=L.neural` */
  hash?: string;
  checks?: (t: Trace) => Check[];
}

export interface LockstepOptions {
  stepsPerSecond?: number;
  /** steps per call into the page (default 30) */
  chunk?: number;
  /** the page API expression (default `window.__sim`) */
  api?: string;
  /** what `h` is bound to in actions and probes (default the api) */
  handle?: string;
  /** steps between checks of `when` actions (default 15) */
  whenEvery?: number;
  onProgress?: (simSeconds: number, wallSeconds: number) => void;
}

const bound = (handle: string, body: string) => `(() => { const h = ${handle}; ${body} })()`;

/** Runs one scenario on an open page whose test API is ready. */
export async function runLockstep(page: Page, sc: Scenario, o: LockstepOptions = {}): Promise<Trace> {
  const sps = o.stepsPerSecond ?? 60;
  const api = o.api ?? "window.__sim";
  const handle = o.handle ?? api;
  const whenEvery = o.whenEvery ?? 15;
  const t0 = Date.now();
  const total = Math.round(sc.seconds * sps);
  const whens = (sc.actions ?? []).filter((a) => a.when);
  type Ev = { step: number; kind: "action" | "shot"; js?: string; path?: string };
  const events: Ev[] = [
    ...(sc.actions ?? []).filter((a) => !a.when).map((a) => ({ step: Math.round((a.at ?? 0) * sps), kind: "action" as const, js: a.js })),
    ...(sc.shots ?? []).map((s) => ({ step: Math.round(s.at * sps), kind: "shot" as const, ...(s.js ? { js: s.js } : {}), path: s.path })),
  ].sort((a, b) => a.step - b.step);
  const probes = (sc.probes ?? []).map((p) => ({ ...p, n: Math.max(1, Math.round(p.every * sps)) }));
  const out: Trace = { rows: [], probes: [], fired: [], wallSeconds: 0 };
  let done = 0;
  let lastLog = Date.now();
  const due = async () => {
    while (events.length && (events[0] as Ev).step <= done) {
      const e = events.shift() as Ev;
      if (e.js) await page.evaluate(bound(handle, e.js));
      if (e.kind === "shot" && e.path) {
        await page.evaluate(`(() => { const a = ${api}; if (a.render) a.render(); })()`);
        mkdirSync(dirname(e.path), { recursive: true });
        await page.screenshot({ path: e.path as `${string}.png` });
      }
    }
  };
  while (done < total) {
    await due();
    let n = Math.min(o.chunk ?? 30, total - done);
    if (events.length) n = Math.min(n, Math.max(1, (events[0] as Ev).step - done));
    for (const p of probes) n = Math.min(n, p.n - (done % p.n));
    if (whens.length) n = Math.min(n, whenEvery - (done % whenEvery));
    await page.evaluate(`${api}.step(${n})`);
    done += n;
    if (whens.length && done % whenEvery === 0) {
      for (let i = 0; i < whens.length; i++) {
        const w = whens[i] as Action;
        if (await page.evaluate(bound(handle, `return !!(${w.when});`))) {
          await page.evaluate(bound(handle, w.js));
          out.fired.push([done, w.when as string]);
          whens.splice(i--, 1);
        }
      }
    }
    for (const p of probes) if (done % p.n === 0) out.probes.push([done, await page.evaluate(bound(handle, `return (${p.js});`))]);
    if (o.onProgress && Date.now() - lastLog > 15000) {
      lastLog = Date.now();
      o.onProgress(done / sps, (Date.now() - t0) / 1000);
    }
  }
  // events at exactly `seconds` (a closing screenshot) fire after the last step
  await due();
  const tr = (await page.evaluate(`${api}.trace()`)) as { rows: unknown[][]; cols?: string[]; hash?: string };
  out.rows = tr.rows;
  if (tr.cols) out.cols = tr.cols;
  if (tr.hash !== undefined) out.hash = tr.hash;
  out.wallSeconds = (Date.now() - t0) / 1000;
  return out;
}

/** JSON with NaN and the infinities kept apart from null. */
const exact = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === "number" && !Number.isFinite(x) ? `${x}` : x));

/** First differing row between two traces, or null when identical. NaN, Infinity and null all differ. */
export function diffTraces(a: { rows: unknown[][]; hash?: string }, b: { rows: unknown[][]; hash?: string }): { row: number; a: unknown; b: unknown } | null {
  const n = Math.max(a.rows.length, b.rows.length);
  for (let i = 0; i < n; i++) {
    const x = exact(a.rows[i]);
    const y = exact(b.rows[i]);
    if (x !== y) return { row: i, a: a.rows[i] ?? null, b: b.rows[i] ?? null };
  }
  if (a.hash !== b.hash) return { row: n, a: a.hash ?? null, b: b.hash ?? null };
  return null;
}

export interface SuiteOptions extends LockstepOptions {
  /** the built page */
  file: string;
  scenarios: Scenario[];
  mode: "record" | "compare" | "check";
  /** golden traces go to <goldenDir>/<name>.json */
  goldenDir?: string;
  routes?: Route[];
  offline?: boolean;
  width?: number;
  height?: number;
  /** parallel browsers (default 2) */
  jobs?: number;
  /** wait this long for the page API (default 240 s) */
  readyMs?: number;
  chrome?: string;
  date?: string;
}

/** Runs a scenario list, records or compares goldens, returns a report. */
export async function runSuite(o: SuiteOptions): Promise<Report & { traces: Record<string, Trace> }> {
  if ((o.mode === "compare" || o.mode === "record") && !o.goldenDir) throw new Error(`${o.mode} needs goldenDir: without it nothing is ${o.mode === "compare" ? "compared" : "recorded"}`);
  const api = o.api ?? "window.__sim";
  const results: ScenarioResult[] = [];
  const traces: Record<string, Trace> = {};
  let chrome = "unknown";
  const queue = [...o.scenarios];
  const one = async (sc: Scenario) => {
    const oo: OpenOptions = { url: o.file, hash: `#test&seed=${sc.seed}${sc.hash ? `&${sc.hash}` : ""}`, routes: o.routes ?? [], offline: o.offline ?? false, width: o.width ?? 420, height: o.height ?? 280 };
    if (o.chrome) oo.chrome = o.chrome;
    const res: ScenarioResult = { name: sc.name, seed: sc.seed, checks: [], errors: [], blocked: [] };
    let close: (() => Promise<void>) | null = null;
    try {
      const opened = await open(oo);
      close = opened.close;
      const { page, log } = opened;
      chrome = log.version;
      res.errors = log.errors;
      res.blocked = log.blocked;
      const ok = await waitFor(page, `!!(${api})`, o.readyMs ?? 240000);
      if (!ok) throw new Error(`no ${api} after ${(o.readyMs ?? 240000) / 1000} s`);
      const tr = await runLockstep(page, sc, o);
      traces[sc.name] = tr;
      res.checks = sc.checks ? sc.checks(tr) : [];
      if (o.goldenDir && o.mode !== "check") {
        const gp = join(o.goldenDir, `${sc.name}.json`);
        if (o.mode === "record") {
          mkdirSync(o.goldenDir, { recursive: true });
          writeFileSync(gp, `${JSON.stringify({ name: sc.name, seed: sc.seed, seconds: sc.seconds, chrome: log.version, hash: tr.hash ?? null, cols: tr.cols ?? null, rows: tr.rows, probes: tr.probes, fired: tr.fired })}\n`);
          res.golden = "recorded";
        } else if (!existsSync(gp)) res.golden = "missing";
        else {
          const d = diffTraces(JSON.parse(readFileSync(gp, "utf8")), tr);
          res.golden = d ? "differs" : "identical";
          if (d) res.firstDifference = d;
        }
      }
    } catch (e) {
      res.errors.push(`runner: ${(e as Error).message}`);
    } finally {
      if (close) await close();
    }
    results.push(res);
  };
  await Promise.all(
    Array.from({ length: Math.min(o.jobs ?? 2, queue.length) }, async () => {
      while (queue.length) await one(queue.shift() as Scenario);
    }),
  );
  results.sort((a, b) => o.scenarios.findIndex((s) => s.name === a.name) - o.scenarios.findIndex((s) => s.name === b.name));
  return { date: o.date ?? new Date().toISOString().slice(0, 10), chrome, results, traces };
}
