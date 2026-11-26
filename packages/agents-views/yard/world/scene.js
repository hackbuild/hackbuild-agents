// ---------- world layout ----------
const PORCH = V3(0, 0, 7.2); // fixed spot where the human starts; the terrain is flattened here
const YOU = V3(0, 0, 7.2);   // the human's live position, updated every frame
const BOWL = V3(-4.2, 0, 4.4);
const BED = V3(4.6, 0, 4.8);
const FENCE_R = 14;
const TREES = [[-8, -6], [7.5, -7], [-10.5, 3], [10, 2.5], [-3.5, -10.5], [3.8, -10]].map(([x, z]) => ({ x, z, r: 0.32 }));
const ROCKS = [[-5.5, -2, 0.55], [5.8, -2.8, 0.4], [1.5, -6, 0.5], [-1.8, -4.2, 0.3], [8.5, 6.5, 0.45]].map(([x, z, r]) => ({ x, z, r }));
const LOGS = [{ x: -7.2, z: 7, a: 0.6, len: 2.4 }, { x: 2.5, z: 2.8, a: -0.3, len: 1.8 }];
const OBST = [];
TREES.forEach(t => OBST.push({ x: t.x, z: t.z, r: t.r + 0.05, kind: 'tree' }));
ROCKS.forEach(r => OBST.push({ x: r.x, z: r.z, r: r.r * 0.95, kind: 'rock' }));
LOGS.forEach(l => { for (let i = -1; i <= 1; i++) OBST.push({ x: l.x + Math.cos(l.a) * i * l.len / 3, z: l.z - Math.sin(l.a) * i * l.len / 3, r: 0.32, kind: 'log' }); });
OBST.push({ x: YOU.x, z: YOU.z, r: 0.3, kind: 'you' });

function H(x, z) {
  let h = 0.24 * Math.sin(x * 0.31 + 1.2) * Math.cos(z * 0.27 - 0.4) + 0.12 * Math.sin(x * 0.67 + z * 0.41) + 0.05 * Math.cos(x * 1.1 - z * 0.9);
  const f = ss(1.0, 3.0, Math.hypot(x - PORCH.x, z - PORCH.z)) * ss(0.8, 2.2, Math.hypot(x - BOWL.x, z - BOWL.z)) * ss(1.0, 2.4, Math.hypot(x - BED.x, z - BED.z));
  h *= f;
  const r = Math.hypot(x, z);
  h += 0.5 * ss(11.5, 15, r);
  return h;
}

// ---------- renderer ----------
const stage = $('stage');
const renderer = new THREE.WebGPURenderer({ antialias: true });
renderer.domElement.className = 'gl';
stage.prepend(renderer.domElement);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#eef2ef');
scene.fog = new THREE.Fog('#eef2ef', 24, 48);
const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 120);
camera.position.set(2.2, 1.7, 6.6);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.35, 2.2);
controls.enableDamping = true;
controls.maxPolarAngle = 1.48;
controls.minDistance = 1.2; controls.maxDistance = 26;

const hemi = new THREE.HemisphereLight('#ffffff', '#cbbfa6', 1.45); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff3df', 2.3);
sun.position.set(7, 14, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
const sc = sun.shadow.camera; sc.left = -15; sc.right = 15; sc.top = 15; sc.bottom = -15; sc.near = 1; sc.far = 40;
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
scene.add(sun); scene.add(sun.target);

// ---------- terrain ----------
const GN = 128, GS = 34;
const tg = new THREE.BufferGeometry();
const tpos = new Float32Array((GN + 1) * (GN + 1) * 3), tcol = new Float32Array((GN + 1) * (GN + 1) * 3);
const tidx = new Uint32Array(GN * GN * 6);
{
  let k = 0;
  const cA = new THREE.Color('#cfdcae'), cB = new THREE.Color('#bccf98'), cC = new THREE.Color('#e7dcc0'), c = new THREE.Color();
  for (let j = 0; j <= GN; j++) for (let i = 0; i <= GN; i++) {
    const x = -GS / 2 + GS * i / GN, z = -GS / 2 + GS * j / GN, y = H(x, z);
    tpos[k * 3] = x; tpos[k * 3 + 1] = y; tpos[k * 3 + 2] = z;
    const n = 0.5 + 0.5 * Math.sin(x * 2.1 + Math.sin(z * 1.3)) * Math.cos(z * 1.7 - x * 0.4);
    c.copy(cA).lerp(cB, n * 0.8);
    const worn = Math.max(1 - Math.hypot(x - PORCH.x, z - PORCH.z) / 2.6, 0) + Math.max(1 - Math.hypot(x - BOWL.x, z - BOWL.z) / 1.4, 0) * 0.6;
    c.lerp(cC, clamp(worn, 0, 0.9));
    tcol[k * 3] = c.r; tcol[k * 3 + 1] = c.g; tcol[k * 3 + 2] = c.b; k++;
  }
  let q = 0;
  for (let j = 0; j < GN; j++) for (let i = 0; i < GN; i++) {
    const a = j * (GN + 1) + i, b = a + 1, d = a + GN + 1, e = d + 1;
    tidx[q++] = a; tidx[q++] = d; tidx[q++] = b; tidx[q++] = b; tidx[q++] = d; tidx[q++] = e;
  }
}
tg.setAttribute('position', new THREE.BufferAttribute(tpos, 3));
tg.setAttribute('color', new THREE.BufferAttribute(tcol, 3));
tg.setIndex(new THREE.BufferAttribute(tidx, 1));
tg.computeVertexNormals();
const ground = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
ground.receiveShadow = true;
scene.add(ground);

// ---------- props ----------
const M = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.85 }, o));
function addMesh(geo, mat, x, y, z, parent = scene, cast = true) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m; }
for (const t of TREES) {
  const g = new THREE.Group(); g.position.set(t.x, H(t.x, t.z), t.z); scene.add(g);
  addMesh(new THREE.CylinderGeometry(0.2, 0.3, 2.4, 9), M('#a68a6d'), 0, 1.2, 0, g);
  const leaf = M('#9cc46c', { flatShading: true }), leaf2 = M('#b5d77f', { flatShading: true });
  addMesh(new THREE.IcosahedronGeometry(1.5, 1), leaf, 0, 3.2, 0, g);
  addMesh(new THREE.IcosahedronGeometry(1.1, 1), leaf2, 0.7, 3.9, 0.3, g);
  addMesh(new THREE.IcosahedronGeometry(0.9, 1), leaf, -0.6, 4.2, -0.4, g);
  t.group = g;
}
for (const r of ROCKS) { const m = addMesh(new THREE.DodecahedronGeometry(r.r, 0), M('#d6d2c8', { flatShading: true }), r.x, H(r.x, r.z) + r.r * 0.45, r.z); m.scale.set(1, 0.7, 1.1); m.rotation.y = r.x; }
for (const l of LOGS) { const m = addMesh(new THREE.CylinderGeometry(0.22, 0.25, l.len, 10), M('#b08c66'), l.x, H(l.x, l.z) + 0.2, l.z); m.rotation.set(0, l.a, Math.PI / 2); }
{ // fence
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 1.1, 0.12), M('#f6f1e6'), 44);
  const o = new THREE.Object3D();
  for (let i = 0; i < 44; i++) { const a = i / 44 * Math.PI * 2, x = Math.cos(a) * FENCE_R, z = Math.sin(a) * FENCE_R; o.position.set(x, H(x, z) + 0.5, z); o.rotation.y = -a; o.updateMatrix(); posts.setMatrixAt(i, o.matrix); }
  posts.castShadow = true; scene.add(posts);
  for (const hh of [0.45, 0.85]) { const rail = new THREE.Mesh(new THREE.TorusGeometry(FENCE_R, 0.035, 6, 160), M('#f6f1e6')); rail.rotation.x = Math.PI / 2; rail.position.y = H(FENCE_R, 0) + hh; scene.add(rail); }
}
{ // grass tufts
  const n = 2600, im = new THREE.InstancedMesh(new THREE.ConeGeometry(0.035, 0.16, 4), M('#a9c77a'), n);
  const o = new THREE.Object3D(); let k = 0;
  while (k < n) { const x = rnd(-13, 13), z = rnd(-13, 13); if (Math.hypot(x, z) > 13 || Math.hypot(x - PORCH.x, z - PORCH.z) < 1.6) continue; o.position.set(x, H(x, z) + 0.06, z); o.rotation.set(rnd(-0.3, 0.3), rnd(0, 6), rnd(-0.3, 0.3)); const s = rnd(0.6, 1.4); o.scale.set(s, s, s); o.updateMatrix(); im.setMatrixAt(k++, o.matrix); }
  scene.add(im);
}
// bowl
const bowlG = new THREE.Group(); bowlG.position.copy(BOWL).setY(H(BOWL.x, BOWL.z)); scene.add(bowlG);
{ const pts = [V3(0.0, 0), V3(0.17, 0), V3(0.2, 0.02), V3(0.23, 0.09), V3(0.21, 0.1), V3(0.18, 0.03), V3(0.0, 0.03)].map(p => new THREE.Vector2(p.x, p.y)); addMesh(new THREE.LatheGeometry(pts, 28), M('#FE0386', { roughness: 0.4 }), 0, 0, 0, bowlG); }
const food = addMesh(new THREE.CylinderGeometry(0.17, 0.15, 0.05, 20), M('#a56a3a', { roughness: 1 }), 0, 0.05, 0, bowlG, false);
// bed
// porch bench: seat height and depth set from the Sitting_Idle_Loop hip drop (0.44 m down, 0.33 m back)
{ const bg = new THREE.Group(); bg.position.set(0, H(0, 7.43), 7.43); scene.add(bg); const wood = M('#b98a5e'), dark = M('#7d5a3c');
  addMesh(new THREE.BoxGeometry(1.4, 0.05, 0.42), wood, 0, 0.405, 0, bg); addMesh(new THREE.BoxGeometry(1.4, 0.32, 0.04), wood, 0, 0.62, 0.22, bg);
  for (const x of [-0.62, 0.62]) for (const z of [-0.17, 0.17]) addMesh(new THREE.BoxGeometry(0.05, 0.4, 0.05), dark, x, 0.2, z, bg);
  for (const x of [-0.5, 0, 0.5]) OBST.push({ x, z: 7.45, r: 0.3, kind: 'bench' }); }
const bedG = new THREE.Group(); bedG.position.copy(BED).setY(H(BED.x, BED.z)); scene.add(bedG);
addMesh(new THREE.CylinderGeometry(0.62, 0.66, 0.08, 32), M('#f2e6d4'), 0, 0.04, 0, bedG);
{ const rim = addMesh(new THREE.TorusGeometry(0.6, 0.12, 10, 36), M('#f7b5d2'), 0, 0.1, 0, bedG); rim.rotation.x = Math.PI / 2; }
// pointer marker
const marker = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.24, 28), new THREE.MeshBasicMaterial({ color: '#FE0386', transparent: true, opacity: 0, depthWrite: false }));
marker.rotation.x = -Math.PI / 2; scene.add(marker);
// squirrel
const sq = new THREE.Group(); scene.add(sq); sq.visible = false;
{ const fur = M('#8b7867'); const b = addMesh(new THREE.SphereGeometry(0.08, 12, 10), fur, 0, 0.09, 0, sq); b.scale.set(0.9, 0.85, 1.5);
  addMesh(new THREE.SphereGeometry(0.055, 12, 10), fur, 0, 0.15, 0.13, sq);
  const tail = addMesh(new THREE.TorusGeometry(0.09, 0.04, 8, 14, Math.PI * 1.3), M('#9d8a78'), 0, 0.2, -0.13, sq); tail.rotation.y = Math.PI / 2; }

// ---------- physics ----------
let RAPIER = null, world = null;
const bodies = {};
const dyn = [];
async function initPhysics() {
  const mod = RAPIER_MODULE;
  RAPIER = mod.default || mod;
  await RAPIER.init();
  world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = 1 / 60;
  const gb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.trimesh(tpos, tidx).setFriction(0.9).setRestitution(0.5), gb);
  for (const t of TREES) world.createCollider(RAPIER.ColliderDesc.cylinder(1.5, 0.28).setTranslation(t.x, H(t.x, t.z) + 1.4, t.z), gb);
  for (const r of ROCKS) world.createCollider(RAPIER.ColliderDesc.ball(r.r * 0.8).setTranslation(r.x, H(r.x, r.z) + r.r * 0.3, r.z), gb);
  for (const l of LOGS) { const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, l.a, Math.PI / 2)); world.createCollider(RAPIER.ColliderDesc.capsule(l.len / 2 - 0.2, 0.23).setTranslation(l.x, H(l.x, l.z) + 0.2, l.z).setRotation(q), gb); }
  for (let i = 0; i < 44; i++) { const a = (i + 0.5) / 44 * Math.PI * 2, x = Math.cos(a) * (FENCE_R + 0.05), z = Math.sin(a) * (FENCE_R + 0.05); const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a, 0)); world.createCollider(RAPIER.ColliderDesc.cuboid(0.06, 0.8, 1.05).setTranslation(x, H(x, z) + 0.6, z).setRotation(q), gb); }
  world.createCollider(RAPIER.ColliderDesc.cylinder(0.05, 0.22).setTranslation(BOWL.x, H(BOWL.x, BOWL.z) + 0.05, BOWL.z), gb);
  bodies.human = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(PORCH.x, H(PORCH.x, PORCH.z) + 0.9, PORCH.z));
  world.createCollider(RAPIER.ColliderDesc.capsule(0.6, 0.2), bodies.human);
  // dog kinematic body
  bodies.dog = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 0.4, 2));
  world.createCollider(RAPIER.ColliderDesc.capsule(0.22, 0.13).setRotation({ x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 }), bodies.dog);
  $('chipPhys').textContent = 'rapier ' + (RAPIER.version ? RAPIER.version() : 'ok'); $('chipPhys').classList.add('on');
}
function makeDynamic(name, mesh, colDesc, pos, opts = {}) {
  const rb = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setCcdEnabled(true).setLinearDamping(opts.lin ?? 0.15).setAngularDamping(opts.ang ?? 0.6));
  world.createCollider(colDesc.setRestitution(opts.rest ?? 0.3).setFriction(opts.fric ?? 0.7).setDensity(opts.dens ?? 300), rb);
  const o = { name, mesh, rb, held: false, prevVy: 0, lastSpeed: 0 };
  dyn.push(o); scene.add(mesh); mesh.castShadow = true; return o;
}
let ball, bone, treats = [];
const crates = [];
function initProps() {
  const bm = new THREE.Mesh(new THREE.SphereGeometry(0.045, 20, 14), M('#d9f04e', { roughness: 0.95 }));
  ball = makeDynamic('ball', bm, RAPIER.ColliderDesc.ball(0.045), V3(1.2, H(1.2, 4) + 0.3, 4), { rest: 0.72, dens: 160, lin: 0.3, ang: 2.2 });
  const bg = new THREE.Group();
  const bmat = M('#f3ead8', { roughness: 0.6 });
  addMesh(new THREE.CapsuleGeometry(0.025, 0.18, 4, 8), bmat, 0, 0, 0, bg).rotation.z = Math.PI / 2;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) addMesh(new THREE.SphereGeometry(0.035, 10, 8), bmat, sx * 0.12, 0, sz * 0.025, bg);
  bone = makeDynamic('bone', bg, RAPIER.ColliderDesc.capsule(0.1, 0.035).setRotation({ x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 }), V3(-2.5, H(-2.5, 0.5) + 0.3, 0.5), { rest: 0.2, dens: 400 });
  const cmat = M('#e2c79b');
  for (const [x, z] of [[3.5, -1], [-3, -1.6], [6.2, 1.2]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), cmat);
    crates.push(makeDynamic('crate', m, RAPIER.ColliderDesc.cuboid(0.16, 0.16, 0.16), V3(x, H(x, z) + 0.4, z), { rest: 0.1, dens: 60, fric: 0.8 }));
  }
}
function spawnTreat(p, v) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.025, 0.035), M('#8a5530'));
  const t = makeDynamic('treat', m, RAPIER.ColliderDesc.cuboid(0.025, 0.0125, 0.0175), p, { rest: 0.2, dens: 500 });
  t.rb.setLinvel(v, true); treats.push(t); return t;
}
function removeDyn(o) { world.removeRigidBody(o.rb); scene.remove(o.mesh); dyn.splice(dyn.indexOf(o), 1); treats = treats.filter(t => t !== o); }
const bodyPos = o => { const t = o.rb.translation(); return V3(t.x, t.y, t.z); };
const bodyVel = o => { const t = o.rb.linvel(); return V3(t.x, t.y, t.z); };
function setHeld(o, held) {
  o.held = held;
  o.rb.setBodyType(held ? RAPIER.RigidBodyType.KinematicPositionBased : RAPIER.RigidBodyType.Dynamic, true);
}

