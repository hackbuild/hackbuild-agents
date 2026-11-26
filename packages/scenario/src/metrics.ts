// Motion metrics from lessons of earlier builds: judge motion by numbers, not by
// eye in a slow headless browser. All pure functions over sampled series.

/** Count, mean, p50, p95 and max of a list of numbers. */
export interface Stats {
  n: number;
  mean: number;
  p50: number;
  p95: number;
  max: number;
}

/** Percentile by nearest rank on a sorted copy. */
export function percentile(xs: readonly number[], p: number): number {
  if (!xs.length) return Number.NaN;
  const s = [...xs].sort((a, b) => a - b);
  const i = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1));
  return s[i] as number;
}

/** Count, mean, p50, p95 and max of a list; NaN for an empty list. */
export function stats(xs: readonly number[]): Stats {
  if (!xs.length) return { n: 0, mean: Number.NaN, p50: Number.NaN, p95: Number.NaN, max: Number.NaN };
  let sum = 0;
  let max = Number.NEGATIVE_INFINITY;
  for (const x of xs) {
    sum += x;
    if (x > max) max = x;
  }
  return { n: xs.length, mean: sum / xs.length, p50: percentile(xs, 50), p95: percentile(xs, 95), max };
}

/** Frame time p50, p95 and max in ms from frame durations. */
export function frameStats(ms: readonly number[]): Stats {
  return stats(ms);
}

/** A 2D or 3D position as numbers. */
export type Point = readonly number[];

/**
 * Jerk magnitudes (m/s^3) from positions sampled every `dt` seconds: the
 * third difference of position over dt^3. Points may be 2D or 3D.
 */
export function jerk(points: readonly Point[], dt: number): number[] {
  const out: number[] = [];
  for (let i = 3; i < points.length; i++) {
    const a = points[i] as Point;
    const b = points[i - 1] as Point;
    const c = points[i - 2] as Point;
    const d = points[i - 3] as Point;
    let s = 0;
    for (let k = 0; k < a.length; k++) {
      const j = ((a[k] as number) - 3 * (b[k] as number) + 3 * (c[k] as number) - (d[k] as number)) / (dt * dt * dt);
      s += j * j;
    }
    out.push(Math.sqrt(s));
  }
  return out;
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** What `sliding` returns: seconds and share of moving samples that slide. */
export interface SlideResult {
  /** seconds where the body heading and the direction of motion differ by more than the threshold */
  seconds: number;
  /** share of moving samples that slide */
  share: number;
  /** moving samples */
  moving: number;
}

/**
 * Sliding: the body faces one way and moves another. `yaw` 0 is +Z,
 * positions are (x, z). Samples below `minSpeed` m/s do not count.
 */
export function sliding(points: readonly Point[], yaw: readonly number[], dt: number, threshold = 0.6, minSpeed = 0.15): SlideResult {
  let slide = 0;
  let moving = 0;
  for (let i = 1; i < points.length; i++) {
    const p = points[i] as Point;
    const q = points[i - 1] as Point;
    const dx = (p[0] as number) - (q[0] as number);
    const dz = (p[1] as number) - (q[1] as number);
    if (Math.hypot(dx, dz) / dt < minSpeed) continue;
    moving++;
    const dir = Math.atan2(dx, dz);
    if (Math.abs(wrap(dir - (yaw[i] as number))) > threshold) slide++;
  }
  return { seconds: slide * dt, share: moving ? slide / moving : 0, moving };
}

/** State changes per second over a sampled label series. */
export function togglesPerSecond(states: readonly unknown[], dt: number): number {
  if (states.length < 2) return 0;
  let n = 0;
  for (let i = 1; i < states.length; i++) if (states[i] !== states[i - 1]) n++;
  return n / ((states.length - 1) * dt);
}

/**
 * Seconds where an agent with a goal moved under `dist` m over the
 * previous `window` s (the stall detector of earlier builds, 0.2 m in 2 s).
 */
export function stallSeconds(points: readonly Point[], hasGoal: readonly boolean[], dt: number, window = 2, dist = 0.2): number {
  const k = Math.max(1, Math.round(window / dt));
  let s = 0;
  for (let i = k; i < points.length; i++) {
    if (!hasGoal[i]) continue;
    const p = points[i] as Point;
    const q = points[i - k] as Point;
    if (Math.hypot((p[0] as number) - (q[0] as number), (p[1] as number) - (q[1] as number)) < dist) s += dt;
  }
  return s;
}
