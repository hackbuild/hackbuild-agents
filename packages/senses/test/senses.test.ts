import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  angularSize,
  cameraLook,
  gauss,
  goldenTrace,
  load,
  localizeSound,
  Looming,
  OCCUPIED,
  OccupancyGrid,
  OdourField,
  PerceptMemory,
  Saliency,
  seededRng,
  Sniffer,
  timeToContact,
  Tracker,
} from "../src/index.js";
import { countIds, decodeDepth } from "../src/three.js";
import { LegacyAttention } from "./legacy-ref.js";

const here = import.meta.dirname;

beforeAll(async () => {
  await load(readFileSync(join(here, "../src/wasm/senses_bg.wasm")));
});

/** A seeded eye frame: sky, ground, noise and up to three moving patches. */
function frame(w: number, h: number, k: number, seed: number): Uint8Array {
  const r = seededRng(seed * 7919 + k);
  const f = new Uint8Array(w * h * 4);
  const patches = [0, 1, 2].map((j) => ({
    cx: (40 + ((k * (9 + j * 5) + j * 97) % (w - 80))) | 0,
    cy: (h / 3 + ((k * (3 + j) + j * 31) % (h / 2))) | 0,
    rgb: [
      [240, 210, 30],
      [40, 60, 230],
      [200, 200, 200],
    ][j] as number[],
    on: (k + j) % 4 !== 0,
  }));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const n = (r() * 30) | 0;
      const sky = y < h / 3;
      f[i] = (sky ? 170 : 90) + n;
      f[i + 1] = (sky ? 190 : 110) + n;
      f[i + 2] = (sky ? 220 : 60) + n;
      f[i + 3] = 255;
      for (const p of patches) {
        if (!p.on || Math.abs(x - p.cx) > 9 || Math.abs(y - p.cy) > 7) continue;
        f.set(p.rgb, i);
      }
    }
  return f;
}

describe("native and wasm agree", () => {
  it("golden trace is bit identical to the native build", () => {
    const g = JSON.parse(readFileSync(join(here, "../../../crates/senses/tests/golden.json"), "utf8"));
    const t = Array.from(goldenTrace(g.seed));
    expect(t.length).toBe(g.values.length);
    expect(t).toEqual(g.values);
  });
});

describe("saliency parity with the HACKLE attention arithmetic", () => {
  it("agrees on the winner in every frame and on the map to f32 rounding", () => {
    // 240 synthetic seeded frames at 320 by 160 (HACKLE's eye size), with a top down blob on a third of them
    const cam = cameraLook({ x: 0, y: 0.5, z: 0 }, 0, 0, 60, 2, 0.05, 50);
    const ref = new LegacyAttention();
    const sal = new Saliency({ rng: seededRng(1) });
    let agree = 0;
    let maxRel = 0;
    const frames = 240;
    for (let k = 0; k < frames; k++) {
      const img = frame(320, 160, k, 3);
      const blobs: [number, number, number][] = k % 3 === 0 ? [[(k * 7) % 40, (k * 3) % 20, 0.6 * 1.2]] : [];
      for (const [cx, cy, a] of blobs) sal.biasUv(cx / 40, cy / 20, a);
      const m = sal.update(img, 320, 160, k * 0.1, cam);
      const s = ref.update(img, 320, 160, 1, blobs);
      let mx = 0;
      let d = 0;
      for (let i = 0; i < s.length; i++) {
        mx = Math.max(mx, Math.abs(s[i] as number));
        d = Math.max(d, Math.abs((s[i] as number) - (m[i] as number)));
      }
      maxRel = Math.max(maxRel, d / (mx || 1));
      const w = sal.winner();
      if ((w ? w.index : -1) === ref.winner()) agree++;
    }
    // tolerances recorded in the README: winner agreement at least 99 percent, map within 1e-6 of the max
    expect(agree / frames).toBeGreaterThanOrEqual(0.99);
    expect(maxRel).toBeLessThan(1e-6);
    console.log(`saliency parity: winner ${agree}/${frames}, max relative map difference ${maxRel.toExponential(2)} (measured)`);
  });

  it("inhibition of return survives a head turn", () => {
    const sal = new Saliency({ rng: seededRng(2) });
    const img = frame(320, 160, 1, 5);
    const camA = cameraLook({ x: 0, y: 0.5, z: 0 }, 0, 0, 60, 2, 0.05, 50);
    sal.update(img, 320, 160, 0, camA);
    const f = sal.shift(0, camA, [], 0.3);
    expect(f).not.toBeNull();
    // the same world direction, seen after the head turned 0.3 rad: the inhibited spot moved in the image
    const camB = cameraLook({ x: 0, y: 0.5, z: 0 }, 0.3, 0, 60, 2, 0.05, 50);
    const plain = new Saliency({ rng: seededRng(2) });
    plain.update(img, 320, 160, 0, camB);
    const a = plain.update(img, 320, 160, 0.1, camB);
    sal.update(img, 320, 160, 0.05, camB);
    const b = sal.update(img, 320, 160, 0.1, camB);
    let lowered = 0;
    for (let i = 0; i < a.length; i++) if ((b[i] as number) < (a[i] as number) - 1e-6) lowered++;
    expect(lowered).toBeGreaterThan(0);
    expect(sal.inhibited).toBe(1);
  });
});

describe("plume parity with the HACKLE nose", () => {
  it("replays puff positions from the same seeded stream", () => {
    // reference: HACKLE plumeTick for one source, transcribed, on the stream the field seeds from
    const seed = 77;
    const rng = seededRng(seed);
    class OU {
      x: number;
      constructor(
        public tau: number,
        public sigma: number,
      ) {
        this.x = sigma * gauss(rng) * 0.5;
      }
      step(dt: number) {
        const e = Math.exp(-(1 / this.tau) * dt);
        this.x = this.x * e + this.sigma * Math.sqrt(1 - e * e) * gauss(rng);
        return this.x;
      }
    }
    const windOu = new OU(25, 0.6);
    const puffs: { x: number; z: number; age: number; tx: OU; tz: OU }[] = [];
    let acc = 0;
    const ws = 0.7;
    // the field draws its seed from the injected rng: give it a stream whose first draw is that seed
    const field = new OdourField({ rng: () => seed / 4294967296 });
    for (let k = 0; k < 600; k++) {
      const dt = 1 / 60;
      const a = 0.4 + windOu.step(dt) * 0.35 * 2;
      const wv = [Math.cos(a) * ws, Math.sin(a) * ws] as const;
      acc += dt * 5 * Math.sqrt(1);
      while (acc >= 1) {
        acc -= 1;
        const x = 1 + (-0.05 + rng() * 0.1);
        const z = -1 + (-0.05 + rng() * 0.1);
        puffs.push({ x, z, age: 0, tx: new OU(0.8, 0.25 * (ws + 0.2)), tz: new OU(0.8, 0.25 * (ws + 0.2)) });
      }
      for (let i = puffs.length - 1; i >= 0; i--) {
        const p = puffs[i] as (typeof puffs)[number];
        p.age += dt;
        p.x += (wv[0] + p.tx.step(dt)) * dt;
        p.z += (wv[1] + p.tz.step(dt)) * dt;
        if (p.age > 14 || Math.abs(p.x) > 17 || Math.abs(p.z) > 17) puffs.splice(i, 1);
      }
      field.step(dt, [{ id: 0, x: 1, z: -1, strength: 1 }]);
    }
    const got = field.puffs();
    expect(got.length / 4).toBe(puffs.length);
    let d = 0;
    puffs.forEach((p, i) => {
      d = Math.max(d, Math.abs(p.x - (got[i * 4] as number)), Math.abs(p.z - (got[i * 4 + 1] as number)));
    });
    // Math.exp, log and cos against libm can differ in the last bit; recorded tolerance 1e-9 m
    expect(d).toBeLessThan(1e-9);
    console.log(`plume parity: ${puffs.length} puffs, max position difference ${d.toExponential(2)} m (measured)`);
  });
});

describe("senses", () => {
  it("looming startles on a fast approach and time to contact matches the TS helper", () => {
    const l = new Looming();
    let startle: number | null = null;
    for (let k = 0; k < 40 && startle === null; k++) startle = l.observe(3, 0.3, 4 - k * 0.1, k / 30);
    expect(startle).not.toBeNull();
    expect(timeToContact(angularSize(0.3, 1.5), angularSize(0.3, 1.45), 1 / 60)).toBeCloseTo(0.5034, 3);
  });

  it("localizes sound with front back confusion near 6 percent", () => {
    const r = seededRng(8);
    let flips = 0;
    for (let i = 0; i < 20000; i++) {
      const a = localizeSound(0.5, 0, 7.6, false, r);
      if (Math.abs(Math.atan2(Math.sin(a - 0.5), Math.cos(a - 0.5))) > 0.8) flips++;
    }
    expect(Math.abs(flips / 20000 - 0.06)).toBeLessThan(0.008);
  });

  it("percept memory sees, forgets and drifts", () => {
    const m = new PerceptMemory({ rng: seededRng(4) });
    const eye = { x: 0, y: 0.5, z: 0 };
    const p = m.sense(0, eye, 0, { pos: { x: 0, y: 0, z: 3 }, size: 0.3 }, 1, 0);
    expect(p.visible).toBe(true);
    const q = m.sense(0, eye, 0, { pos: { x: 0, y: 0, z: 3 }, size: 0.3, occluded: true }, 1, 1);
    expect(q.visible).toBe(false);
    const r = m.recall(0, 61);
    expect(r).not.toBeNull();
    expect(Math.hypot((r?.pos.x ?? 0) - 0, (r?.pos.z ?? 0) - 3)).toBeGreaterThan(0);
  });

  it("a sniffer on a plume finds whiffs downwind and the tracker surges", () => {
    const f = new OdourField({ rng: seededRng(5), meander: 0 });
    const src = [{ id: 0, x: -3, z: 0, strength: 1 }];
    for (let k = 0; k < 300; k++) f.step(1 / 60, src);
    const w = f.wind();
    const nose = { x: -3 + w.x * 3, z: w.z * 3 };
    const sn = new Sniffer({ rng: seededRng(6) });
    const tr = new Tracker({ rng: seededRng(7) });
    const modes = new Set<string>();
    for (let k = 0; k < 600; k++) {
      const now = 5 + k / 60;
      f.step(1 / 60, src);
      sn.tick(f, 1 / 60, now, true, nose, { x: 0, z: 0.03 });
      modes.add(tr.step(f, sn, 1 / 60, now, nose, 0, k % 60 === 0).mode);
    }
    expect(modes.has("surge")).toBe(true);
  });

  it("occupancy grid finds a path round a wall", () => {
    const g = new OccupancyGrid({ cells: 60 });
    for (let j = 0; j < 60; j++)
      for (let i = 0; i < 60; i++) {
        const x = -3 + (i + 0.5) * 0.1;
        const z = -3 + (j + 0.5) * 0.1;
        g.mark(x, z, false);
        if (j === 30 && i < 45) {
          g.mark(x, z, true);
          g.mark(x, z, true);
        }
      }
    expect(g.at(-2, 0.05)).toBe(OCCUPIED);
    const p = g.path({ x: -2, z: -1.5 }, { x: -2, z: 1.5 });
    expect(p?.some((q) => q.x > 1.5)).toBe(true);
  });

  it("decodes packed depth and counts id pixels from a bottom up readback", () => {
    const w = 4;
    const h = 2;
    const px = new Uint8Array(w * h * 4);
    // bottom row (first in memory): depth 6 m of 12 is 127.5 of 255, so red 127 and green 128
    for (let x = 0; x < w; x++) px.set([127, 128, 0, 255], x * 4);
    const d = decodeDepth(px, w, h, 12);
    expect(d[w + 1]).toBeCloseTo(6, 2);
    expect(d[1]).toBe(0);
    const ids = new Uint8Array(w * h * 4);
    ids.set([1, 0, 0, 255], 0);
    ids.set([2, 1, 0, 255], 4);
    const c = countIds(ids, w, h, 300);
    expect(c.count[0]).toBe(1);
    expect(c.count[257]).toBe(1);
    expect(c.sy[0]).toBe(1);
  });
});
