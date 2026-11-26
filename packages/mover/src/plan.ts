// A grid path planner over `World` colliders. The steerer bends round one
// obstacle at a time and slides along it, so on its own it never gets
// round a wall that stands across the line to the goal: the stall detector
// fires again and again. `planPath` runs A* on a grid where every collider
// the actor cannot step onto is grown by the actor radius and a margin,
// then pulls the cell path straight where the line between two waypoints
// stays clear. `Steerer.setPath` walks the result. Deterministic: fixed
// neighbour order, heap ties break by cell index.

import type { Collider, World } from "./world.js";

/** A point on the ground plane. */
export interface Spot {
  x: number;
  z: number;
}

/** Grid, actor size and search area for `planPath`. */
export interface PlanOptions {
  /** grid cell, metres (0.2) */
  cell?: number;
  /** actor radius, metres (0.3) */
  radius?: number;
  /** extra clearance kept from colliders, metres (0.12) */
  margin?: number;
  /** feet height the actor walks at, metres (0) */
  y?: number;
  /** actor height; colliders wholly above `y + height` do not block (1.7) */
  height?: number;
  /** tops up to `y + stepUp` are walked over (the world's stepUp, else 0.36) */
  stepUp?: number;
  /** search area; default the box round every enabled collider and both ends */
  bounds?: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** cells at most; a larger grid fails with reason `too-large` (250000) */
  maxCells?: number;
}

/** The waypoints of a plan, or why there is none: `goal-blocked`, `no-way` or `too-large`. */
export type PlanResult =
  | { ok: true; waypoints: Spot[]; cells: number; why: string }
  | { ok: false; reason: "goal-blocked" | "no-way" | "too-large"; waypoints: []; cells: number; why: string };

/** Colliders that block an actor at feet height `y` (walls, tops above the step, not overhead ones). */
export function blockers(colliders: readonly Collider[], y = 0, height = 1.7, stepUp = 0.36): Collider[] {
  return colliders.filter((c) => c.enabled && (c.wall || c.maxY > y + stepUp) && c.minY < y + height);
}

/** Surface distance on the ground plane from (x, z) to a collider; negative inside. */
function gap(c: Collider, x: number, z: number): number {
  if (c.kind === "cyl") return Math.hypot(x - c.x, z - c.z) - c.r;
  const dx = Math.max(c.minX - x, 0, x - c.maxX);
  const dz = Math.max(c.minZ - z, 0, z - c.maxZ);
  if (dx || dz) return Math.hypot(dx, dz);
  return -Math.min(x - c.minX, c.maxX - x, z - c.minZ, c.maxZ - z);
}

/** True when an actor of the planner's radius plus margin fits at (x, z). */
export function clearAt(block: readonly Collider[], x: number, z: number, pad: number): boolean {
  for (const c of block) if (gap(c, x, z) < pad) return false;
  return true;
}

/**
 * A path from `from` to `to` round the colliders of `world` (a `World` or a
 * collider list), as waypoints after `from` ending exactly at `to`. On
 * failure `ok` is false and `reason` says why: the goal stands inside a
 * collider grown by the pad, no way exists on the grid, or the grid would
 * exceed `maxCells`.
 */
export function planPath(world: World | readonly Collider[], from: Spot, to: Spot, o: PlanOptions = {}): PlanResult {
  const colliders = Array.isArray(world) ? (world as readonly Collider[]) : (world as World).colliders;
  const cell = o.cell ?? 0.2;
  const pad = (o.radius ?? 0.3) + (o.margin ?? 0.12);
  const stepUp = o.stepUp ?? (Array.isArray(world) ? 0.36 : (world as World).stepUp);
  const block = blockers(colliders, o.y ?? 0, o.height ?? 1.7, stepUp);
  const fail = (reason: "goal-blocked" | "no-way" | "too-large", cells: number, why: string): PlanResult => ({ ok: false, reason, waypoints: [], cells, why });
  if (!clearAt(block, to.x, to.z, pad)) return fail("goal-blocked", 0, `goal at ${to.x.toFixed(2)}, ${to.z.toFixed(2)} is inside a collider grown by ${pad.toFixed(2)} m`);

  let b = o.bounds;
  if (!b) {
    b = { minX: Math.min(from.x, to.x), maxX: Math.max(from.x, to.x), minZ: Math.min(from.z, to.z), maxZ: Math.max(from.z, to.z) };
    for (const c of colliders) {
      if (!c.enabled) continue;
      const [x0, x1, z0, z1] = c.kind === "box" ? [c.minX, c.maxX, c.minZ, c.maxZ] : [c.x - c.r, c.x + c.r, c.z - c.r, c.z + c.r];
      b = { minX: Math.min(b.minX, x0), maxX: Math.max(b.maxX, x1), minZ: Math.min(b.minZ, z0), maxZ: Math.max(b.maxZ, z1) };
    }
    const e = pad + cell;
    b = { minX: b.minX - e, maxX: b.maxX + e, minZ: b.minZ - e, maxZ: b.maxZ + e };
  }
  const nx = Math.max(1, Math.ceil((b.maxX - b.minX) / cell));
  const nz = Math.max(1, Math.ceil((b.maxZ - b.minZ) / cell));
  const total = nx * nz;
  if (total > (o.maxCells ?? 250000)) return fail("too-large", total, `${nx} by ${nz} cells is over maxCells, raise cell or pass bounds`);
  const { minX, minZ } = b;
  const ax = (i: number) => minX + (i + 0.5) * cell;
  const az = (j: number) => minZ + (j + 0.5) * cell;
  const ci = (x: number) => Math.max(0, Math.min(nx - 1, Math.floor((x - minX) / cell)));
  const cj = (z: number) => Math.max(0, Math.min(nz - 1, Math.floor((z - minZ) / cell)));
  const free = new Uint8Array(total);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) free[j * nx + i] = clearAt(block, ax(i), az(j), pad) ? 1 : 0;
  const s = cj(from.z) * nx + ci(from.x);
  const g = cj(to.z) * nx + ci(to.x);
  // the start may sit within the pad of a wall; the goal point is clear
  free[s] = 1;
  free[g] = 1;

  const cost = new Float64Array(total).fill(Infinity);
  const prev = new Int32Array(total).fill(-1);
  const shut = new Uint8Array(total);
  const gi = g % nx;
  const gj = Math.floor(g / nx);
  const h = (k: number) => Math.hypot((k % nx) - gi, Math.floor(k / nx) - gj);
  // binary heap of cells by f, ties by cell index
  const hf: number[] = [];
  const hk: number[] = [];
  const less = (a: number, c: number) => (hf[a] as number) < (hf[c] as number) || (hf[a] === hf[c] && (hk[a] as number) < (hk[c] as number));
  const swap = (a: number, c: number) => {
    [hf[a], hf[c]] = [hf[c] as number, hf[a] as number];
    [hk[a], hk[c]] = [hk[c] as number, hk[a] as number];
  };
  const push = (f: number, k: number) => {
    hf.push(f);
    hk.push(k);
    for (let i = hf.length - 1; i > 0; ) {
      const p = (i - 1) >> 1;
      if (!less(i, p)) break;
      swap(i, p);
      i = p;
    }
  };
  const pop = (): number => {
    const top = hk[0] as number;
    const lf = hf.pop() as number;
    const lk = hk.pop() as number;
    if (hf.length) {
      hf[0] = lf;
      hk[0] = lk;
      for (let i = 0; ; ) {
        const l = 2 * i + 1;
        let m = i;
        if (l < hf.length && less(l, m)) m = l;
        if (l + 1 < hf.length && less(l + 1, m)) m = l + 1;
        if (m === i) break;
        swap(i, m);
        i = m;
      }
    }
    return top;
  };
  cost[s] = 0;
  push(h(s), s);
  while (hf.length) {
    const k = pop();
    if (shut[k]) continue;
    shut[k] = 1;
    if (k === g) break;
    const i0 = k % nx;
    const j0 = Math.floor(k / nx);
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const i = i0 + di;
        const j = j0 + dj;
        if (i < 0 || j < 0 || i >= nx || j >= nz) continue;
        const n = j * nx + i;
        // no corner cutting: a diagonal needs both sides open
        if (!free[n] || (di && dj && (!free[j0 * nx + i] || !free[j * nx + i0]))) continue;
        const c = (cost[k] as number) + (di && dj ? Math.SQRT2 : 1);
        if (c < (cost[n] as number)) {
          cost[n] = c;
          prev[n] = k;
          push(c + h(n), n);
        }
      }
  }
  if (g !== s && prev[g] === -1) return fail("no-way", total, `no way from ${from.x.toFixed(2)}, ${from.z.toFixed(2)} to ${to.x.toFixed(2)}, ${to.z.toFixed(2)} on a ${cell} m grid`);

  const pts: Spot[] = [];
  for (let k = g; k !== s && k !== -1; k = prev[k] as number) pts.push({ x: ax(k % nx), z: az(Math.floor(k / nx)) });
  pts.reverse();
  if (pts.length) pts[pts.length - 1] = { x: to.x, z: to.z };
  else pts.push({ x: to.x, z: to.z });
  // pull the path straight where the line between two waypoints stays clear
  const line = (p: Spot, q: Spot) => {
    const n = Math.ceil(Math.hypot(q.x - p.x, q.z - p.z) / (cell / 2));
    for (let i = 1; i <= n; i++) if (!clearAt(block, p.x + ((q.x - p.x) * i) / n, p.z + ((q.z - p.z) * i) / n, pad)) return false;
    return true;
  };
  const out: Spot[] = [];
  let here: Spot = from;
  for (let i = 0; i < pts.length; ) {
    let j = pts.length - 1;
    while (j > i && !line(here, pts[j] as Spot)) j--;
    here = pts[j] as Spot;
    out.push(here);
    i = j + 1;
  }
  return { ok: true, waypoints: out, cells: total, why: `${out.length} waypoint${out.length === 1 ? "" : "s"} on a ${cell} m grid` };
}
