// Seeded inputs shared by the legacy parity fixtures and the tests that
// read them. The fixtures in fixtures/legacy-*.json were produced by
// running the legacy dog simulator's own JavaScript (legacy/det in the
// public dog-simulator repository, commit named in each fixture) on
// exactly these inputs; only the numbers it produced are committed here.

/** Mulberry32, the generator the legacy code and the wasm both use. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Frame sizes for the map parity run: the legacy eye size and odd sizes. */
export const MAP_SIZES: readonly (readonly [number, number])[] = [
  [320, 160],
  [640, 320],
  [200, 100],
  [321, 163],
  [97, 61],
];

/**
 * Frame k of the map parity run: noise with up to four flat rectangles,
 * every fifth frame flat grey. Returns the RGBA bytes and the size.
 */
export function mapFrame(k: number): { img: Uint8Array; w: number; h: number } {
  const [w, h] = MAP_SIZES[k % MAP_SIZES.length] as readonly [number, number];
  const r = mulberry32(1000 + k);
  const img = new Uint8Array(w * h * 4);
  if (k % 5 === 4) {
    img.fill(80);
    return { img, w, h };
  }
  for (let i = 0; i < img.length; i++) img[i] = (r() * 255) | 0;
  const nb = (r() * 5) | 0;
  for (let b = 0; b < nb; b++) {
    const x0 = (r() * w) | 0;
    const y0 = (r() * h) | 0;
    const bw = (r() * 60) | 0;
    const bh = (r() * 40) | 0;
    const c = [(r() * 255) | 0, (r() * 255) | 0, (r() * 255) | 0];
    for (let y = y0; y < Math.min(h, y0 + bh); y++) for (let x = x0; x < Math.min(w, x0 + bw); x++) img.set(c, (y * w + x) * 4);
  }
  return { img, w, h };
}

export const MAP_FRAMES = 300;

/** A world point with a legacy percept kind, for top down bias and snapping. */
export interface Percept {
  kind: "you" | "ball" | "squirrel" | "bowl" | "bone" | "treat";
  x: number;
  y: number;
  z: number;
}

/** One fixation sequence: a turning head over moving frames, with percepts. */
export interface Sequence {
  seed: number;
  w: number;
  h: number;
  frames: number;
  dt: number;
  /** drive levels and arousal the legacy top down weights read */
  drives: { social: number; play: number; prey: number; hunger: number };
  arousal: number;
  percepts: Percept[];
}

export const SEQUENCES: readonly Sequence[] = [
  { seed: 11, w: 320, h: 160, frames: 120, dt: 0.1, drives: { social: 0.3, play: 0.6, prey: 0.1, hunger: 0.4 }, arousal: 0.2, percepts: [{ kind: "ball", x: 1.2, y: 0.1, z: 3 }, { kind: "bowl", x: -1.5, y: 0, z: 2.5 }, { kind: "you", x: 0.4, y: 1.5, z: 5 }] },
  { seed: 12, w: 321, h: 163, frames: 120, dt: 0.07, drives: { social: 0.8, play: 0.1, prey: 0.7, hunger: 0.1 }, arousal: 0.8, percepts: [{ kind: "squirrel", x: -2, y: 0.2, z: 4 }, { kind: "treat", x: 0.5, y: 0, z: 1.5 }, { kind: "bone", x: 2.5, y: 0, z: 2 }] },
  { seed: 13, w: 200, h: 100, frames: 120, dt: 0.13, drives: { social: 0.5, play: 0.5, prey: 0.5, hunger: 0.9 }, arousal: 0.5, percepts: [] },
];

/** Head pose at frame k of a sequence: eye 0.5 m up, yaw sweeping, small pitch. */
export function headPose(s: Sequence, k: number): { x: number; y: number; z: number; yaw: number; pitch: number } {
  return { x: 0.02 * k, y: 0.5, z: 0, yaw: 0.6 * Math.sin(k * 0.07 + s.seed), pitch: -0.1 + 0.05 * Math.sin(k * 0.11) };
}

/** Frame k of a sequence: sky and ground with moving coloured patches, seeded. */
export function sequenceFrame(s: Sequence, k: number): Uint8Array {
  const { w, h } = s;
  const r = mulberry32(s.seed * 7919 + k);
  const f = new Uint8Array(w * h * 4);
  const patches = [0, 1, 2].map((j) => ({
    cx: (20 + ((k * (9 + j * 5) + j * 97) % Math.max(1, w - 40))) | 0,
    cy: (h / 3 + ((k * (3 + j) + j * 31) % Math.max(1, h / 2))) | 0,
    rgb: ([[240, 210, 30], [40, 60, 230], [200, 200, 200]] as const)[j] as readonly number[],
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

/** Plume runs: seed, sources, steps; the third reaches the 600 puff cap. */
export interface PlumeRun {
  seed: number;
  steps: number;
  sources: { id: number; x: number; z: number; strength: number }[];
}

export const PLUME_RUNS: readonly PlumeRun[] = [
  { seed: 77, steps: 3000, sources: [{ id: 0, x: 1, z: -1, strength: 1 }] },
  { seed: 78, steps: 3000, sources: [{ id: 0, x: 1, z: -1, strength: 1 }, { id: 1, x: -4, z: 3, strength: 1.3 }, { id: 2, x: 6, z: 6, strength: 0.25 }] },
  { seed: 79, steps: 2400, sources: Array.from({ length: 12 }, (_, i) => ({ id: i, x: -3 + (i % 4) * 2, z: -3 + Math.floor(i / 4) * 2, strength: 1 + (i % 3) * 0.2 })) },
];

/** Step length at step k: mostly 1/60 s, every seventh 1/30 s. */
export const plumeDt = (k: number): number => (k % 7 === 3 ? 1 / 30 : 1 / 60);
