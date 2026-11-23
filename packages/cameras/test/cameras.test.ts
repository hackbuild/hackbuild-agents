import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { damp, FirstPerson, Follow, Group, Orbit, Shake, splitViewports } from "../src/index.js";

const rng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a) >>> 0;
    t = ((t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

describe("cameras", () => {
  it("damping is frame rate independent", () => {
    let a = 0;
    let b = 0;
    for (let k = 0; k < 60; k++) a = damp(a, 10, 3, 1 / 60);
    for (let k = 0; k < 30; k++) b = damp(b, 10, 3, 1 / 30);
    expect(Math.abs(a - b)).toBeLessThan(1e-9);
  });

  it("group framing keeps every point on screen", () => {
    const cam = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 500);
    const g = new Group(cam, { pad: 1 });
    const pts = [new THREE.Vector3(-6, 0, -2), new THREE.Vector3(5, 1.5, 3), new THREE.Vector3(0, 0, 8)];
    g.update(pts, 0, true);
    cam.updateMatrixWorld();
    for (const p of pts) {
      const v = p.clone().project(cam);
      expect(Math.abs(v.x)).toBeLessThan(1);
      expect(Math.abs(v.y)).toBeLessThan(1);
      expect(v.z).toBeLessThan(1);
    }
  });

  it("group framing keeps every point on screen over random sets (property)", () => {
    // before the distance was solved from projected corners, 379 of 13,414
    // points left the screen at fov 50 and 16:9 with no centre pull, and
    // 836 of 9,077 with the default pull away from the origin (measured)
    let total = 0;
    let worst = 0;
    for (const [fov, aspect, pull, yaw, pitch] of [
      [50, 16 / 9, 0, 0, 0.92],
      [60, 16 / 9, 0, 0, 0.92],
      [50, 1, 0, 0, 0.92],
      [50, 16 / 9, 0.1, 0, 0.92],
      [40, 9 / 16, 0.1, 0.7, 0.5],
      [70, 21 / 9, 0.3, -2, 1.3],
    ] as const) {
      const cam = new THREE.PerspectiveCamera(fov, aspect, 0.1, 500);
      const g = new Group(cam, { centerPull: pull, yaw, pitch });
      const r = rng(4);
      for (let s = 0; s < 1500; s++) {
        const n = 2 + ((r() * 6) | 0);
        const spread = 1 + r() * 20;
        const ox = (r() - 0.5) * 40;
        const oz = (r() - 0.5) * 40;
        const pts = Array.from({ length: n }, () => ({ x: ox + (r() - 0.5) * spread, y: r() * 1.5, z: oz + (r() - 0.5) * spread }));
        const sol = g.solve(pts);
        if (sol.dist >= 60 - 1e-9) continue;
        g.update(pts, 0, true);
        cam.updateMatrixWorld();
        for (const p of pts) {
          const v = new THREE.Vector3(p.x, p.y, p.z).project(cam);
          total++;
          worst = Math.max(worst, Math.abs(v.x), Math.abs(v.y));
        }
      }
    }
    expect(total).toBeGreaterThan(20000);
    expect(worst).toBeLessThanOrEqual(1);
  });

  it("follow sits behind the heading and pulls in when blocked", () => {
    const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    const f = new Follow(cam, { distance: 4 });
    f.update({ x: 0, y: 0, z: 0 }, 0, 1 / 60, true);
    expect(cam.position.z).toBeLessThan(-3);
    let wall = 10;
    const g = new Follow(cam, { distance: 4, clear: (_from, _dir, max) => Math.min(max, wall) });
    g.update({ x: 0, y: 0, z: 0 }, 0, 1 / 60, true);
    expect(g.dist).toBe(4);
    wall = 1.5;
    g.update({ x: 0, y: 0, z: 0 }, 0, 1 / 60);
    expect(g.dist).toBeCloseTo(1.2);
    wall = 10;
    g.update({ x: 0, y: 0, z: 0 }, 0, 1 / 60);
    expect(g.dist).toBeGreaterThan(1.2);
    expect(g.dist).toBeLessThan(1.3);
  });

  it("shake is seeded and decays", () => {
    const a = new Shake(rng(4));
    const b = new Shake(rng(4));
    a.kick(0.5);
    b.kick(0.5);
    const xa = Array.from({ length: 30 }, () => a.step(1 / 60).x);
    const xb = Array.from({ length: 30 }, () => b.step(1 / 60).x);
    expect(xa).toEqual(xb);
    for (let k = 0; k < 120; k++) a.step(1 / 60);
    expect(a.amplitude).toBeLessThan(0.01);
  });

  it("orbit pans to the right of the view", () => {
    const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    const o = new Orbit(cam, 0, 0.5, 6, { x: 0, y: 0, z: 0 });
    o.pan(1, 0);
    o.apply();
    cam.updateMatrixWorld();
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
    expect(right.x * o.target.x + right.z * o.target.z).toBeGreaterThan(0.99);
  });

  it("first person hides the head for its render only", () => {
    const cam = new THREE.PerspectiveCamera(74, 2, 0.03, 50);
    const head = new THREE.Object3D();
    const fp = new FirstPerson(cam, head);
    fp.place({ x: 0, y: 1.6, z: 0 }, 0, 0);
    let during = 1;
    fp.render(() => {
      during = head.scale.x;
    });
    expect(during).toBe(0.001);
    expect(head.scale.x).toBe(1);
    expect(cam.position.z).toBeCloseTo(0.11);
  });

  it("splits the screen for one to four views", () => {
    expect(splitViewports(1, 800, 600)).toEqual([{ x: 0, y: 0, w: 800, h: 600, yGl: 0 }]);
    const three = splitViewports(3, 800, 600);
    expect(three[2]).toEqual({ x: 0, y: 300, w: 800, h: 300, yGl: 0 });
    expect(splitViewports(4, 800, 600)[1]?.yGl).toBe(300);
  });
});
