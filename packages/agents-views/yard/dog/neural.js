// ---------- neural gait: @hackbuild/motion-net drives the dog rig ----------
// The network and its gait host are @hackbuild/motion-net (MIT). The host is a gait
// LocomotionBackend: speed and turn rate in, root motion, 27 bone positions, paw contacts and a
// MotorState out. This file maps that onto the dog rig: paw targets for the rig's leg solver,
// body height, pitch and roll from the network's spine, and the switch rules. The weights
// (CC-BY-NC-4.0) are fetched at run time from one pinned URL, checked by SHA-256, never bundled.
//
// Bone map, network (HMN.BONES index) to rig (setup.js LEGDEF and NEED):
//   LeftHandSite 10, LeftHand 9     -> LF  frontHorselink.L, frontToe.L   (paw target, paw tilt)
//   RightHandSite 15, RightHand 14  -> RF  frontHorselink.R, frontToe.R
//   LeftFootSite 19, LeftFoot 18    -> LH  rearHorselink.L, rearFoot.L, rearToe.L
//   RightFootSite 23, RightFoot 22  -> RH  rearHorselink.R, rearFoot.R, rearToe.R
//   Hips 0, Neck 3                  -> root bone height and pitch
//   LeftArm 7, RightArm 12, LeftUpLeg 16, RightUpLeg 20 -> body roll; with the paw sites, the
//                                      network leg length that sets the scale
// The upper and lower limb bones are solved by the rig's own two bone IK (body.js solveLeg), so
// the rig keeps its proportions; head, ears and tail stay with the app's secondary motion.
// Paw contact order is the rig's leg order: front left, front right, hind left, hind right.

const NN_PAW = [{ site: 10, paw: 9 }, { site: 15, paw: 14 }, { site: 19, paw: 18 }, { site: 23, paw: 22 }];
const NN_HIPS = 0, NN_NECK = 3, NN_SHOULDERS = [7, 12], NN_UPLEGS = [16, 20];
// a run still in flight keeps a fresh switch to the network waiting until it lands
const NGW = { busy: false };
// the retarget: scale (rig meters per network meter), rest pose readings, the offset between the
// host's ground plane and the world, the blend of paw targets after a switch
const NR = { ok: false, s: 1, pitch: 0, drop: 0, roll: 0, legs: [0, 1, 2, 3].map(c => ({ c })), rest: null, ox: 0, oz: 0, blend: 1, from: [V3(), V3(), V3(), V3()], cw: [0, 1, 2, 3].map(() => ({ x: 0, z: 0, set: false })), wasStance: [true, true, true, true] };

// local (host root frame) reading of one bone: x to the dog's left, y up, z forward
function nnLocal(b, out) {
  const g = NG.gait, P = g.positions, r = g.root, c = Math.cos(r.yaw), s = Math.sin(r.yaw);
  const dx = P[b * 3] - r.x, dz = P[b * 3 + 2] - r.z;
  out[0] = c * dx - s * dz; out[1] = P[b * 3 + 1]; out[2] = s * dx + c * dz; return out;
}
const nnA = [0, 0, 0], nnB = [0, 0, 0];
const nnPitchOf = (h, n) => Math.atan2(n[1] - h[1], n[2] - h[2]);
const nnRollOf = (l, r) => Math.atan2(l[1] - r[1], Math.max(l[0] - r[0], 0.02));

// rest pose, computed here from the Idle style pose the weights carry (81 values, network frame,
// x to the dog's right): mirrored into the host frame, left and right averaged so the rig's
// stance stays symmetric
function nnRestPose() {
  const st = NG.styles.Idle, at = b => [-st[b * 3], st[b * 3 + 1], st[b * 3 + 2]];
  const sym = (a, b) => { const A = at(a), B = at(b), x = (A[0] - B[0]) / 2, y = (A[1] + B[1]) / 2, z = (A[2] + B[2]) / 2; return [[x, y, z], [-x, y, z]]; };
  const fr = sym(10, 15), hr = sym(19, 23), fp = sym(9, 14), hp = sym(18, 22);
  const sites = [fr[0], fr[1], hr[0], hr[1]], paws = [fp[0], fp[1], hp[0], hp[1]];
  const hips = at(NN_HIPS), neck = at(NN_NECK);
  const ls = at(NN_SHOULDERS[0]), rs = at(NN_SHOULDERS[1]), lh = at(NN_UPLEGS[0]), rh = at(NN_UPLEGS[1]);
  // leg length: shoulder and hip joint heights over the paw sites, as the rig measures its own
  const ground = sites.reduce((a, p) => a + p[1], 0) / 4;
  const legLen = (ls[1] + rs[1] + lh[1] + rh[1]) / 4 - ground;
  const tilt = sites.map((p, i) => Math.atan2(p[1] - paws[i][1], p[2] - paws[i][2]));
  const roll = (nnRollOf(ls, rs) + nnRollOf(lh, rh)) / 2;
  return { sites, paws, ground, legLen, hipsY: hips[1], pitch: nnPitchOf(hips, neck), roll, tilt };
}
function nnRig() {
  if (!NG.styles || !dog.ready) return;
  NR.rest = nnRestPose();
  NR.s = dog.legLen / NR.rest.legLen;
  NR.ok = true;
}
// a switch to the network: paw targets ease from where the pattern generator left them
function nnSeedFeet() {
  dog.legs.forEach((l, i) => { NR.from[i].copy(l.foot); NR.wasStance[i] = l.stance; NR.cw[i].set = false; });
  NR.blend = 0;
}

// body and paw targets from the host's pose, called by poseDog before the rig is posed
function nnApply(dt) {
  if (!NG.gait || !NR.ok) return;
  const R = NR.rest, s = NR.s, g = NG.gait;
  // body: hips height, pitch along hips to neck, roll across the shoulders and hips
  const hips = nnLocal(NN_HIPS, nnA), hy = hips[1], hz = hips[2];
  const neck = nnLocal(NN_NECK, nnB);
  NR.drop = clamp((R.hipsY - hy) * s, -0.08, 0.3);
  NR.pitch = clamp(-(nnPitchOf([0, hy, hz], neck) - R.pitch), -0.6, 0.6);
  const ls = nnLocal(NN_SHOULDERS[0], [0, 0, 0]), rs = nnLocal(NN_SHOULDERS[1], [0, 0, 0]);
  const lh = nnLocal(NN_UPLEGS[0], [0, 0, 0]), rh = nnLocal(NN_UPLEGS[1], [0, 0, 0]);
  NR.roll = clamp((nnRollOf(ls, rs) + nnRollOf(lh, rh)) / 2 - R.roll, -0.3, 0.3);
  // paws: the network's paw site, scaled, plus the offset from its rest site to the rig's nominal
  // foot. The offset is fixed to the body, but a paw in stance keeps the world offset it landed
  // with, so a turning body does not drag a planted paw; in swing it eases back to the body's
  NR.blend = Math.min(1, NR.blend + dt / 0.25);
  const e = ON('L.springs') ? ORG.mj(NR.blend) : NR.blend;
  const c = Math.cos(dog.yaw), sn = Math.sin(dog.yaw), k = 1 - Math.exp(-dt / 0.05);
  const P = g.positions;
  dog.legs.forEach((l, i) => {
    const b = NN_PAW[i].site, p = nnLocal(b, nnA), r0 = R.sites[i];
    const ox = l.nom.x - r0[0] * s, oz = l.nom.z - r0[2] * s, cw = NR.cw[i];
    const tx = c * ox + sn * oz, tz = -sn * ox + c * oz;
    if (!g.paws[i].stance || NR.blend < 1 || !cw.set) { cw.x += (tx - cw.x) * (cw.set ? k : 1); cw.z += (tz - cw.z) * (cw.set ? k : 1); cw.set = true; }
    const wx = NR.s * P[b * 3] + NR.ox + cw.x, wz = NR.s * P[b * 3 + 2] + NR.oz + cw.z;
    const wy = H(wx, wz) + l.toeH + Math.max(0, (p[1] - r0[1]) * s);
    if (e < 1) l.foot.set(lerp(NR.from[i].x, wx, e), lerp(NR.from[i].y, wy, e), lerp(NR.from[i].z, wz, e));
    else l.foot.set(wx, wy, wz);
    const st = g.paws[i].stance;
    if (st && !NR.wasStance[i]) addPrint(l.foot, dog.yaw);
    NR.wasStance[i] = st; l.stance = st; l.step = null;
  });
}
// paw tilt about the paw's side axis: the network's paw to site angle against its rest angle
function nnPawTilt(i, q) {
  let tilt = 0;
  if (NG.gait && NR.ok) {
    const site = nnLocal(NN_PAW[i].site, nnA), paw = nnLocal(NN_PAW[i].paw, nnB);
    tilt = clamp(NR.rest.tilt[i] - Math.atan2(site[1] - paw[1], site[2] - paw[2]), -1.2, 1.2) * ss(0, 1, NR.blend);
  }
  q.setFromEuler(dqE.set(tilt, 0, 0, 'YXZ'));
}

// real frame time, fed by the animation loop (sim/loop.js); lockstep never calls it
function ngFrame(realDt) {
  if (!(realDt > 0)) return;
  NG.frameMs += (realDt * 1000 - NG.frameMs) * 0.1;
  // slow frames add up; good frames pay the debt back at the same rate
  NG.slowT = realDt > NG.SLOW_FRAME ? NG.slowT + realDt : Math.max(0, NG.slowT - realDt);
}

const NG = {
  ready: false, active: false, state: 'off', err: '', licence: '',
  gait: null, predictor: null, styles: null, loading: null, inflight: null,
  guidance: 'Idle', speed: 0, ms: 0, cont: [1, 1, 1, 1],
  // health: a prediction older than AGE sim s, no first prediction within FIRST sim s, or real
  // frames slower than SLOW_FRAME s adding up past SLOW_FOR s hand the body back to the pattern
  // generator for `hold` sim s; each handover doubles the next hold up to HOLD_MAX, and HOLD_RESET
  // sim s of healthy running set it back to HOLD_MIN
  // while the network drives, body.js steer runs its heading loops at TURN_GAIN (the network
  // turns about 0.3 s behind its command; at full gain the heading swung 1 rad either side of the
  // goal, measured) and caps a goto approach at a DECEL m/s^2 stopping profile (the network ran
  // up to 2 m past a stop; measured). BRAKE and POSE_SPEED are read in update below
  TURN_GAIN: 0.5, DECEL: 1.2, BRAKE: 1, POSE_SPEED: 0.3,
  AGE: 0.5, FIRST: 1.5, SLOW_FRAME: 0.1, SLOW_FOR: 1, HOLD_MIN: 2, HOLD_MAX: 16, HOLD_RESET: 30,
  holdUntil: 0, hold: 2, why: '', enterT: 0, frameMs: 16.7, slowT: 0,
  // the host asks this for each prediction; lockstep awaits `inflight` after every step so a
  // prediction lands on the same step on every run
  port: { predict(input) {
    const p = NG.predictor.predict(input), f = p.then(() => {}, () => {});
    NG.inflight = f; NGW.busy = true;
    f.then(() => { if (NG.inflight === f) { NG.inflight = null; NGW.busy = false; } });
    return p;
  } },
  load(cb) {
    if (NG.ready) return Promise.resolve();
    if (NG.loading) return NG.loading;
    const say = st => { NG.state = st; if (cb) cb(st); };
    NG.loading = (async () => {
      try {
        say('fetching weights');
        const U = HMN.UPSTREAM;
        const w = await HMN.loadWeights({ manifest: U.manifest, bin: U.bin, sha256: U.binSha256,
          onLicence: t => { NG.licence = t; console.info(t); toast(t); },
          onProgress: (a, b) => say('fetching weights ' + Math.round(100 * a / (b || U.binBytes)) + ' percent') });
        say('starting the network');
        NG.predictor = await HMN.Predictor.create(w, { worker: 'auto' });
        NG.styles = w.styles; NG.ready = true; NR.ok = false;
        say(NG.status());
      } catch (e) {
        NG.err = String(e && e.message || e); NG.loading = null;
        say('failed: ' + NG.err.toLowerCase());
      }
    })();
    return NG.loading;
  },
  status() {
    if (!NG.ready) return NG.err ? 'failed: ' + NG.err.toLowerCase() : NG.loading ? NG.state : 'off';
    const where = NG.predictor.mode === 'worker' ? 'worker' : 'in page';
    if (NG.active) return 'on, ' + where + ', ' + NG.ms.toFixed(0) + ' ms';
    if (now < NG.holdUntil) return 'held ' + Math.ceil(NG.holdUntil - now) + ' s: ' + NG.why;
    return 'ready, ' + where;
  },
  healthy() {
    const g = NG.gait; let why = '';
    if (!g) why = 'no host';
    else if (g.received === 0 && now - NG.enterT > NG.FIRST) why = 'no prediction';
    else if (g.received > 0 && g.predictionAge > NG.AGE) why = 'predictions late';
    else if (!TEST && NG.slowT > NG.SLOW_FOR) why = 'slow frames';
    if (!why) { if (now - NG.enterT > NG.HOLD_RESET) NG.hold = NG.HOLD_MIN; return true; }
    NG.why = why; NG.holdUntil = now + NG.hold; NG.hold = Math.min(NG.hold * 2, NG.HOLD_MAX); NG.slowT = 0;
    return false;
  },
  // a fresh host at the dog's place and facing; v is the speed the dog had, rig m/s
  enter(v) {
    NG.gait = new HMN.QuadrupedHost(NG.port, NG.styles);
    NG.gait.reset(0, 0, dog.yaw);
    NR.ox = dog.pos.x; NR.oz = dog.pos.z;
    NG.enterT = now; NG.speed = v; NG.guidance = 'Idle';
  },
  // speed in network m/s, turn rate in rad/s, posture targets 0 to 1; returns the world root
  update(dt, speed, turnRate, posture) {
    const g = NG.gait;
    // a sit or a down waits until the dog has slowed: the network does not brake in those styles
    const slow = g.rootVelocity && Math.hypot(g.rootVelocity.x, g.rootVelocity.z) < NG.POSE_SPEED;
    const style = slow && posture && posture.down > 0.5 ? 'Lie' : slow && posture && posture.sit > 0.5 ? 'Sit' : 'auto';
    // the host's speed loop overshoots after a hard start, so a root running faster than asked is
    // braked by asking for less, in proportion to the excess
    const got = Math.hypot(g.rootVelocity.x, g.rootVelocity.z);
    const ask = got > speed ? Math.max(0, speed - NG.BRAKE * (got - speed)) : speed;
    const r = g.update(dt, { speed: ask, turnRate, style });
    NG.speed = r.speed * NR.s; NG.guidance = g.style; NG.ms = g.evalMs;
    for (let i = 0; i < 4; i++) NG.cont[i] = g.paws[i].contact;
    return { x: NR.s * r.x + NR.ox, z: NR.s * r.z + NR.oz, yaw: r.yaw };
  },
  // the world pushed the root (obstacles, fence): move the host's ground plane with it
  follow(dx, dz) { NR.ox += dx; NR.oz += dz; }
};
