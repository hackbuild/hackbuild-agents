// gait tables, order LF RF LH RH (Hildebrand style phase offsets). Pace pairs same side legs, canter is three beat.
const GAITS = [
  { name: 'walk', off: [0.25, 0.75, 0.0, 0.5], duty: 0.64, clr: 0.045 },
  { name: 'pace', off: [0.0, 0.5, 0.0, 0.5], duty: 0.5, clr: 0.055 },
  { name: 'trot', off: [0.0, 0.5, 0.5, 0.0], duty: 0.42, clr: 0.07 },
  { name: 'canter', off: [0.3, 0.55, 0.0, 0.3], duty: 0.38, clr: 0.08 },
  { name: 'gallop', off: [0.62, 0.5, 0.0, 0.12], duty: 0.32, clr: 0.09 }
];
const ikA = V3(), ikB = V3(), ikC = V3(), ikT = V3();
function rotateBoneWorld(bone, qd) {
  bone.getWorldQuaternion(tmpQ[0]); tmpQ[0].premultiply(qd);
  bone.parent.getWorldQuaternion(tmpQ[1]).invert();
  bone.quaternion.copy(tmpQ[1].multiply(tmpQ[0]));
  bone.updateMatrixWorld(true);
}
function setBoneWorldQuat(bone, qw) { bone.parent.getWorldQuaternion(tmpQ[1]).invert(); bone.quaternion.copy(tmpQ[1].multiply(qw)); bone.updateMatrixWorld(true); }
function solveLeg(l, target, endTilt) {
  const qEnd = tmpQ[2].copy(dog.root.quaternion).multiply(endTilt).multiply(dog.pivot.quaternion);
  const paw = tmpV[5].copy(l.pawL).multiplyScalar(dog.S).applyQuaternion(qEnd);
  ikT.copy(target).sub(paw);
  l.up.getWorldPosition(ikA); l.mid.getWorldPosition(ikB); l.end.getWorldPosition(ikC);
  const l1 = l.l1, l2 = l.l2;
  const dv = tmpV[6].copy(ikT).sub(ikA); let d = dv.length();
  const dn = dv.clone().divideScalar(d || 1);
  d = clamp(d, Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
  const pole = tmpV[7].copy(l.pole).applyQuaternion(dog.root.quaternion);
  pole.sub(dn.clone().multiplyScalar(pole.dot(dn))).normalize();
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(l1 * l1 - a * a, 0));
  const Bn = ikA.clone().addScaledVector(dn, a).addScaledVector(pole, h);
  const Cn = ikA.clone().addScaledVector(dn, d);
  rotateBoneWorld(l.up, tmpQ[3].setFromUnitVectors(ikB.clone().sub(ikA).normalize(), Bn.clone().sub(ikA).normalize()));
  l.mid.getWorldPosition(ikB); l.end.getWorldPosition(ikC);
  rotateBoneWorld(l.mid, tmpQ[3].setFromUnitVectors(ikC.clone().sub(ikB).normalize(), Cn.clone().sub(ikB).normalize()));
  setBoneWorldQuat(l.end, qEnd);
}

// ---------- locomotion ----------
const motor = { mode: 'stop', target: V3(), speed: 0, stopDist: 0.3, face: null, turnRate: 0, done: false };
const manualKeys = {};
function steer(dt) {
  let vCmd = 0, wCmd = 0, yTo = null;
  // the network turns about 0.3 s behind its command, so its heading loops run at half gain
  const kW = NG.active ? NG.TURN_GAIN : 1;
  if ($('manual').checked) {
    const k = manualKeys; const run = k.shift ? 4.8 : 1.6;
    vCmd = (k.w || k.arrowup ? run : 0) - (k.s || k.arrowdown ? 0.6 : 0);
    wCmd = ((k.a || k.arrowleft ? 1 : 0) - (k.d || k.arrowright ? 1 : 0)) * (vCmd > 2.5 ? 1.6 : 2.6);
    motor.done = false;
  } else if ((yTo = dogYield(dog.posture.sit + dog.posture.down + dog.posture.bow > 0.35))) {
    // side step out of his path; the brain keeps its goal and takes over when the yield ends
    const err = wrapA(Math.atan2(yTo.x - dog.pos.x, yTo.z - dog.pos.z) - dog.yaw);
    wCmd = clamp(err * 3.2, -3.2, 3.2); vCmd = Math.abs(err) > 1.4 ? 0.3 : 1.1 * clamp(Math.cos(err) * 1.2, 0, 1);
  } else if (motor.mode === 'goto') {
    const to = tmpV[0].copy(motor.target).sub(dog.pos); to.y = 0;
    const dist = to.length(), stopD = NG.active ? Math.max(motor.stopDist, NG.gait.capabilities.minStopDistance) : motor.stopDist; // the network cannot stop on a coin
    if (dist < stopD) { motor.done = true; vCmd = 0; if (motor.face) { const fa = Math.atan2(motor.face.x - dog.pos.x, motor.face.z - dog.pos.z); wCmd = clamp(wrapA(fa - dog.yaw) * 4 * kW, -2.5, 2.5); if (Math.abs(wrapA(fa - dog.yaw)) < 0.12) wCmd = 0; } }
    else {
      motor.done = false;
      const dir = to.divideScalar(dist);
      const avoid = V3();
      for (const o of OBST) {
        if (motor.ignore && motor.ignore === o) continue;
        const dx = dog.pos.x - o.x, dz = dog.pos.z - o.z, dd = Math.hypot(dx, dz) - o.r - 0.3;
        if (dd < 1.6 && Math.hypot(motor.target.x - o.x, motor.target.z - o.z) > o.r + 0.35) {
          const w = (1 / Math.max(dd, 0.05) - 1 / 1.6) * 0.35; avoid.x += dx / (dd + o.r + 0.3) * w; avoid.z += dz / (dd + o.r + 0.3) * w;
          let side = Math.sign(dir.x * dz - dir.z * dx) || 1; if (o.kind === 'you') side = passSide(PASS.dog, o, side, now); avoid.x += -dir.z * side * w * 0.6; avoid.z += dir.x * side * w * 0.6;
        }
      }
      const r = Math.hypot(dog.pos.x, dog.pos.z); if (r > FENCE_R - 1.6) { avoid.x -= dog.pos.x / r * (r - FENCE_R + 1.6) * 1.2; avoid.z -= dog.pos.z / r * (r - FENCE_R + 1.6) * 1.2; }
      dir.add(avoid).normalize();
      const want = Math.atan2(dir.x, dir.z), err = wrapA(want - dog.yaw);
      const wMax = lerp(3.2, 1.6, ss(1.5, 4.5, dog.v));
      wCmd = clamp(err * 3.2 * kW, -wMax, wMax);
      vCmd = motor.speed * clamp(Math.cos(err) * 1.2, 0, 1) * clamp((dist - stopD) / 0.9 + 0.15, 0, 1);
      // the network needs room to stop: its speed is held under a constant deceleration profile
      if (NG.active) vCmd = Math.min(vCmd, Math.sqrt(2 * NG.DECEL * Math.max(dist - stopD, 0)));
      if (Math.abs(err) > 1.4) vCmd = Math.min(vCmd, 0.35);
      if (dist < 1.1 && Math.abs(err) > 0.5) vCmd = Math.min(vCmd, 0.12);
    }
  } else if (motor.mode === 'turn') { wCmd = motor.turnRate; vCmd = 0; }
  else if (motor.mode === 'face' && motor.face) { const fa = Math.atan2(motor.face.x - dog.pos.x, motor.face.z - dog.pos.z); const e = wrapA(fa - dog.yaw); wCmd = Math.abs(e) > 0.15 ? clamp(e * 4 * kW, -2.4, 2.4) : 0; motor.done = Math.abs(e) < 0.15; }
  const postureBusy = dog.posture.sit + dog.posture.down + dog.posture.bow > 0.35;
  if (postureBusy) { vCmd = 0; wCmd *= 0.0; }
  vCmd *= brain ? brain.speedMul() : 1;
  if (ON('L.springs') && dog.org) {
    // speed eases by a critically damped velocity spring, so starts and stops carry momentum
    const s = dog.org.vs; s.v = dog.v; ORG.vspring(s, vCmd, vCmd > dog.v ? 0.32 : 0.22, dt); dog.v = s.v;
    const w = dog.org.ws; w.v = dog.w; ORG.vspring(w, wCmd, 0.12, dt); dog.w = w.v;
  } else {
    const acc = vCmd > dog.v ? 5.5 : 7;
    dog.v += clamp(vCmd - dog.v, -acc * dt, acc * dt);
    dog.w += clamp(wCmd - dog.w, -9 * dt, 9 * dt);
  }
}
function pushOut(p, r0) { // obstacles and fence
  for (const o of OBST) { const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), m = o.r + r0; if (d < m) { p.x = o.x + dx / d * m; p.z = o.z + dz / d * m; } }
  const r = Math.hypot(p.x, p.z); if (r > FENCE_R - 0.5) { p.x *= (FENCE_R - 0.5) / r; p.z *= (FENCE_R - 0.5) / r; }
}
function integrate(dt) {
  dog.yaw = wrapA(dog.yaw + dog.w * dt);
  dog.pos.x += Math.sin(dog.yaw) * dog.v * dt; dog.pos.z += Math.cos(dog.yaw) * dog.v * dt;
  pushOut(dog.pos, 0.24);
}
const footLog = [];
let footTimer = 0;
const prints = new THREE.InstancedMesh(new THREE.CircleGeometry(0.03, 10), new THREE.MeshBasicMaterial({ color: '#a7a184', transparent: true, opacity: 0.55, depthWrite: false }), 240);
prints.count = 0; prints.renderOrder = 1; scene.add(prints); let printI = 0;
function addPrint(p, yaw) { if (!$('prints').checked) return; const o = tmpObj; o.position.set(p.x, H(p.x, p.z) + 0.006, p.z); o.rotation.set(-Math.PI / 2, 0, -yaw); o.scale.set(1, 1.3, 1); o.updateMatrix(); prints.setMatrixAt(printI, o.matrix); printI = (printI + 1) % 240; prints.count = Math.min(prints.count + 1, 240); prints.instanceMatrix.needsUpdate = true; if (typeof trailDeposit === 'function') trailDeposit(p.x, p.z, 0.25, 'dog'); }
const tmpObj = new THREE.Object3D();

// gait mix from the Froude number Fr = v^2 / (g l): dogs walk below about 0.5 and trot up to about 3 (Andrada 2023).
// A 10 percent dead band on Fr gives hysteresis, so the dog does not flicker between gaits near a threshold.
function gaitWeights(v) {
  if (!ON('L.organic')) { const wT = ss(0.9, 1.3, v) * (1 - ss(2.6, 3.2, v)), wG = ss(2.6, 3.2, v), wW = 1 - ss(0.9, 1.3, v); return [wW, 0, wT, 0, wG]; }
  const fr = v * v / (9.81 * dog.legLen);
  if (fr > dog.frEff * 1.1) dog.frEff = fr / 1.1; else if (fr < dog.frEff / 1.1) dog.frEff = fr * 1.1;
  const F = dog.frEff, b = (x, t) => ss(t * 0.85, t * 1.15, x);
  const fP = TV('B.frPace'), fT = TV('B.frTrot'), fC = TV('B.frCanter');
  if (F > fP && !dog.inBand) { dog.inBand = true; dog.paceOn = RNG() < TV('B.paceBias'); } else if (F < fP * 0.7) dog.inBand = false;
  const u1 = b(F, fP), u2 = b(F, fT), u3 = b(F, fC), u4 = b(F, fC * 2.6);
  const mid = u1 * (1 - u3), pace = dog.paceOn ? mid * (1 - u2) : 0;
  return [1 - u1, pace, mid - pace, u3 * (1 - u4), u3 * u4];
}
function gaitUpdate(dt) {
  const v = Math.abs(dog.v);
  dog.gaitW = gaitWeights(v);
  const [wW, wP, wT, wC, wG] = dog.gaitW;
  const f = wW * (1.05 + 0.9 * Math.min(v, 1.2) + Math.abs(dog.w) * 0.25) + wP * (1.6 + 0.35 * v) + wT * (1.8 + 0.3 * v) + wC * (2.0 + 0.15 * v) + wG * (2.3 + 0.12 * v);
  let duty = 0, clr = 0; GAITS.forEach((g, i) => { duty += dog.gaitW[i] * g.duty; clr += dog.gaitW[i] * g.clr; });
  dog.freq = f; dog.duty = duty;
  const activity = clamp((v + Math.abs(dog.w) * 0.25) / 0.06, 0, 1);
  const posed = dog.posture.sit + dog.posture.down + dog.posture.bow + dog.posture.reach;
  if (dog.standing && activity > 0.5 && posed < 0.2) {
    dog.standing = false;
    let worst = 0, wi = 0; dog.legs.forEach((l, i) => { const e = l.foot.distanceTo(nomWorld(l, dog.pos, dog.yaw, tmpV[1])); if (e > worst) { worst = e; wi = i; } });
    const offs = blendOffsets(); dog.phase = frac(duty + 0.01 - offs[wi]);
    dog.legs.forEach((l, i) => { l.ph = frac(dog.phase + offs[i]); l.stance = l.ph < duty; if (!l.stance) { l.lift.copy(l.foot); } l.step = null; });
  } else if (!dog.standing && activity < 0.08) {
    if (dog.legs.every(l => l.stance)) dog.standing = true;
  }
  const offs = blendOffsets();
  if (!dog.standing) {
    dog.phase = frac(dog.phase + f * dt);
    const vw = V3(Math.sin(dog.yaw) * dog.v, 0, Math.cos(dog.yaw) * dog.v);
    dog.legs.forEach((l, i) => {
      const target = frac(dog.phase + offs[i]);
      l.ph = frac(l.ph + f * dt + 4 * dt * wrapH(target - l.ph) / 1);
      const inStance = l.ph < duty;
      if (l.stance && !inStance) { l.stance = false; l.lift.copy(l.foot); }
      if (!l.stance && inStance) { l.stance = true; l.foot.copy(l.land); l.foot.y = H(l.foot.x, l.foot.z) + l.toeH; addPrint(l.foot, dog.yaw); }
      if (!l.stance) {
        const s = clamp((l.ph - duty) / (1 - duty), 0, 1);
        const tr = (1 - s) * (1 - duty) / Math.max(f, 0.5);
        const P = tmpV[2].copy(dog.pos).addScaledVector(vw, tr);
        const Y = dog.yaw + dog.w * tr;
        nomWorld(l, P, Y, l.land); l.land.addScaledVector(vw, duty / Math.max(f, 0.5) * 0.5);
        l.land.y = H(l.land.x, l.land.z) + l.toeH;
        const e = ON('L.springs') ? ORG.mj(s) : s * s * (3 - 2 * s);
        l.foot.x = lerp(l.lift.x, l.land.x, e); l.foot.z = lerp(l.lift.z, l.land.z, e);
        l.foot.y = H(l.foot.x, l.foot.z) + l.toeH + clr * (l.front ? 1.15 : 1) * Math.sin(Math.PI * s) * (0.6 + 0.4 * clamp(v, 0, 1.5));
        l.swingS = s;
      }
    });
  } else {
    const swinging = dog.legs.find(l => l.step);
    dog.legs.forEach(l => {
      const n = nomWorld(l, dog.pos, dog.yaw, tmpV[3]);
      if (l.step) {
        l.step.t += dt / 0.26; const s = clamp(l.step.t, 0, 1), e = ON('L.springs') ? ORG.mj(s) : s * s * (3 - 2 * s);
        l.foot.x = lerp(l.step.a.x, n.x, e); l.foot.z = lerp(l.step.a.z, n.z, e); l.foot.y = H(l.foot.x, l.foot.z) + l.toeH + 0.05 * Math.sin(Math.PI * s);
        l.stance = false; if (s >= 1) { l.step = null; l.stance = true; addPrint(l.foot, dog.yaw); }
      } else if (posed > 0.05) {
        l.foot.lerp(n, 1 - Math.exp(-dt * 5)); l.foot.y = H(l.foot.x, l.foot.z) + l.toeH; l.stance = true;
      } else if (!swinging && l.foot.distanceTo(n) > 0.06) {
        l.step = { t: 0, a: l.foot.clone() };
      } else { l.stance = true; l.foot.y = H(l.foot.x, l.foot.z) + l.toeH; }
    });
  }
  if (!dog.standing) for (const l of dog.legs) if (l.stance) { const n = nomWorld(l, dog.pos, dog.yaw, tmpV[4]); if (Math.hypot(n.x - l.foot.x, n.z - l.foot.z) > 0.55) { l.stance = false; l.ph = duty + 0.01; l.lift.copy(l.foot); } }
  logFeet(dt);
}
function logFeet(dt) { footTimer += dt; if (footTimer > 1 / 30) { footTimer = 0; footLog.push(dog.legs.map(l => l.stance)); if (footLog.length > 120) footLog.shift(); } }
function blendOffsets() {
  const out = [0, 0, 0, 0];
  for (let i = 0; i < 4; i++) { let cx = 0, sy = 0; GAITS.forEach((g, k) => { cx += dog.gaitW[k] * Math.cos(2 * Math.PI * g.off[i]); sy += dog.gaitW[k] * Math.sin(2 * Math.PI * g.off[i]); }); out[i] = frac(Math.atan2(sy, cx) / (2 * Math.PI)); }
  return out;
}
// neural or procedural body this frame: the switch is inertialized, so neither side pops
function nnWanted() { return ON('L.neural') && NG.ready && dog.ready && dog.org && now >= NG.holdUntil && !(dog.postureT.bow > 0.5 || dog.posture.bow > 0.15 || dog.pawLift > 0.02 || (brain && brain.cur === 'shake')); }
function locomotion(dt) {
  // a run still in flight from before (dropped by enter) keeps the body procedural until it lands
  const want = nnWanted() && (NG.active ? NG.healthy() : !NGW.busy);
  if (want && !NG.active) {
    if (!NR.ok) nnRig();
    NG.enter(Math.max(dog.v, 0) / TV('B.nnSpeed'));
    NG.active = true; dog.org.inert.capture(); dog.org.src = 'nn'; nnSeedFeet();
  } else if (!want && NG.active) {
    NG.active = false; dog.org.inert.capture(); dog.org.src = 'cpg'; dog.standing = true; dog.legs.forEach(l => { l.stance = true; l.step = null; });
  }
  if (!NG.active) { integrate(dt); gaitUpdate(dt); return; }
  // the network takes the same motor's speed (in its own meters) and turn rate
  const v = Math.max(dog.v, 0), P = dog.postureT;
  const r = NG.update(dt, v / TV('B.nnSpeed') / NR.s, dog.w, { sit: P.sit, down: P.down });
  const q = V3(r.x, 0, r.z); pushOut(q, 0.24);
  if (q.x !== r.x || q.z !== r.z) NG.follow(q.x - r.x, q.z - r.z);
  dog.pos.x = q.x; dog.pos.z = q.z; dog.yaw = r.yaw;
  dog.standing = NG.speed < 0.1; dog.freq = 0;
  const g = NG.guidance; dog.gaitW = [g === 'Walk' ? 1 : 0, g === 'Pace' ? 1 : 0, g === 'Trot' ? 1 : 0, g === 'Canter' ? 1 : 0, 0];
  logFeet(dt);
}

// one motor state for both sources (@hackbuild/gait MotorState): the network's comes from the
// host's phase estimator (touchdown to touchdown timing of a reference leg), the pattern
// generator's from its own oscillator; diagnostics read this and show the source label
const cpgMotor = { source: 'procedural', phase: 0, duty: 0, strideFrequency: 0, contacts: [true, true, true, true] };
function motorState() {
  if (NG.active) return NG.gait.motorState();
  cpgMotor.phase = dog.legs.length ? dog.legs[0].ph : 0; cpgMotor.duty = dog.duty; cpgMotor.strideFrequency = dog.standing ? 0 : dog.freq;
  dog.legs.forEach((l, i) => { cpgMotor.contacts[i] = l.stance; });
  return cpgMotor;
}
// the gait ring while the network drives: each leg at the motor phase plus its table offset for
// the guidance gait, measured from the reference leg
function nnLegPhases() {
  const m = NG.gait.motorState(), g = GAITS[Math.max(0, dog.gaitW.indexOf(1))], ref = NR.legs.findIndex(x => x.c === 0);
  dog.legs.forEach((l, i) => { l.ph = frac(m.phase + g.off[i] - g.off[ref]); });
  dog.duty = m.duty;
}

// posture parameter sets for the procedural body
const POSES = {
  sit: { pitch: -0.42, drop: 0.175, dz: -0.02, off: { LF: [0, -0.05], RF: [0, -0.05], LH: [0.015, 0.13], RH: [-0.015, 0.13] }, tiltR: -1.0, tiltF: 0 },
  down: { pitch: -0.04, drop: 0.215, dz: 0.0, off: { LF: [0.0, 0.17], RF: [0.0, 0.17], LH: [0.05, 0.17], RH: [-0.05, 0.17] }, tiltR: -1.35, tiltF: -1.2 },
  bow: { pitch: 0.36, drop: 0.02, dz: 0.0, off: { LF: [0.01, 0.13], RF: [-0.01, 0.13], LH: [0, 0], RH: [0, 0] }, tiltR: 0, tiltF: -0.9 },
  reach: { pitch: 0.22, drop: 0.02, dz: 0.0, off: { LF: [0, -0.02], RF: [0, -0.02], LH: [0, 0.02], RH: [0, 0.02] }, tiltR: 0, tiltF: 0 }
};
// tail wag modes: Ren 2022 found wagging moves between about eight stable modes; Quaranta 2007 found right bias toward the owner
const WAG = [
  { n: 'still', amp: 0.05, hz: 0.45, lift: -0.25 }, { n: 'slow wide', amp: 0.5, hz: 0.6 }, { n: 'fast small', amp: 0.2, hz: 1.45 }, { n: 'loose broad', amp: 0.75, hz: 0.95 },
  { n: 'helicopter', amp: 0.55, hz: 1.2, circ: 1 }, { n: 'high stiff', amp: 0.12, hz: 1.7, lift: 0.6 }, { n: 'tucked', amp: 0.05, hz: 1.6, lift: -1.0 }, { n: 'tip flick', amp: 0.28, hz: 1.1, tip: 1 }
];
function wagPick() {
  const v = brain.v, a = brain.a, c = brain.cur, pos = Math.max(v, 0), neg = Math.max(-v, 0);
  const w = [(c === 'sleep' || c === 'rest' ? 2.2 : 0.2) + neg * 0.5 + (a < 0.25 ? 0.6 : 0), 0.6 + pos * 0.6 * (1 - a), 0.25 + a * pos, pos * 1.3 * (a > 0.4 ? 1 : 0.3),
    (c === 'greet' && v > 0.35 ? 2.6 : 0) + (v > 0.7 && a > 0.6 ? 0.8 : 0), (c === 'chase' || brain.d.prey > 0.4 ? 2 : 0) + Math.max(a - 0.6, 0) * neg * 3,
    Math.max(neg - 0.3, 0) * a * 4 + (c === 'appease' ? 2.5 : 0), (c === 'explore' || c === 'sniff' || c === 'investigate' ? 1 : 0.1)];
  let tot = w.reduce((x, y) => x + y, 0), r = RNG() * tot; for (let i = 0; i < w.length; i++) { if ((r -= w[i]) <= 0) return i; } return 1;
}
const tiltQ = new THREE.Quaternion();
let skel = null; const ikMarks = [];
function orgSetup() {
  const S = ORG.S;
  dog.org = {
    post: { sit: S(), down: S(), bow: S(), reach: S() }, hy: S(), hp: S(), hr: S(), ear: [S(), S()], tail: [S(), S(), S()], tailLift: S(-0.3), lean: S(), load: S(), vPrev: 0,
    vs: S(), ws: S(), wag: { mode: 1, until: 0, amp: S(0.3), hz: S(0.6), c: S(0), lift: S(0), circ: S(0), tip: S(0), ph: 0 },
    shake: null, rem: 0, sway: new ORG.Pink(0.6, 5), swayR: new ORG.Pink(0.6, 5), hn1: new ORG.Pink(0.25, 5), hn2: new ORG.Pink(0.25, 5), br: 0, brJ: new ORG.OU(3, 0.12),
    remN: [0, 1, 2, 3].map(() => new ORG.Pink(0.08, 3)),
    inert: new ORG.PoseInert(['hips', 'spine2', 'spine_03', 'chest', 'neck1', 'head', 'tail1', 'tail3', 'tail_03', 'clavicle.L', 'clavicle.R', 'ear.L_01', 'ear.R_01'].map(n => dog.bones[n]), dog.bones['root']),
    src: 'cpg'
  };
  dog.frEff = 0; dog.legLen = (dog.legs[2].hipL.y + dog.legs[0].hipL.y) / 2; NR.ok = false;
}
function startShake() { if (!dog.org || dog.org.shake) return; const hz = 4.5 * Math.pow(TV('B.mass') / 30, -0.22); dog.org.shake = { t: 0, hz, dur: rnd(0.8, 1.3) }; }
function poseDog(dt, t) {
  if (!dog.ready) return;
  const O = dog.org, org = ON('L.organic');
  // posture: critically damped springs carry velocity into and out of a sit or a down
  for (const k in dog.posture) {
    if (ON('L.springs')) { const s = O.post[k]; s.x = dog.posture[k]; dog.posture[k] = clamp(ORG.spring(s, dog.postureT[k], TV('B.postureHL') * (dog.postureT[k] < dog.posture[k] ? 0.75 : 1), dt), -0.05, 1.05); }
    else dog.posture[k] += (dog.postureT[k] - dog.posture[k]) * (1 - Math.exp(-dt * (dog.postureT[k] < dog.posture[k] ? 5 : 3.2)));
  }
  const P = dog.posture, nn = NG.active && NR.ok;
  dog.postureOff = {};
  for (const l of dog.legs) { let x = 0, z = 0; for (const k in POSES) { const o = POSES[k].off[l.id]; x += o[0] * P[k]; z += o[1] * P[k]; } dog.postureOff[l.id] = { x, z }; }
  dog.postureOff.LF.z += dog.pawLift * 0.12;
  resetPose();
  const fl = nomWorld(dog.legs[0], dog.pos, dog.yaw, tmpV[0]).y, fr = nomWorld(dog.legs[1], dog.pos, dog.yaw, tmpV[1]).y, rl = nomWorld(dog.legs[2], dog.pos, dog.yaw, tmpV[2]).y, rr = nomWorld(dog.legs[3], dog.pos, dog.yaw, tmpV[3]).y;
  const ikOn = $('ikOn').checked;
  const front = (fl + fr) / 2, rear = (rl + rr) / 2;
  const tPitch = ikOn ? -Math.atan2(front - rear, dog.frontZ - dog.rearZ) : 0;
  const tRoll = ikOn ? Math.atan2(((fl + rl) - (fr + rr)) / 2, dog.halfW * 2) * 0.6 : 0;
  const ph = dog.phase * Math.PI * 2, gw = dog.gaitW, mov = dog.standing ? 0 : 1;
  // breathing: slower and deeper asleep, fast and shallow when hot, each cycle jittered
  const hot = (dog.heat > 0.4 || (brain.fear || 0) > 0.6) && brain.cur !== 'sleep';
  // sleeping about 14 breaths a minute, awake at rest about 19 (veterinary norms); panting rate is an estimate
  const brHz = hot ? 3.5 : brain.cur === 'sleep' ? 14 / 60 : brain.cur === 'rest' || brain.cur === 'idle' ? 19 / 60 : 0.35 + 0.5 * brain.a;
  O.br += dt * 2 * Math.PI * brHz * (ON('L.noise') ? Math.exp(O.brJ.step(dt)) : 1);
  const breathe = Math.sin(O.br) * (hot ? 0.005 : brain.cur === 'sleep' ? 0.006 : 0.003);
  let pitch = 0, drop = 0, dz = 0, bob = 0;
  const rb = dog.bones['root'];
  if (nn) {
    // the network gives body height, pitch and roll; terrain, breath and the turn bend come from here
    nnApply(dt); nnLegPhases();
    dog.root.position.set(dog.pos.x, ikOn ? rear : H(dog.pos.x, dog.pos.z), dog.pos.z);
    dog.root.rotation.set(0, dog.yaw, 0);
    pitch = tPitch + NR.pitch; drop = NR.drop - breathe;
    dog.bodyPitch = 0;
    rb.position.add(tmpV[4].set(0, -drop, 0).applyQuaternion(QC).divideScalar(dog.S));
    rb.quaternion.premultiply(dq(pitch, 0, tRoll + NR.roll));
    const bend = clamp(dog.w * 0.09, -0.22, 0.22);
    dog.bones['spine2'].quaternion.premultiply(dq(0, bend * 0.6, 0));
    dog.bones['spine_03'].quaternion.premultiply(dq(breathe * 2, bend, 0));
    dog.bones['chest'].quaternion.premultiply(dq(0, bend * 0.6, 0));
  } else {
    dog.root.position.set(dog.pos.x, ikOn ? rear : H(dog.pos.x, dog.pos.z), dog.pos.z);
    dog.root.rotation.set(0, dog.yaw, 0);
    // gait body motion: walk sways, pace rolls side to side, trot bobs twice a stride, canter and gallop rock
    bob = mov * (gw[0] * 0.006 * Math.cos(2 * ph) + gw[1] * -0.008 * Math.cos(2 * ph) + gw[2] * -0.014 * Math.cos(2 * ph) + gw[3] * 0.02 * Math.sin(ph) + gw[4] * 0.03 * Math.sin(ph));
    const gPitch = mov * (gw[3] * 0.08 + gw[4] * 0.11) * Math.sin(ph + 0.6);
    let gRoll = mov * (gw[0] * 0.035 + gw[1] * 0.07) * Math.sin(ph);
    pitch = tPitch + gPitch; drop = -bob - breathe - dog.hop;
    for (const k in POSES) { pitch += POSES[k].pitch * P[k]; drop += POSES[k].drop * P[k]; dz += POSES[k].dz * P[k]; }
    const mood = brain ? brain.v : 0; drop += clamp(-mood, 0, 1) * 0.02;
    let roll = tRoll + gRoll;
    if (ON('L.secondary')) {
      // lean into turns by the centripetal angle, chest rises under acceleration and dips under braking
      ORG.spring(O.lean, Math.atan(dog.v * dog.w / 9.81) * TV('B.lean'), 0.12, dt); roll -= O.lean.x;
      const acc = (dog.v - O.vPrev) / Math.max(dt, 1e-3); O.vPrev = dog.v; ORG.spring(O.load, clamp(-acc * TV('B.loadShift'), -0.12, 0.12), 0.1, dt); pitch += O.load.x;
      if (dog.standing && P.sit + P.down < 0.3 && ON('L.noise')) { drop += O.sway.step(dt) * 0.003; roll += O.swayR.step(dt) * 0.012; }
    }
    dog.bodyPitch = pitch;
    rb.position.add(tmpV[4].set(0, -drop, dz).applyQuaternion(QC).divideScalar(dog.S));
    rb.quaternion.premultiply(dq(pitch, 0, roll));
    const bend = clamp(dog.w * 0.09, -0.22, 0.22);
    const flex = mov * (gw[4] * 0.16 + gw[3] * 0.08) * Math.sin(ph + 1.4);
    dog.bones['spine2'].quaternion.premultiply(dq(flex * 0.5, bend * 0.6, 0));
    dog.bones['spine_03'].quaternion.premultiply(dq(flex * 0.5 + breathe * 2, bend, 0));
    dog.bones['chest'].quaternion.premultiply(dq(-flex * 0.3, bend * 0.6, 0));
  }
  // shake off: a near harmonic twist wave, head to tail, about 4.5 Hz for a Labrador scaled by mass^-0.22 (Dickerson 2012)
  if (O.shake) {
    const S = O.shake; S.t += dt; const cyc = S.t * S.hz, env = ss(0, 2, cyc) * (1 - ss(S.dur * S.hz - 2, S.dur * S.hz, cyc)), w = 2 * Math.PI * S.hz * S.t;
    const seg = [['head', 0.32, 0], ['neck1', 0.28, 0.35], ['chest', 0.22, 0.8], ['spine_03', 0.16, 1.3], ['spine2', 0.12, 1.8], ['tail1', 0.25, 2.4]];
    for (const [n, a, lag] of seg) if (dog.bones[n]) dog.bones[n].quaternion.premultiply(dq(0, n === 'head' ? a * 0.6 * env * Math.sin(w - lag) : 0, a * env * Math.sin(w - lag)));
    if (S.t > S.dur) O.shake = null;
  }
  // tail
  const ar = brain ? brain.a : 0.3, val = brain ? brain.v : 0.2;
  const sleeping = brain && brain.cur === 'sleep';
  if (ON('L.secondary')) {
    const W = O.wag;
    if (now > W.until) { W.mode = wagPick(); W.until = now + ORG.exg(1.2, 0.3, 1.8); }
    const m = WAG[W.mode], hl = 0.25;
    // lateral bias: right toward the owner it likes, left toward a threat
    const bias = (percepts.you && percepts.you.vis ? 0.1 * Math.max(val, 0) * (0.5 + (brain.bond || 0.5)) : 0) - 0.12 * Math.max(-val - 0.2, 0);
    const fz = clamp((1.5 + 3.5 * ar) * m.hz * TV('B.wagHz'), 0.8, 5); ORG.spring(W.amp, m.amp * (sleeping ? 0.3 : 1) * clamp(1.8 / fz, 0.45, 1.4) * (1 + 0.6 * (brain.reunionI || 0)), hl, dt); ORG.spring(W.hz, fz, hl, dt); ORG.spring(W.c, bias, 0.4, dt);
    ORG.spring(W.lift, (m.lift || 0) + clamp(-0.25 - 0.5 * val - 0.2 * ar, -0.95, 0.55) + P.sit * 0.5 + P.down * 0.4, 0.3, dt); ORG.spring(W.circ, m.circ || 0, hl, dt); ORG.spring(W.tip, m.tip || 0, hl, dt);
    W.ph += dt * 2 * Math.PI * W.hz.x;
    const drive = W.c.x + W.amp.x * Math.sin(W.ph) * (1 - 0.7 * W.tip.x) - dog.w * 0.12;
    const thl = TV('B.tailHL'), T = O.tail;
    ORG.spring(T[0], drive, thl, dt); ORG.spring(T[1], T[0].x + W.tip.x * W.amp.x * 0.6 * Math.sin(W.ph * 1.6), thl * 1.5, dt); ORG.spring(T[2], T[1].x + W.tip.x * W.amp.x * Math.sin(W.ph * 1.6 + 0.8), thl * 2.1, dt);
    const circ = W.circ.x * W.amp.x * 0.5 * Math.cos(W.ph), lift = W.lift.x + (nn ? 0 : mov * gw[4] * 0.2);
    dog.bones['tail1'].quaternion.premultiply(dq(lift + circ, T[0].x * 0.6, 0));
    dog.bones['tail3'].quaternion.premultiply(dq(0.15, T[1].x * 0.45, 0));
    dog.bones['tail_03'].quaternion.premultiply(dq(0.15, T[2].x * 0.45, 0));
  } else {
    const wagAmp = clamp(0.15 + 0.75 * Math.max(val, 0) * (0.5 + ar), 0.05, 0.95) * (sleeping ? 0.1 : 1);
    dog.tailPhase += dt * (1.5 + 6 * ar) * Math.PI * 2;
    const lift = clamp(-0.25 - 0.5 * val - 0.2 * ar, -0.95, 0.55) + P.sit * 0.5 + P.down * 0.4;
    dog.bones['tail1'].quaternion.premultiply(dq(lift + mov * gw[4] * 0.2, Math.sin(dog.tailPhase) * wagAmp * 0.6, 0));
    dog.bones['tail3'].quaternion.premultiply(dq(0.15, Math.sin(dog.tailPhase - 0.9) * wagAmp * 0.5, 0));
    dog.bones['tail_03'].quaternion.premultiply(dq(0.15, Math.sin(dog.tailPhase - 1.8) * wagAmp * 0.5, 0));
  }
  // head gaze: springs toward the look target, with slow pink drift so a still dog never freezes
  const hd = dog.head;
  if (ON('L.springs')) {
    const hl = TV('B.headHL') * (brain.startle > 0 ? 0.5 : 1), drift = ON('L.noise') && !sleeping ? 0.035 : 0;
    hd.yaw = ORG.spring(O.hy, hd.tYaw + O.hn1.step(dt) * drift, hl, dt);
    hd.pitch = ORG.spring(O.hp, hd.tPitch - (nn ? 0 : pitch * TV('B.stabilize')) + O.hn2.step(dt) * drift * 0.7, hl, dt);
    hd.roll = ORG.spring(O.hr, hd.tRoll, hl * 2, dt);
  } else {
    const k = 1 - Math.exp(-dt * 7);
    hd.yaw += (hd.tYaw - hd.yaw) * k; hd.pitch += (hd.tPitch - pitch * 0.85 - hd.pitch) * k; hd.roll += (hd.tRoll - hd.roll) * (1 - Math.exp(-dt * 4));
  }
  const hp = clamp(hd.pitch, -1.0, 1.25);
  if (ON('L.organic')) {
    // gaze in world space: yaw about the vertical, pitch about the horizontal lateral axis, so no roll leaks in from a pitched neck
    dog.root.updateMatrixWorld(true);
    const nk = dog.bones['neck1'], hb = dog.bones['head'], upW = tmpV[6].set(0, 1, 0), q = tmpQ[3];
    const y1 = dog.yaw + hd.yaw * 0.5, y2 = dog.yaw + hd.yaw;
    rotateBoneWorld(nk, q.setFromAxisAngle(upW, hd.yaw * 0.5)); rotateBoneWorld(nk, q.setFromAxisAngle(V3(Math.cos(y1), 0, -Math.sin(y1)), hp * 0.45));
    rotateBoneWorld(hb, q.setFromAxisAngle(upW, hd.yaw * 0.5)); rotateBoneWorld(hb, q.setFromAxisAngle(V3(Math.cos(y2), 0, -Math.sin(y2)), hp * 0.55));
    if (Math.abs(hd.roll) > 1e-3) rotateBoneWorld(hb, q.setFromAxisAngle(V3(Math.sin(y2), 0, Math.cos(y2)), hd.roll));
  } else {
    dog.bones['neck1'].quaternion.premultiply(dq(hp * 0.45, hd.yaw * 0.5, 0));
    dog.bones['head'].quaternion.premultiply(dq(hp * 0.55, hd.yaw * 0.5, hd.roll));
  }
  // ears: a spring per ear, kicked by head motion, perked by arousal, flapped by the shake
  const perk = clamp(dog.earPerk, -1, 1);
  if (ON('L.secondary')) {
    const kick = -O.hy.v * 0.09, flapL = O.shake ? 0.5 * Math.sin(2 * Math.PI * O.shake.hz * O.shake.t - 0.4) : 0;
    const gallop = nn ? (NG.guidance === 'Canter' || NG.guidance === 'Trot' ? 0.12 * Math.sin(t * 13) : 0) : mov * Math.sin(ph * 2) * 0.12;
    // DogFACS: ears adductor marks positive anticipation; ears flattener and downward go with frustration and fear (Bremhorst, Caeiro 2017)
    const ant = brain.antic || 0, neg = Math.max(brain.frus || 0, brain.fear || 0);
    O.add = (O.add || 0) + ((ant - neg * 0.5) - (O.add || 0)) * (1 - Math.exp(-dt * 6));
    ORG.spring(O.ear[0], perk * 0.45 - neg * 0.5 + kick + flapL + gallop, TV('B.earHL'), dt); ORG.spring(O.ear[1], perk * 0.45 - neg * 0.5 - kick - flapL + gallop, TV('B.earHL'), dt);
    if (O.rem > 0.1 && RNG() < dt * 2) O.ear[RNG() < 0.5 ? 0 : 1].v += rnd(-6, 6);
    if (dog.bones['ear.L_01']) dog.bones['ear.L_01'].quaternion.premultiply(dq(-perk * 0.2 - O.add * 0.35 + neg * 0.25, O.add * 0.25, O.ear[0].x));
    if (dog.bones['ear.R_01']) dog.bones['ear.R_01'].quaternion.premultiply(dq(-perk * 0.2 - O.add * 0.35 + neg * 0.25, -O.add * 0.25, -O.ear[1].x));
  } else {
    const flop = Math.sin(t * 9) * 0.06 * (dog.standing ? 0.2 : 1) + (dog.standing ? 0 : Math.sin(ph * 2) * 0.12);
    if (dog.bones['ear.L_01']) dog.bones['ear.L_01'].quaternion.premultiply(dq(-perk * 0.2, 0, perk * 0.45 + flop));
    if (dog.bones['ear.R_01']) dog.bones['ear.R_01'].quaternion.premultiply(dq(-perk * 0.2, 0, -perk * 0.45 - flop));
  }
  dog.root.updateMatrixWorld(true);
  // inertialization: at a switch the old pose decays into the new one instead of snapping
  O.inert.apply(dt, TV('B.inertHL'), ON('L.inert'));
  dog.root.updateMatrixWorld(true);
  // legs
  if (ikOn) {
    dog.legs.forEach((l, i) => {
      if (nn) nnPawTilt(i, tiltQ);
      else { let tilt = 0; for (const kk in POSES) tilt += (l.front ? POSES[kk].tiltF : POSES[kk].tiltR) * P[kk]; if (l.id === 'LF') tilt -= dog.pawLift * 1.4; tiltQ.setFromEuler(dqE.set(tilt, 0, 0, 'YXZ')); }
      const tgt = l.foot.clone(); if (l.id === 'LF' && dog.pawLift > 0.01) tgt.y += dog.pawLift * 0.16;
      // dreaming: paws paddle during REM
      if (O.rem > 0.02) { const n = O.remN[i].step(dt); tgt.x += Math.sin(dog.yaw) * n * 0.03 * O.rem; tgt.z += Math.cos(dog.yaw) * n * 0.03 * O.rem; }
      solveLeg(l, tgt, tiltQ);
    });
  }
  if (dog.tongue) { const lick = brain.lickUntil > now; dog.tongue.visible = (hot || lick) && brain && brain.cur !== 'sleep' && !(ball && ball.held); }
  const xr = $('xray').checked;
  if (xr && !skel) { skel = new THREE.SkeletonHelper(dog.pivot); scene.add(skel); for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), new THREE.MeshBasicMaterial({ color: '#FE0386', depthTest: false })); m.renderOrder = 3; scene.add(m); ikMarks.push(m); } }
  if (skel) skel.visible = xr;
  ikMarks.forEach((m, i) => { m.visible = xr; if (xr) { m.position.copy(dog.legs[i].foot); m.material.color.set(dog.legs[i].stance ? '#1a1a1a' : '#FE0386'); } });
  if (dog.mat) { const want = xr ? 0.35 : 1; if ((dog.mat.opacity !== want)) { dog.mat.transparent = xr; dog.mat.opacity = want; dog.mat.depthWrite = !xr; dog.mat.needsUpdate = true; } }
  if (bodies.dog) { const c = tmpV[5].set(0, 0.33 - drop * 0.8, 0.02).applyQuaternion(dog.root.quaternion).add(dog.root.position); bodies.dog.setNextKinematicTranslation({ x: c.x, y: c.y, z: c.z }); const q = dog.root.quaternion; bodies.dog.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w }); }
}
