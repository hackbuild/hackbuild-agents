// Steering for walking agents that share space. Written against a stall in
// an earlier dog simulator: there, each agent was an obstacle in the
// other's potential field and the radial push outweighed the tangential
// term, so two agents facing each other each turned away and stood still.
// Here:
// - each agent picks a passing side per neighbour from where the other
//   will stand at closest approach, keeps it for at least `holdSide`
//   seconds (1 s), renews it only while that approach is still ahead and
//   drops it once it is behind;
// - the bend is a tangent round the neighbour on the held side, so it stays
//   a pass while the goal heading swings;
// - contact is a constraint: inside `clearance` of a neighbour the part of
//   the heading toward it is removed and an outward push added;
// - an agent with no goal, or a lower priority, yields: it steps aside
//   from the other's path, still under the contact and footprint
//   constraints, and the yield times out so two yielders cannot deadlock;
// - a stall detector fires when an agent with a goal moves under 0.2 m in
//   2 s and inserts a side waypoint;
// - with `follow` set, a target within `exemptRadius` (1.3 m) of that
//   leader switches off the leader's bend, so a follower can reach a spot
//   beside it; the contact constraint still holds.
// Obstacles are footprints of several circles or capsules each (bench
// ends, a long table), with per agent filters (the goal object, its own
// body). Deterministic: no random draws; ties break by id.

export interface Circle {
  x: number;
  z: number;
  r: number;
}
export interface Capsule {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  r: number;
}
export interface Footprint {
  id: string;
  parts: (Circle | Capsule)[];
}

const isCap = (p: Circle | Capsule): p is Capsule => "ax" in p;

/** Surface distance from (x, z) to a footprint and the outward normal there. */
export function nearest(fp: Footprint, x: number, z: number): { dist: number; nx: number; nz: number } {
  let best = { dist: Infinity, nx: 1, nz: 0 };
  for (const p of fp.parts) {
    let cx: number;
    let cz: number;
    if (isCap(p)) {
      const vx = p.bx - p.ax;
      const vz = p.bz - p.az;
      const l2 = vx * vx + vz * vz;
      const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - p.ax) * vx + (z - p.az) * vz) / l2)) : 0;
      cx = p.ax + vx * t;
      cz = p.az + vz * t;
    } else {
      cx = p.x;
      cz = p.z;
    }
    const dx = x - cx;
    const dz = z - cz;
    const d = Math.hypot(dx, dz);
    const s = d - p.r;
    if (s < best.dist) best = { dist: s, nx: d > 1e-9 ? dx / d : 1, nz: d > 1e-9 ? dz / d : 0 };
  }
  return best;
}

export interface AgentState {
  id: string;
  x: number;
  z: number;
  vx: number;
  vz: number;
  radius: number;
  /** higher goes first; equal priorities break by id */
  priority?: number;
  /** true when the agent is walking to a goal */
  moving?: boolean;
}

export interface SteerOptions {
  /** cruise speed m/s */
  speed?: number;
  stopDist?: number;
  /** seconds a chosen passing side is kept (the plan: at least 1) */
  holdSide?: number;
  /** neighbours closer than this bend the path (m, surface to surface) */
  lookahead?: number;
  /** extra clearance kept from neighbours and obstacles (m) */
  clearance?: number;
  /** id of a leader whose bend is switched off while the target is within `exemptRadius` of it */
  follow?: string;
  /** see `follow` (m) */
  exemptRadius?: number;
  /** stall: under `stallDist` m in `stallWindow` s with a goal */
  stallDist?: number;
  stallWindow?: number;
  /** side waypoint offset when a stall fires (m) */
  sideStep?: number;
  /** a yield lasts at most this long (s), then the agent goes regardless */
  yieldTimeout?: number;
  /** after a timed out yield, no new yield for this long (s) */
  yieldCooldown?: number;
}

export interface SteerOut {
  vx: number;
  vz: number;
  mode: "arrived" | "go" | "pass" | "yield";
  /** set on the step a stall inserted a side waypoint */
  sideWaypoint: { x: number; z: number } | null;
  why: string;
}

const D = {
  speed: 1.2,
  stopDist: 0.3,
  holdSide: 1,
  lookahead: 1.6,
  clearance: 0.25,
  exemptRadius: 1.3,
  stallDist: 0.2,
  stallWindow: 2,
  sideStep: 1,
  yieldTimeout: 1.5,
  yieldCooldown: 2,
};

export class Steerer {
  readonly o: Required<Omit<SteerOptions, "follow">> & { follow?: string };
  private goal: { x: number; z: number } | null = null;
  private waypoints: { x: number; z: number }[] = [];
  private sides = new Map<string, { side: number; until: number }>();
  private hist: { t: number; x: number; z: number }[] = [];
  private yieldUntil = -Infinity;
  private noYieldUntil = -Infinity;
  private yieldFrom: string | null = null;
  stalls = 0;

  constructor(
    readonly id: string,
    o: SteerOptions = {},
  ) {
    this.o = { ...D, ...o };
  }

  /** A new goal: waypoints and the stall history reset (no stale completion). */
  setGoal(x: number, z: number): void {
    this.goal = { x, z };
    this.waypoints = [];
    this.hist = [];
  }
  clearGoal(): void {
    this.goal = null;
    this.waypoints = [];
    this.hist = [];
  }
  get target(): { x: number; z: number } | null {
    return this.waypoints[0] ?? this.goal;
  }
  get hasGoal(): boolean {
    return this.goal !== null;
  }
  /** The held passing side for a neighbour: +1 right of the heading, -1 left, 0 none. */
  sideFor(other: string, now: number): number {
    const s = this.sides.get(other);
    return s && s.until > now ? s.side : 0;
  }

  /**
   * Contact and footprints as constraints on a unit heading: inside
   * `clearance` of a neighbour or a footprint the inward part of the
   * heading is removed and an outward push added; near a footprint a
   * tangent on the held side is added, so the agent slides round it.
   * Returns a unit heading, or zero when every way is blocked.
   */
  private constrain(now: number, dx: number, dz: number, gx: number, gz: number, self: AgentState, others: readonly AgentState[], obstacles: readonly Footprint[], ignore: ReadonlySet<string>): [number, number] {
    const o = this.o;
    for (const a of others) {
      if (a.id === self.id || ignore.has(a.id)) continue;
      const ox = a.x - self.x;
      const oz = a.z - self.z;
      const centre = Math.hypot(ox, oz) || 1e-9;
      const gap = centre - self.radius - a.radius;
      if (gap > o.clearance) continue;
      const nx = ox / centre;
      const nz = oz / centre;
      const inward = dx * nx + dz * nz;
      if (inward > 0) {
        dx -= nx * inward;
        dz -= nz * inward;
      }
      const push = ((o.clearance - gap) / o.clearance) * 1.5;
      dx -= nx * push;
      dz -= nz * push;
      const l = Math.hypot(dx, dz) || 1;
      dx /= l;
      dz /= l;
    }
    for (const fp of obstacles) {
      if (ignore.has(fp.id)) continue;
      const n = nearest(fp, self.x, self.z);
      const gap = n.dist - self.radius;
      if (gap > o.lookahead) continue;
      const inward = -(dx * n.nx + dz * n.nz);
      if (inward <= 0 && gap > o.clearance) continue;
      const k = Math.max(0, Math.min(1, (o.lookahead - gap) / Math.max(1e-6, o.lookahead - o.clearance)));
      let side = this.sideFor(fp.id, now);
      const tx0 = -n.nz;
      const tz0 = n.nx;
      if (!side) {
        side = tx0 * gx + tz0 * gz >= 0 ? 1 : -1;
        this.sides.set(fp.id, { side, until: now + o.holdSide });
      }
      if (inward > 0) {
        dx += n.nx * inward * k + tx0 * side * inward * k;
        dz += n.nz * inward * k + tz0 * side * inward * k;
      }
      if (gap < o.clearance) {
        dx += n.nx * (o.clearance - gap) * 3;
        dz += n.nz * (o.clearance - gap) * 3;
      }
      const l = Math.hypot(dx, dz) || 1;
      dx /= l;
      dz /= l;
    }
    return [dx, dz];
  }

  update(now: number, self: AgentState, others: readonly AgentState[], obstacles: readonly Footprint[] = [], ignore: ReadonlySet<string> = new Set()): SteerOut {
    const o = this.o;
    this.hist.push({ t: now, x: self.x, z: self.z });
    while (this.hist.length > 2 && (this.hist[1] as { t: number }).t <= now - o.stallWindow) this.hist.shift();
    let tgt = this.target;
    while (tgt && this.waypoints.length && Math.hypot(tgt.x - self.x, tgt.z - self.z) < o.stopDist + 0.1) {
      this.waypoints.shift();
      tgt = this.target;
    }
    const myPri = self.priority ?? 0;
    const outranks = (a: AgentState) => (a.priority ?? 0) > myPri || ((a.priority ?? 0) === myPri && a.id < self.id);

    // yield: the other outranks me (or I have no goal) and its path comes within reach of me
    if (now >= this.noYieldUntil) {
      for (const a of others) {
        if (a.id === self.id || ignore.has(a.id)) continue;
        if (this.goal && !outranks(a)) continue;
        const sp = Math.hypot(a.vx, a.vz);
        if (sp < 0.2) continue;
        const rx = self.x - a.x;
        const rz = self.z - a.z;
        const t = (rx * a.vx + rz * a.vz) / (sp * sp);
        if (t < 0 || t > 2.5) continue;
        const cx = a.x + a.vx * t - self.x;
        const cz = a.z + a.vz * t - self.z;
        const miss = Math.hypot(cx, cz);
        if (miss < self.radius + a.radius + o.clearance + 0.35) {
          if (this.yieldFrom !== a.id || now > this.yieldUntil + o.yieldCooldown) {
            if (this.yieldFrom !== a.id) this.yieldUntil = now + o.yieldTimeout;
            this.yieldFrom = a.id;
          }
          if (now < this.yieldUntil) {
            // step off the other's line, to the side I already stand on
            let px = -a.vz / sp;
            let pz = a.vx / sp;
            if (px * -cx + pz * -cz < 0) {
              px = -px;
              pz = -pz;
            }
            const v = Math.min(o.speed, 0.9);
            // the side step still respects contact and footprints
            [px, pz] = this.constrain(now, px, pz, px, pz, self, others, obstacles, ignore);
            return { vx: px * v, vz: pz * v, mode: "yield", sideWaypoint: null, why: `${self.id}: yields to ${a.id}, closest approach ${miss.toFixed(2)} m in ${t.toFixed(1)} s` };
          }
          this.noYieldUntil = now + o.yieldCooldown;
        }
      }
    }
    if (this.yieldFrom && now >= this.yieldUntil) this.yieldFrom = null;

    if (!tgt) return { vx: 0, vz: 0, mode: "arrived", sideWaypoint: null, why: `${self.id}: no goal` };
    const tx = tgt.x - self.x;
    const tz = tgt.z - self.z;
    const dist = Math.hypot(tx, tz);
    if (dist < o.stopDist && !this.waypoints.length) {
      this.hist = [];
      return { vx: 0, vz: 0, mode: "arrived", sideWaypoint: null, why: `${self.id}: arrived` };
    }
    let dx = tx / dist;
    let dz = tz / dist;
    const gx = dx;
    const gz = dz;
    let mode: SteerOut["mode"] = "go";
    let why = `${self.id}: heading to the goal, ${dist.toFixed(2)} m`;

    // neighbours: a held passing side and a bend round the neighbour
    for (const a of others) {
      if (a.id === self.id || ignore.has(a.id)) continue;
      const ox = a.x - self.x;
      const oz = a.z - self.z;
      const centre = Math.hypot(ox, oz) || 1e-9;
      const gap = centre - self.radius - a.radius;
      if (gap > o.lookahead) {
        this.sides.delete(a.id);
        continue;
      }
      // the leader's own push is off near a follow spot beside it; the
      // contact constraint below still holds for it
      if (a.id === o.follow && Math.hypot(tgt.x - a.x, tgt.z - a.z) < o.exemptRadius && !this.waypoints.length) continue;
      const nx = ox / centre;
      const nz = oz / centre;
      const ahead = nx * gx + nz * gz;
      // closest approach of the two, up to 2.5 s ahead
      const rvx = a.vx - self.vx;
      const rvz = a.vz - self.vz;
      const rv2 = rvx * rvx + rvz * rvz;
      const tcRaw = rv2 > 1e-6 ? -(ox * rvx + oz * rvz) / rv2 : 0;
      const closing = tcRaw > 0 || gap < o.clearance;
      let side = this.sideFor(a.id, now);
      if (side && (this.sides.get(a.id)?.until ?? 0) - now < 0.1) {
        // renew only while the closest approach is still ahead
        if (closing) this.sides.set(a.id, { side, until: now + o.holdSide });
        else {
          this.sides.delete(a.id);
          side = 0;
        }
      }
      if (!side) {
        if (!closing || (ahead < -0.2 && gap > o.clearance)) continue;
        // pass on the side away from where the other will stand at closest
        // approach, so two crossing agents pick sides that send one behind
        // the other; head on, keep right (each agent's own right)
        const tc = Math.max(0, Math.min(2.5, tcRaw));
        const qx = ox + rvx * tc;
        const qz = oz + rvz * tc;
        const cr = gx * qz - gz * qx;
        side = Math.abs(cr) < 0.15 * Math.max(Math.hypot(qx, qz), 1e-6) ? 1 : cr < 0 ? 1 : -1;
        this.sides.set(a.id, { side, until: now + o.holdSide });
      }
      // the bend is a tangent round the neighbour (side +1 keeps it on my
      // left), so it stays a pass as the goal heading swings; with y up and
      // yaw 0 along +z, the right of a direction (x, z) is (-z, x)
      const px = -nz * side;
      const pz = nx * side;
      const w = Math.min(1.5, (o.lookahead - Math.max(gap - o.clearance, 0)) / o.lookahead) * Math.max(0, ahead + 0.3);
      dx += px * w;
      dz += pz * w;
      mode = "pass";
      why = `${self.id}: passes ${a.id} on the ${side > 0 ? "right" : "left"}, gap ${gap.toFixed(2)} m`;
    }

    let l = Math.hypot(dx, dz) || 1;
    dx /= l;
    dz /= l;
    // the goal keeps a share of the heading so a neighbour's bend never turns the agent back
    if (dx * gx + dz * gz < 0.2) {
      dx += gx * 0.6;
      dz += gz * 0.6;
      l = Math.hypot(dx, dz) || 1;
      dx /= l;
      dz /= l;
    }
    [dx, dz] = this.constrain(now, dx, dz, gx, gz, self, others, obstacles, ignore);
    const v = o.speed * Math.min(1, (dist - o.stopDist) / 0.8 + 0.3);

    // stall: a goal, and under stallDist over the window: insert a side waypoint
    let sideWaypoint: { x: number; z: number } | null = null;
    const first = this.hist[0];
    if (first && now - first.t >= o.stallWindow - 1e-9 && Math.hypot(self.x - first.x, self.z - first.z) < o.stallDist) {
      const held = [...this.sides.values()].find((s) => s.until > now)?.side ?? 1;
      sideWaypoint = { x: self.x - gz * held * o.sideStep + gx * 0.3, z: self.z + gx * held * o.sideStep + gz * 0.3 };
      this.waypoints.unshift(sideWaypoint);
      this.hist = [];
      this.stalls++;
      why = `${self.id}: stalled under ${o.stallDist} m in ${o.stallWindow} s, side waypoint inserted`;
    }
    return { vx: dx * v, vz: dz * v, mode, sideWaypoint, why };
  }
}
