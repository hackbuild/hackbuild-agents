import { FirstPerson, Follow, Group, Orbit, Shake, splitViewports } from "@hackbuild/cameras";
import * as THREE from "three";
import { boxMesh, capsule, lcg, stage } from "../shared/scene.js";
import { $, FrameTimer, auto, check, finish, readout, result, sleep, status } from "../shared/ui.js";

const r = result("cameras");
const MODES = ["follow", "group", "orbit", "first person", "split"] as const;
type Mode = (typeof MODES)[number];
$("#controls").innerHTML = `
<label>camera <select id="mode">${MODES.map((m) => `<option>${m}</option>`).join("")}</select></label>
<button id="shake" type="button">shake</button>
<span>orbit: arrow keys rotate, + and - zoom</span>`;
const modeIn = $("#mode") as HTMLSelectElement;

const { renderer, scene, camera, controls } = stage([0, 0.5, 0], 6);
controls.enabled = false;
renderer.setScissorTest(false);
// walls the follow camera must pull in front of
const walls: THREE.Object3D[] = [];
for (const [x, z, w, d] of [[0, -3.2, 6, 0.3], [3.2, 0, 0.3, 6], [-3.6, 2, 0.3, 3]] as const) {
  const m = boxMesh(w, 2.2, d, 0x8a8f98);
  m.position.set(x, 0, z);
  scene.add(m);
  walls.push(m);
}
const dog = capsule(0.25, 0.6, 0xc8742c);
const dogHead = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), new THREE.MeshStandardMaterial({ color: 0xc8742c }));
dogHead.position.set(0, 0.55, 0.22);
dog.add(dogHead);
scene.add(dog);
const friends = [0x3a6ea5, 0x1a7f37, 0xd03030].map((c) => {
  const m = capsule(0.25, 1.7, c);
  scene.add(m);
  return m;
});

const ray = new THREE.Raycaster();
const clear = (from: { x: number; y: number; z: number }, dir: { x: number; y: number; z: number }, max: number) => {
  ray.set(new THREE.Vector3(from.x, from.y, from.z), new THREE.Vector3(dir.x, dir.y, dir.z).normalize());
  ray.far = max;
  const hit = ray.intersectObjects(walls, false)[0];
  return hit ? hit.distance : max;
};
const follow = new Follow(camera, { distance: 4, clear });
const group = new Group(camera);
const orbit = new Orbit(camera, 0.6, 0.5, 9, { x: 0, y: 0.5, z: 0 });
const fp = new FirstPerson(camera, dogHead);
const shake = new Shake(lcg(9));
$("#shake").addEventListener("click", () => shake.kick(0.25));
addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") orbit.rotate(-0.1, 0);
  if (e.key === "ArrowRight") orbit.rotate(0.1, 0);
  if (e.key === "ArrowUp") orbit.rotate(0, 0.05);
  if (e.key === "ArrowDown") orbit.rotate(0, -0.05);
  if (e.key === "+" || e.key === "=") orbit.zoom(0.9);
  if (e.key === "-") orbit.zoom(1.1);
});
// one camera per split view, each with its own controller
const splitCams = [0, 1, 2, 3].map(() => new THREE.PerspectiveCamera(50, 1, 0.05, 100));
const splitFollow = new Follow(splitCams[0]!, { distance: 4, clear });
const splitGroup = new Group(splitCams[1]!);
const splitOrbit = new Orbit(splitCams[2]!, 0.6, 0.5, 9, { x: 0, y: 0.5, z: 0 });
const splitFp = new FirstPerson(splitCams[3]!, dogHead);

const timer = new FrameTimer();
let prev = performance.now();
let simT = 0;
let heading = 0;
const stats = { followFrames: 0, pulledIn: 0, minDist: Infinity, blocked: 0, groupFrames: 0, groupOutside: 0, maxShake: 0 };
const dogPos = new THREE.Vector3();
status("one dog walks a loop past walls; pick a camera.", "ok");

function sightBlocked(cam: THREE.Camera): boolean {
  const target = dog.position.clone().setY(0.4);
  const dir = cam.position.clone().sub(target);
  const len = dir.length();
  ray.set(target, dir.normalize());
  ray.far = len;
  return ray.intersectObjects(walls, false).length > 0;
}

function inFrustum(cam: THREE.PerspectiveCamera, pts: THREE.Vector3[]): number {
  cam.updateMatrixWorld();
  const f = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
  return pts.filter((p) => !f.containsPoint(p)).length;
}

function frame(now: number) {
  timer.tick(now);
  const dt = Math.min(0.05, Math.max(0, (now - prev) / 1000));
  prev = now;
  const mode = modeIn.value as Mode;
  const host = $("#stage");
  const W = host.clientWidth;
  const H = host.clientHeight;
  timer.time(() => {
    simT += dt;
    // the dog walks a loop that passes close in front of the walls
    const a = simT * 0.35;
    const nx = Math.cos(a) * 2.4;
    const nz = Math.sin(a * 2) * 1.6;
    heading = Math.atan2(nx - dogPos.x, nz - dogPos.z) || heading;
    dogPos.set(nx, 0, nz);
    dog.position.copy(dogPos);
    dog.rotation.y = heading;
    friends.forEach((f, i) => f.position.set(Math.cos(a + 2 + i * 1.7) * 2, 0, Math.sin(a * 0.7 + i) * 2));
    const pts = [dog.position, ...friends.map((f) => f.position)].map((p) => p.clone().setY(0.8));
    const s = shake.step(dt);
    stats.maxShake = Math.max(stats.maxShake, Math.hypot(s.x, s.y, s.z));
    if (mode === "split") return;
    if (mode === "follow") {
      follow.update(dog.position, heading, dt);
      stats.followFrames++;
      if (follow.dist < follow.o.distance - 1e-3) stats.pulledIn++;
      stats.minDist = Math.min(stats.minDist, follow.dist);
      if (sightBlocked(camera)) stats.blocked++;
    } else if (mode === "group") {
      group.update(pts, dt, false, s);
      stats.groupFrames++;
      stats.groupOutside += inFrustum(camera, pts);
    } else if (mode === "orbit") orbit.apply();
    else fp.place(dogHead.getWorldPosition(new THREE.Vector3()), heading, -0.05);
    if (mode !== "group") camera.position.add(new THREE.Vector3(s.x, s.y, s.z));
  });
  if (mode === "split") {
    const pts = [dog.position, ...friends.map((f) => f.position)].map((p) => p.clone().setY(0.8));
    splitFollow.update(dog.position, heading, dt);
    splitGroup.update(pts, dt);
    splitOrbit.apply();
    splitFp.place(dogHead.getWorldPosition(new THREE.Vector3()), heading, -0.05);
    renderer.setScissorTest(true);
    splitViewports(4, W, H).forEach((v, i) => {
      const cam = splitCams[i]!;
      cam.aspect = v.w / v.h;
      cam.updateProjectionMatrix();
      renderer.setViewport(v.x, v.yGl, v.w, v.h);
      renderer.setScissor(v.x, v.yGl, v.w, v.h);
      if (i === 3) splitFp.render(() => renderer.render(scene, cam));
      else renderer.render(scene, cam);
    });
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, W, H);
  } else if (mode === "first person") fp.render(() => renderer.render(scene, camera));
  else renderer.render(scene, camera);
  if (Math.floor(now / 250) !== Math.floor((now - 17) / 250)) {
    const st = timer.stats();
    readout({
      camera: mode,
      "follow distance m (computed)": follow.dist,
      "follow frames pulled in (measured)": `${stats.pulledIn} of ${stats.followFrames}`,
      "follow frames with the dog hidden (measured)": stats.blocked,
      "group points outside the view (measured)": stats.groupOutside,
      "shake amplitude m (computed)": shake.amplitude,
      "fps p50 (measured)": st.fpsP50,
      "frame work ms p95 (measured)": st.workMsP95,
    });
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

if (auto) {
  await sleep(500);
  const per: Record<string, number> = {};
  for (const m of MODES) {
    modeIn.value = m;
    await sleep(500);
    timer.reset();
    if (m === "follow") shake.kick(0.25);
    await sleep(m === "follow" ? 12_000 : 4_000);
    const st = timer.stats();
    per[m] = st.fpsP50;
    r.numbers[`${m}: fps p50 (measured)`] = Math.round(st.fpsP50 * 100) / 100;
    r.numbers[`${m}: frame ms p95 (measured)`] = Math.round(st.frameMsP95 * 100) / 100;
    r.numbers[`${m}: work ms p95 (measured)`] = Math.round(st.workMsP95 * 100) / 100;
  }
  const amp = shake.amplitude;
  Object.assign(r.numbers, {
    "follow frames pulled in by a wall (measured)": stats.pulledIn,
    "follow frames (measured)": stats.followFrames,
    "follow min distance m (measured)": Math.round(stats.minDist * 1000) / 1000,
    "follow frames with the dog hidden by a wall (measured)": stats.blocked,
    "group frames (measured)": stats.groupFrames,
    "group point frames outside the view (measured)": stats.groupOutside,
    "shake peak offset m (measured)": Math.round(stats.maxShake * 1000) / 1000,
    "shake amplitude after 12 s m (measured)": Math.round(amp * 1e4) / 1e4,
  });
  const fpsOk = Object.values(per).every((v) => v > 50);
  check(r, "cameras: follow, group, orbit, first person and split views at real frame rate", fpsOk && r.notes.length === 0 ? "pass" : "fail", Object.entries(per).map(([k, v]) => `${k} ${v.toFixed(1)} fps`).join(", ") + " (measured)");
  const followOk = stats.pulledIn > 0 && stats.blocked <= stats.followFrames * 0.02;
  check(r, "cameras: follow pulls in front of walls so the dog stays in sight", followOk ? "pass" : "fail", `${stats.pulledIn} of ${stats.followFrames} frames pulled in, ${stats.blocked} frames hidden (measured); bound 2 percent (inferred)`);
  check(r, "cameras: group framing keeps four moving points in view", stats.groupOutside === 0 ? "pass" : "fail", `${stats.groupOutside} point frames outside over ${stats.groupFrames} frames (measured)`);
  check(r, "cameras: a person judges shake feel and follow smoothing", "not run", "needs the owner to look; screenshot in .local/shots/cameras.png");
  const bad = Object.values(r.checks).some((c) => c.status === "fail");
  modeIn.value = "split";
  await sleep(500);
  finish(r, bad ? "fail" : "pass");
}
