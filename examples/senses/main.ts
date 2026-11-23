import { Eye, cameraFromThree } from "@hackbuild/senses/three";
import { OCCUPIED, FREE, OccupancyGrid, OdourField, PerceptMemory, Saliency, Sniffer, Tracker, load, seededRng } from "@hackbuild/senses";
import * as THREE from "three";
import { boxMesh, capsule, stage } from "../shared/scene.js";
import { $, FrameTimer, auto, check, finish, readout, result, sleep, status } from "../shared/ui.js";

const r = result("senses");
$("#controls").innerHTML = `
<label>wind m/s <input id="wind" type="range" min="0.2" max="2" step="0.1" value="0.7"><span id="windv">0.7</span></label>
<label>arousal <input id="arousal" type="range" min="0" max="1" step="0.05" value="0.5"></label>
<button id="reset" type="button">restart the sniffer</button>`;
const panels = document.createElement("div");
panels.style.cssText = "display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-top:12px";
const mk = (label: string, w: number, h: number) => {
  const f = document.createElement("figure");
  f.style.margin = "0";
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.style.cssText = "width:100%;image-rendering:pixelated;border:1px solid var(--line);border-radius:4px;background:#000";
  const cap = document.createElement("figcaption");
  cap.textContent = label;
  cap.style.color = "var(--dim)";
  f.append(c, cap);
  panels.append(f);
  return c;
};
$("#stage").after(panels);
const windIn = $("#wind") as HTMLInputElement;
const arousalIn = $("#arousal") as HTMLInputElement;
windIn.addEventListener("input", () => ($("#windv").textContent = windIn.value));

status("loading the senses wasm.");
await load();
const { renderer, scene, camera, controls } = stage([0, 0.5, 0], 9);
camera.position.set(6, 8, 9);
controls.update();

// a 12 m room, a watcher in the middle, three things to look at, a bowl to smell
const ROOM = 6;
for (const [x, z, w, d] of [[0, ROOM, 12, 0.2], [0, -ROOM, 12, 0.2], [ROOM, 0, 0.2, 12], [-ROOM, 0, 0.2, 12], [-1.5, -1.5, 3, 0.2]] as const) {
  const m = boxMesh(w, 1.2, d, 0x8a8f98);
  m.position.set(x, 0, z);
  scene.add(m);
}
const watcher = capsule(0.25, 0.7, 0x3a6ea5);
scene.add(watcher);
const head = new THREE.Vector3(0, 0.6, 0);
const ball = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16), new THREE.MeshStandardMaterial({ color: 0xd03030 }));
const crate = boxMesh(0.5, 0.5, 0.5, 0x2f80ed);
crate.position.set(-2.5, 0, 3);
const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.9, 20), new THREE.MeshStandardMaterial({ color: 0xe0b020 }));
scene.add(ball, crate, post);
const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 0.12, 24), new THREE.MeshStandardMaterial({ color: 0x1a7f37 }));
const BOWL = { x: -3.5, z: -3.5 };
bowl.position.set(BOWL.x, 0.06, BOWL.z);
const nose = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 16), new THREE.MeshStandardMaterial({ color: 0xc8742c }));
nose.geometry.rotateX(Math.PI / 2);
scene.add(bowl, nose);
const gaze = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), head, 1.2, 0xffffff);
scene.add(gaze);
const grid3 = scene.children.find((o) => o instanceof THREE.GridHelper)!;
const puffGeo = new THREE.BufferGeometry();
const puffPts = new THREE.Points(puffGeo, new THREE.PointsMaterial({ color: 0x57c27a, size: 0.08, transparent: true, opacity: 0.6 }));
scene.add(puffPts);

const sal = new Saliency({ rng: seededRng(1) });
const eye = new Eye(renderer, scene, { far: 12 });
const grid = new OccupancyGrid({ cells: 130, cell: 0.1 });
const memory = new PerceptMemory({ rng: seededRng(2) });
const field = new OdourField({ rng: seededRng(3), size: 14, bounds: 7, cells: 64 });
const sniffer = new Sniffer({ rng: seededRng(4) });
const tracker = new Tracker({ rng: seededRng(5) });

const salCanvas = mk("saliency map from the watcher's view (computed)", sal.mapWidth, sal.mapHeight);
const gridCanvas = mk("occupancy grid from the eye's depth (computed)", 130, 130);
const plumeCanvas = mk("odour puffs and trail, top down (computed)", 140, 140);

let yaw = 0;
let pitch = -0.2;
let target = new THREE.Vector3(0, 0.3, 3);
let pos = { x: 0, z: 0 };
let heading = 0;
let waypoint: { x: number; z: number } | null = null;
let stopDist = 0.3;
let mode = "decide";
let found = -1;
let sniffStart = 0;
const timer = new FrameTimer();
const stats = { fixations: 0, onObject: 0, eyePasses: 0, ballSeen: 0, salMs: [] as number[], eyeMs: [] as number[] };
const placeNose = () => {
  const w = field.wind();
  const n = Math.hypot(w.x, w.z) || 1;
  // start 5 m downwind of the bowl
  pos = { x: BOWL.x + (w.x / n) * 5, z: BOWL.z + (w.z / n) * 5 };
  pos.x = Math.max(-5.5, Math.min(5.5, pos.x));
  pos.z = Math.max(-5.5, Math.min(5.5, pos.z));
  heading = Math.atan2(-w.x, -w.z);
  waypoint = null;
  found = -1;
  sniffStart = performance.now() / 1000;
};
for (let k = 0; k < 400; k++) field.step(1 / 60, [{ id: 0, x: BOWL.x, z: BOWL.z, strength: 1 }]);
placeNose();
$("#reset").addEventListener("click", placeNose);

let lastSal = 0;
let lastEye = 0;
let prev = performance.now();
status("the watcher looks where its saliency map peaks; the cone tracks the bowl's scent. drag to orbit.", "ok");

function drawMap(c: HTMLCanvasElement, w: number, h: number, value: (i: number) => [number, number, number]) {
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const [R, G, B] = value(i);
    img.data.set([R, G, B, 255], i * 4);
  }
  ctx.putImageData(img, 0, 0);
}

function frame(now: number) {
  timer.tick(now);
  const dt = Math.min(0.05, Math.max(0, (now - prev) / 1000));
  prev = now;
  const t = now / 1000;
  timer.time(() => {
    ball.position.set(Math.cos(t * 0.6) * 2.5, 0.2, 2 + Math.sin(t * 0.6) * 2.5);
    post.position.set(3 + Math.sin(t * 0.9) * 1.5, 0.45, 1.5);
    // eye: saliency every 100 ms, depth and ids every 250 ms
    eye.place(head, yaw, pitch);
    const cam = cameraFromThree(eye.camera);
    if (now - lastSal > 100) {
      lastSal = now;
      const s0 = performance.now();
      // the gaze arrow, the drawn puffs and the floor grid are page overlays, kept out of what the eye sees
      gaze.visible = puffPts.visible = grid3.visible = false;
      const frameRgba = eye.colorFrame(160, 80);
      gaze.visible = puffPts.visible = grid3.visible = true;
      const map = sal.update(frameRgba, 160, 80, t, cam);
      stats.salMs.push(performance.now() - s0);
      let max = 0;
      for (const v of map) max = Math.max(max, v);
      drawMap(salCanvas, sal.mapWidth, sal.mapHeight, (i) => {
        const x = i % sal.mapWidth;
        const y = Math.floor(i / sal.mapWidth);
        const v = Math.round(255 * ((map[y * sal.mapWidth + x] ?? 0) / (max || 1)));
        return [v, v, v];
      });
      if (sal.ready(t)) {
        const fix = sal.shift(t, cam, [ball.position, crate.position.clone().setY(0.25), post.position], Number(arousalIn.value));
        if (fix) {
          stats.fixations++;
          if (fix.object >= 0) stats.onObject++;
          target = new THREE.Vector3(fix.point.x, fix.point.y, fix.point.z);
        }
      }
    }
    const want = Math.atan2(target.x - head.x, target.z - head.z);
    let d = want - yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    yaw += d * Math.min(1, dt * 6);
    pitch += (Math.atan2(target.y - head.y, Math.hypot(target.x - head.x, target.z - head.z)) - pitch) * Math.min(1, dt * 6);
    watcher.rotation.y = yaw;
    gaze.setDirection(new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)));
    if (now - lastEye > 250) {
      lastEye = now;
      const e0 = performance.now();
      const pass = eye.pass([{ object: ball, label: "ball" }], [watcher, gaze, puffPts, grid3]);
      grid.integrate(pass.camera, pass.depth, pass.depthWidth, pass.depthHeight, 12, { x: head.x, y: 0, z: head.z });
      stats.eyeMs.push(performance.now() - e0);
      stats.eyePasses++;
      const seen = pass.visible.some((v) => v.label === "ball");
      if (seen) stats.ballSeen++;
      memory.sense(0, head, yaw, { pos: ball.position, size: 0.4, occluded: !seen }, 1, t);
      const cells = grid.cells();
      drawMap(gridCanvas, 130, 130, (i) => {
        const c = cells[i];
        return c === OCCUPIED ? [255, 120, 80] : c === FREE ? [70, 90, 110] : [20, 20, 22];
      });
    }
    // plume and the tracking nose
    field.setWind(Number(windIn.value), 0.35);
    field.step(dt, [{ id: 0, x: BOWL.x, z: BOWL.z, strength: 1 }]);
    if (found < 0) {
      const side = { x: Math.cos(heading) * 0.03, z: -Math.sin(heading) * 0.03 };
      sniffer.tick(field, dt, t, true, pos, side);
      const arrived = !waypoint || Math.hypot(waypoint.x - pos.x, waypoint.z - pos.z) < stopDist;
      const step = tracker.step(field, sniffer, dt, t, pos, heading, arrived);
      mode = step.mode;
      if (step.waypoint) waypoint = step.waypoint;
      stopDist = step.stopDist;
      if (waypoint && !arrived) {
        const dx = waypoint.x - pos.x;
        const dz = waypoint.z - pos.z;
        const n = Math.hypot(dx, dz);
        const v = Math.min(step.speed || 0.6, n / Math.max(dt, 1e-3));
        pos.x += (dx / n) * v * dt;
        pos.z += (dz / n) * v * dt;
        heading = Math.atan2(dx, dz);
      }
      if (Math.hypot(pos.x - BOWL.x, pos.z - BOWL.z) < 0.8) found = t - sniffStart;
    }
    nose.position.set(pos.x, 0.25, pos.z);
    nose.rotation.y = heading;
  });
  const puffs = field.puffs();
  const arr = new Float32Array((puffs.length / 4) * 3);
  for (let i = 0; i < puffs.length / 4; i++) arr.set([puffs[i * 4]!, 0.05, puffs[i * 4 + 1]!], i * 3);
  puffGeo.setAttribute("position", new THREE.BufferAttribute(arr, 3));
  renderer.setRenderTarget(null);
  renderer.render(scene, camera);
  if (Math.floor(now / 250) !== Math.floor((now - 17) / 250)) {
    const trail = field.trail();
    let tmax = 0;
    for (const v of trail) tmax = Math.max(tmax, v);
    const pc = plumeCanvas.getContext("2d")!;
    pc.fillStyle = "#000";
    pc.fillRect(0, 0, 140, 140);
    const cellPx = 140 / 64;
    for (let i = 0; i < trail.length; i++) {
      const v = (trail[i] ?? 0) / (tmax || 1);
      if (v <= 0) continue;
      pc.fillStyle = `rgba(200,116,44,${v})`;
      pc.fillRect((i % 64) * cellPx, Math.floor(i / 64) * cellPx, cellPx, cellPx);
    }
    pc.fillStyle = "#57c27a";
    for (let i = 0; i < puffs.length / 4; i++) pc.fillRect(((puffs[i * 4]! + 7) / 14) * 140, ((puffs[i * 4 + 1]! + 7) / 14) * 140, 1.5, 1.5);
    pc.fillStyle = "#fff";
    pc.fillRect(((pos.x + 7) / 14) * 140 - 2, ((pos.z + 7) / 14) * 140 - 2, 4, 4);
    const st = timer.stats();
    const rc = memory.recall(0, t);
    const known = grid.known();
    readout({
      "fixations on an object (measured)": `${stats.onObject} of ${stats.fixations}`,
      "ball seen by the eye (measured)": `${stats.ballSeen} of ${stats.eyePasses} passes`,
      "ball recall confidence (computed)": rc ? rc.confidence : 0,
      "grid cells free, occupied (computed)": `${known.free}, ${known.occupied}`,
      "tracker mode": found >= 0 ? `found the bowl in ${found.toFixed(1)} s` : mode,
      "puffs (computed)": field.puffCount,
      "fps p50 (measured)": st.fpsP50,
      "frame work ms p95 (measured)": st.workMsP95,
    });
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

if (auto) {
  await sleep(1000);
  timer.reset();
  Object.assign(stats, { fixations: 0, onObject: 0, eyePasses: 0, ballSeen: 0, salMs: [], eyeMs: [] });
  placeNose();
  const t0 = performance.now();
  while (found < 0 && performance.now() - t0 < 45_000) await sleep(500);
  const q = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.floor(p * (xs.length - 1))] ?? Number.NaN;
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const known = grid.known();
  Object.assign(r.numbers, timer.numbers(), {
    "saliency update ms p50 incl readback (measured)": r2(q(stats.salMs, 0.5)),
    "saliency update ms p95 incl readback (measured)": r2(q(stats.salMs, 0.95)),
    "eye pass ms p50 (measured)": r2(q(stats.eyeMs, 0.5)),
    "eye pass ms p95 (measured)": r2(q(stats.eyeMs, 0.95)),
    "fixations (measured)": stats.fixations,
    "fixations on an object (measured)": stats.onObject,
    "ball seen in eye passes (measured)": `${stats.ballSeen} of ${stats.eyePasses}`,
    "grid cells occupied (computed)": known.occupied,
    "seconds to the bowl (measured)": found >= 0 ? r2(found) : "not reached in 45 s",
  });
  const fps = timer.stats().fpsP50;
  check(r, "senses: eye, saliency and plume run at real frame rate on the real gpu", fps > 50 && r.notes.length === 0 ? "pass" : "fail", `fps p50 ${fps.toFixed(1)} (measured)`);
  const frac = stats.fixations ? stats.onObject / stats.fixations : 0;
  check(r, "senses: saliency fixation quality on a scene with objects", frac >= 0.5 ? "pass" : "fail", `${stats.onObject} of ${stats.fixations} fixations on one of 3 objects (measured); bar 0.5 (inferred)`);
  check(r, "senses: eye pass and occupancy grid from depth at real frame rate", stats.ballSeen > 0 && known.occupied > 0 ? "pass" : "fail", `ball seen ${stats.ballSeen} of ${stats.eyePasses}, ${known.occupied} occupied cells`);
  check(r, "senses: sniffer and tracker find the source on a live plume", found >= 0 ? "pass" : "fail", found >= 0 ? `${found.toFixed(1)} s from 5 m downwind (measured)` : "not reached in 45 s");
  check(r, "senses: a person looks at the eye, plume and saliency map", "not run", "needs the owner to look; screenshot in .local/shots/senses.png");
  const bad = Object.values(r.checks).some((c) => c.status === "fail");
  finish(r, bad ? "fail" : "pass");
}
