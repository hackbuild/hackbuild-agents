import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  checkMessage,
  createProfiler,
  diffTraces,
  findChrome,
  formatReport,
  frameStats,
  installRafSampler,
  jerk,
  npmCdn,
  open,
  percentile,
  pinned,
  readRaf,
  reportPasses,
  runSuite,
  type Scenario,
  serve,
  sliding,
  stallSeconds,
  togglesPerSecond,
  verdict,
} from "../src/index.js";

const here = import.meta.dirname;
const root = join(here, "../../..");
const nm = join(root, "node_modules");
const fixture = join(here, "fixtures/sim.html");
const tmp = mkdtempSync(join(tmpdir(), "hb-scenario-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe("metrics", () => {
  it("jerk is zero on a constant acceleration and large on a kick", () => {
    const dt = 0.1;
    const smooth = Array.from({ length: 20 }, (_, i) => [0.5 * 2 * (i * dt) ** 2, 0]);
    expect(Math.max(...jerk(smooth, dt))).toBeLessThan(1e-6);
    const kicked = smooth.map((p, i) => (i === 10 ? [(p[0] as number) + 0.05, 0] : p));
    // a 5 cm kick: third difference 3 * 0.05 / 0.001 = 150 m/s^3 (computed)
    expect(Math.max(...jerk(kicked, dt))).toBeCloseTo(150, 6);
  });

  it("sliding counts heading against motion over 0.6 rad", () => {
    const dt = 0.1;
    const pts = Array.from({ length: 11 }, (_, i) => [i * 0.1, 0]);
    // moving along +x is yaw pi/2; half the samples face +z instead
    const yaw = pts.map((_, i) => (i <= 5 ? Math.PI / 2 : 0));
    const r = sliding(pts, yaw, dt);
    expect(r.moving).toBe(10);
    expect(r.share).toBeCloseTo(0.5);
    expect(r.seconds).toBeCloseTo(0.5);
  });

  it("toggles per second, stalls and frame percentiles", () => {
    expect(togglesPerSecond(["a", "a", "b", "b", "a"], 0.25)).toBe(2);
    const still = Array.from({ length: 20 }, () => [1, 1]);
    expect(stallSeconds(still, still.map(() => true), 0.25)).toBeCloseTo(3);
    const f = frameStats([16, 17, 16, 50, 16, 17, 16, 16, 17, 100]);
    expect([f.p50, f.p95, f.max]).toEqual([16, 100, 100]);
    expect(percentile([3, 1, 2], 50)).toBe(2);
  });
});

describe("reports in the check message form", () => {
  it("names what failed, measured, legal, constraint and a fix", () => {
    const c = { what: "stall", measured: 4.75, unit: "s", legal: { max: 1 }, constraint: "set by the stall detector, 0.2 m in 2 s", fix: "insert a side waypoint" };
    expect(verdict(c)).toBe("fail");
    expect(checkMessage(c)).toBe("stall 4.75 s (measured), legal at most 1 s, set by the stall detector, 0.2 m in 2 s. fix: insert a side waypoint");
    expect(checkMessage({ ...c, measured: 0.5 })).toBe("stall 0.5 s (measured), legal at most 1 s, set by the stall detector, 0.2 m in 2 s");
    expect(checkMessage({ ...c, measured: null })).toBe("stall not run, legal at most 1 s, set by the stall detector, 0.2 m in 2 s");
    const rep = { date: "2026-11-22", chrome: "Chrome/150", results: [{ name: "a", seed: 1, checks: [c, { ...c, measured: 0.5 }], errors: [], blocked: [] }] };
    expect(formatReport(rep).split("\n")[2]).toMatch(/^ {2}fail: stall 4.75 s/);
    expect(reportPasses(rep)).toBe(false);
  });

  it("does not pass a report whose checks did not run", () => {
    const c = { what: "stall", measured: null, unit: "s", legal: { max: 1 }, constraint: "set by the stall detector" };
    const rep = (checks: object[]) => ({ date: "2026-11-23", chrome: "Chrome/150", results: [{ name: "a", seed: 1, checks: checks as never[], errors: [], blocked: [] }] });
    expect(reportPasses(rep([c, { ...c, measured: Number.NaN }]))).toBe(false);
    expect(reportPasses(rep([{ ...c, measured: 0.5 }, { ...c, optional: true }]))).toBe(true);
    expect(formatReport(rep([{ ...c, optional: true }]))).toMatch(/not run/);
  });

  it("refuses compare or record without a golden directory", async () => {
    await expect(runSuite({ file: fixture, scenarios: [], mode: "compare" })).rejects.toThrow(/goldenDir/);
    await expect(runSuite({ file: fixture, scenarios: [], mode: "record" })).rejects.toThrow(/goldenDir/);
  });
});

describe("profiler", () => {
  it("charges time per system and reports the worst first", () => {
    let t = 0;
    const p = createProfiler(() => t);
    for (let f = 0; f < 3; f++) {
      p.begin();
      t += 1;
      p.mark("brain");
      t += f === 2 ? 9 : 2;
      p.mark("render");
    }
    const r = p.report();
    expect(r[0]).toEqual({ label: "render", avg: 13 / 3, max: 9, n: 3 });
    expect(r[1]?.avg).toBe(1);
  });
});

describe("routes", () => {
  it("serves an npm CDN URL only for the installed version", () => {
    const v = JSON.parse(readFileSync(join(nm, "three/package.json"), "utf8")).version;
    const r = npmCdn(nm);
    expect(r(new URL(`https://cdn.jsdelivr.net/npm/three@${v}/build/three.module.js`))?.file).toBe(join(nm, "three/build/three.module.js"));
    expect(r(new URL("https://cdn.jsdelivr.net/npm/three@0.1.0/build/three.module.js"))).toBeNull();
    expect(r(new URL(`https://unpkg.com/three@${v}/package.json`))?.file).toBe(join(nm, "three/package.json"));
  });

  it("refuses an npm CDN path that climbs out of the package", () => {
    // before: the encoded slashes decoded after the URL parser had
    // normalized the path, and this URL resolved to /etc/hosts
    const v = JSON.parse(readFileSync(join(nm, "three/package.json"), "utf8")).version;
    const r = npmCdn(nm);
    const up = "..%2f".repeat(12);
    expect(r(new URL(`https://cdn.jsdelivr.net/npm/three@${v}/${up}etc%2fhosts`))).toBeNull();
    expect(r(new URL(`https://unpkg.com/three@${v}/${up}etc%2fhosts`))).toBeNull();
    expect(r(new URL(`https://cdn.jsdelivr.net/npm/three@${v}/..%5c..%5cpackage.json`))).toBeNull();
    expect(r(new URL(`https://cdn.jsdelivr.net/npm/three@${v}/%2e%2e/%2e%2e/package.json`))).toBeNull();
    expect(r(new URL(`https://cdn.jsdelivr.net/npm/three@${v}/build/%E0%A4%A`))).toBeNull();
  });

  it("refuses a pinned file whose hash changed", () => {
    const f = join(tmp, "w.bin");
    writeFileSync(f, "weights");
    const sha = createHash("sha256").update("weights").digest("hex");
    const r = pinned([{ url: "https://example.org/w.bin", file: "w.bin", sha256: sha }], tmp);
    const hit = r(new URL("https://example.org/w.bin?x=1"));
    expect(hit && serve(hit).contentType).toBe("application/octet-stream");
    const bad = pinned([{ url: "https://example.org/w.bin", file: "w.bin", sha256: "00" }], tmp)(new URL("https://example.org/w.bin"));
    expect(() => bad && serve(bad)).toThrow(/sha256/);
  });

  it("finds the first differing trace row", () => {
    expect(diffTraces({ rows: [[1], [2]] }, { rows: [[1], [2]] })).toBeNull();
    expect(diffTraces({ rows: [[1], [2]] }, { rows: [[1], [3]] })).toEqual({ row: 1, a: [2], b: [3] });
    expect(diffTraces({ rows: [[1]], hash: "a" }, { rows: [[1]], hash: "b" })?.row).toBe(1);
    // before: both sides went through JSON.stringify and NaN read as null
    expect(diffTraces({ rows: [[Number.NaN]] }, { rows: [[null]] })?.row).toBe(0);
    expect(diffTraces({ rows: [[Number.POSITIVE_INFINITY]] }, { rows: [[Number.NaN]] })?.row).toBe(0);
    expect(diffTraces({ rows: [[Number.NaN]] }, { rows: [[Number.NaN]] })).toBeNull();
  });
});

const chrome = findChrome();
describe.skipIf(!chrome)("in chrome", () => {
  const walk: Scenario = {
    name: "walk",
    seed: 3,
    seconds: 12,
    actions: [{ at: 4, js: "h.agent.v = 0;" }, { when: "h.agent.pos.length() > 2", js: "h.agent.state = 'far';" }],
    probes: [{ every: 1, js: "[h.agent.pos.x, h.agent.pos.y]" }],
    checks: (t) => {
      const pts = t.rows.map((r) => [r[1] as number, r[2] as number]);
      const yaw = t.rows.map((r) => r[3] as number);
      return [
        { what: "slide share", measured: sliding(pts, yaw, 0.25).share, legal: { max: 0.3 }, constraint: "set by the turn rate of 3 rad/s" },
        { what: "state toggles", measured: togglesPerSecond(t.rows.map((r) => r[4]), 0.25), unit: "per s", legal: { max: 2 }, constraint: "set by waypoint spacing" },
      ];
    },
  };

  it("records, then compares identical goldens with routed requests and no leaks", async () => {
    const goldenDir = join(tmp, "golden");
    const rec = await runSuite({ file: fixture, scenarios: [walk, { ...walk, name: "walk-s9", seed: 9 }], mode: "record", goldenDir, routes: [npmCdn(nm)] });
    expect(rec.results.map((r) => r.golden)).toEqual(["recorded", "recorded"]);
    const cmp = await runSuite({ file: fixture, scenarios: [walk, { ...walk, name: "walk-s9", seed: 9 }], mode: "compare", goldenDir, routes: [npmCdn(nm)] });
    expect(cmp.results.map((r) => r.golden)).toEqual(["identical", "identical"]);
    expect(reportPasses(cmp)).toBe(true);
    const tr = cmp.traces.walk;
    expect(tr?.rows.length).toBe(48);
    expect(tr?.probes.length).toBe(12);
    expect(tr?.fired.length).toBe(1);
    // a different seed gives a different trace
    expect(diffTraces(cmp.traces.walk as { rows: unknown[][] }, cmp.traces["walk-s9"] as { rows: unknown[][] })).not.toBeNull();
    console.log(formatReport(cmp));
  }, 120000);

  it("fails a run on an unrouted request and in offline mode", async () => {
    const leak = await runSuite({ file: fixture, scenarios: [{ ...walk, hash: "leak=1", seconds: 1 }], mode: "check", routes: [npmCdn(nm)] });
    expect(leak.results[0]?.blocked).toContain("https://example.invalid/track");
    expect(reportPasses(leak)).toBe(false);
    const off = await runSuite({ file: fixture, scenarios: [{ ...walk, seconds: 1 }], mode: "check", offline: true, readyMs: 3000 });
    expect(off.results[0]?.blocked.some((u) => u.includes("cdn.jsdelivr.net"))).toBe(true);
  }, 120000);

  it("takes a screenshot set at exactly the scenario length", async () => {
    // before: the step loop ended first and the closing shot never fired
    const shot = join(tmp, "end.png");
    await runSuite({ file: fixture, scenarios: [{ ...walk, seconds: 1, shots: [{ at: 1, path: shot }] }], mode: "check", routes: [npmCdn(nm)] });
    expect(existsSync(shot)).toBe(true);
  }, 60000);

  it("closes the browser when anything after launch fails", async () => {
    // before: a missing file threw from goto with the browser still running
    let browser: import("puppeteer-core").Browser | null = null;
    const missing = join(tmp, "no-such-page.html");
    await expect(
      open({
        url: missing,
        beforeGoto: async (p) => {
          browser = p.browser();
        },
      }),
    ).rejects.toThrow();
    expect(browser).not.toBeNull();
    expect((browser as unknown as import("puppeteer-core").Browser).connected).toBe(false);
    const r = await runSuite({ file: missing, scenarios: [{ ...walk, seconds: 1 }, { ...walk, name: "walk-2", seconds: 1 }], mode: "check" });
    expect(r.results.map((x) => x.name)).toEqual(["walk", "walk-2"]);
    expect(r.results.every((x) => x.errors.some((e) => e.startsWith("runner:")))).toBe(true);
    expect(reportPasses(r)).toBe(false);
  }, 60000);

  it("samples frames at real rate with the raf sampler", async () => {
    const { page, close } = await open({ url: fixture, hash: "#seed=2", routes: [npmCdn(nm)], beforeGoto: installRafSampler, gpu: "default" });
    try {
      await new Promise((r) => setTimeout(r, 1500));
      const r = await readRaf<number[]>(page);
      expect(r.frames.length).toBeGreaterThan(10);
      // samples start once the page defines __rafSample, a few frames after the sampler
      expect(r.samples.length).toBeGreaterThan(10);
      expect(r.samples.length).toBeLessThanOrEqual(r.frames.length + 1);
      expect(r.stats.p50).toBeGreaterThan(0);
      console.log(`raf sampler: ${r.frames.length} frames, p50 ${r.stats.p50.toFixed(1)} ms, p95 ${r.stats.p95.toFixed(1)} ms, max ${r.stats.max.toFixed(1)} ms (measured, headless, default gpu)`);
    } finally {
      await close();
    }
  }, 60000);
});
