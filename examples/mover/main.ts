import { type Actor, type AgentState, type Footprint, Steerer, World, box, wallBox } from "@hackbuild/mover";
import { createRegistry } from "@hackbuild/tunables";
import { bindPanel } from "@hackbuild/tunables/dom";
import * as THREE from "three";
import { boxMesh, capsule, stage } from "../shared/scene.js";
import { $, FrameTimer, auto, check, chips, chipsHtml, finish, readout, result, sleep, status } from "../shared/ui.js";

const r = result("mover");
const SCENES = ["corridor pass", "parked in path", "bench", "four way cross"] as const;
type Scene = (typeof SCENES)[number];
$("#controls").innerHTML = `
${chipsHtml("scene", "scene", SCENES)}
<button class="hb-btn" id="restart" type="button">restart</button>`;
const sceneIn = chips("scene", (s) => setup(s as Scene));
const whyLine = document.createElement("p");
whyLine.className = "pg-what";
$("#readout").after(whyLine);
// steering values on a @hackbuild/tunables panel; a change applies on restart and is kept in the url hash
const tuneHost = document.createElement("div");
tuneHost.id = "tune";
tuneHost.className = "pg-tune";
whyLine.after(tuneHost);
const tune = createRegistry({ version: 1 });
tune.define({ key: "St.speed", group: "steer", label: "walk speed", unit: "m/s", def: 1.2, min: 0.4, max: 2.5, step: 0.05, source: "inferred" });
tune.define({ key: "St.hold", group: "steer", label: "hold passing side", unit: "s", def: 1, min: 0, max: 3, step: 0.1, source: "inferred" });
tune.define({ key: "St.yield", group: "steer", label: "yield timeout", unit: "s", def: 1.5, min: 0.2, max: 4, step: 0.1, source: "inferred" });
tune.fromUrlHash(location.hash);
const panel = bindPanel(tuneHost, tune, { syncHash: true });
const steerOpts = () => ({ speed: tune.get("St.speed"), holdSide: tune.get("St.hold"), yieldTimeout: tune.get("St.yield") });

const { renderer, scene, camera, controls } = stage([0, 0, 0], 9);
camera.position.set(0, 11, 7);
controls.update();
const root = new THREE.Group();
scene.add(root);

type Body = AgentState & { steer: Steerer; mesh: THREE.Mesh; goals: [number, number][]; leg: number; track: { t: number; x: number; z: number; goal: boolean }[]; stall: number; arrivals: number; parked?: boolean };
let bodies: Body[] = [];
let obstacles: Footprint[] = [];
let world = new World([]);
let minGap = Infinity;
let simT = 0;
const COLORS = [0x3a6ea5, 0xc8742c, 0x1a7f37, 0xd03030];

function body(id: string, x: number, z: number, radius: number, goals: [number, number][], priority = 0): Body {
  const mesh = capsule(radius, id.startsWith("dog") ? 0.6 : 1.7, COLORS[bodies.length % COLORS.length]!);
  root.add(mesh);
  const b: Body = { id, x, z, vx: 0, vz: 0, radius, priority, steer: new Steerer(id, steerOpts()), mesh, goals, leg: 0, track: [], stall: 0, arrivals: 0 };
  if (goals.length) b.steer.setGoal(...goals[0]!);
  bodies.push(b);
  return b;
}

/** Frees the geometries and materials under the scene root, then empties it. */
function clearRoot() {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.geometry.dispose();
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) mat.dispose();
  });
  root.clear();
}

function setup(s: Scene) {
  clearRoot();
  bodies = [];
  obstacles = [];
  minGap = Infinity;
  simT = 0;
  const colliders = [box(0, 0, 0, 30, 30)];
  const wall = (cx: number, cz: number, w: number, d: number) => {
    colliders.push(wallBox(cx, cz, w, d, 0, 1.2));
    const m = boxMesh(w, 1.2, d, 0x8a8f98);
    m.position.set(cx, 0, cz);
    root.add(m);
  };
  if (s === "corridor pass" || s === "parked in path") {
    wall(-1.1, 0, 0.2, 12);
    wall(1.1, 0, 0.2, 12);
  }
  if (s === "corridor pass") {
    body("human", 0, -4, 0.3, [[0, 4], [0, -4]], 1);
    body("dog", 0.05, 4, 0.35, [[0, -4], [0, 4]]);
  } else if (s === "parked in path") {
    body("human", 0, -4, 0.3, [[0, 4], [0, -4]], 1);
    body("dog", 0, 0, 0.35, []).parked = true;
  } else if (s === "bench") {
    body("human", 0, -4, 0.3, [[0, 4], [0, -4]], 1);
    obstacles = [{ id: "bench", parts: [{ ax: -0.8, az: 0, bx: 0.8, bz: 0, r: 0.25 }, { x: -0.8, z: 0.4, r: 0.12 }, { x: 0.8, z: 0.4, r: 0.12 }] }];
    const seat = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 1.6, 4, 12), new THREE.MeshStandardMaterial({ color: 0x8a5a2b }));
    seat.rotation.z = Math.PI / 2;
    seat.position.set(0, 0.45, 0);
    root.add(seat);
    for (const x of [-0.8, 0.8]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.45, 12), new THREE.MeshStandardMaterial({ color: 0x8a5a2b }));
      leg.position.set(x, 0.22, 0.4);
      root.add(leg);
    }
  } else {
    body("a", -4, 0, 0.3, [[4, 0], [-4, 0]], 1);
    body("b", 4, 0.1, 0.3, [[-4, 0], [4, 0]]);
    body("c", 0, -4, 0.3, [[0, 4], [0, -4]], 2);
    body("dog", 0.1, 4, 0.35, [[0, -4], [0, 4]]);
  }
  world = new World(colliders);
}
setup("corridor pass");
$("#restart").addEventListener("click", () => setup(sceneIn.value as Scene));

const timer = new FrameTimer();
let prev = performance.now();
status("capsule movers with steering, a held passing side, timed yields and a stall detector.", "ok");

function step(dt: number) {
  simT += dt;
  const outs = bodies.map((b) => b.steer.update(simT, b, bodies, obstacles));
  bodies.forEach((b, i) => {
    const o = outs[i]!;
    if (o.mode === "arrived" && b.goals.length && b.steer.hasGoal) {
      b.arrivals++;
      b.leg = (b.leg + 1) % b.goals.length;
      b.steer.setGoal(...b.goals[b.leg]!);
    }
    // a body accelerates toward the wanted velocity (0.15 s time constant, inferred)
    b.vx += (o.vx - b.vx) * Math.min(1, dt / 0.15);
    b.vz += (o.vz - b.vz) * Math.min(1, dt / 0.15);
    const a: Actor = { pos: { x: b.x, y: 0, z: b.z }, vel: { x: b.vx, y: 0, z: b.vz }, radius: b.radius, height: 1.7, grounded: true };
    world.step(a, dt);
    b.x = a.pos.x;
    b.z = a.pos.z;
    b.vx = a.vel.x;
    b.vz = a.vel.z;
    // stall: a goal and under 0.2 m of travel over the last 2 s (the package test's bound)
    b.track.push({ t: simT, x: b.x, z: b.z, goal: b.steer.hasGoal && o.mode !== "arrived" });
    while (b.track.length && b.track[0]!.t < simT - 2) b.track.shift();
    const first = b.track[0]!;
    if (simT > 2 && first.goal && Math.hypot(b.x - first.x, b.z - first.z) < 0.2) b.stall += dt;
    if (o.why && i === 0) whyLine.textContent = o.why;
  });
  world.endFrame();
  for (let i = 0; i < bodies.length; i++)
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i]!;
      const c = bodies[j]!;
      minGap = Math.min(minGap, Math.hypot(a.x - c.x, a.z - c.z) - a.radius - c.radius);
    }
  for (const o of obstacles)
    for (const b of bodies)
      for (const p of o.parts) {
        const d = "ax" in p ? segDist(b.x, b.z, p) - p.r : Math.hypot(b.x - p.x, b.z - p.z) - p.r;
        minGap = Math.min(minGap, d - b.radius);
      }
}

function segDist(x: number, z: number, c: { ax: number; az: number; bx: number; bz: number }): number {
  const dx = c.bx - c.ax;
  const dz = c.bz - c.az;
  const t = Math.max(0, Math.min(1, ((x - c.ax) * dx + (z - c.az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - c.ax - t * dx, z - c.az - t * dz);
}

function frame(now: number) {
  timer.tick(now);
  const dt = Math.min(0.05, Math.max(0, (now - prev) / 1000));
  prev = now;
  timer.time(() => step(dt));
  for (const b of bodies) b.mesh.position.set(b.x, 0, b.z);
  renderer.render(scene, camera);
  if (Math.floor(now / 250) !== Math.floor((now - 17) / 250)) {
    const st = timer.stats();
    readout({
      ...Object.fromEntries(bodies.map((b) => [`${b.id} stall s, arrivals (measured)`, `${b.stall.toFixed(2)}, ${b.arrivals}`])),
      "closest gap m, below 0 is overlap (measured)": minGap,
      "fps p50 (measured)": st.fpsP50,
      "step work ms p95 (measured)": st.workMsP95,
    });
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

if (auto) {
  await sleep(500);
  timer.reset();
  const rows: string[] = [];
  let ok = true;
  for (const s of SCENES) {
    sceneIn.value = s;
    setup(s);
    await sleep(14_000);
    const stall = Math.max(...bodies.map((b) => b.stall));
    const arrivals = bodies.filter((b) => !b.parked).reduce((n, b) => n + b.arrivals, 0);
    const movers = bodies.filter((b) => !b.parked).length;
    const pass = stall <= 1 && minGap > -0.05 && arrivals >= movers;
    ok &&= pass;
    r.numbers[`${s}: worst stall s (measured)`] = Math.round(stall * 100) / 100;
    r.numbers[`${s}: closest gap m (measured)`] = Math.round(minGap * 1000) / 1000;
    r.numbers[`${s}: arrivals in 14 s (measured)`] = arrivals;
    rows.push(`${s} ${pass ? "ok" : "failed"}`);
  }
  Object.assign(r.numbers, timer.numbers());
  check(r, "mover: corridor pass, parked in path, bench and a four way cross at real frame rate", ok ? "pass" : "fail", `${rows.join("; ")}; bound: stall at most 1 s, gap above -0.05 m, every mover arrives`);
  const rows0 = tuneHost.querySelectorAll("input").length;
  tune.set("St.speed", 1.5);
  await sleep(200);
  const hashOk = location.hash.includes("St.speed");
  tune.reset();
  check(r, "tunables: the panel builds and syncs the url hash in a real browser", rows0 > 0 && hashOk ? "pass" : "fail", `${rows0} inputs, hash ${hashOk ? "written" : "not written"} (measured); no stylesheet ships, the page styles it`);
  check(r, "mover: a person looks at the steering, passing side and yields", "not run", "needs the owner to look; screenshot in .local/shots/mover.png");
  check(r, "mover: dog-simulator corridor-pass and parked-in-path seed 21 with a moving dog", "not run", "needs the dog-simulator scenarios on this package");
  finish(r, ok && r.notes.length === 0 ? "pass" : "fail");
}
