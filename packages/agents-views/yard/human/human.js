// ---------- the human: Moheeb (rig core from the owner's earlier voice app, biped gait with leg IK, task planner, optional VLM mind) ----------
// Body animation: Quaternius Universal Animation Library (CC0) clips, retargeted offline onto his rig by world space deltas from a shared T-pose
const RIG = (() => {
const PREFIX = new Set(['mixamorig', 'bip', 'cc', 'base', 'j', 'bi', 'c', 'def', 'org', 'armature', 'root', 'rig', 'skeleton', 'bone', 'jnt', 'joint', 'sk']);
function classifyBone(raw) {
  if (!raw) return null;
  let n = String(raw).replace(/^.*[|:]/, '');
  const toks = n.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2').split(/[^A-Za-z]+/).filter(Boolean).map(s => s.toLowerCase());
  let side = '';
  const rest = [];
  for (const t of toks) {
    if (t === 'left' || t === 'l') side = 'L';
    else if (t === 'right' || t === 'r') side = 'R';
    else if (PREFIX.has(t) && rest.length === 0) continue;
    else rest.push(t);
  }
  const part = rest.join('');
  const key = {
    hips: 'hips', pelvis: 'hips', hip: side ? 'upperLeg' : 'hips', spine: 'spine', chest: 'chest', upperchest: 'upperChest',
    neck: 'neck', head: 'head', jaw: 'jaw',
    shoulder: 'shoulder', clavicle: 'shoulder', collar: 'shoulder',
    arm: 'upperArm', upperarm: 'upperArm', uparm: 'upperArm', forearm: 'lowerArm', lowerarm: 'lowerArm', lowarm: 'lowerArm',
    hand: 'hand', thigh: 'upperLeg', upleg: 'upperLeg', upperleg: 'upperLeg', leg: 'lowerLeg', calf: 'lowerLeg', shin: 'lowerLeg', lowerleg: 'lowerLeg', lowleg: 'lowerLeg',
    foot: 'foot', eye: 'eye',
  }[part];
  if (!key) return null;
  const sided = ['shoulder', 'upperArm', 'lowerArm', 'hand', 'upperLeg', 'lowerLeg', 'foot', 'eye'];
  if (sided.includes(key)) return side ? key + side : null;
  return key;
}


  return { classifyBone };
})();
const HA = { roles: [], clips: {}, bones: {}, hipH: 0.96, lphase: 0, idleT: 0, talkT: 0, talkW: 0, act: null, actW: 0, loco: [1, 0, 0, 0], pose: null, tmpA: null, tmpB: null };
function haLoad(pack) {
  HA.roles = pack.roles; HA.fps = pack.fps;
  const dec = b => { const s2 = atob(b), u = new Uint8Array(s2.length); for (let i = 0; i < s2.length; i++) u[i] = s2.charCodeAt(i); return new Int16Array(u.buffer); };
  for (const [k, c] of Object.entries(pack.clips)) {
    const qi = dec(c.q), pi = dec(c.p), q = new Float32Array(qi.length), p = new Float32Array(pi.length);
    for (let i = 0; i < qi.length; i++) q[i] = qi[i] / 32767; for (let i = 0; i < pi.length; i++) p[i] = pi[i] / 10000;
    HA.clips[k] = { dur: c.dur, n: c.n, loop: c.loop, q, p };
  }
  const mk = () => ({ q: HA.roles.map(() => new THREE.Quaternion()), p: V3() });
  HA.pose = mk(); HA.tmpA = mk(); HA.tmpB = mk(); HA.tmpC = mk();
}
const _hq1 = new THREE.Quaternion(), _hq2 = new THREE.Quaternion();
function haSample(name, t, out) {
  const c = HA.clips[name], R = HA.roles.length;
  let x = c.loop ? (((t % c.dur) + c.dur) % c.dur) * HA.fps : clamp(t, 0, c.dur) * HA.fps;
  let i0 = Math.floor(x), u = x - i0; i0 = Math.min(i0, c.n - 1); const i1 = c.loop ? (i0 + 1) % c.n : Math.min(c.n - 1, i0 + 1);
  for (let r = 0; r < R; r++) {
    const a = (i0 * R + r) * 4, b = (i1 * R + r) * 4;
    _hq1.set(c.q[a], c.q[a + 1], c.q[a + 2], c.q[a + 3]); _hq2.set(c.q[b], c.q[b + 1], c.q[b + 2], c.q[b + 3]);
    out.q[r].copy(_hq1).slerp(_hq2, u).normalize();
  }
  out.p.set(lerp(c.p[i0 * 3], c.p[i1 * 3], u), lerp(c.p[i0 * 3 + 1], c.p[i1 * 3 + 1], u), lerp(c.p[i0 * 3 + 2], c.p[i1 * 3 + 2], u));
  return out;
}
function haMix(into, from, w) { if (w <= 0) return; if (w >= 1) { into.q.forEach((q, i) => q.copy(from.q[i])); into.p.copy(from.p); return; } into.q.forEach((q, i) => q.slerp(from.q[i], w)); into.p.lerp(from.p, w); }
// actions: one shots and holds layered over locomotion
const ACTS = { kneel: { clip: 'Fixing_Kneeling', hold: [1.25, 3.9] }, crouch: { clip: 'Crouch_Idle_Loop', loopHold: true }, interact: { clip: 'Interact' }, celebrate: { clip: 'Dance_Loop', loopFor: 1.6 }, pickup: { clip: 'PickUp_Table' } };
function haAct(name, opts = {}) { const A = ACTS[name]; HA.act = { name, clip: A.clip, t: opts.t0 || 0, hold: A.hold, holding: !!(A.hold || A.loopHold), loopHold: A.loopHold, dir: 1, loopFor: A.loopFor, done: false }; }
// seated: Sitting_Enter, then the idle or talking loop, then Sitting_Exit
function haSit(on) { if (on && (!HA.sit || HA.sit.ph === 'exit')) HA.sit = { ph: 'enter', t: 0, w: HA.sit ? HA.sit.w : 0 }; else if (!on && HA.sit && HA.sit.ph !== 'exit') { HA.sit.ph = 'exit'; HA.sit.t = 0; } }
function haSeated() { return HA.sit && HA.sit.ph === 'idle'; }
function haRelease() { if (HA.act) HA.act.holding = false; }
function haKneeling() { return HA.act && (HA.act.name === 'kneel' && HA.act.t > 1.0 || HA.act.name === 'crouch' && HA.act.t > 0.35) && HA.actW > 0.8; }
function haTick(dt, speed, speaking, turn = 0) {
  // locomotion weights: idle, walk, jog, sprint; turning on the spot steps the feet (about 4 steps per 180 deg, Lancashire 2022)
  const vr = Math.abs(speed), tw = ON('L.hbody') ? Math.abs(turn) : 0;
  const v = vr < 0.35 && tw > 0.45 ? Math.max(vr, Math.min(tw * 0.42, 0.75)) : vr;
  const wI = 1 - ss(0.05, 0.5, v), wS = ss(3.4, 4.2, v), wJ = ss(1.7, 2.4, v) * (1 - wS), wW = Math.max(0, 1 - wI - wJ - wS);
  HA.loco = [wI, wW, wJ, wS];
  const SPD = [0, 1.24, 2.7, 4.3], NAMES = ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop'];
  let rate = 0, wsum = 0; for (let i = 1; i < 4; i++) { if (HA.loco[i] > 0) {
    // walking cadence is about 62 + 37 v steps per minute; the clip cycle is two steps, so blend speed matching with cadence
    let r = v / SPD[i]; if (i === 1 && ON('L.hbody')) r = 0.5 * r + 0.5 * ((62 + 37 * v) / 60) * HA.clips.Walk_Loop.dur / 2;
    rate += HA.loco[i] * r / HA.clips[NAMES[i]].dur; wsum += HA.loco[i]; } }
  if (wsum > 0) HA.lphase = frac(HA.lphase + dt * clamp(rate / wsum, 0, 3));
  HA.idleT += dt;
  HA.talkW += ((speaking && wI > 0.9 ? 1 : 0) - HA.talkW) * (1 - Math.exp(-dt * 3));
  if (HA.talkW > 0.01) HA.talkT += dt;
  const P = HA.pose;
  haSample('Idle_Loop', HA.idleT, P);
  if (HA.talkW > 0.01) haMix(P, haSample('Idle_Talking_Loop', HA.talkT, HA.tmpA), HA.talkW);
  let acc = wI;
  for (let i = 1; i < 4; i++) { const w = HA.loco[i]; if (w <= 0.001) continue; acc += w; haMix(P, haSample(NAMES[i], HA.lphase * HA.clips[NAMES[i]].dur, HA.tmpA), w / acc); }
  // action layer
  const A = HA.act;
  if (A) {
    A.t += dt * A.dir;
    const c = HA.clips[A.clip];
    if (A.hold && A.holding) { if (A.t > A.hold[1]) A.dir = -1; if (A.t < A.hold[0] && A.dir < 0) A.dir = 1; }
    else A.dir = 1;
    if (A.loopFor) { if (A.t > A.loopFor) A.done = true; }
    else if (A.loopHold) { if (!A.holding) A.done = true; }
    else if (A.t >= c.dur - 0.02) A.done = true;
    HA.actW += ((A.done ? 0 : 1) - HA.actW) * (1 - Math.exp(-dt * (A.loopHold ? 5 : 8)));
    haMix(P, haSample(A.clip, A.loopFor || A.loopHold ? A.t % c.dur : A.t, HA.tmpB), HA.actW);
    if (A.done && HA.actW < 0.03) { HA.act = null; HA.actW = 0; }
  }
  // seated layer overrides everything below it
  if (HA.sit) {
    const S = HA.sit; S.t += dt; let pose;
    if (S.ph === 'enter') { pose = haSample('Sitting_Enter', S.t, HA.tmpC); if (S.t >= HA.clips.Sitting_Enter.dur - 0.02) { S.ph = 'idle'; S.t = 0; } }
    else if (S.ph === 'idle') { pose = haSample('Sitting_Idle_Loop', S.t, HA.tmpC); if (HA.talkS > 0.01) haMix(pose, haSample('Sitting_Talking_Loop', S.t, HA.tmpB), HA.talkS); }
    else { pose = haSample('Sitting_Exit', S.t, HA.tmpC); if (S.t >= HA.clips.Sitting_Exit.dur - 0.02) { HA.sit = null; } }
    HA.talkS = (HA.talkS || 0) + ((speaking ? 1 : 0) - (HA.talkS || 0)) * (1 - Math.exp(-dt * 3));
    if (HA.sit) { S.w += (1 - S.w) * (1 - Math.exp(-dt * 10)); haMix(P, pose, S.w); }
  }
  // write to bones
  HA.roles.forEach((r, i) => { const b = HA.bones[r]; if (b) b.quaternion.copy(P.q[i]); });
  return P.p;
}
const hq = [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()], hv = [V3(), V3(), V3(), V3(), V3(), V3(), V3(), V3()];
// his model calls go through @hackbuild/drives InferenceScheduler, at least 25 s apart, one at a time
const humMindSched = new HDRIVE.InferenceScheduler({ minInterval: 25 });
const HUM = {
  root: new THREE.Group(), ready: false, av: null, map: null, pos: PORCH.clone(), yaw: Math.PI, v: 0, w: 0, legs: [], phase: 0, standing: true,
  crouch: 0, crouchT: 0, bend: 0, holding: false, throwT: -1, throwTo: null, released: false, reach: null, look: null, task: null, lines: [],
  line: '', sayT: 0, lastTrain: -30, lastMind: -99, ballIdle: 0, petT: 0, hasLegs: false, headRestQ: null, eye: null, moving: 0,
  motor: { mode: 'stop', target: V3(), speed: 1.3, stopDist: 0.5, face: null, done: false },
  vs: ORG.S(), ws: ORG.S(), lookingAtDog: false, threat: 0, gazeDir: V3(0, 0, 1), point: null, reachS: null, plan: null, locks: [null, null], lw: [0, 0], ankRest: 0.08,
  mood: { pleased: ORG.S(), frus: ORG.S(), tired: ORG.S() }, brPh: 0, brJ: new ORG.OU(4, 0.12), swX: new ORG.Pink(1.2, 4), swZ: new ORG.Pink(1.2, 4),
  train: { word: '', trick: '', tries: 0, ok: 0, hist: [] }
};
scene.add(HUM.root);
const humCam = new THREE.PerspectiveCamera(62, 2, 0.05, 60);
const humRT = new THREE.RenderTarget(EW, EH);
const humView = document.createElement('canvas'); humView.width = EW; humView.height = EH;

function setupHuman(gltf, pack) {
  const obj = gltf.scene;
  obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; const m = o.material; if (m && m.map) m.map.colorSpace = THREE.SRGBColorSpace; if (m) { m.metalness = 0; m.roughness = 0.85; } } });
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj, true), sc = 1.75 / (box.max.y - box.min.y);
  obj.scale.multiplyScalar(sc); obj.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(obj, true), c = b2.getCenter(V3());
  obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= b2.min.y;
  const body = new THREE.Group(); body.add(obj); HUM.root.add(body); HUM.body = body;
  // role map, same rule as the offline bake
  const depth = o => { let d = 0; while (o.parent) { d++; o = o.parent; } return d; };
  const m = {}, sp = [];
  obj.traverse(o => { if (!o.isBone) return; const k = RIG.classifyBone(o.name); if (!k) return; if (k === 'spine') { sp.push(o); return; } if (!m[k] || depth(o) < depth(m[k])) m[k] = o; });
  sp.sort((a, b) => depth(a) - depth(b)); if (sp[0]) m.spine = sp[0]; if (sp[1]) m.chest = sp[1]; if (sp[2]) m.upperChest = sp[2];
  HUM.map = m; HA.bones = m;
  haLoad(pack);
  HUM.root.position.set(0, 0, 0); HUM.root.rotation.set(0, 0, 0); HUM.root.updateMatrixWorld(true);
  HUM.headRestQ = m.head ? m.head.getWorldQuaternion(new THREE.Quaternion()) : null;
  HUM.hipH = m.hips ? m.hips.getWorldPosition(V3()).y : 0.96; HA.hipH = HUM.hipH;
  HUM.legs = [];
  for (const s2 of ['L', 'R']) {
    const up = m['upperLeg' + s2], mid = m['lowerLeg' + s2], end = m['foot' + s2];
    if (!up || !mid || !end) continue;
    const A = up.getWorldPosition(V3()), B = mid.getWorldPosition(V3()), C = end.getWorldPosition(V3());
    HUM.legs.push({ s: s2, up, mid, end, l1: A.distanceTo(B), l2: B.distanceTo(C) });
  }
  HUM.hasLegs = HUM.legs.length === 2;
  if (HUM.hasLegs) HUM.ankRest = Math.min(...HUM.legs.map(l => l.end.getWorldPosition(V3()).y));
  HUM.eye = obj.getObjectByName('headfront') || m.head;
  HUM.hand = m.handR || m.lowerArmR;
  if (m.handR) { const ph = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.15, 0.009), new THREE.MeshStandardMaterial({ color: '#2a2a2e', roughness: 0.4 })); ph.visible = false; m.handR.add(ph); const s = 1 / m.handR.getWorldScale(V3()).x; ph.scale.setScalar(s); ph.position.set(0, 0.09 * s, 0.03 * s); HUM.phoneMesh = ph; }
  HUM.root.position.copy(HUM.pos).setY(H(HUM.pos.x, HUM.pos.z)); HUM.root.rotation.y = HUM.yaw; HUM.root.updateMatrixWorld(true);
  HUM.ready = true;
}
function ik2(up, mid, end, T, l1, l2, poleW) {
  const A = up.getWorldPosition(hv[0]), B = mid.getWorldPosition(hv[1]), C = end.getWorldPosition(hv[2]);
  const dv = hv[3].copy(T).sub(A); let d = dv.length(); const dn = dv.divideScalar(d || 1).clone();
  d = clamp(d, Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
  const pole = hv[4].copy(poleW); pole.sub(dn.clone().multiplyScalar(pole.dot(dn))).normalize();
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(l1 * l1 - a * a, 0));
  const Bn = A.clone().addScaledVector(dn, a).addScaledVector(pole, h), Cn = A.clone().addScaledVector(dn, d);
  rotateBoneWorld(up, hq[0].setFromUnitVectors(B.clone().sub(A).normalize(), Bn.sub(A).normalize()));
  mid.getWorldPosition(B); end.getWorldPosition(C);
  rotateBoneWorld(mid, hq[0].setFromUnitVectors(C.clone().sub(B).normalize(), Cn.sub(B).normalize()));
}
function humForward(out = V3()) { return out.set(Math.sin(HUM.yaw), 0, Math.cos(HUM.yaw)); }
function headFwd(out = V3()) {
  const h = HUM.map.head; if (!h || !HUM.headRestQ) return humForward(out);
  h.getWorldQuaternion(hq[1]); hq[1].multiply(hq[2].copy(HUM.headRestQ).invert());
  return out.set(0, 0, 1).applyQuaternion(hq[1]).normalize();
}
function aimBone(bone, child, target, k) {
  if (!bone || !child) return;
  const a = bone.getWorldPosition(hv[5]), c = child.getWorldPosition(hv[6]);
  const cur = c.sub(a).normalize(), want = hv[7].copy(target).sub(a).normalize();
  hq[2].identity().slerp(hq[1].setFromUnitVectors(cur, want), k);
  rotateBoneWorld(bone, hq[2]);
}
function swingBone(bone, axisW, ang) { if (!bone || !ang) return; rotateBoneWorld(bone, hq[2].setFromAxisAngle(axisW, ang)); }

// voice and words
// the fixed lines he says live in human/lines.js (H_LINES)
const NEW_WORDS = [['boop', 'paw'], ['twirl', 'spin'], ['chill', 'down'], ['woof', 'speak'], ['park it', 'sit']];
function humHead(out = V3()) { return HUM.map && HUM.map.head ? HUM.map.head.getWorldPosition(out) : out.copy(HUM.pos).setY(H(HUM.pos.x, HUM.pos.z) + 1.6); }
function humSay(text, dur = 3.5, toDog = false, think = false) {
  if (!text) return;
  // a cognitive aversion starts about 1.3 s before he speaks a considered line; it also hides model latency
  if (think && ON('L.hgaze')) { HUM.thinkUntil = now + 1.4; humLater(1.32, () => humSay(text, dur, toDog, false)); return; }
  HUM.toDog = toDog;
  HUM.line = text; HUM.sayT = dur;
  HUM.lines.unshift(text); HUM.lines.length = Math.min(HUM.lines.length, 7);
  $('humSaid').innerHTML = HUM.lines.map((l, i) => `<div style="opacity:${1 - i * 0.12}">${l.replace(/</g, '&lt;')}</div>`).join('');
  Voice.speak(text, toDog ? 0.11 : 0);
  emitSound(humHead(V3()), 0.45, 'voice');
}
function humCue(word, withName = RNG() < 0.5) {
  const n = $('dogName').value.trim();
  humSay((withName && n ? n + ', ' : '') + word + '.', 2.5, true);
  if (withName && n) brain.named(1);
  SIMQ.after(0.35, () => { $('heard').textContent = 'moheeb: "' + word + '"'; brain.cue(word); });
}
function humanHold(on) {
  if (!ball) return;
  ball.humanHeld = on; HUM.holding = on;
  ball.rb.setBodyType(on ? RAPIER.RigidBodyType.KinematicPositionBased : RAPIER.RigidBodyType.Dynamic, true);
}
function handPos(out = V3()) { return HUM.hand ? HUM.hand.getWorldPosition(out) : out.copy(HUM.pos).setY(H(HUM.pos.x, HUM.pos.z) + 1.0); }
// blocking layers each task may keep across a task change (learned in earlier builds: a held layer can outlive its task); any other held layer is
// released explicitly: a held kneel skips the rest of its hold and plays the stand up (1.3 s), where
// before it played on through the hold window and froze the feet up to 3.9 s
const TASK_LAYERS = { get_ball: ['kneel'], pet: ['kneel', 'crouch'], feed: ['kneel'] };
// read only tap: where the next task comes from (rule, routine, mind, you), set by the caller
let humSrcNext = null;
function startTask(name, args = {}, why = '') {
  const src = humSrcNext || (args.user ? 'you' : 'task'); humSrcNext = null;
  if (src === 'rule') HUM.lastPlan = { at: now, rule: why, choice: name };
  HUM.taskEv = EV.emit({ agent: 'human', kind: 'act', text: name.replace('_', ' ') + (why ? ', ' + why : ''), cause: src === 'rule' && /dog/.test(why) ? brain.evAct || null : src === 'mind' ? HUM.mindEv || null : null });
  HUM.task = { name, t: 0, s: '', args, why };
  HUM.taskSrc = src;
  const A = HA.act; if (A && A.hold && !A.done && A.t < A.hold[1] && !(TASK_LAYERS[name] || []).includes(A.name)) A.t = Math.max(A.t, A.hold[1]);
  HUM.motor.mode = 'stop'; HUM.motor.face = null; HUM.motor.done = false; HUM.reach = null; haRelease();
  // a new task while seated: stand up first (the sit layer blocks the feet until the exit clip ends); a repeat sit just stays down
  if (HA.sit && HA.sit.ph !== 'exit') { if (name === 'sit') { HUM.task.s = 'down'; HUM.task.k = 0; } else haSit(false); }
}

// steering and gait
function humSteer(dt) {
  const m = HUM.motor; let vC = 0, wC = 0;
  if (m.mode === 'goto') {
    // a side waypoint from the stall detector stands in for the goal until he reaches it
    const blocked = !!HA.sit || !!(HA.act && (HA.act.name === 'kneel' || HA.act.name === 'pickup' || HA.act.name === 'crouch') && !HA.act.done);
    const wp = humStallWaypoint(blocked), tgt = wp || m.target;
    const to = hv[0].copy(tgt).sub(HUM.pos); to.y = 0; const dist = to.length();
    if (wp && dist < 0.3) { vC = 0; }
    else if (dist < m.stopDist && !wp) { m.done = true; if (m.face) { const fa = Math.atan2(m.face.x - HUM.pos.x, m.face.z - HUM.pos.z), e = wrapA(fa - HUM.yaw); wC = Math.abs(e) > 0.12 ? clamp(e * 3, -2, 2) : 0; } }
    else {
      m.done = false; const dir = to.divideScalar(dist); const av = V3();
      // his obstacles: everything but his own circle, and the dog unless the dog is his goal
      const obs = OBST.filter(o => o.kind !== 'you').concat(dist2(m.target, dog.pos) > 1.2 ? dogCircles() : []), near = new Set();
      for (const o of obs) {
        const dx = HUM.pos.x - o.x, dz = HUM.pos.z - o.z, dd = Math.hypot(dx, dz) - o.r - 0.3;
        if (dd < 1.5 && Math.hypot(tgt.x - o.x, tgt.z - o.z) > o.r + 0.4) {
          const w = (1 / Math.max(dd, 0.05) - 1 / 1.5) * 0.35; av.x += dx / (dd + o.r + 0.3) * w; av.z += dz / (dd + o.r + 0.3) * w;
          // passing the dog: the side comes from where the dog will be in half a second, and is held for at least 1 s
          let sd = Math.sign(dir.x * dz - dir.z * dx) || 1;
          if (o.kind === 'dog') { const lead = dog.v * 0.5, px = dx - Math.sin(dog.yaw) * lead, pz = dz - Math.cos(dog.yaw) * lead; sd = passSide(PASS.hum, o.key, Math.sign(dir.x * pz - dir.z * px) || 1, now); near.add(o.key); }
          av.x += -dir.z * sd * w * 0.6; av.z += dir.x * sd * w * 0.6;
        }
      }
      for (const k of PASS.hum.keys()) if (!near.has(k)) PASS.hum.delete(k);
      dir.add(av).normalize();
      const e = wrapA(Math.atan2(dir.x, dir.z) - HUM.yaw);
      wC = clamp(e * 3, -2.4, 2.4);
      vC = m.speed * clamp(Math.cos(e) * 1.3, 0, 1) * clamp((dist - m.stopDist) / 0.8 + 0.2, 0, 1);
      if (Math.abs(e) > 1.2) vC = Math.min(vC, 0.2);
    }
  } else if (m.mode === 'face' && m.face) { const fa = Math.atan2(m.face.x - HUM.pos.x, m.face.z - HUM.pos.z), e = wrapA(fa - HUM.yaw); wC = Math.abs(e) > 0.1 ? clamp(e * 3, -2.2, 2.2) : 0; m.done = Math.abs(e) < 0.15; }
  if (HA.act && (HA.act.name === 'kneel' || HA.act.name === 'pickup' || HA.act.name === 'crouch') && !HA.act.done) { vC = 0; wC *= 0.2; }
  if (HA.sit) { vC = 0; wC = 0; }
  if (ON('L.hbody')) {
    // eyes and head go first; the feet leave 120 to 230 ms later (turn studies), so the body waits a beat on a big turn
    if (Math.abs(wC) > 1.2 && Math.abs(HUM.w) < 0.25 && !HUM.turnAt) HUM.turnAt = now + rnd(0.12, 0.23);
    if (Math.abs(wC) < 0.4) HUM.turnAt = 0;
    if (HUM.turnAt && now < HUM.turnAt) wC = 0;
    // walking slows in bends: V = K R^beta with beta about 0.2 for walking (Hicheur 2005), and when he is tired
    if (Math.abs(wC) > 0.05 && vC > 0.2) vC *= Math.min(1, Math.pow(vC / Math.abs(wC) / 2, TV('Hu.beta')));
    vC *= 1 - 0.18 * HUM.mood.tired.x;
    // velocity springs: starts and stops ease in and out (Holden)
    HUM.vs.v = HUM.v; ORG.vspring(HUM.vs, vC, TV('Hu.rootHL'), dt); HUM.v = HUM.vs.v;
    HUM.ws.v = HUM.w; ORG.vspring(HUM.ws, wC, 0.15, dt); HUM.w = HUM.ws.v;
  } else { HUM.v += clamp(vC - HUM.v, -4 * dt, 3 * dt); HUM.w += clamp(wC - HUM.w, -8 * dt, 8 * dt); }
  HUM.yaw = wrapA(HUM.yaw + HUM.w * dt);
  HUM.pos.x += Math.sin(HUM.yaw) * HUM.v * dt; HUM.pos.z += Math.cos(HUM.yaw) * HUM.v * dt;
  for (const o of OBST) { if (o.kind === 'you' || o.kind === 'bench') continue; const dx = HUM.pos.x - o.x, dz = HUM.pos.z - o.z, d = Math.hypot(dx, dz), mm = o.r + 0.28; if (d < mm) { HUM.pos.x = o.x + dx / d * mm; HUM.pos.z = o.z + dz / d * mm; } }
  const r = Math.hypot(HUM.pos.x, HUM.pos.z); if (r > FENCE_R - 0.6) { HUM.pos.x *= (FENCE_R - 0.6) / r; HUM.pos.z *= (FENCE_R - 0.6) / r; }
}
// gaze: saccade sizes from P = 15.7 exp(-A / 6.9) with cardinal directions favoured (Lee, Badler and Badler 2002),
// mutual gaze 75 / 41 / 20 percent listening, talking, thinking (SmartBody), head joins past the eye only range with slope 0.77 (Stahl 1999)
const SAC_BINS = [[270, 0.204], [90, 0.177], [180, 0.168], [0, 0.155], [45, 0.074], [135, 0.074], [225, 0.074], [315, 0.074]];
const THINK_BINS = [[90, 0.34], [270, 0.34], [0, 0.1], [180, 0.1], [45, 0.03], [135, 0.03], [225, 0.03], [315, 0.03]];
function humGaze(dt) {
  const G = HUM.gz || (HUM.gz = { next: 0, aver: null, hy: ORG.S(), hp: ORG.S(), tY: 0, tP: 0, pY: 0, pP: 0, pAt: 0, ey: 0, ep: 0, mode: 'listen', blinkAt: 0, blinks: 0 });
  const eye = humHead(hv[5]).clone(); eye.y += 0.06;
  const want = HUM.look ? HUM.look.clone() : eye.clone().add(V3(Math.sin(HUM.yaw) * 3, -0.6, Math.cos(HUM.yaw) * 3));
  G.mode = Voice.speaking ? 'talk' : HUM.thinking ? 'think' : 'listen';
  if (!ON('L.hgaze')) { G.aver = null; }
  else {
    // aversion episodes (Andrist 2014): speaking 1.96 s every 4.75 s, listening 1.14 s every 7.21 s, thinking 3.54 s mostly upward
    const think = G.mode === 'think' || HUM.thinkUntil > now;
    if (G.av && now > G.av.end) G.av = null;
    if (!G.av && HUM.look && (now > (G.nextAv || 0) || (think && !G.thinkAv))) {
      const dur = think ? ORG.exg(2.6, 0.5, 0.9) : G.mode === 'talk' ? ORG.exg(1.5, 0.3, 0.45) : ORG.exg(0.85, 0.2, 0.3);
      const bins = think ? THINK_BINS : SAC_BINS; let r = RNG() * bins.reduce((x, b) => x + b[1], 0), dir = 0; for (const [d, w] of bins) if ((r -= w) <= 0) { dir = d; break; }
      const A = (think ? rnd(16, 32) : rnd(9, 26)) * Math.PI / 180;
      G.av = { dy: Math.cos(dir * Math.PI / 180) * A, dp: Math.sin(dir * Math.PI / 180) * A * 0.8, end: now + dur }; G.thinkAv = think;
      G.nextAv = now + dur + (G.mode === 'talk' ? ORG.exg(2.3, 0.5, 0.5) : ORG.exg(5.3, 1, 1.0)); if (A > 0.3) G.blinks++;
    }
    if (!think) G.thinkAv = false;
    // small saccades inside a fixation, sizes from P = 15.7 exp(-A/6.9) capped small
    if (now >= G.next) { G.next = now + ORG.exg(G.mode === 'talk' ? 0.42 : 0.7, 0.12, G.mode === 'talk' ? 0.35 : 0.8); const a = Math.min(-6.9 * Math.log(Math.max(RNG(), 1e-3)), 9) * Math.PI / 180 * 0.5, th = RNG() * Math.PI * 2; G.micro = { dy: Math.cos(th) * a, dp: Math.sin(th) * a }; }
    const mc = G.micro || { dy: 0, dp: 0 };
    G.aver = G.av ? { dy: G.av.dy + mc.dy, dp: G.av.dp + mc.dp } : HUM.look ? mc : null;
  }
  const to = want.sub(eye), tyaw = wrapA(Math.atan2(to.x, to.z) - HUM.yaw), tpit = Math.atan2(to.y, Math.hypot(to.x, to.z));
  const gy = clamp(tyaw + (G.aver ? G.aver.dy : 0), -1.6, 1.6), gp = clamp(tpit + (G.aver ? G.aver.dp : 0), -0.9, 0.7);
  const half = TV('Hu.eyeRange') / 2 * Math.PI / 180, k = TV('Hu.headSlope');
  let hy = Math.sign(gy) * Math.max(0, k * (Math.abs(gy) - half)), hp = Math.sign(gp) * Math.max(0, k * (Math.abs(gp) - half * 0.6));
  if (!ON('L.hgaze')) { hy = gy * 0.9; hp = gp * 0.9; }
  if (Math.abs(hy - G.pY) > 0.03 || Math.abs(hp - G.pP) > 0.03) { G.pY = hy; G.pP = hp; G.pAt = now + (ON('L.hgaze') ? rnd(0.02, 0.05) : 0); }
  if (now >= G.pAt) { G.tY = G.pY; G.tP = G.pP; }
  ORG.spring(G.hy, G.tY, TV('Hu.headHL'), dt); ORG.spring(G.hp, G.tP, TV('Hu.headHL'), dt);
  G.ey = clamp(gy - G.hy.x, -half * 1.5, half * 1.5); G.ep = clamp(gp - G.hp.x, -half, half);
  const ya = HUM.yaw + G.hy.x + G.ey, pa = G.hp.x + G.ep;
  HUM.gazeDir.set(Math.sin(ya) * Math.cos(pa), Math.sin(pa), Math.cos(ya) * Math.cos(pa));
  const dh = dog.ready ? headWorld(V3(), V3()).sub(eye).normalize() : V3(0, 0, 1);
  HUM.lookingAtDog = HUM.gazeDir.dot(dh) > Math.cos(0.26);
  // a straight, fast, staring approach reads as a threat to a dog (Animal Cognition 2020)
  if (dog.ready) { const tdg = V3(dog.pos.x - HUM.pos.x, 0, dog.pos.z - HUM.pos.z), dd = tdg.length(), vd = V3(Math.sin(HUM.yaw), 0, Math.cos(HUM.yaw));
    HUM.threat = clamp((HUM.v - 0.5) / 1.2, 0, 1) * ss(0.85, 0.97, vd.dot(tdg.normalize())) * (HUM.lookingAtDog ? 1 : 0.4) * (1 - ss(2, 4, dd)); }
}
// throw: a proximal to distal chain with phase shares from Owens 2024 (stride 37, cocking 14, acceleration 3, deceleration 20, follow 26 percent),
// segment timing and order jittered per throw since real throwers rarely follow the textbook order (Frontiers 2021)
function throwPlan() {
  const e = ON('L.hbody') ? TV('Hu.throw') : 0.6, j = () => ON('L.hbody') ? 1 + ORG.gauss() * 0.07 : 1;
  const sh = [0.373 * j(), 0.143 * j(), 0.032 * j(), 0.195 * j(), 0.258], tot = sh.reduce((a, b) => a + b, 0), T = ON('L.hbody') ? 1.05 / (0.8 + 0.4 * e) : 1;
  let c = 0; const t = sh.map(x => (c += x / tot * T));
  const swap = ON('L.hbody') && RNG() < 0.3;
  return { e, T, ts: t[0], tc: t[1], tr: t[2], td: t[3], lagP: swap ? 0.05 : 0, lagT: swap ? 0 : 0.05, err: ON('L.hbody') ? ORG.gauss() * (0.05 + 0.08 * (1 - e)) : 0, dist: ON('L.hbody') ? 1 + ORG.gauss() * 0.08 : 1 };
}
const keyed = (t, K) => { if (t <= K[0][0]) return K[0][1]; for (let i = 1; i < K.length; i++) if (t <= K[i][0]) { const [t0, a] = K[i - 1], [t1, b] = K[i]; return a + (b - a) * ORG.mj((t - t0) / Math.max(t1 - t0, 1e-3)); } return K[K.length - 1][1]; };
function humPose(dt, t) {
  if (!HUM.map) return;
  const m = HUM.map, body = ON('L.hbody');
  const off = haTick(dt, HUM.v, Voice.speaking, HUM.w);
  const g0 = H(HUM.pos.x, HUM.pos.z);
  HUM.root.position.set(HUM.pos.x, g0, HUM.pos.z); HUM.root.rotation.set(0, HUM.yaw, 0);
  HUM.body.position.set(off.x * HUM.hipH, off.y * HUM.hipH, off.z * HUM.hipH);
  // postural sway: a few mm of pink drift of the hips while he stands, feet stay put by IK
  if (body && HUM.v < 0.2) { const s = TV('Hu.sway') / 1000; HUM.body.position.x += HUM.swX.step(dt) * s; HUM.body.position.z += HUM.swZ.step(dt) * s; }
  HUM.root.updateMatrixWorld(true);
  const lat = V3(Math.cos(HUM.yaw), 0, -Math.sin(HUM.yaw)), up = V3(0, 1, 0), fw = humForward(V3());
  // mood shape (EMOTE): pleased rises and opens, frustration leans in, tiredness sinks
  if (body) {
    const M = HUM.mood; ORG.spring(M.pleased, M.pleasedT || 0, 1.2, dt); ORG.spring(M.frus, M.frusT || 0, 1.2, dt);
    const tired = ON('L.day') ? clamp((CLOCK.h - 18) / 4, 0, 1) * 0.8 + (CLOCK.h < 6 ? 0.8 : 0) : 0; ORG.spring(M.tired, tired, 3, dt);
    M.pleasedT = Math.max(0, (M.pleasedT || 0) - dt * 0.04); M.frusT = Math.max(0, (M.frusT || 0) - dt * 0.05);
    const sp = m.spine; if (sp) swingBone(sp, lat, -0.05 * M.pleased.x + 0.05 * M.frus.x + 0.07 * M.tired.x);
    if (m.neck) swingBone(m.neck, lat, -0.04 * M.pleased.x + 0.08 * M.tired.x);
    // breathing: about 14 a minute, inhale shorter than exhale, each cycle a little different, faster after running
    const rate = TV('Hu.breath') / 60 * (1 + clamp(HUM.exert || 0, 0, 1)) * Math.exp(HUM.brJ.step(dt)); HUM.brPh = frac(HUM.brPh + rate * dt);
    const b = HUM.brPh < 0.4 ? Math.sin(HUM.brPh / 0.4 * Math.PI / 2) : Math.cos((HUM.brPh - 0.4) / 0.6 * Math.PI / 2);
    const ch = m.upperChest || m.chest; if (ch) swingBone(ch, lat, -0.022 * b);
    if (m.shoulderL) swingBone(m.shoulderL, fw, -0.03 * b); if (m.shoulderR) swingBone(m.shoulderR, fw, 0.03 * b);
    HUM.exert = Math.max(0, (HUM.exert || 0) + (HUM.v > 2 ? dt * 0.2 : -dt * 0.03));
  }
  if (Voice.speaking && m.head) swingBone(m.head, lat, 0.05 * Math.sin(t * 7) * Voice.level());
  // throw
  if (HUM.throwT >= 0 && HUM.plan) {
    const p = HUM.plan, tt = HUM.throwT, e = p.e;
    const pel = keyed(tt, [[0, 0], [p.ts, -0.42 * e], [p.tc + p.lagP, 0.25 * e], [p.tr + 0.08, 0.42 * e], [p.T, 0]]);
    const tho = keyed(tt, [[0, 0], [p.ts + 0.03, -0.3 * e], [p.tc + p.lagT, 0.2 * e], [p.tr + 0.1, 0.35 * e], [p.T, 0]]);
    const shd = keyed(tt, [[0, 0], [p.ts, 2.3], [p.tc, 2.6], [p.tr, 4.9], [p.td, 5.8], [p.T, Math.PI * 2]]);
    const elb = keyed(tt, [[0, 0], [p.ts * 0.6, -0.6], [p.tc, -1.25], [p.tr, -0.05], [p.T, 0]]);
    const lean = keyed(tt, [[0, 0], [p.ts, -0.08 * e], [p.tr + 0.1, 0.22 * e], [p.T, 0]]);
    if (m.hips) rotateBoneWorld(m.hips, hq[2].setFromAxisAngle(up, pel));
    if (m.chest) rotateBoneWorld(m.chest, hq[2].setFromAxisAngle(up, tho));
    if (m.spine) swingBone(m.spine, lat, lean);
    const k = 1 - ss(p.T * 0.8, p.T, tt);
    swingBone(m.upperArmR, lat, shd * k + (1 - k) * Math.PI * 2);
    swingBone(m.lowerArmR, lat, elb);
  }
  if (HUM.shakeT > 0) { HUM.shakeT -= dt; if (m.head) rotateBoneWorld(m.head, hq[2].setFromAxisAngle(up, 0.35 * Math.sin(HUM.shakeT * 18) * Math.min(1, HUM.shakeT))); }
  // reach: a minimum jerk weight ramp, so the hand starts and lands softly
  if (HUM.reach && haKneeling()) {
    if (!HUM.reachS || HUM.reachS.p.distanceTo(HUM.reach) > 0.3) HUM.reachS = { p: HUM.reach.clone(), t0: now, d: 0.55 + 0.25 * handPos(V3()).distanceTo(HUM.reach) };
    const w = body ? ORG.mj((now - HUM.reachS.t0) / HUM.reachS.d) : 1;
    aimBone(m.upperArmR, m.lowerArmR, HUM.reach, 0.55 * w); aimBone(m.lowerArmR, m.handR, HUM.reach, 0.5 * w);
    if (HUM.task && HUM.task.name === 'pet') swingBone(m.lowerArmR, lat, 0.2 * w * Math.sin(t * 6));
  } else HUM.reachS = null;
  // pointing: a dynamic gesture, arm swings up to the target, holds, drops
  if (HUM.point) {
    // Peeters 2013: onset 0.53 s, the arm takes 0.83 s, apex at 1.37 s, hold about 1.2 s; retract 0.6 s is an estimate
    const P = HUM.point, pt = now - P.t0, w = ORG.mj((pt - 0.53) / 0.83) * (1 - ORG.mj((pt - 2.56) / 0.6));
    if (w > 0.01) { aimBone(m.upperArmR, m.lowerArmR, P.p, 0.85 * w); aimBone(m.lowerArmR, m.handR, P.p, 0.8 * w); }
    if (!P.fired && pt > 1.37) { P.fired = true; const hd = handPos(V3()); brain.point(P.p, hd.distanceTo(P.p) < 0.7, true); }
    if (pt > 3.3) HUM.point = null;
  }
  if (body) {
    // lean into acceleration and turns: atan2(a, g) and atan2(v w, g), about half spread down the spine
    HUM.lF = HUM.lF || ORG.S(); HUM.lS = HUM.lS || ORG.S();
    ORG.spring(HUM.lF, clamp(Math.atan2(HUM.vs.a || 0, 9.81) * 0.5, -0.15, 0.15), 0.15, dt); ORG.spring(HUM.lS, clamp(Math.atan2(HUM.v * HUM.w, 9.81) * 0.5, -0.12, 0.12), 0.15, dt);
    if (m.spine) { swingBone(m.spine, lat, HUM.lF.x * 0.6); swingBone(m.spine, fw, -HUM.lS.x * 0.6); }
    if (m.chest) { swingBone(m.chest, lat, HUM.lF.x * 0.4); swingBone(m.chest, fw, -HUM.lS.x * 0.4); }
    // the phone: right hand up in front of the chest
    HUM.phW = (HUM.phW || 0) + ((HUM.phoneOn ? 1 : 0) - (HUM.phW || 0)) * (1 - Math.exp(-dt * 6));
    if (HUM.phoneMesh) HUM.phoneMesh.visible = HUM.phW > 0.3;
    if (HUM.phW > 0.01) { const ch = (m.upperChest || m.chest || m.spine).getWorldPosition(V3()), tp = ch.addScaledVector(fw, 0.32).add(V3(0, -0.12, 0)); aimBone(m.upperArmR, m.lowerArmR, tp, 0.7 * HUM.phW); aimBone(m.lowerArmR, m.handR, tp.clone().add(V3(0, 0.1, 0)), 0.8 * HUM.phW); }
    // idle scheduler: a postural change about every 20 s, mostly fidgets and weight shifts (Duarte and Zatsiorsky), face touches about 23 an hour (Kwok 2015)
    const idle = HUM.v < 0.15 && Math.abs(HUM.w) < 0.3 && !HA.act && !HA.sit && HUM.throwT < 0 && !HUM.point && !HUM.phoneOn && !HUM.reach;
    const I = HUM.idle || (HUM.idle = { next: now + ORG.poisson(1 / 20), sh: ORG.S(), shT: 0, faceNext: now + ORG.poisson(23 / 3600), face: null, fid: null });
    if (idle && now > I.next) { I.next = now + ORG.poisson(1 / 20); const r = RNG(); if (r < 0.5) I.fid = { t0: now, d: ORG.exg(1.5, 0.4, 0.8), arm: RNG() < 0.5 ? 'L' : 'R' }; else if (r < 0.85) I.shT = (RNG() < 0.5 ? -1 : 1) * rnd(0.02, 0.04); else I.shT *= 0.5; }
    if (!idle) I.shT = 0;
    ORG.spring(I.sh, I.shT, 0.45, dt); HUM.body.position.x += I.sh.x; if (m.hips) swingBone(m.hips, fw, I.sh.x * 2.2);
    if (I.fid) { const u = (now - I.fid.t0) / I.fid.d; if (u > 1 || !idle) I.fid = null; else { const a = Math.sin(Math.PI * u) * 0.16, ua = I.fid.arm === 'L' ? m.upperArmL : m.upperArmR; swingBone(ua, lat, -a); if (m['shoulder' + I.fid.arm]) swingBone(m['shoulder' + I.fid.arm], fw, (I.fid.arm === 'L' ? -1 : 1) * a * 0.4); } }
    if (idle && now > I.faceNext && !I.face) { I.face = { t0: now, d: ORG.exg(1.2, 0.3, 0.8), arm: RNG() < 0.6 ? 'R' : 'L', mouth: RNG() < 0.44 }; I.faceNext = now + ORG.poisson(23 / 3600); }
    if (I.face) { const u = (now - I.face.t0) / I.face.d, w = ORG.mj(u * 3) * (1 - ORG.mj((u - 0.75) * 4)); if (u > 1 || !idle) I.face = null; else { const hp = humHead(V3()), side = I.face.arm === 'L' ? 1 : -1, fp = hp.addScaledVector(fw, 0.1).addScaledVector(lat, I.face.mouth ? 0 : side * 0.07).add(V3(0, I.face.mouth ? -0.07 : -0.02, 0)); const ua = I.face.arm === 'L' ? m.upperArmL : m.upperArmR, la = I.face.arm === 'L' ? m.lowerArmL : m.lowerArmR, hd = I.face.arm === 'L' ? m.handL : m.handR; aimBone(ua, la, fp, 0.75 * w); aimBone(la, hd, fp, 0.85 * w); } }
    // beat gestures while talking away from the talking clip: strokes at least about 0.87 s apart
    if (Voice.speaking && (HUM.v > 0.3 || HA.act || HA.sit)) { if (!HUM.beat || now > HUM.beat.next) HUM.beat = { t0: now, next: now + ORG.exg(0.95, 0.1, 0.35), arm: HUM.beat && HUM.beat.arm === 'R' ? 'L' : 'R' }; const u = (now - HUM.beat.t0) / 0.32; if (u < 1) swingBone(HUM.beat.arm === 'L' ? m.lowerArmL : m.lowerArmR, lat, -0.28 * Math.sin(Math.PI * u)); }
  }
  // head: the gaze stack decides where it points
  humGaze(dt);
  if (m.head && !(HUM.throwT >= 0 && HUM.throwT < 0.6)) {
    const G = HUM.gz, lim = haKneeling() ? 0.6 : 1.1, yy = clamp(G.hy.x, -lim, lim), pp = clamp(G.hp.x, -0.6, 0.5);
    if (m.neck) { rotateBoneWorld(m.neck, hq[2].setFromAxisAngle(up, yy * 0.4)); swingBone(m.neck, lat, -pp * 0.4); }
    rotateBoneWorld(m.head, hq[2].setFromAxisAngle(up, yy * 0.6)); swingBone(m.head, lat, -pp * 0.6);
  }
  // feet: lock planted feet in the world, follow the terrain, release when the clip lifts them or they stretch too far
  if (HUM.hasLegs && $('ikOn').checked) {
    HUM.root.updateMatrixWorld(true);
    const ank = HUM.legs.map(l => l.end.getWorldPosition(V3()));
    const tg = ank.map((a, i) => {
      const gy = H(a.x, a.z), hLoc = a.y - g0 - HUM.body.position.y * 0 , T = a.clone(); T.y += gy - g0;
      if (body) {
        const planted = (a.y - g0) < HUM.ankRest + 0.035;
        if (planted && !HUM.locks[i]) HUM.locks[i] = T.clone();
        if (HUM.locks[i] && (!planted || HUM.locks[i].distanceTo(T) > 0.28)) HUM.locks[i] = null;
        HUM.lw[i] += ((HUM.locks[i] ? 1 : 0) - HUM.lw[i]) * (1 - Math.exp(-dt * (HUM.locks[i] ? 30 : 14)));
        if (HUM.locks[i]) HUM.lastLock = HUM.locks[i]; const L = HUM.locks[i] || T;
        T.x = lerp(T.x, L.x, HUM.lw[i]); T.z = lerp(T.z, L.z, HUM.lw[i]); T.y = lerp(T.y, L.y, HUM.lw[i]);
      }
      return T;
    });
    const drop = Math.min(0, tg[0].y - ank[0].y, tg[1].y - ank[1].y);
    if (drop < 0) { HUM.body.position.y += drop; HUM.root.updateMatrixWorld(true); }
    HUM.legs.forEach((l, i) => {
      const a = l.end.getWorldPosition(V3()); if (a.distanceTo(tg[i]) < 0.004) return;
      const fq = l.end.getWorldQuaternion(new THREE.Quaternion());
      ik2(l.up, l.mid, l.end, tg[i], l.l1, l.l2, fw);
      setBoneWorldQuat(l.end, fq);
    });
  }
  if (bodies.human) bodies.human.setNextKinematicTranslation({ x: HUM.pos.x, y: g0 + 0.9, z: HUM.pos.z });
  YOU.set(HUM.pos.x, 0, HUM.pos.z);
  const yo = OBST.find(o => o.kind === 'you'); if (yo) { yo.x = HUM.pos.x; yo.z = HUM.pos.z; }
}

// tasks
const pct2 = v => Math.round(v * 100) + '%';
function pickThrowTarget() {
  for (let i = 0; i < 20; i++) {
    const a = HUM.yaw + rnd(-1.0, 1.0), r = rnd(5, 10), x = HUM.pos.x + Math.sin(a) * r, z = HUM.pos.z + Math.cos(a) * r;
    if (Math.hypot(x, z) > FENCE_R - 1.8) continue; if (OBST.some(o => o.kind !== 'you' && Math.hypot(o.x - x, o.z - z) < o.r + 0.8)) continue;
    return V3(x, 0, z);
  }
  const a = Math.atan2(-HUM.pos.x, -HUM.pos.z); return V3(HUM.pos.x + Math.sin(a) * 6, 0, HUM.pos.z + Math.cos(a) * 6);
}
// approach a dog from the side on a curve, slowing down, eyes off its face, then crouch (dog greeting practice)
function sideSpot(dist = 0.85) {
  if (!ON('L.hbody') || !TV('Hu.side')) return V3(dog.pos.x, 0, dog.pos.z);
  const lat = V3(Math.cos(dog.yaw), 0, -Math.sin(dog.yaw)), toH = V3(HUM.pos.x - dog.pos.x, 0, HUM.pos.z - dog.pos.z);
  const s = Math.sign(lat.dot(toH)) || 1, fw = V3(Math.sin(dog.yaw), 0, Math.cos(dog.yaw));
  return V3(dog.pos.x + lat.x * s * dist + fw.x * 0.15, 0, dog.pos.z + lat.z * s * dist + fw.z * 0.15);
}
function approachSpeed(base) { if (!ON('L.hbody')) return base; const d = dist2(HUM.pos, dog.pos); return base * clamp(d / 2.6, 0.38, 1); }
function humPoint(p) { HUM.point = { p: p.clone(), t0: now, fired: false }; HUM.look = p.clone(); }
function humTask(dt) {
  const T = HUM.task; if (!T) return; T.t += dt;
  const m = HUM.motor, dogP = V3(dog.pos.x, 0, dog.pos.z), dogBack = dog.root.position.clone().add(V3(0, 0.42, 0)), dogFace = headWorld(V3(), V3());
  const end = () => { HUM.task = null; HUM.reach = null; m.mode = 'stop'; haRelease(); HUM.phoneOn = false; };
  const kneel = () => { if (!HA.act || HA.act.name !== 'kneel') haAct('kneel'); };
  switch (T.name) {
    case 'watch': m.mode = 'stop'; HUM.look = dogFace; if (T.t > (T.args.dur || 4)) end(); break;
    case 'chat': m.mode = 'face'; m.face = dogP; HUM.look = dogFace; if (!T.s) { T.s = 'said'; humSay(T.args.line || pick(H_LINES.chat), 3.5, false, true); } if (T.t > 5) end(); break;
    case 'wander':
      if (!T.args.to) { const a = rnd(0, Math.PI * 2), r = rnd(1.5, 4); T.args.to = V3(clamp(dog.pos.x + Math.sin(a) * r, -10, 10), 0, clamp(dog.pos.z + Math.cos(a) * r, -10, 10)); }
      m.mode = 'goto'; m.target.copy(T.args.to); m.speed = 1.25; m.stopDist = 0.4; HUM.look = T.t % 6 < 3 ? dogBack : null;
      if (m.done || T.t > 15) end(); break;
    case 'get_ball': {
      if (ball.held) { end(); startTask('watch', { dur: 3 }, 'the dog has the ball'); break; }
      if (HUM.holding) { end(); startTask('throw', {}, 'got the ball'); break; }
      const bp = bodyPos(ball); HUM.look = bp;
      if (T.args.delay && T.t < T.args.delay) { m.mode = 'face'; m.face = bp; HUM.look = T.t < T.args.delay * 0.5 ? dogFace : bp; break; }
      if (!T.k) { m.mode = 'goto'; m.target.copy(bp).setY(0); m.speed = 1.5; m.stopDist = 0.55; m.face = bp; }
      if (T.k || (m.done && T.t > 0.2)) { T.k = 1; m.mode = 'stop'; kneel(); HUM.reach = bp; T.reachT = (T.reachT || 0) + dt; if (haKneeling() && T.reachT > 1.6) { humanHold(true); HUM.reach = null; haRelease(); } }
      if (T.t > 25) end(); break;
    }
    case 'throw': {
      if (!HUM.holding && HUM.throwT < 0) { end(); break; }
      if (!T.args.to) T.args.to = pickThrowTarget();
      const to = T.args.to;
      if (HUM.throwT < 0) {
        m.mode = 'face'; m.face = to; HUM.look = V3(to.x, H(to.x, to.z) + 0.5, to.z);
        if (m.done || T.t > 2.5) { if (!T.args.user || RNG() < 0.6) humSay(pick(H_LINES.throw), 2, true); HUM.plan = throwPlan(); HUM.throwT = 0; HUM.released = false; HUM.throwTo = to.clone(); }
      } else if (HUM.throwT > (HUM.plan ? HUM.plan.T : 1)) end();
      break;
    }
    case 'pet': {
      if (!T.k) { const sp = sideSpot(); m.mode = 'goto'; m.target.copy(sp); m.speed = approachSpeed(1.4); m.stopDist = ON('L.hbody') ? 0.25 : 0.8; m.face = dogP; }
      HUM.look = ON('L.hbody') && !T.k && dist2(HUM.pos, dog.pos) < 2.6 ? dog.root.position.clone().add(V3(0, 0.25, 0)) : dogBack;
      if (T.k || (m.done && T.t > 0.2)) { T.k = 1; m.mode = 'face'; m.face = dogP; if (T.args.crouch) { if (!HA.act || HA.act.name !== 'crouch') haAct('crouch'); } else kneel(); HUM.reach = dogBack; T.petT = (T.petT || 0) + dt; if (T.petT > 0.8 && !T.s) { T.s = 'said'; humSay(pick(H_LINES.pet)); } if (Math.floor(T.petT / 0.9) !== Math.floor((T.petT - dt) / 0.9)) pet(); if (T.petT > 5.5 || dist2(HUM.pos, dog.pos) > 1.6) end(); }
      if (T.t > 20) end(); break;
    }
    case 'feed': {
      const bw = V3(BOWL.x, 0, BOWL.z); if (!T.k) { m.mode = 'goto'; m.target.copy(bw); m.speed = 1.4; m.stopDist = 0.65; m.face = bw; } HUM.look = bw.clone().setY(0.1);
      if (T.k || (m.done && T.t > 0.2)) { T.k = 1; m.mode = 'stop'; kneel(); HUM.reach = V3(BOWL.x, H(BOWL.x, BOWL.z) + 0.15, BOWL.z); T.f = (T.f || 0) + dt; if (T.f > 1.8 && !T.s) { T.s = 'filled'; foodAmt = 1; emitSound(V3(BOWL.x, 0.2, BOWL.z), 0.45, 'kibble'); scentSrc.push({ x: BOWL.x, z: BOWL.z, s: 1.2, t: now }); humSay(pick(H_LINES.feed)); } if (T.f > 3.2) end(); }
      if (T.t > 25) end(); break;
    }
    case 'phone': {
      // head down, hand up, the dog drops out of his attention (mind elsewhere about half the time, Killingsworth and Gilbert 2010)
      m.mode = 'stop'; HUM.phoneOn = true; HUM.look = handPos(V3()).add(humForward(V3()).multiplyScalar(0.15)).add(V3(0, -0.05, 0));
      if (brain.barkT > now - 0.4 && !T.glanced) { T.glanced = true; humLater(humLat(0.38, 0.08, 0.1), () => { if (HUM.task === T) { T.glanceUntil = now + 1.2; } }); }
      if (T.glanceUntil > now) HUM.look = dogFace;
      if (T.t > T.args.dur) { HUM.phoneOn = false; end(); }
      break;
    }
    case 'errand': {
      // out through the gate for a while: the dog waits, then greets him harder the longer he was gone (Rehn and Keeling 2011)
      if (!T.s) { T.s = 'out'; humSay(pick(H_LINES.leave), 2.2, true); }
      if (T.s === 'out') { m.mode = 'goto'; m.target.copy(GATE); m.speed = 1.35; m.stopDist = 0.4; HUM.look = null; if (m.done || T.t > 25) { T.s = 'away'; HUM.away = true; HUM.root.visible = false; HUM.awayT0 = now; HUM.awayDur = T.args.hours * TV('W.dayMin') * 60 / 24 / Math.max(+$('tempo').value, 0.25); } }
      if (T.s === 'away') { m.mode = 'stop'; if (now - HUM.awayT0 > HUM.awayDur) { T.s = 'back'; HUM.away = false; HUM.root.visible = true; brain.reunion(T.args.hours); humSay(pick(H_LINES.back), 2.2, true); emitSound(humHead(V3()), 0.6, 'voice'); } }
      if (T.s === 'back') { m.mode = 'goto'; m.target.copy(SEAT); m.speed = 1.2; m.stopDist = 1.2; HUM.look = dogFace; if (dist2(HUM.pos, dog.pos) < 1.4 && !T.k) { T.k = 1; m.mode = 'stop'; haAct('crouch'); HUM.reach = dogBack; humLater(2.5, () => { if (HUM.task === T) { haRelease(); HUM.reach = null; end(); } }); } if (T.t > 120) end(); }
      break;
    }
    case 'stroll': {
      // a loop of the yard with the dog, about the one walk a day most owners give (Westgarth 2019)
      if (!T.path) { const a0 = Math.atan2(HUM.pos.x, HUM.pos.z), dir = RNG() < 0.5 ? 1 : -1; T.path = Array.from({ length: 7 }, (_, i) => { const a = a0 + dir * (i + 1) * 0.9, r = 9.5 + rnd(-1, 1); return V3(Math.sin(a) * r, 0, Math.cos(a) * r); }); T.i = 0; humCue('come', true); brain.stroll = { on: true }; }
      const wp = T.path[T.i]; m.mode = 'goto'; m.target.copy(wp); m.speed = dist2(HUM.pos, dog.pos) > 5 ? 0.8 : 1.15; m.stopDist = 0.8; HUM.look = T.t % 9 < 3 ? dogFace : null;
      if (m.done) { T.i++; if (T.i >= T.path.length) { brain.stroll = null; end(); } }
      if (T.t > 120) { brain.stroll = null; end(); }
      break;
    }
    case 'sit': {
      // the porch bench: sit down, idle or talk, get up
      if (!T.s) { m.mode = 'goto'; m.target.copy(SEAT); m.speed = 1.2; m.stopDist = 0.25; m.face = null; if (m.done) { T.s = 'turn'; m.done = false; } }
      // back to the bench before sitting: wait until he actually faces away from the backrest, not on a stale done flag from the walk
      else if (T.s === 'turn') { m.mode = 'face'; m.face = V3(SEAT.x, 0, SEAT.z - 5); const e = Math.abs(wrapA(Math.PI - HUM.yaw)), ke = Math.min(1, dt * 5); HUM.pos.x += (SEAT.x - HUM.pos.x) * ke; HUM.pos.z += (SEAT.z - HUM.pos.z) * ke; if (e < 0.12 && Math.abs(HUM.w) < 0.4) { T.s = 'down'; T.k = 0; haSit(true); } if (T.t > 30) { T.s = 'down'; T.k = 0; haSit(true); } }
      if (T.s === 'down') { m.mode = 'stop'; T.k += dt; HUM.look = dist2(HUM.pos, dog.pos) < 8 ? dogFace : null; if (T.k > 3 && RNG() < dt * 0.04) humSay(pick(H_LINES.chat), 3.5); if (T.k > T.args.dur) { haSit(false); T.s = 'up'; T.k = 0; }
        // the dog bringing the ball does not stand him up: he stays seated, says so once, and the ball waits at his feet for after
        else if (brain.cur === 'fetch' && ball && ball.held && dist2(dog.pos, HUM.pos) < 2 && !T.ballSaid) { T.ballSaid = 1; humSay(pick(H_LINES.sitBall), 2.5); } }
      if (T.s === 'up') { m.mode = 'stop'; T.k += dt; if (!HA.sit) end(); }
      if (T.t > 400) { haSit(false); end(); }
      break;
    }
    case 'point': { m.mode = 'face'; m.face = T.args.p; if (!T.s) { T.s = 'pointed'; humPoint(T.args.p); } if (T.s === 'pointed' && T.t > 1.36) { T.s = 'said'; humSay(pick(H_LINES.point), 2, true); } HUM.look = T.t < 1.9 ? T.args.p : T.t < 2.6 ? dogFace : T.args.p; if (T.t > 3.4) end(); break; }
    case 'call': { m.mode = 'face'; m.face = dogP; HUM.look = dogFace; if (!T.s) { T.s = 'called'; humCue('come', true); haAct('interact'); } if (T.t > 2) end(); break; }
    case 'train': {
      const tr = HUM.train, A = T.args;
      HUM.look = dogFace;
      if (!T.s) { T.s = 'intro'; tr.word = A.word; tr.trick = A.trick; tr.tries = 0; tr.ok = 0; humSay(pick(H_LINES.trainStart)); T.k = 0; renderHumTrain(); }
      const dd = dist2(HUM.pos, dog.pos);
      if (T.s === 'intro' && T.t > 2) T.s = 'approach';
      if (T.s === 'approach') { m.mode = 'goto'; m.target.copy(ON('L.hbody') ? sideSpot(1.4) : dogP); m.speed = approachSpeed(1.4); m.stopDist = ON('L.hbody') ? 0.4 : 1.6; m.face = dogP; if (dd > 4 && (!T.lastCall || now - T.lastCall > 6)) { T.lastCall = now; humCue('come', true); } if (dd < 2.6 || T.t > 20) { T.s = 'cue'; T.k = 0; } }
      if (T.s === 'cue') { m.mode = 'face'; m.face = dogP; T.k += dt; if (T.k > 1.0 && brain.cur !== 'sleep') { humCue(A.word); T.cueT = now; T.s = 'judge'; tr.tries++; } }
      if (T.s === 'judge') {
        const trial = brain.trial;
        const ready = trial && trial.t0 >= T.cueT && (trial.done || now - T.cueT > 5.5);
        if (ready || now - T.cueT > 7) {
          if (trial && trial.action === 'ignored' && !T.rep && trial.t0 >= T.cueT) { T.rep = 1; T.cueT = now; humLater(humLat(0.6, 0.1, 0.3), () => humCue(A.word.toUpperCase().slice(0, 1) + A.word.slice(1), false)); break; }
          T.rep = 0;
          const off = brain.offered && brain.offered.a === A.trick && now - brain.offered.t < 4 && brain.offered.t > T.cueT - 1;
          const ok = (trial && trial.t0 >= T.cueT && trial.action === A.trick) || (ON('L.learn') && off);
          // praise lands about 0.62 s after the response and food about 0.98 s (Browne), later when he is tired or distracted
          if (ok) { tr.ok++; HUM.mood.pleasedT = 1; humLater(humLat(0.47, 0.11, 0.15), () => { humSay(pick(H_LINES.praise), 2.2, true); brain.reward(0.8, 'praise'); }); if (RNG() < 0.5) humLater(humLat(0.73, 0.15, 0.25), () => tossTreat(true)); if (RNG() < 0.3) haAct('celebrate'); }
          else if (trial && trial.action !== 'none' && trial.action !== 'ignored') { HUM.mood.frusT = Math.min(1, (HUM.mood.frusT || 0) + 0.35); humLater(humLat(0.5, 0.1, 0.2), () => { humSay(pick(H_LINES.no), 2); brain.reward(-0.5, 'no'); HUM.shakeT = 1.1; }); }
          else humSay(A.word + '. ' + H_LINES.missed, 2);
          tr.hist.unshift({ word: A.word, trick: A.trick, got: trial ? trial.action : 'none', ok }); tr.hist.length = Math.min(tr.hist.length, 8);
          renderHumTrain(); T.s = 'rest'; T.k = 0;
        }
      }
      if (T.s === 'rest') { T.k += dt; if (T.k > 2.6) { if (tr.tries >= A.reps) { humSay(pick(H_LINES.trainDone)); HUM.lastTrain = now; T.s = 'done'; T.k = 0; } else { T.s = dd > 3.5 ? 'approach' : 'cue'; T.k = 0; } } }
      if (T.s === 'done') { T.k += dt; if (T.k > 2) end(); }
      if (T.t > 120) end();
      break;
    }
    default: end();
  }
}
// ---------- the owner as an agent: needs with a daily routine, sampled among the top few options (The Sims), repetition penalty, human latencies ----------
// Measured anchors: one ~30 min walk a day (Westgarth 2019), phone pickups about every 12.6 min awake (dscout, compressed here),
// praise about 0.62 s and food about 0.98 s after the dog responds (Browne), training spaced rather than massed (Meyer and Ladewig 2008, Demant 2011).
const GATE = V3(0, 0, 13.0), SEAT = V3(0, 0, 7.1);
HUM.need = { dog: 0.35, fun: 0.4, rest: 0.15, screen: 0.3, chores: 0.25 };
HUM.later = []; HUM.recent = []; HUM.fetchN = 0; HUM.lastThrowT = -99; HUM.lastPhone = 0; HUM.lastStroll = -1e9; HUM.lastErrand = -1e9; HUM.lastFeedH = -99;
function humLater(d, fn) { HUM.later.push({ at: now + d, fn }); }
const humLat = (mu = 0.45, sg = 0.09, tau = 0.08) => ON('L.hbody') ? ORG.exg(mu, sg, tau * (1 + 2 * HUM.mood.tired.x) + (HUM.task && HUM.task.name === 'phone' ? 0.6 : 0)) : 0.3;
function routine(h) { // weight of each activity by hour of the day (estimates shaped by owner surveys)
  if (!ON('L.day')) return { stroll: 0.15, train: 0.2, phone: 0.2, sit: 0.1, errand: 0.03 };
  const mor = Math.exp(-Math.pow((h - 8) / 1.2, 2)), eve = Math.exp(-Math.pow((h - 18.5) / 1.3, 2)), aft = Math.exp(-Math.pow((h - 15) / 1.5, 2)), night = h >= 20.5 || h < 6.5 ? 1 : 0;
  return { stroll: 0.6 * (mor + eve), train: 0.3 * (1 - night) * (0.4 + aft), phone: 0.25 + 0.2 * night, sit: 0.1 + 0.9 * night + 0.3 * eve, errand: 0.35 * aft };
}
function humNeeds(dt) {
  const gh = dt * +$('tempo').value * 24 / (TV('W.dayMin') * 60), N = HUM.need, T = HUM.task && HUM.task.name;
  N.dog = clamp(N.dog + gh * 0.12 - (T === 'pet' || T === 'stroll' || T === 'throw' || T === 'chat' ? dt * 0.02 : 0), 0, 1);
  N.fun = clamp(N.fun + gh * 0.1 - (T === 'throw' || T === 'train' ? dt * 0.012 : 0), 0, 1);
  N.rest = clamp(N.rest + gh * (CLOCK.h > 18 || CLOCK.h < 6 ? 0.2 : 0.05) + (HUM.v > 1.5 ? dt * 0.01 : 0) - (T === 'sit' ? dt * 0.01 : 0), 0, 1);
  N.screen = clamp(N.screen + dt / 110 - (T === 'phone' ? dt * 0.09 : 0), 0, 1);
  N.chores = clamp(N.chores + gh * 0.06 - (T === 'errand' ? dt * 0.02 : 0), 0, 1);
  if (now - HUM.lastThrowT > 60) HUM.fetchN = 0;
}
function humPlan() {
  const d = brain.d, ballFree = ball && !ball.held && !ball.humanHeld, N = HUM.need, h = CLOCK.h, org = ON('L.organic');
  if (HUM.away) return;
  humSrcNext = 'rule';
  if (HUM.holding) return startTask('throw', {}, 'holding the ball');
  const bp = ball ? bodyPos(ball) : V3();
  if (ON('L.social') && ballFree && brain.cur === 'fetch' && ((brain.search || 0) > 1.5 || now - (brain.lookBackT || -99) < 2) && dist2(bp, HUM.pos) < 12) return startTask('point', { p: bp.clone().setY(H(bp.x, bp.z) + 0.05) }, brain.lookBackT && now - brain.lookBackT < 2 ? 'the dog looked back at him for help' : 'the dog lost the ball, he points at it');
  // the dog drops the ball at his feet: throw again after a short human latency, or end the session when bored
  if (ballFree && dist2(bp, HUM.pos) < 1.8 && bodyVel(ball).length() < 0.4) {
    const keep = !org || RNG() < clamp(0.95 - 0.05 * HUM.fetchN - 0.4 * (1 - N.fun) * (HUM.fetchN > 3 ? 1 : 0), 0.1, 0.95);
    if (keep) return startTask('get_ball', { delay: org ? ORG.exg(0.9, 0.3, 1.2) : 0 }, 'the dog dropped the ball at his feet');
    HUM.fetchN = 0; N.fun = Math.max(0, N.fun - 0.3); return startTask('chat', { line: pick(H_LINES.fetchDone) }, 'fetch got old, ending the session');
  }
  if (org && ON('L.day')) {
    // feeding times anchor the day
    for (const fh of [7.5, 18]) if (h > fh && h < fh + 1.5 && Math.abs(HUM.lastFeedH - fh) > 0.1 && foodAmt < 0.6) { HUM.lastFeedH = fh; return startTask('feed', {}, 'feeding time, ' + (fh < 12 ? 'breakfast' : 'dinner')); }
  }
  if (foodAmt < 0.08 && d.hunger > 0.45) return startTask('feed', {}, 'bowl is empty and the dog is hungry ' + pct2(d.hunger));
  if (ballFree && brain.cur !== 'fetch' && HUM.ballIdle > 14 && RNG() < 0.6 * (0.5 + N.fun)) return startTask('get_ball', {}, 'nobody is fetching, so he goes for it');
  if (!org) {
    const opts = [['train', now - HUM.lastTrain > 90 && brain.cur !== 'sleep' ? 0.25 : 0], ['pet', d.social * 0.4], ['wander', 0.25], ['chat', 0.12], ['watch', 0.18], ['call', dist2(HUM.pos, dog.pos) > 7 ? 0.15 : 0]];
    let tot = opts.reduce((s, o) => s + o[1], 0), r = RNG() * tot, choice = 'watch'; for (const [n, w] of opts) { if ((r -= w) <= 0) { choice = n; break; } }
    HUM.lastPlan = { at: now, U: Object.fromEntries(opts), U0: Object.fromEntries(opts), top: opts.filter(o => o[1] > 0).map(o => o[0]), probs: Object.fromEntries(opts.map(o => [o[0], tot ? o[1] / tot : 0])), choice, routine: null };
    humSrcNext = 'routine'; return startPlain(choice);
  }
  const R = routine(h), dayGap = TV('W.dayMin') * 60 / 24; // real seconds per game hour
  const U = {
    watch: 0.25, chat: 0.12 + 0.2 * N.dog * (brain.lookingAtYou ? 1 : 0.3), wander: 0.15 + 0.2 * N.rest * 0,
    pet: 0.15 + 0.6 * N.dog + 0.3 * d.social, call: dist2(HUM.pos, dog.pos) > 7 ? 0.2 + 0.3 * N.dog : 0,
    train: now - HUM.lastTrain > 2.5 * dayGap && brain.cur !== 'sleep' ? R.train + 0.3 * N.fun : 0,
    phone: now - HUM.lastPhone > 25 ? R.phone + 0.8 * N.screen : 0,
    stroll: now - HUM.lastStroll > 5 * dayGap ? R.stroll + 0.3 * N.dog : 0,
    errand: now - HUM.lastErrand > 10 * dayGap ? R.errand + 0.4 * N.chores : 0,
    sit: R.sit + 0.7 * N.rest,
    greet: brain.cur === 'greet' && dist2(HUM.pos, dog.pos) < 3 ? 0.7 : 0
  };
  const U0 = Object.assign({}, U);
  // repetition penalty: the same thing three times running gets dull
  for (const k in U) { const n = HUM.recent.filter(x => x === k).length; U[k] *= Math.pow(0.55, n); }
  // pick at random among the top three (The Sims), weighted
  const top = Object.entries(U).filter(x => x[1] > 0.01).sort((a, b) => b[1] - a[1]).slice(0, 3); let tot = top.reduce((s, x) => s + x[1], 0), r = RNG() * tot, choice = top[0][0];
  for (const [k, w] of top) { if ((r -= w) <= 0) { choice = k; break; } }
  HUM.lastPlan = { at: now, U: Object.assign({}, U), U0, top: top.map(x => x[0]), probs: Object.fromEntries(top.map(x => [x[0], tot ? x[1] / tot : 0])), choice, routine: R, recent: HUM.recent.slice() };
  humSrcNext = 'routine';
  HUM.recent.unshift(choice); HUM.recent.length = Math.min(HUM.recent.length, 4);
  if (choice === 'greet') return startTask('pet', { crouch: true, greet: true }, 'the dog came over to say hi, he crouches');
  if (choice === 'phone') { HUM.lastPhone = now; return startTask('phone', { dur: ORG.exg(7, 2, 8) }, 'checking his phone'); }
  if (choice === 'stroll') { HUM.lastStroll = now; return startTask('stroll', {}, 'walking the yard with the dog'); }
  if (choice === 'errand') { HUM.lastErrand = now; return startTask('errand', { hours: rnd(0.8, 3) }, 'heading out for a bit'); }
  if (choice === 'sit') return startTask('sit', { dur: ORG.exg(25, 5, 30) * (CLOCK.h > 20 || CLOCK.h < 6 ? 2.5 : 1) }, CLOCK.h > 20 || CLOCK.h < 6 ? 'evening on the porch' : 'taking a seat');
  return startPlain(choice);
}
function startPlain(choice) {
  const d = brain.d;
  if (choice === 'train') { const pair = RNG() < 0.55 ? (w => [w, w])(pick(['sit', 'down', 'spin', 'paw', 'speak'])) : pick(NEW_WORDS); return startTask('train', { word: pair[0], trick: pair[1], reps: 5 }, 'teaching "' + pair[0] + '" to mean ' + pair[1]); }
  return startTask(choice, { dur: rnd(3, 6), crouch: choice === 'pet' && RNG() < 0.5 }, { pet: 'the dog wants company ' + pct2(d.social), wander: 'stretching his legs', chat: 'thinking out loud', watch: 'watching the dog', call: 'the dog wandered off' }[choice]);
}
async function humSnap() {
  if (!HUM.eye) return null;
  const e = HUM.eye.getWorldPosition(V3()), f = headFwd(V3());
  humCam.position.copy(e).addScaledVector(f, 0.08); humCam.lookAt(e.clone().addScaledVector(f, 2)); humCam.updateMatrixWorld();
  HUM.root.visible = false;
  renderer.setRenderTarget(humRT); renderer.render(scene, humCam); renderer.setRenderTarget(null);
  HUM.root.visible = true;
  const px = await renderer.readRenderTargetPixelsAsync(humRT, 0, 0, EW, EH);
  const ctx = humView.getContext('2d'), img = ctx.createImageData(EW, EH), d = img.data, flip = !renderer.backend.isWebGPUBackend, rb = px.length / EH;
  for (let y = 0; y < EH; y++) { const sy = flip ? EH - 1 - y : y; for (let x = 0; x < EW; x++) { const si = sy * rb + x * 4, di = (y * EW + x) * 4; d[di] = srgbLUT[px[si]]; d[di + 1] = srgbLUT[px[si + 1]]; d[di + 2] = srgbLUT[px[si + 2]]; d[di + 3] = 255; } }
  ctx.putImageData(img, 0, 0);
  return humView;
}
// what his mind may answer with: the tool list the prompt inspector shows for his calls
const HUM_DO = ['throw', 'train sit', 'train down', 'train spin', 'train paw', 'train speak', 'train boop', 'pet', 'feed', 'wander', 'watch'];
async function humThink() {
  if (vlm.state !== 'ready' || HUM.thinking) return false;
  HUM.thinking = true; HUM.lastMind = now; $('humMind').textContent = 'thinking';
  const callT = now;
  try {
    const view = await humSnap(); if (!view) throw new Error('no view');
    const d = brain.d, n = $('dogName').value.trim() || 'the dog';
    const best = Object.entries(brain.W).map(([c, row]) => { const [a, w] = Object.entries(row).sort((x, y) => y[1] - x[1])[0]; return [c, a, w]; }).filter(x => x[2] > 0.45).map(x => x[0] + '=' + x[1]).slice(0, 5).join(', ') || 'not much yet';
    const ballSt = ball.held ? n + ' has the ball in its mouth' : ball.humanHeld ? 'you are holding the ball' : 'the ball is on the ground ' + dist2(bodyPos(ball), HUM.pos).toFixed(0) + ' m away';
    const prompt = `You are Moheeb, out in your backyard with your dog ${n}. The picture is what you see right now. You talk to your dog the way people do: a few plain, warm words, like Good boy, Come here, You hungry, Easy. No jokes, no slang, no emoji, no dashes.
${n} is ${brain.cur === 'obey' ? 'doing a trick' : brain.cur}. Hungry ${pct2(d.hunger)}, tired ${pct2(d.fatigue)}, wants to play ${pct2(d.play)}, wants company ${pct2(d.social)}. ${ballSt}. Food bowl is ${foodAmt > 0.1 ? 'not empty' : 'empty'}. Cues it knows: ${best}.
Reply in exactly two lines and nothing else:
SAY: one short thing you say out loud, under 14 words
DO: one of ${HUM_DO.join(', ')}`;
    const r = await vlmAsk(view, prompt, 48, HUM_DO);
    const txt = r.text.trim();
    vlmLog({ t: callT, who: 'human', kind: 'think', prompt, text: txt, ms: r.ms, tokens: r.tokens, ok: true });
    HUM.mindEv = EV.emit({ agent: 'human', kind: 'model', text: 'his mind replied in ' + (r.ms / 1000).toFixed(1) + ' s: ' + txt.replace(/\s+/g, ' ').slice(0, 90) });
    humSrcNext = 'mind';
    const say = ((txt.match(/SAY:\s*(.+)/i) || [])[1] || txt.split('\n')[0] || '').replace(/^["']|["']$/g, '').replace(new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']', 'g'), ',').trim();
    const doL = ((txt.match(/DO:\s*(.+)/i) || [])[1] || '').toLowerCase();
    if (vlm.last) vlm.last.plan = { say, do: doL };
    $('humMind').textContent = 'say: ' + say + '\ndo: ' + (doL || '?') + '  (' + (r.ms / 1000).toFixed(1) + ' s)';
    let started = true;
    const tm = doL.match(/train\s+(\w+)/);
    if (tm) { const w = tm[1], nw = NEW_WORDS.find(x => x[0] === w); const trick = nw ? nw[1] : (ACTIONS.includes(w) ? w : 'sit'); startTask('train', { word: w, trick, reps: 4 }, 'his mind chose to teach "' + w + '"'); }
    else if (/throw/.test(doL)) startTask(HUM.holding ? 'throw' : 'get_ball', {}, 'his mind wants to play fetch');
    else if (/pet/.test(doL)) startTask('pet', {}, 'his mind chose pets');
    else if (/feed/.test(doL)) startTask('feed', {}, 'his mind chose feeding');
    else if (/wander/.test(doL)) startTask('wander', {}, 'his mind chose a walk');
    else if (/watch/.test(doL)) startTask('watch', { dur: 5 }, 'his mind chose to watch');
    else started = false;
    humSrcNext = null;
    if (say) humSay(say.slice(0, 110), 4.5, false, true);
    HUM.thinking = false; return started;
  } catch (e) { console.warn('human mind', e); vlmLog({ t: callT, who: 'human', kind: 'think', prompt: '', text: String(e.message || e), ms: 0, tokens: 0, ok: false }); $('humMind').textContent = 'error: ' + (e.message || e); HUM.thinking = false; return false; }
}
function humTick(dt, t) {
  if (!HUM.ready) return;
  for (let i = HUM.later.length - 1; i >= 0; i--) if (now >= HUM.later[i].at) { const f = HUM.later[i].fn; HUM.later.splice(i, 1); f(); }
  if (ON('L.organic')) humNeeds(dt);
  // a bark gets a reply after about a conversational turn gap (Stivers 2009), when he is not busy
  if (brain.barkT > now - dt * 1.5 && !HUM.away && !Voice.speaking && RNG() < 0.25 && (!HUM.task || ['watch', 'sit', 'wander', 'phone'].includes(HUM.task.name))) humLater(ORG.exg(0.2, 0.05, 0.25), () => humSay(pick(H_LINES.bark), 1.6, true));
  if (ball) { const moving = ball.held || ball.humanHeld || bodyVel(ball).length() > 0.3; HUM.ballIdle = moving ? 0 : HUM.ballIdle + dt; }
  if ($('humAI').checked) {
    if (!HUM.task) { if ($('humMindOn').checked && vlm.state === 'ready' && !HUM.thinking && humMindSched.state(now) === 'ready') { HUM.lastMind = now; humMindSched.run(now, true, humThink).then(ok => { if (!ok && !HUM.task) humPlan(); }); } else if (!HUM.thinking) humPlan(); }
  } else if (!HUM.task || ['wander', 'chat', 'pet', 'feed', 'train', 'get_ball', 'call', 'phone', 'stroll', 'sit', 'errand'].includes(HUM.task.name) && !HUM.task.args.user) { if (HUM.task && HUM.task.name !== 'throw') { HUM.task = null; HUM.phoneOn = false; if (HUM.away) { HUM.away = false; HUM.root.visible = true; } if (HA.sit) haSit(false); } HUM.motor.mode = 'face'; HUM.motor.face = V3(dog.pos.x, 0, dog.pos.z); HUM.look = dog.root.position.clone().add(V3(0, 0.4, 0)); HUM.manualWhy = 'you are driving: buttons and cues act through him'; } else HUM.manualWhy = null;
  humTask(dt);
  humSteer(dt);
  if (HUM.throwT >= 0) {
    HUM.throwT += dt;
    const P = HUM.plan || { tr: 0.43, T: 1, err: 0, dist: 1 };
    if (!HUM.released && HUM.throwT >= P.tr) {
      HUM.released = true; humanHold(false);
      // release timing and effort scatter where it lands
      const from = handPos(V3()), to0 = HUM.throwTo.clone(), dv = to0.clone().sub(HUM.pos).setY(0), ang = P.err, c = Math.cos(ang), sn = Math.sin(ang);
      const to = V3(HUM.pos.x + (dv.x * c + dv.z * sn) * P.dist, 0, HUM.pos.z + (-dv.x * sn + dv.z * c) * P.dist); to.y = H(to.x, to.z) + 0.05;
      const dd = from.distanceTo(to), Tf = 0.55 + dd * 0.07; const v = to.clone().sub(from).divideScalar(Tf); v.y = (to.y - from.y + 0.5 * 9.81 * Tf * Tf) / Tf;
      ball.rb.setTranslation({ x: from.x, y: from.y, z: from.z }, true); ball.rb.setLinvel({ x: v.x, y: v.y, z: v.z }, true); ball.rb.setAngvel({ x: rnd(-8, 8), y: 0, z: rnd(-8, 8) }, true);
      emitSound(from, 0.3, 'throw'); brain.d.play = clamp(brain.d.play + 0.1, 0, 1); brain.a = clamp(brain.a + 0.2, 0, 1);
    }
    if (HUM.throwT > P.T) HUM.throwT = -1;
  }
  humPose(dt, t);
  HUM.sayT -= dt;
}
function renderHumTrain() {
  const tr = HUM.train;
  $('humTrain').innerHTML = `<div class="hb-kv"><span>word</span><span>${tr.word || '-'}</span></div><div class="hb-kv"><span>should mean</span><span>${tr.trick || '-'}</span></div><div class="hb-kv"><span>this session</span><span>${tr.ok} of ${tr.tries}</span></div>` +
    '<div class="lst" style="margin-top:6px">' + tr.hist.map(h => `<div><span>"${h.word}"</span><span>${h.got}</span><span class="${h.ok ? 'vis' : ''}">${h.ok ? 'good' : 'no'}</span></div>`).join('') + '</div>';
}
