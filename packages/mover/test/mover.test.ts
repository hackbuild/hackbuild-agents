import { describe, expect, it } from "vitest";
import { type AgentState, type Footprint, nearest, Steerer } from "../src/steer.js";
import { type Actor, box, moveCollider, wallBox, World } from "../src/world.js";

type Body = AgentState & { steer: Steerer };

/** Runs agents at 60 Hz with a speed limit and returns per agent tracks sampled every 0.25 s. */
function run(bodies: Body[], seconds: number, obstacles: Footprint[] = [], world?: World) {
  const dt = 1 / 60;
  const tracks = new Map(bodies.map((b) => [b.id, [] as { x: number; z: number; goal: boolean; mode: string }[]]));
  let minGap = Infinity;
  for (let k = 0; k < seconds * 60; k++) {
    const now = k * dt;
    const outs = bodies.map((b) => b.steer.update(now, b, bodies, obstacles));
    bodies.forEach((b, i) => {
      const o = outs[i] as ReturnType<Steerer["update"]>;
      // a body accelerates toward the wanted velocity (0.15 s time constant)
      b.vx += (o.vx - b.vx) * Math.min(1, dt / 0.15);
      b.vz += (o.vz - b.vz) * Math.min(1, dt / 0.15);
      if (world) {
        const a: Actor = { pos: { x: b.x, y: 0, z: b.z }, vel: { x: b.vx, y: 0, z: b.vz }, radius: b.radius, height: 1.7, grounded: true };
        world.step(a, dt);
        b.x = a.pos.x;
        b.z = a.pos.z;
        b.vx = a.vel.x;
        b.vz = a.vel.z;
      } else {
        b.x += b.vx * dt;
        b.z += b.vz * dt;
      }
      if (k % 15 === 0) tracks.get(b.id)?.push({ x: b.x, z: b.z, goal: b.steer.hasGoal && o.mode !== "arrived", mode: o.mode });
    });
    for (let i = 0; i < bodies.length; i++)
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i] as Body;
        const c = bodies[j] as Body;
        minGap = Math.min(minGap, Math.hypot(a.x - c.x, a.z - c.z) - a.radius - c.radius);
      }
  }
  return { tracks, minGap };
}

/** Seconds with a goal and under 0.2 m of travel in the previous 2 s (the plan's stall bound). */
function stallSeconds(t: { x: number; z: number; goal: boolean }[]): number {
  let s = 0;
  for (let i = 8; i < t.length; i++) {
    const a = t[i] as { x: number; z: number; goal: boolean };
    const b = t[i - 8] as { x: number; z: number };
    if (a.goal && Math.hypot(a.x - b.x, a.z - b.z) < 0.2) s += 0.25;
  }
  return s;
}

const body = (id: string, x: number, z: number, radius: number, priority = 0): Body => ({ id, x, z, vx: 0, vz: 0, radius, priority, steer: new Steerer(id) });

describe("passing and yielding (hackle-plan 5.4 item 3)", () => {
  it("two walkers head on in a corridor pass without a stall", () => {
    const h = body("human", 0, -4, 0.3, 1);
    const d = body("dog", 0.05, 4, 0.35);
    h.steer.setGoal(0, 4);
    d.steer.setGoal(0, -4);
    const r = run([h, d], 14);
    expect(Math.hypot(h.x, h.z - 4)).toBeLessThan(0.4);
    expect(Math.hypot(d.x, d.z + 4)).toBeLessThan(0.4);
    expect(stallSeconds(r.tracks.get("human") ?? [])).toBeLessThanOrEqual(1);
    expect(stallSeconds(r.tracks.get("dog") ?? [])).toBeLessThanOrEqual(1);
    expect(r.minGap).toBeGreaterThan(-0.05);
  });

  it("a dog parked in the human's path yields and the human walks through", () => {
    const h = body("human", 0, -4, 0.3, 1);
    const d = body("dog", 0, 0, 0.35);
    h.steer.setGoal(0, 4);
    const r = run([h, d], 12);
    expect(h.z).toBeGreaterThan(3.6);
    expect(stallSeconds(r.tracks.get("human") ?? [])).toBe(0);
    expect(r.tracks.get("dog")?.some((s) => s.mode === "yield")).toBe(true);
    expect(r.minGap).toBeGreaterThan(-0.05);
  });

  it("four agents crossing at right angles pass without overlap", () => {
    // measured before the side was chosen at closest approach: two crossers
    // each swerved in front of the other and overlapped by 0.13 m at 60 Hz
    const a = body("a", -4, 0, 0.3, 1);
    const b = body("b", 4, 0.1, 0.3);
    const c = body("c", 0, -4, 0.3, 2);
    const d = body("dog", 0.1, 4, 0.35);
    a.steer.setGoal(4, 0);
    b.steer.setGoal(-4, 0);
    c.steer.setGoal(0, 4);
    d.steer.setGoal(0, -4);
    const r = run([a, b, c, d], 14);
    expect(r.minGap).toBeGreaterThan(-0.05);
    for (const x of [a, b, c, d]) expect(stallSeconds(r.tracks.get(x.id) ?? [])).toBeLessThanOrEqual(1);
    expect(Math.hypot(a.x - 4, a.z)).toBeLessThan(0.4);
    expect(Math.hypot(c.x, c.z - 4)).toBeLessThan(0.4);
  });

  it("keeps a chosen passing side for at least one second", () => {
    const s = new Steerer("a");
    s.setGoal(0, 5);
    const me = { id: "a", x: 0, z: 0, vx: 0, vz: 1, radius: 0.3, priority: 1 };
    s.update(0, me, [{ id: "b", x: 0.2, z: 1.2, vx: 0, vz: 0, radius: 0.3 }]);
    const side = s.sideFor("b", 0);
    expect(side).not.toBe(0);
    // the other drifts across the line: the side holds inside the second
    s.update(0.5, me, [{ id: "b", x: -0.2, z: 1.2, vx: 0, vz: 0, radius: 0.3 }]);
    expect(s.sideFor("b", 0.5)).toBe(side);
  });

  it("a yield times out, so two agents cannot wait on each other forever", () => {
    const s = new Steerer("dog", { yieldTimeout: 1.5 });
    const me = { id: "dog", x: 0, z: 0, vx: 0, vz: 0, radius: 0.35 };
    const other = { id: "human", x: 0, z: -1.5, vx: 0, vz: 0.8, radius: 0.3, priority: 1 };
    const modes: string[] = [];
    for (let k = 0; k <= 30; k++) modes.push(s.update(k * 0.1, me, [other]).mode);
    expect(modes[0]).toBe("yield");
    expect(modes.slice(16, 30).every((m) => m !== "yield")).toBe(true);
  });

  it("a follow spot beside the leader is exempt from its push", () => {
    const s = new Steerer("dog", { follow: "human" });
    s.setGoal(0.9, 0.2);
    const out = s.update(0, { id: "dog", x: 3, z: 0.2, vx: 0, vz: 0, radius: 0.35 }, [{ id: "human", x: 0, z: 0, vx: 0, vz: 0, radius: 0.3, priority: 1, moving: false }]);
    expect(out.mode).toBe("go");
    expect(out.vx).toBeLessThan(-0.5);
  });
});

/** Mulberry32, for seeded layouts in the property tests. */
function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Walker = Body & { goal: [number, number] };

/** Steps walkers with a 1 - exp(-dt / 0.15) velocity lag; returns the closest surface gap and whether all arrived within 0.5 m. */
function walk(bodies: Walker[], seconds: number, hz: number): { minGap: number; arrived: boolean } {
  for (const b of bodies) b.steer.setGoal(...b.goal);
  const dt = 1 / hz;
  const k = 1 - Math.exp(-dt / 0.15);
  let minGap = Infinity;
  for (let s = 0; s < seconds * hz; s++) {
    const outs = bodies.map((b) => b.steer.update(s * dt, b, bodies));
    bodies.forEach((b, i) => {
      const o = outs[i] as ReturnType<Steerer["update"]>;
      b.vx += (o.vx - b.vx) * k;
      b.vz += (o.vz - b.vz) * k;
      b.x += b.vx * dt;
      b.z += b.vz * dt;
    });
    for (let i = 0; i < bodies.length; i++)
      for (let j = i + 1; j < bodies.length; j++) {
        const p = bodies[i] as Walker;
        const q = bodies[j] as Walker;
        minGap = Math.min(minGap, Math.hypot(p.x - q.x, p.z - q.z) - p.radius - q.radius);
      }
  }
  return { minGap, arrived: bodies.every((b) => Math.hypot(b.x - b.goal[0], b.z - b.goal[1]) < 0.5) };
}

const walker = (id: string, x: number, z: number, radius: number, priority: number, goal: [number, number]): Walker => ({ ...body(id, x, z, radius, priority), goal });

describe("random crossings (property)", () => {
  // Before the side was kept relative to the neighbour and dropped once the
  // closest approach was behind, 164 of these 1,000 two agent layouts
  // overlapped by more than 5 cm (worst 0.639 m) and 61 of 200 many agent
  // layouts did (measured).
  it("two agents crossing at 20 to 180 degrees never overlap by more than 5 cm", () => {
    let runs = 0;
    let worst = Infinity;
    for (let seed = 1; runs < 1000; seed++) {
      const r = mulberry(seed);
      const ang = ((20 + r() * 160) * Math.PI) / 180;
      const off = r() - 0.5;
      const tOff = (r() - 0.5) * 2;
      const ux = Math.cos(ang);
      const uz = Math.sin(ang);
      const a = walker("a", -5, 0, 0.3, (r() * 2) | 0, [5, 0]);
      const b = walker("b", -ux * (5 + tOff) - uz * off, -uz * (5 + tOff) + ux * off, 0.35, (r() * 2) | 0, [ux * 5 - uz * off, uz * 5 + ux * off]);
      const far = (p: [number, number], x: number, z: number) => Math.hypot(p[0] - x, p[1] - z) >= 1.5;
      if (!far(a.goal, b.x, b.z) || !far(b.goal, a.x, a.z) || !far(a.goal, ...b.goal)) continue;
      runs++;
      const res = walk([a, b], 20, 60);
      expect(res.arrived, `seed ${seed}`).toBe(true);
      worst = Math.min(worst, res.minGap);
    }
    expect(worst).toBeGreaterThan(-0.05);
  });

  it("two to six agents crossing a 10 m ring never overlap by more than 5 cm", () => {
    let runs = 0;
    let worst = Infinity;
    for (let seed = 1; runs < 200; seed++) {
      const r = mulberry(100000 + seed);
      const n = 2 + ((r() * 5) | 0);
      const bodies: Walker[] = [];
      for (let i = 0; i < n; i++) {
        const a = r() * Math.PI * 2;
        const g = a + Math.PI + (r() - 0.5) * 1.5;
        bodies.push(walker(`n${i}`, 5 * Math.cos(a), 5 * Math.sin(a), 0.3 + r() * 0.1, (r() * 2) | 0, [5 * Math.cos(g), 5 * Math.sin(g)]));
      }
      const near = bodies.some((p, i) => bodies.some((q, j) => j > i && (Math.hypot(p.x - q.x, p.z - q.z) < 1.5 || Math.hypot(p.goal[0] - q.goal[0], p.goal[1] - q.goal[1]) < 1.5 || Math.hypot(p.goal[0] - q.x, p.goal[1] - q.z) < 1.5 || Math.hypot(q.goal[0] - p.x, q.goal[1] - p.z) < 1.5)));
      if (near) continue;
      runs++;
      const res = walk(bodies, 25, 60);
      expect(res.arrived, `seed ${seed}`).toBe(true);
      worst = Math.min(worst, res.minGap);
    }
    expect(worst).toBeGreaterThan(-0.05);
  });

  it("a goal beside a standing agent that is not the leader keeps the contact push", () => {
    // the exemption is for a named leader only; a sitter near the goal
    // keeps its bend and the contact constraint
    const w = walker("walker", 0, -4, 0.3, 1, [0, 0]);
    const s = walker("sitter", 0.5, 0, 0.35, 0, [0.5, 0]);
    s.steer = new Steerer("sitter");
    const res = walk([w, s], 10, 60);
    expect(res.minGap).toBeGreaterThan(-0.05);
  });
});

describe("footprints and stalls", () => {
  const bench: Footprint = { id: "bench", parts: [{ ax: -0.8, az: 0, bx: 0.8, bz: 0, r: 0.25 }, { x: -0.9, z: 0, r: 0.3 }, { x: 0.9, z: 0, r: 0.3 }] };

  it("measures distance to the nearest part of a footprint", () => {
    expect(nearest(bench, 0, 1).dist).toBeCloseTo(0.75);
    expect(nearest(bench, 2, 0).dist).toBeCloseTo(0.8);
  });

  it("walks round a bench of several parts without touching it, and can ignore it", () => {
    const a = body("a", 0.1, -3, 0.3);
    a.steer.setGoal(0.1, 3);
    let worst = Infinity;
    for (let k = 0; k < 600; k++) {
      const o = a.steer.update(k / 60, a, [], [bench]);
      a.x += o.vx / 60;
      a.z += o.vz / 60;
      worst = Math.min(worst, nearest(bench, a.x, a.z).dist - a.radius);
    }
    expect(a.z).toBeGreaterThan(2.6);
    expect(worst).toBeGreaterThan(0);
    const b = new Steerer("b");
    b.setGoal(0, 0.3);
    const o = b.update(0, { id: "b", x: 0, z: -2, vx: 0, vz: 0, radius: 0.3 }, [], [bench], new Set(["bench"]));
    expect(o.vz).toBeGreaterThan(1);
  });

  it("a yielding agent does not step into a footprint", () => {
    // before: the yield velocity skipped the footprint loop and the dog
    // ended 0.397 m inside the bench (measured in the audit)
    const side: Footprint = { id: "bench", parts: [{ ax: 0.6, az: -1, bx: 0.6, bz: 1, r: 0.25 }] };
    const h = body("human", 0, -4, 0.3, 1);
    const d = body("dog", 0, 0, 0.35);
    h.steer.setGoal(0, 4);
    const dt = 1 / 60;
    let worst = Infinity;
    let yielded = false;
    for (let k = 0; k < 8 * 60; k++) {
      const outs = [h, d].map((b) => b.steer.update(k * dt, b, [h, d], [side]));
      [h, d].forEach((b, i) => {
        const o = outs[i] as ReturnType<Steerer["update"]>;
        if (b === d && o.mode === "yield") yielded = true;
        b.vx += (o.vx - b.vx) * (1 - Math.exp(-dt / 0.15));
        b.vz += (o.vz - b.vz) * (1 - Math.exp(-dt / 0.15));
        b.x += b.vx * dt;
        b.z += b.vz * dt;
      });
      worst = Math.min(worst, nearest(side, d.x, d.z).dist - d.radius);
    }
    expect(yielded).toBe(true);
    expect(worst).toBeGreaterThan(-0.05);
  });

  it("a goal in a closed pocket holds one side waypoint and turns unreachable", () => {
    // before: every stall added a waypoint and kept the old ones, 117
    // after 20 minutes (measured in the audit), with no unreachable signal
    const world = new World([wallBox(0, 2, 3, 0.2, 0, 2), wallBox(-1.5, 3, 0.2, 2, 0, 2), wallBox(1.5, 3, 0.2, 2, 0, 2), wallBox(0, 4, 3, 0.2, 0, 2)]);
    const a = body("a", 0, -2, 0.3);
    a.steer.setGoal(0, 3);
    run([a], 120, [], world);
    expect(a.steer.stalls).toBeGreaterThan(8);
    expect((a.steer as unknown as { waypoints: unknown[] }).waypoints.length).toBeLessThanOrEqual(1);
    expect(a.steer.unreachable).toBe(true);
    a.steer.setGoal(0, -3);
    expect(a.steer.unreachable).toBe(false);
  });

  it("a stall against a wall inserts a side waypoint", () => {
    const world = new World([wallBox(0, 0, 4, 0.2, 0, 2)]);
    const a = body("a", 0.3, -1, 0.3);
    a.steer = new Steerer("a", { lookahead: 0.05, clearance: 0 });
    a.steer.setGoal(0.3, 2);
    const r = run([a], 8, [], world);
    expect(a.steer.stalls).toBeGreaterThanOrEqual(1);
    expect(r.tracks.get("a")?.some((s) => Math.abs(s.x - 0.3) > 0.6)).toBe(true);
  });
});

describe("kinematic capsule", () => {
  it("steps onto a low box, stops at a high one, slides along walls and rides a platform", () => {
    const low = box(1, 0.3, 0, 1, 1);
    const high = box(1, 0.6, 3, 1, 1);
    const plat = box(-3, 0.2, 0, 1, 1);
    const w = new World([box(0, 0, 0, 40, 40), low, high, plat]);
    const a: Actor = { pos: { x: 0, y: 0, z: 0 }, vel: { x: 1, y: 0, z: 0 }, radius: 0.3, height: 1.7, grounded: true };
    for (let k = 0; k < 60; k++) {
      a.vel.x = 1;
      a.vel.y -= 9.8 / 60;
      w.step(a, 1 / 60);
    }
    expect(a.pos.y).toBeCloseTo(0.3);
    const b: Actor = { pos: { x: 0, y: 0, z: 3 }, vel: { x: 1, y: 0, z: 0.2 }, radius: 0.3, height: 1.7 };
    for (let k = 0; k < 60; k++) {
      b.vel.x = 1;
      b.vel.z = 0.2;
      b.vel.y -= 9.8 / 60;
      w.step(b, 1 / 60);
    }
    expect(b.pos.x).toBeLessThanOrEqual(0.2 + 1e-9);
    expect(b.pos.z).toBeGreaterThan(3.1);
    const c: Actor = { pos: { x: -3, y: 0.2, z: 0 }, vel: { x: 0, y: 0, z: 0 }, radius: 0.3, height: 1.7, grounded: true, groundC: plat };
    for (let k = 0; k < 30; k++) {
      moveCollider(plat, 0.01, 0, 0);
      c.vel.y -= 9.8 / 60;
      w.step(c, 1 / 60);
    }
    expect(c.pos.x).toBeCloseTo(-2.7, 5);
  });
});
