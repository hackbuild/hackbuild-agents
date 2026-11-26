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
import { type Code, type Driver, diffTraces, drive, type LockstepOptions, type Scenario, type SimTrace, type Trace } from "./core.js";
import type { Report, ScenarioResult } from "./report.js";
import type { Route } from "./routes.js";

const bound = (handle: string, c: Code, expr: boolean) =>
  typeof c === "string" ? `(() => { const h = ${handle}; ${expr ? `return (${c});` : c} })()` : `(${c.toString()})(${handle})`;

/** A driver over a puppeteer page whose test API is ready. */
export function pageDriver(page: Page, o: LockstepOptions = {}): Driver {
  const api = o.api ?? "window.__sim";
  const handle = o.handle ?? api;
  return {
    act: (c) => page.evaluate(bound(handle, c, false)),
    read: (c) => page.evaluate(bound(handle, c, true)),
    step: (n) => page.evaluate(`${api}.step(${n})`),
    trace: () => page.evaluate(`${api}.trace()`) as Promise<SimTrace>,
    async shot(path) {
      await page.evaluate(`(() => { const a = ${api}; if (a.render) a.render(); })()`);
      mkdirSync(dirname(path), { recursive: true });
      await page.screenshot({ path: path as `${string}.png` });
    },
  };
}

/** Runs one scenario on an open page whose test API is ready. */
export function runLockstep(page: Page, sc: Scenario, o: LockstepOptions = {}): Promise<Trace> {
  return drive(pageDriver(page, o), sc, o);
}

/** Options of `runSuite`: the page file, the scenarios, the mode, goldens, routes, viewport and parallel browsers. */
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
