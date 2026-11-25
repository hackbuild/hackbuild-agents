import { describe, expect, it } from "vitest";
import { blockers, planPath, type Spot } from "../src/plan.js";
import { type AgentState, Steerer } from "../src/steer.js";
import { type Actor, box, type Collider, wallBox, World } from "../src/world.js";

const floor = () => box(0, 0, 0, 12, 12);
/** A wall across z = 0 from x = -3 to 3, 0.2 m thick. */
const wall = () => wallBox(0, 0, 6, 0.2, 0, 2);

/** Walks one capsule with a steerer at 60 Hz; returns the end spot and seconds taken (Infinity when it never arrived). */
function walk(world: World, start: Spot, goal: Spot, path: Spot[] | null, seconds: number) {
  const dt = 1 / 60;
  const me: AgentState = { id: "a", x: start.x, z: start.z, vx: 0, vz: 0, radius: 0.3, moving: true };
  const a: Actor = { pos: { x: start.x, y: 0, z: start.z }, vel: { x: 0, y: 0, z: 0 }, radius: 0.3, height: 1.7, grounded: true };
  const s = new Steerer("a");
  if (path) s.setPath(path);
  else s.setGoal(goal.x, goal.z);
  for (let k = 0; k < seconds * 60; k++) {
    const o = s.update(k * dt, me, [me]);
    if (o.mode === "arrived" && Math.hypot(a.pos.x - goal.x, a.pos.z - goal.z) < 0.4) return { x: a.pos.x, z: a.pos.z, t: k * dt };
    a.vel.x += (o.vx - a.vel.x) * Math.min(1, dt / 0.15);
    a.vel.z += (o.vz - a.vel.z) * Math.min(1, dt / 0.15);
    world.step(a, dt);
    world.endFrame();
    Object.assign(me, { x: a.pos.x, z: a.pos.z, vx: a.vel.x, vz: a.vel.z });
  }
  return { x: a.pos.x, z: a.pos.z, t: Infinity };
}

describe("planPath", () => {
  it("goes round a wall the steerer alone needs repeated stalls to pass", () => {
    const world = new World([floor(), wall()]);
    const from = { x: 0, z: -2 };
    const to = { x: 0, z: 2 };
    const p = planPath(world, from, to);
    expect(p.ok).toBe(true);
    expect(p.waypoints.length).toBeGreaterThan(1);
    expect(p.waypoints.at(-1)).toEqual(to);
    // every waypoint clears the wall end by the radius plus margin
    expect(p.waypoints.some((w) => Math.abs(w.x) > 3.3)).toBe(true);
    const planned = walk(world, from, to, p.waypoints, 30);
    expect(planned.t).toBeLessThan(15);
    const alone = walk(world, from, to, null, 30);
    // alone, the steerer slides along the wall and gets past only by stall side waypoints
    expect(alone.t).toBeGreaterThan(planned.t * 2);
  });

  it("goes through a gap wide enough for the actor and not through a narrow one", () => {
    const left = wallBox(-3.6, 0, 6, 0.2, 0, 2);
    const right = wallBox(3.6, 0, 6, 0.2, 0, 2);
    // a 1.2 m gap between x = -0.6 and 0.6; the world floor ends at the walls
    const wide = new World([floor(), left, right]);
    const p = planPath(wide, { x: -2, z: -2 }, { x: 2, z: 2 }, { bounds: { minX: -6, maxX: 6, minZ: -6, maxZ: 6 } });
    expect(p.ok).toBe(true);
    for (const w of p.waypoints) if (Math.abs(w.z) < 0.5) expect(Math.abs(w.x)).toBeLessThan(0.6);
    expect(walk(wide, { x: -2, z: -2 }, { x: 2, z: 2 }, p.waypoints, 30).t).toBeLessThan(15);
    // 0.6 m gap: narrower than 2 * (0.3 + 0.12)
    const narrow = [floor(), wallBox(-3.3, 0, 6, 0.2, 0, 2), wallBox(3.3, 0, 6, 0.2, 0, 2)];
    const q = planPath(narrow, { x: -2, z: -2 }, { x: 2, z: 2 }, { bounds: { minX: -6, maxX: 6, minZ: -6, maxZ: 6 } });
    expect(q.ok).toBe(false);
    if (!q.ok) expect(q.reason).toBe("no-way");
  });

  it("reports an unreachable goal and a goal inside a collider", () => {
    // a closed 2 m pen round the goal
    const pen: Collider[] = [wallBox(3, 2, 2.2, 0.2, 0, 2), wallBox(3, 4, 2.2, 0.2, 0, 2), wallBox(2, 3, 0.2, 2.2, 0, 2), wallBox(4, 3, 0.2, 2.2, 0, 2)];
    const world = new World([floor(), ...pen]);
    const r = planPath(world, { x: -3, z: -3 }, { x: 3, z: 3 });
    expect(r).toMatchObject({ ok: false, reason: "no-way", waypoints: [] });
    expect(r.why).toContain("no way");
    const inWall = planPath(world, { x: -3, z: -3 }, { x: 2, z: 3 });
    expect(inWall).toMatchObject({ ok: false, reason: "goal-blocked" });
    const big = planPath(world, { x: -3, z: -3 }, { x: 0, z: 0 }, { cell: 0.01, maxCells: 1000 });
    expect(big).toMatchObject({ ok: false, reason: "too-large" });
  });

  it("walks over a step, honours the radius and is deterministic", () => {
    const step = box(0, 0.3, 0, 6, 0.4);
    const world = new World([floor(), step]);
    expect(blockers(world.colliders)).toHaveLength(0);
    const p = planPath(world, { x: 0, z: -2 }, { x: 0, z: 2 });
    expect(p.ok && p.waypoints).toEqual([{ x: 0, z: 2 }]);
    const w = new World([floor(), wall()]);
    const a = planPath(w, { x: 0, z: -2 }, { x: 0, z: 2 }, { radius: 0.5, cell: 0.1 });
    const b = planPath(w, { x: 0, z: -2 }, { x: 0, z: 2 }, { radius: 0.5, cell: 0.1 });
    expect(a).toEqual(b);
    expect(a.waypoints.some((q) => Math.abs(q.x) > 3.5)).toBe(true);
  });
});

describe("Steerer.setPath", () => {
  it("walks the waypoints in order and ends at the last", () => {
    const s = new Steerer("a");
    s.setPath([
      { x: 1, z: 0 },
      { x: 1, z: 1 },
    ]);
    expect(s.target).toEqual({ x: 1, z: 0 });
    expect(s.waypointsLeft).toBe(1);
    s.setPath([]);
    expect(s.hasGoal).toBe(false);
  });
});
