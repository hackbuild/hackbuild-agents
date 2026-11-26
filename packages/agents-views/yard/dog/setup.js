// ---------- the dog body ----------
const dog = {
  root: new THREE.Group(), pivot: new THREE.Group(), ready: false,
  pos: V3(0, 0, 2), yaw: Math.PI, v: 0, w: 0, S: 0.47, yaw0: 0,
  bones: {}, rest: new Map(), legs: [], mesh: null, mat: null,
  noseL: V3(), mouthL: V3(), eyeL: V3(), fwdM: V3(), upM: V3(0, 1, 0),
  posture: { sit: 0, down: 0, bow: 0, reach: 0 }, postureT: { sit: 0, down: 0, bow: 0, reach: 0 },
  phase: 0, gaitW: [1, 0, 0], freq: 0, duty: 0.65, act: 0, standing: true,
  head: { yaw: 0, pitch: 0, roll: 0, tYaw: 0, tPitch: 0, tRoll: 0 },
  tailPhase: 0, earPerk: 0, bodyPitch: 0, heat: 0, hop: 0, pawLift: 0
};
scene.add(dog.root); dog.root.add(dog.pivot);
const QY = a => new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), a);
let QC = QY(0), QCi = QY(0);
const dqE = new THREE.Euler();
function dq(pitch, yaw, roll, out = new THREE.Quaternion()) { dqE.set(pitch, yaw, roll, 'YXZ'); out.setFromEuler(dqE); return out.premultiply(QC).multiply(QCi); }

const LEGDEF = [
  { id: 'LF', up: 'frontUpr.L', mid: 'frontLeg.L_03', end: 'frontHorselink.L', toe: ['frontToe.L'], front: true, side: 1 },
  { id: 'RF', up: 'frontUpr.R', mid: 'frontLeg.R_03', end: 'frontHorselink.R', toe: ['frontToe.R'], front: true, side: -1 },
  { id: 'LH', up: 'rearUpr.L', mid: 'rearLwr.L', end: 'rearHorselink.L', toe: ['rearFoot.L', 'rearToe.L'], front: false, side: 1 },
  { id: 'RH', up: 'rearUpr.R', mid: 'rearLwr.R', end: 'rearHorselink.R', toe: ['rearFoot.R', 'rearToe.R'], front: false, side: -1 }
];
const bk = n => n.replace(/[\[\]\.:\/]/g, '').replace(/\s/g, '_').toLowerCase();
const NEED = ['root', 'hips', 'spine2', 'spine_03', 'chest', 'neck1', 'head', 'tail1', 'tail3', 'tail_03'];

function setupDog(gltf, label) {
  // clear previous
  while (dog.pivot.children.length) dog.pivot.remove(dog.pivot.children[0]);
  dog.bones = {}; dog.rest.clear(); dog.legs = []; dog.ready = false;
  const root = gltf.scene;
  let mesh = null;
  root.traverse(o => { if (o.isSkinnedMesh && !mesh) mesh = o; if (o.isBone) dog.bones[bk(o.name)] = o; });
  const raw = dog.bones; dog.bones = new Proxy(raw, { get: (t, k) => t[bk(String(k))] });
  const miss = [...NEED, ...LEGDEF.flatMap(l => [l.up, l.mid, l.end, ...l.toe])].filter(n => !dog.bones[n]);
  if (!mesh || miss.length) { toast('rig not recognised: missing ' + (mesh ? miss.slice(0, 3).join(', ') : 'skinned mesh')); return false; }
  dog.mesh = mesh;
  mesh.frustumCulled = false; mesh.castShadow = true; mesh.receiveShadow = true;
  const mat = mesh.material; mat.metalness = 0; mat.side = THREE.FrontSide; dog.mat = mat;
  root.updateMatrixWorld(true);
  const W = n => dog.bones[n].getWorldPosition(V3());
  const head = W('head'), tail = W('tail1');
  const f = V3(head.x - tail.x, 0, head.z - tail.z).normalize();
  dog.yaw0 = Math.atan2(f.x, f.z); dog.fwdM.copy(f);
  QC = QY(dog.yaw0); QCi = QY(-dog.yaw0);
  // skinned bind pose vertices in model space (quantized GLBs fold scale into the bind matrices)
  const pa = mesh.geometry.attributes.position; const bb = new THREE.Box3();
  const sk = mesh.geometry.attributes.skinIndex, sw = mesh.geometry.attributes.skinWeight;
  const headIdx = mesh.skeleton.bones.indexOf(dog.bones['head']);
  const verts = [];
  mesh.skeleton.update();
  for (let i = 0; i < pa.count; i += 3) {
    const p = mesh.getVertexPosition(i, V3()).applyMatrix4(mesh.matrixWorld);
    bb.expandByPoint(p);
    let hw = 0; if (sk) for (let k = 0; k < 4; k++) if (sk.getComponent(i, k) === headIdx) hw += sw.getComponent(i, k);
    if (hw > 0.5) verts.push(p);
  }
  const height = bb.max.y - bb.min.y;
  dog.S = 0.78 / height;
  const center = W('clavicle.L').add(W('clavicle.R')).add(W('rearUpr.L')).add(W('rearUpr.R')).multiplyScalar(0.25);
  dog.pivot.rotation.set(0, -dog.yaw0, 0);
  dog.pivot.scale.setScalar(dog.S);
  const c = center.clone().applyAxisAngle(V3(0, 1, 0), -dog.yaw0).multiplyScalar(dog.S);
  dog.pivot.position.set(-c.x, -bb.min.y * dog.S, -c.z);
  dog.pivot.add(root);
  root.traverse(o => { if (o.isBone) dog.rest.set(o, { p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() }); });
  // nose, mouth, eyes from vertices near the head
  const hb = head;
  let best = -1e9; const nose = hb.clone().addScaledVector(f, 0.3);
  for (const v of verts) { const pr = v.x * f.x + v.z * f.z; if (pr > best) { best = pr; nose.copy(v); } }
  dog.noseL.copy(nose).sub(hb);
  dog.mouthL.copy(hb).lerp(nose, 0.82).sub(hb); dog.mouthL.y -= 0.07;
  dog.eyeL.copy(hb).lerp(nose, 0.35).sub(hb); dog.eyeL.y += 0.07;
  // legs
  dog.root.position.set(0, 0, 0); dog.root.rotation.set(0, 0, 0); dog.root.updateMatrixWorld(true);
  for (const L of LEGDEF) {
    const b = { up: dog.bones[L.up], mid: dog.bones[L.mid], end: dog.bones[L.end] };
    const A = b.up.getWorldPosition(V3()), B = b.mid.getWorldPosition(V3()), C = b.end.getWorldPosition(V3());
    const toeBone = dog.bones[L.toe[L.toe.length - 1]]; const T = toeBone.getWorldPosition(V3());
    const pawL = V3(); for (const n of L.toe) pawL.add(dog.bones[n].position);
    const ac = C.clone().sub(A).normalize(); const pole = B.clone().sub(A); pole.sub(ac.clone().multiplyScalar(pole.dot(ac))).normalize();
    dog.legs.push(Object.assign({}, L, b, {
      l1: A.distanceTo(B), l2: B.distanceTo(C), pawL, pole,
      nom: V3(T.x, 0, T.z), toeH: Math.max(T.y, 0.005), hipL: A.clone(),
      foot: V3(), lift: V3(), land: V3(), stance: true, swingS: 0, ph: 0, step: null, trail: []
    }));
  }
  dog.frontZ = (dog.legs[0].nom.z + dog.legs[1].nom.z) / 2; dog.rearZ = (dog.legs[2].nom.z + dog.legs[3].nom.z) / 2;
  dog.halfW = (dog.legs[0].nom.x - dog.legs[1].nom.x) / 2;
  dog.rootL = dog.bones['root'].getWorldPosition(V3());
  // tongue
  const tongue = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), M('#f07aa6', { roughness: 0.5 }));
  tongue.scale.set(0.55, 0.18, 1.2); dog.bones['head'].add(tongue); tongue.position.copy(dog.mouthL).add(V3(0, -0.02, 0)); tongue.visible = false; dog.tongue = tongue;
  // place feet
  dog.root.position.set(dog.pos.x, H(dog.pos.x, dog.pos.z), dog.pos.z); dog.root.rotation.y = dog.yaw; dog.root.updateMatrixWorld(true);
  for (const l of dog.legs) { l.foot.copy(nomWorld(l, dog.pos, dog.yaw)); l.stance = true; }
  dog.phase = 0;
  dog.ready = true;
  const tris = mesh.geometry.index ? mesh.geometry.index.count / 3 : pa.count / 3;
  $('mdlName').textContent = label;
  $('mdlInfo').innerHTML = `<b>bones</b><span>${mesh.skeleton.bones.length}</span><b>triangles</b><span>${Math.round(tris).toLocaleString()}</span><b>scale</b><span>${dog.S.toFixed(3)} m per unit</span><b>shoulder</b><span>${(dog.legs[0].hipL.y).toFixed(2)} m</span><b>facing fix</b><span>${(dog.yaw0 * 180 / Math.PI).toFixed(1)} deg</span><b>stand height</b><span>${(height * dog.S).toFixed(2)} m</span>`;
  if (skel) { scene.remove(skel); skel = null; }
  orgSetup();
  return true;
}
function nomWorld(l, pos, yaw, out = V3()) {
  const P = dog.postureOff ? dog.postureOff[l.id] : null;
  let x = l.nom.x, z = l.nom.z; if (P) { x += P.x; z += P.z; }
  const c = Math.cos(yaw), s = Math.sin(yaw);
  out.set(pos.x + c * x + s * z, 0, pos.z - s * x + c * z);
  out.y = H(out.x, out.z) + l.toeH; return out;
}
function resetPose() { for (const [b, r] of dog.rest) { b.position.copy(r.p); b.quaternion.copy(r.q); b.scale.copy(r.s); } }

