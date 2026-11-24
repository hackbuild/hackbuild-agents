import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rolldown } from "rolldown";
import { afterAll, describe, expect, it } from "vitest";
import { diffMessage, diffRows, formatReport, parseScenario, parseTrace, reportPasses, runScenario, runScenarios, type Sim, traceHash } from "../src/browser.js";
import { findChrome, open, runLockstep } from "../src/index.js";
// @ts-expect-error a plain ES module fixture with no types
import { createSim } from "./fixtures/walker.mjs";

const here = import.meta.dirname;
const tmp = mkdtempSync(join(tmpdir(), "hb-scenario-browser-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));
const make = createSim as (seed: number) => Sim & { agent: { x: number } };

const def = {
  name: "walk",
  seed: 7,
  seconds: 10,
  actions: [{ at: 4, js: "h.agent.v = 0;" }, { when: "h.agent.x * h.agent.x + h.agent.z * h.agent.z > 2.25", js: "h.agent.state = 'far';" }],
  probes: [{ every: 1, js: "[h.agent.x, h.agent.z]" }],
  checks: [
    { what: "slide share", js: "m.sliding(t.rows.map((r) => [r[1], r[2]]), t.rows.map((r) => Math.atan2(r[3], r[4])), 0.25).share", legal: { max: 0.5 }, constraint: "set by the turn rate of 3 rad/s" },
    { what: "rows", js: "t.rows.length", legal: { min: 40, max: 40 }, constraint: "set by a row every 15 steps" },
  ],
};

let bundle = "";
describe("browser entry", () => {
  it("bundles for the browser with no node built ins and no puppeteer", async () => {
    const b = await rolldown({ input: join(here, "../src/browser.ts"), platform: "browser", logLevel: "silent" });
    const { output } = await b.generate({ format: "esm", codeSplitting: false });
    const chunk = output[0];
    bundle = chunk.code;
    expect(chunk.imports).toEqual([]);
    expect(bundle).not.toMatch(/from\s*["'](node:|puppeteer)/);
    expect(bundle).not.toMatch(/\bprocess\.env\b|\brequire\(/);
  });

  it("gives the same trace hash for the same seed and another for another seed", async () => {
    const sc = parseScenario(JSON.stringify(def));
    const events: string[] = [];
    const a = await runScenario(make(7), sc, { onEvent: (e) => events.push(e.type) });
    const b = await runScenario(make(7), sc);
    const c = await runScenario(make(8), { ...sc, seed: 8 });
    expect(traceHash(a)).toBe(traceHash(b));
    expect(traceHash(a)).not.toBe(traceHash(c));
    expect(a.rows.length).toBe(40);
    expect(a.probes.length).toBe(10);
    expect(a.fired.length).toBe(1);
    expect(events.filter((e) => e === "probe").length).toBe(10);
    expect(events).toContain("action");
    expect(events).toContain("fired");
  });

  it("judges a loaded scenario and compares goldens", async () => {
    const sc = parseScenario(def);
    const first = await runScenarios({ scenarios: [sc], makeSim: make, browser: "node", date: "2026-11-24" });
    expect(reportPasses(first)).toBe(true);
    const golden = parseTrace(JSON.stringify(first.traces.walk));
    const again = await runScenarios({ scenarios: [sc], makeSim: make, goldens: { walk: golden }, browser: "node", date: "2026-11-24" });
    expect(again.results[0]?.golden).toBe("identical");
    const off = await runScenarios({ scenarios: [sc], makeSim: (s) => make(s + 1), goldens: { walk: golden }, browser: "node" });
    expect(off.results[0]?.golden).toBe("differs");
    expect(reportPasses(off)).toBe(false);
    expect(formatReport(off)).toMatch(/golden differs/);
  });

  it("names the first differing row and column", () => {
    const a = { cols: ["step", "heading"], rows: [[1, 0.2], [2, 0.41], [3, 0.5]] };
    const b = { rows: [[1, 0.2], [2, 0.39], [3, 0.6]] };
    expect(diffMessage(a, b)).toBe("trace differs at row 1: heading 0.41, expected 0.39");
    expect(diffRows(a, b).differing).toBe(2);
    expect(diffMessage(a, a)).toBe("traces match");
  });

  it("refuses a scenario file that misses a field", () => {
    expect(() => parseScenario("{")).toThrow(/scenario is not json/);
    expect(() => parseScenario({ name: "x", seed: 1.5, seconds: 1 })).toThrow("x: seed must be a whole number");
    expect(() => parseScenario({ name: "x", seed: 1, seconds: 1, checks: [{ what: "a", js: "1", constraint: "c" }] })).toThrow(/needs legal/);
  });
});

const chrome = findChrome();
describe.skipIf(!chrome)("browser entry in chrome", () => {
  it("matches the node trace hash in a headless page, through both drivers", async () => {
    expect(bundle).not.toBe("");
    const node = traceHash(await runScenario(make(7), parseScenario(def), {}));
    const blank = join(tmp, "blank.html");
    writeFileSync(blank, "<!doctype html><title>blank</title>");
    const url = (code: string) => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
    const walker = readFileSync(join(here, "fixtures/walker.mjs"), "utf8");
    const { page, log, close } = await open({ url: blank, offline: true });
    try {
      // a string, so the test transform leaves the page's import() alone
      const inPage = (await page.evaluate(`(async () => {
        const m = await import(${JSON.stringify(url(bundle))});
        const s = await import(${JSON.stringify(url(walker))});
        const t = await m.runScenario(s.createSim(7), m.parseScenario(${JSON.stringify(JSON.stringify(def))}));
        window.__sim = s.createSim(7);
        return m.traceHash(t);
      })()`)) as string;
      const driven = traceHash(await runLockstep(page, parseScenario(def)));
      expect(inPage).toBe(node);
      expect(driven).toBe(node);
      expect(log.errors).toEqual([]);
      expect(log.blocked).toEqual([]);
    } finally {
      await close();
    }
  }, 60000);
});
