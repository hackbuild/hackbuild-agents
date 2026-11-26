// ---------- attention: Itti Koch saliency on the dog eye frame, top down bias, inhibition of return in world directions ----------
// Itti, Koch and Niebur 1998: center surround on a pyramid, the N() normalization, winner take all, inhibition of return.
// Dogs: red green is dropped (dichromat), blue yellow kept, motion weighted highest.
const SW = 80, SH = 40;
const attention = {
  map: new Float32Array((SW / 2) * (SH / 2)), prevI: null, ior: [], focusP: null, focusT: 0, nextShift: 0, show: false, lastFrame: -1, label: '',
  levels(src, w, h) { const L = [{ d: src, w, h }]; for (let k = 0; k < 4; k++) { const p = L[L.length - 1], nw = Math.max(1, p.w >> 1), nh = Math.max(1, p.h >> 1), o = new Float32Array(nw * nh); for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) { const x0 = x * 2, y0 = y * 2, x1 = Math.min(x0 + 1, p.w - 1), y1 = Math.min(y0 + 1, p.h - 1); o[y * nw + x] = (p.d[y0 * p.w + x0] + p.d[y0 * p.w + x1] + p.d[y1 * p.w + x0] + p.d[y1 * p.w + x1]) / 4; } L.push({ d: o, w: nw, h: nh }); } return L; },
  // feature map at level 1 from center levels 1,2 and surrounds c+2, c+3, sampled at level 1 resolution
  csMap(L) { const W = L[1].w, Hh = L[1].h, out = new Float32Array(W * Hh); const smp = (l, u, v) => { const x = clamp(Math.floor(u * l.w), 0, l.w - 1), y = clamp(Math.floor(v * l.h), 0, l.h - 1); return l.d[y * l.w + x]; };
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { const u = (x + 0.5) / W, v = (y + 0.5) / Hh; let s = 0; for (const c of [1, 2]) for (const dd of [2, 3]) { if (c + dd >= L.length) continue; s += Math.abs(smp(L[c], u, v) - smp(L[c + dd], u, v)); } out[y * W + x] = s; } return out; },
  N(m, W, Hh) { let mx = 0; for (const v of m) mx = Math.max(mx, v); if (mx < 1e-6) return m.fill(0); for (let i = 0; i < m.length; i++) m[i] /= mx;
    let sum = 0, n = 0; for (let y = 1; y < Hh - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x, v = m[i]; if (v < 0.999 && v > 0.05 && v >= m[i - 1] && v >= m[i + 1] && v >= m[i - W] && v >= m[i + W]) { sum += v; n++; } }
    const mb = n ? sum / n : 0, k = (1 - mb) * (1 - mb); for (let i = 0; i < m.length; i++) m[i] *= k; return m; },
  update() {
    if (!ON('L.salience') || !dog.ready) return;
    const img = rawCtx.getImageData(0, 0, EW, EH).data, I = new Float32Array(SW * SH), BY = new Float32Array(SW * SH), sx = EW / SW, sy = EH / SH;
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) { const i = (Math.floor(y * sy) * EW + Math.floor(x * sx)) * 4, r = img[i] / 255, g = img[i + 1] / 255, b = img[i + 2] / 255; I[y * SW + x] = (r + g + b) / 3; BY[y * SW + x] = b - (r + g) / 2; }
    const M = new Float32Array(SW * SH); if (this.prevI) for (let i = 0; i < M.length; i++) M[i] = Math.abs(I[i] - this.prevI[i]) * 4; this.prevI = I;
    const E = new Float32Array(SW * SH); for (let y = 1; y < SH - 1; y++) for (let x = 1; x < SW - 1; x++) { const i = y * SW + x; E[i] = Math.hypot(I[i + 1] - I[i - 1], I[i + SW] - I[i - SW]); }
    const W = SW / 2, Hh = SH / 2, cs = d => this.N(this.csMap(this.levels(d, SW, SH)), W, Hh);
    const mI = cs(I), mB = cs(BY), mE = cs(E), mM = this.N(this.levels(M, SW, SH)[1].d.slice(), W, Hh);
    const S = this.map, g = TV('Se.sal');
    for (let i = 0; i < S.length; i++) S[i] = g * (mI[i] + 0.7 * mB[i] + 0.6 * mE[i] + 1.7 * mM[i]);
    // top down: the drives raise what matters, projected into the eye image
    const want = { you: 0.4 + brain.d.social + (brain.bond || 0.5) * 0.5, ball: brain.d.play * 1.4, squirrel: brain.d.prey * 2 + 0.6, bowl: brain.d.hunger * 0.8, bone: brain.d.play * 0.5 };
    this.want = want;
    for (const p of Object.values(percepts)) {
      if (!p.vis) continue; const k = want[p.kind] ?? (p.kind === 'treat' ? 1.2 + brain.d.hunger : 0.2);
      const v = tmpV[0].copy(p.pos).project(eyeCam); if (v.z > 1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1) continue;
      const cx = (v.x + 1) / 2 * W, cy = (1 - v.y) / 2 * Hh; for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { const d2 = (x - cx) ** 2 + (y - cy) ** 2; S[y * W + x] += k * 0.6 * Math.exp(-d2 / 6); }
    }
    // inhibition of return, stored as world directions so it survives head turns
    const eye = eyeCam.position;
    this.ior = this.ior.filter(o => o.until > now);
    for (const o of this.ior) { const v = tmpV[1].copy(eye).add(o.dir).project(eyeCam); if (v.z > 1) continue; const cx = (v.x + 1) / 2 * W, cy = (1 - v.y) / 2 * Hh, r = W / 6; for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { const d2 = (x - cx) ** 2 + (y - cy) ** 2; if (d2 < r * r) S[y * W + x] *= 0.15 + 0.85 * d2 / (r * r); } }
    this.lastFrame = now;
    if (now > this.nextShift) this.shift();
  },
  shift() {
    const W = SW / 2, Hh = SH / 2, S = this.map; let bi = -1, bv = 0.35; for (let i = 0; i < S.length; i++) if (S[i] > bv) { bv = S[i]; bi = i; }
    // fixation dwell: lognormal around the measured dog fixation means, a little shorter when aroused
    this.nextShift = now + Math.min(4, ORG.lognorm(TV('Se.fix'), 0.6)) * (1.15 - 0.3 * brain.a);
    if (bi < 0) { this.focusP = null; this.label = ''; return; }
    const x = bi % W, y = Math.floor(bi / W), ndc = V3((x + 0.5) / W * 2 - 1, 1 - (y + 0.5) / Hh * 2, 0.5).unproject(eyeCam), dir = ndc.sub(eyeCam.position).normalize();
    // snap to a known object near that ray, else the ground under it
    let best = null, bd = 0.25, lab = '', bid = null;
    for (const p of Object.values(percepts)) { if (!p.vis) continue; const to = p.pos.clone().sub(eyeCam.position), dd = to.length(), c = to.normalize().dot(dir); const a = Math.acos(clamp(c, -1, 1)); if (a < bd) { bd = a; best = p.pos.clone(); lab = p.id.replace(/\d+$/, ''); bid = p.id; } }
    if (bid !== this.focusId && bid) EV.emit({ agent: 'dog', kind: 'sense', sense: 'eye', text: 'looked at ' + (lab === 'you' ? 'moheeb' : lab), cause: percepts[bid].ev || null });
    this.focusId = bid; this.focusV = bv;
    if (!best) { const t = dir.y < -0.02 ? (eyeCam.position.y - 0.05) / -dir.y : 6; best = eyeCam.position.clone().addScaledVector(dir, Math.min(t, 8)); lab = 'something'; }
    this.focusP = best; this.label = lab; this.focusT = now;
    this.ior.push({ dir: best.clone().sub(eyeCam.position).normalize(), until: now + TV('Se.ior') * (0.7 + RNG() * 0.6) });
    // orienting cascade: ears first, then the head, the body only if it is far round and the dog is idle
    dog.earPerk = Math.max(dog.earPerk, 0.4 + 0.3 * brain.a);
  },
  focus() {
    if (!ON('L.salience')) { let best = null, bs = 0.15; for (const k in percepts) { const p = percepts[k]; if (p.vis && p.sal > bs && k !== 'bed') { bs = p.sal; best = p; } } return best ? (best.id === 'you' ? V3(YOU.x, H(YOU.x, YOU.z) + 1.6, YOU.z) : best.pos) : null; }
    if (this.label === 'you') return humHead(V3());
    return this.focusP;
  },
  draw(ctx) {
    if (!ON('L.salience') || !this.show) return; const W = SW / 2, Hh = SH / 2, cw = EW / W, ch = EH / Hh; let mx = 0; for (const v of this.map) mx = Math.max(mx, v);
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { const v = this.map[y * W + x] / (mx || 1); if (v < 0.25) continue; ctx.fillStyle = `rgba(254,3,134,${(v * 0.45).toFixed(2)})`; ctx.fillRect(x * cw, y * ch, cw, ch); }
    if (this.focusP) { const v = this.focusP.clone().project(eyeCam); if (v.z < 1) { const px = (v.x + 1) / 2 * EW, py = (1 - v.y) / 2 * EH; ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, 9, 0, 7); ctx.moveTo(px - 14, py); ctx.lineTo(px + 14, py); ctx.moveTo(px, py - 14); ctx.lineTo(px, py + 14); ctx.stroke(); } }
  }
};
// looming: time to contact tau = theta / (dtheta/dt); a fast approach under the threshold gives a startle
const loomPrev = {};
function loomCheck(dt) {
  if (!ON('L.salience') || brain.cur === 'sleep') return;
  const eye = headWorld(dog.eyeL, tmpV[0]);
  for (const p of Object.values(percepts)) {
    if (!p.vis || !p.pos) continue;
    // a familiar person walking up is not a threat; only fast objects, or a looming stranger like approach, count
    if (p.kind === 'you' && HUM.threat < 0.5) continue; if (p.kind !== 'you' && (p.speed || 0) < 1.5) continue;
    const d = p.pos.distanceTo(eye), size = p.kind === 'you' ? 0.5 : p.kind === 'ball' ? 0.09 : 0.3, th = HSENSE.angularSize(size, d);
    const q = loomPrev[p.id]; loomPrev[p.id] = { th, t: now };
    if (!q || now - q.t > 0.3 || now - q.t < 1e-3) continue;
    const tau = HSENSE.timeToContact(q.th, th, now - q.t); if (tau === Infinity) continue;
    const thr = TV('Se.loom') * (1 + 0.2 * PT('reactivity') + 0.15 * PT('fearfulness'));
    if (tau < thr && th > 0.04 && (!p.loomT || now - p.loomT > 2.5)) {
      p.ev = EV.emit({ agent: 'dog', kind: 'sense', sense: 'eye', text: (p.id === 'you' ? 'moheeb' : p.id.replace(/\d+$/, '')) + ' came at me fast, startled' });
      p.loomT = now; brain.startle = 0.5; dog.hop = 0.035; dog.earPerk = PT('fearfulness') > 0.5 ? -1 : 1; lookAt(p.pos);
      brain.a = clamp(brain.a + 0.3, 0, 1); brain.remember((p.id === 'you' ? 'my human' : p.id.replace(/\d+$/, '')) + ' came at me fast', 2);
      if (PT('fearfulness') > 0.8 && p.kind === 'you') brain.stimulus('fear');
    }
  }
}
// ---------- nose: intermittent puff plume plus a decaying ground trail ----------
// Celani, Villermaux and Vergassola 2014: odor arrives as whiffs and blanks; whiffs keep the animal surging upwind,
// a loss of signal starts crosswind casting. Sniffs at 4 to 7 Hz in bouts recurring about once a second (Craven 2010).
const wind = { a: 0.4, ou: new ORG.OU(25, 0.6), v: V3() };
const puffs = []; const TG = 64, TGS = 34, trail = new Float32Array(TG * TG), trailT = new Float32Array(TG * TG).fill(-1e9);
const tgi = (x, z) => { const i = Math.floor((x + TGS / 2) / TGS * TG), j = Math.floor((z + TGS / 2) / TGS * TG); return i < 0 || j < 0 || i >= TG || j >= TG ? -1 : j * TG + i; };
function trailDeposit(x, z, amt, who) { if (who === 'dog') return; const i = tgi(x, z); if (i >= 0) { trail[i] = Math.min(trail[i] + amt, 3); trailT[i] = now; } }
let trailDecayT = 0, puffAcc = {};
function scentSources() {
  const S = [{ id: 'bowl', x: BOWL.x, z: BOWL.z, s: Math.max(foodAmt, 0.12) * 1.2 }];
  for (const tr of treats) { const p = bodyPos(tr); S.push({ id: 'treat', x: p.x, z: p.z, s: 1.3 }); }
  if (ball && !ball.held) { const p = bodyPos(ball); S.push({ id: 'ball', x: p.x, z: p.z, s: 0.25 }); }
  if (bone) { const p = bodyPos(bone); S.push({ id: 'bone', x: p.x, z: p.z, s: 0.4 }); }
  if (sq.visible) S.push({ id: 'squirrel', x: sq.position.x, z: sq.position.z, s: 0.6 });
  S.push({ id: 'you', x: YOU.x, z: YOU.z, s: 0.2 });
  return S;
}
function plumeTick(dt) {
  if (!ON('L.plume')) { puffs.length = 0; return; }
  // wind direction meanders as a slow OU process
  wind.a = 0.4 + wind.ou.step(dt) * TV('W.meander') * 2; const ws = TV('W.wind'); wind.v.set(Math.cos(wind.a) * ws, 0, Math.sin(wind.a) * ws);
  for (const s of scentSources()) {
    puffAcc[s.id] = (puffAcc[s.id] || 0) + dt * TV('Se.puffs') * Math.sqrt(s.s);
    while (puffAcc[s.id] >= 1) { puffAcc[s.id] -= 1; if (puffs.length < 600) puffs.push({ x: s.x + rnd(-0.05, 0.05), z: s.z + rnd(-0.05, 0.05), age: 0, m: s.s, tx: new ORG.OU(0.8, 0.25 * (ws + 0.2)), tz: new ORG.OU(0.8, 0.25 * (ws + 0.2)) }); }
  }
  for (let i = puffs.length - 1; i >= 0; i--) { const p = puffs[i]; p.age += dt; p.x += (wind.v.x + p.tx.step(dt)) * dt; p.z += (wind.v.z + p.tz.step(dt)) * dt; if (p.age > 14 || Math.abs(p.x) > 17 || Math.abs(p.z) > 17) puffs.splice(i, 1); }
  // squirrel and human feet lay ground trails; trails fade with a game time halflife
  if (sq.visible && RNG() < dt * 6) trailDeposit(sq.position.x, sq.position.z, 0.6, 'squirrel');
  if (HUM.ready && HUM.v > 0.3 && RNG() < dt * 2) trailDeposit(HUM.pos.x, HUM.pos.z, 0.25, 'you');
  trailDecayT += dt; if (trailDecayT > 0.5) { const k = Math.pow(0.5, gameMin(trailDecayT) * +$('tempo').value / TV('Se.trail')); for (let i = 0; i < trail.length; i++) trail[i] *= k; trailDecayT = 0; }
}
// direction of travel along a trail: weight nearby cells by how much fresher they are than average
function trailDir(p, prev) {
  const cs = TGS / TG, cx = Math.floor((p.x + TGS / 2) / cs), cz = Math.floor((p.z + TGS / 2) / cs); let sx = 0, sz = 0, mt = 0, n = 0; const cells = [];
  for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) { const i = cx + dx, j = cz + dz; if (i < 0 || j < 0 || i >= TG || j >= TG) continue; const k = j * TG + i; if (trail[k] < 0.03) continue; cells.push([dx, dz, trailT[k]]); mt += trailT[k]; n++; }
  if (n < 3) return null; mt /= n;
  for (const [dx, dz, t] of cells) { const w = (t - mt), l = Math.hypot(dx, dz) || 1; sx += w * dx / l; sz += w * dz / l; }
  let d = V3(sx, 0, sz); if (d.lengthSq() < 1e-6) return null; d.normalize();
  if (prev && d.dot(prev) < -0.2) d = prev.clone(); return d;
}
function puffConc(x, z) { let c = 0; for (const p of puffs) { const s2 = 0.0025 + 0.03 * p.age, dx = x - p.x, dz = z - p.z, d2 = dx * dx + dz * dz; if (d2 < 9 * s2) c += p.m * 0.012 / s2 * Math.exp(-d2 / (2 * s2)); } return c; }
function groundConc(x, z) { const i = tgi(x, z); return i < 0 ? 0 : trail[i] * 0.5; }
// scent at a point: the plume model, or the older smooth gaussian field when the layer is off
function scentAt(x, z) {
  if (ON('L.plume')) return puffConc(x, z) + groundConc(x, z);
  let s = 0;
  const wnd = [0.6, 0.25];
  const food = Math.max(foodAmt, 0.15);
  const add = (px, pz, str, sig) => { const dx = x - px - wnd[0] * sig * 0.6, dz = z - pz - wnd[1] * sig * 0.6; s += str * Math.exp(-(dx * dx + dz * dz) / (2 * sig * sig)); };
  add(BOWL.x, BOWL.z, food, 2.4);
  for (const tr of treats) { const p = bodyPos(tr); add(p.x, p.z, 1.2, 1.6); }
  for (const sc of scentSrc) add(sc.x, sc.z, sc.s * Math.exp(-(now - sc.t) / 40), 0.8 + (now - sc.t) * 0.03);
  return s;
}
// sniff clock: bouts of 4 to 7 Hz sniffs; each sniff samples both nostrils, a little apart
const sniff = { boutT: 0, inBout: 0, ph: 0, last: 0, cL: 0, cR: 0, c: 0, mean: 0.01, whiffT: -99, sndT: 0 };
function sniffTick(dt, active) {
  if (!dog.ready) return false;
  if (!active) { sniff.inBout = 0; return false; }
  if (sniff.inBout <= 0) { sniff.boutT -= dt; if (sniff.boutT <= 0) { sniff.inBout = rnd(0.3, 0.9); sniff.boutT = ORG.poisson(TV('Se.boutHz')); } return false; }
  sniff.inBout -= dt; sniff.ph += dt * TV('Se.sniffHz'); if (sniff.ph < 1) return false; sniff.ph -= 1;
  const n = headWorld(dog.noseL, tmpV[0]), side = V3(Math.cos(dog.yaw + dog.head.yaw), 0, -Math.sin(dog.yaw + dog.head.yaw)).multiplyScalar(0.03);
  sniff.cL = scentAt(n.x + side.x, n.z + side.z); sniff.cR = scentAt(n.x - side.x, n.z - side.z); sniff.c = (sniff.cL + sniff.cR) / 2;
  sniff.mean += (sniff.c - sniff.mean) * 0.15;
  if (sniff.c > Math.max(0.03, sniff.mean * 1.4)) { if (now - sniff.whiffT > 3) brain.evScent = EV.emit({ agent: 'dog', kind: 'sense', sense: 'nose', text: 'caught a whiff, ' + sniff.c.toFixed(3) + (sniff.cL > sniff.cR ? ', stronger left' : ', stronger right') }); sniff.whiffT = now; }
  if (now - sniff.sndT > 0.12) { sniff.sndT = now; sniffSound(n); }
  return true;
}
function sniffSound(p) { const a = audio(); if (!a) return; const t = a.currentTime, nz = a.createBufferSource(), buf = a.createBuffer(1, a.sampleRate * 0.05, a.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / d.length); nz.buffer = buf; const f = a.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500; const g = a.createGain(); g.gain.value = 0.025 * distGain(p); nz.connect(f); f.connect(g); g.connect(a.destination); nz.start(t); }
// tracking: surge upwind on a whiff, cast crosswind with widening zigzags on a loss
function sniffRun(B, dt) {
  const P = dog.postureT;
  if (!ON('L.plume')) {
    const n = headWorld(dog.noseL, tmpV[0]); const e = 0.35;
    const gx = scentAt(n.x + e, n.z) - scentAt(n.x - e, n.z), gz = scentAt(n.x, n.z + e) - scentAt(n.x, n.z - e);
    const g = Math.hypot(gx, gz);
    if (!B.wp || B.subT <= 0 || motor.done) { B.wp = g > 0.004 ? V3(dog.pos.x + gx / g * 1.6, 0, dog.pos.z + gz / g * 1.6) : V3(dog.pos.x + rnd(-2, 2), 0, dog.pos.z + rnd(-2, 2)); B.subT = 1.4; motor.done = false; }
    B.subT -= dt; motor.mode = 'goto'; motor.target.copy(B.wp); motor.speed = 0.55; motor.stopDist = 0.2;
    dog.head.tYaw = Math.sin(now * 3) * 0.25; dog.head.tPitch = 0.95 - dog.bodyPitch; dog.head.tRoll = 0;
    if (RNG() < dt * 0.6) B.say(pick(LINES.sniff), 1.5);
    if (B.t > 14) B.done = true;
    return;
  }
  const S = B.sn || (B.sn = { mode: 'cast', side: RNG() < 0.5 ? 1 : -1, amp: 0.8, wp: null, t: 0 });
  const up = V3(-wind.v.x, 0, -wind.v.z); if (up.lengthSq() < 1e-4) up.set(Math.sin(dog.yaw), 0, Math.cos(dog.yaw)); up.normalize();
  const cross = V3(-up.z, 0, up.x), lr = sniff.cL - sniff.cR, gnd = groundConc(dog.pos.x, dog.pos.z);
  S.t += dt;
  // ground trail: a deciding phase of 3 to 5 s at half speed over a few footprints, then follow toward the fresher end (Thesen 1993, Hepper and Wells 2005)
  if (gnd > 0.08 && S.mode !== 'decide' && S.mode !== 'trail' && (!S.trailDone || now - S.trailDone > 15)) { S.mode = 'decide'; S.dEnd = now + ORG.exg(3.2, 0.5, 1); S.wp = null; }
  if (S.mode === 'decide') {
    motor.mode = 'goto'; if (!S.wp || motor.done) { S.wp = dog.pos.clone().add(V3(rnd(-0.4, 0.4), 0, rnd(-0.4, 0.4))); motor.done = false; } motor.target.copy(S.wp); motor.speed = 0.4; motor.stopDist = 0.15;
    dog.head.tPitch = 1.0 - dog.bodyPitch + (NG.active ? 0.3 : 0); dog.head.tYaw = Math.sin(now * 3) * 0.35;
    if (now > S.dEnd) { S.tdir = trailDir(dog.pos, null); S.mode = S.tdir ? 'trail' : 'cast'; S.wp = null; if (S.tdir) B.say(pick(['this way', 'fresh.', 'got the trail']), 1.6); }
    return;
  }
  if (S.mode === 'trail') {
    if (!S.wp || motor.done) { const d = trailDir(dog.pos, S.tdir); if (!d || groundConc(dog.pos.x, dog.pos.z) < 0.03) { S.mode = 'cast'; S.trailDone = now; S.wp = null; } else { S.tdir = d; S.wp = dog.pos.clone().addScaledVector(d, 1.5); pushOut(S.wp, 0.4); motor.done = false; } }
    if (S.wp) { motor.mode = 'goto'; motor.target.copy(S.wp); motor.speed = 0.9; motor.stopDist = 0.3; }
    dog.head.tPitch = 0.9 - dog.bodyPitch + (NG.active ? 0.25 : 0); dog.head.tYaw = Math.sin(now * 2.2) * 0.25;
    if (S.t > 24) { B.done = true; B.sn = null; }
    return;
  }
  const whiff = now - sniff.whiffT < 0.9;
  if (whiff && S.mode !== 'surge') { S.mode = 'surge'; S.wp = null; S.amp = 0.8; }
  if (!whiff && S.mode === 'surge') { S.mode = 'cast'; S.wp = null; }
  if (!S.wp || motor.done) {
    if (S.mode === 'surge') { const lat = clamp(lr * 40, -0.8, 0.8); S.wp = dog.pos.clone().addScaledVector(up, 1.3).addScaledVector(cross, -lat); }
    else { S.side = -S.side; S.amp = Math.min(S.amp * 1.35, 3.2); S.wp = dog.pos.clone().addScaledVector(cross, S.side * S.amp).addScaledVector(up, 0.25); }
    pushOut(S.wp, 0.4); motor.done = false;
  }
  motor.mode = 'goto'; motor.target.copy(S.wp); motor.speed = S.mode === 'surge' ? 0.9 : 0.6; motor.stopDist = 0.25;
  // nose down on a ground trail, up a little for air scent; small side to side sweeps while sniffing
  const low = gnd > 0.05 || sniff.c < 0.05;
  dog.head.tYaw = Math.sin(now * 2.6) * 0.3 + clamp(lr * 25, -0.3, 0.3); dog.head.tPitch = (low ? 0.95 : 0.35) - dog.bodyPitch; dog.head.tRoll = 0;
  if (NG.active) dog.head.tPitch += low ? 0.25 : 0;
  if (RNG() < dt * 0.5) B.say(S.mode === 'surge' ? pick(['getting closer', 'this way', 'sniff sniff']) : pick(['lost it', 'where...', 'sniff sniff']), 1.5);
  if ((now - sniff.whiffT > 9 && S.t > 6) || S.t > 24) { B.done = true; B.sn = null; }
  for (const s of scentSources()) if ((s.id === 'treat' || (s.id === 'bowl' && foodAmt > 0.05)) && Math.hypot(s.x - dog.pos.x, s.z - dog.pos.z) < 0.9) { B.done = true; B.sn = null; }
}
// ---------- daylight ----------
function lightTick() {
  const L = CLOCK.light, h = CLOCK.h, warm = ON('L.day') ? Math.max(Math.exp(-Math.pow((h - 6.8) / 1.1, 2)), Math.exp(-Math.pow((h - 19.2) / 1.1, 2))) : 0;
  hemi.intensity = 0.95 + 0.5 * L; sun.intensity = 0.7 + 1.6 * L; // night stays a light blue dusk, never dark
  hemi.color.setRGB(lerp(0.78, 1, L), lerp(0.84, 1, L), lerp(0.98, 1, L));
  sun.color.setRGB(lerp(0.8, 1, L), lerp(0.86, lerp(0.95, 0.72, warm), L), lerp(1, lerp(0.87, 0.5, warm), L));
  const el = ON('L.day') ? Math.sin(Math.PI * clamp((h - 6) / 13, 0, 1)) : 0.85, az = ON('L.day') ? (h - 12) / 12 * Math.PI : 0.8;
  sun.position.set(Math.sin(az) * 14, 4 + el * 12, Math.cos(az) * 8 + 4);
  const bg = scene.background; bg.setRGB(lerp(0.80, 0.933, L) - warm * 0.03, lerp(0.84, 0.949, L) - warm * 0.05, lerp(0.92, 0.937, L) - warm * 0.07); scene.fog.color.copy(bg);
}
// scent puffs drawn in the yard when asked
const puffViz = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 5), new THREE.MeshBasicMaterial({ color: '#FE0386', transparent: true, opacity: 0.18, depthWrite: false }), 600);
puffViz.count = 0; puffViz.frustumCulled = false; puffViz.renderOrder = 2; scene.add(puffViz);
function puffDraw() {
  const on = $('showPuffs') && $('showPuffs').checked && ON('L.plume'); puffViz.visible = on; if (!on) return;
  const o = tmpObj; let n = 0;
  for (const p of puffs) { const s = Math.sqrt(0.0025 + 0.03 * p.age); o.position.set(p.x, H(p.x, p.z) + 0.12, p.z); o.rotation.set(0, 0, 0); o.scale.set(s, s * 0.35, s); o.updateMatrix(); puffViz.setMatrixAt(n++, o.matrix); }
  puffViz.count = n; puffViz.instanceMatrix.needsUpdate = true;
}
