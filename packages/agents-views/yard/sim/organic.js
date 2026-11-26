// ---------- organic layer: springs, inertialization, noise, latencies, tunables, personality ----------
// Springs and inertialization follow Daniel Holden, "Spring-It-On" and "Dead Blending" (theorangeduck.com).
// Noise and latency models: exact Ornstein-Uhlenbeck steps, summed OU octaves for pink idle drift,
// ex-Gaussian reaction times, truncated power law steps with von Mises turns.
const ORG = (() => {
  const hl2d = h => 4 * Math.LN2 / (h + 1e-5);
  const nexp = x => 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  // exact critically damped spring of a scalar state {x, v} toward goal
  function spring(s, goal, hl, dt) {
    const y = hl2d(hl) / 2, j0 = s.x - goal, j1 = s.v + j0 * y, e = nexp(y * dt);
    s.x = e * (j0 + j1 * dt) + goal; s.v = e * (s.v - j1 * y * dt); return s.x;
  }
  // character velocity spring: state {x, v, a}, the velocity eases toward vGoal; returns x
  function vspring(s, vGoal, hl, dt) {
    const y = hl2d(hl) / 2, j0 = s.v - vGoal, j1 = s.a + j0 * y, e = nexp(y * dt);
    s.x = e * ((-j1) / (y * y) + (-j0 - j1 * dt) / y) + j1 / (y * y) + j0 / y + vGoal * dt + s.x;
    s.v = e * (j0 + j1 * dt) + vGoal; s.a = e * (s.a - j1 * y * dt); return s.x;
  }
  // decay an offset {x, v} to zero, the inertialization core
  function decay(s, hl, dt) { const y = hl2d(hl) / 2, j1 = s.v + s.x * y, e = nexp(y * dt); s.x = e * (s.x + j1 * dt); s.v = e * (s.v - j1 * y * dt); return s.x; }
  const S = (x = 0) => ({ x, v: 0, a: 0 });
  // random numbers: seeded stream for personality, RNG for moment to moment noise
  function mulberry(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  function gauss(r = RNG) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  // ex-Gaussian: Normal(mu, sigma) plus Exponential(tau), mean mu + tau
  const exg = (mu, sigma, tau) => Math.max(0.02, mu + sigma * gauss() - tau * Math.log(1 - RNG()));
  // truncated power law step length, exponent mu in (1, 3]
  const levy = (lmin, mu, lmax) => Math.min(lmax, lmin * Math.pow(1 - RNG(), -1 / (mu - 1)));
  // von Mises turn angle (Best and Fisher 1979)
  function vonMises(k) {
    if (k < 1e-6) return (RNG() * 2 - 1) * Math.PI;
    const a = 1 + Math.sqrt(1 + 4 * k * k), b = (a - Math.sqrt(2 * a)) / (2 * k), r = (1 + b * b) / (2 * b);
    for (;;) { const z = Math.cos(Math.PI * RNG()), f = (1 + r * z) / (r + z), c = k * (r - f), u = RNG();
      if (c * (2 - c) - u > 0 || Math.log(c / u) + 1 - c >= 0) return (RNG() < 0.5 ? -1 : 1) * Math.acos(f); }
  }
  const poisson = rate => -Math.log(1 - RNG()) / Math.max(rate, 1e-6);
  // gamma (Marsaglia and Tsang) and lognormal samplers
  function gamma(k, th) { if (k < 1) return gamma(k + 1, th) * Math.pow(RNG(), 1 / k); const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d); for (;;) { let x, v; do { x = gauss(); v = 1 + c * x; } while (v <= 0); v = v * v * v; const u = RNG(); if (u < 1 - 0.0331 * x * x * x * x || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v * th; } }
  const lognorm = (median, sigma) => Math.exp(Math.log(median) + sigma * gauss());
  // Ornstein-Uhlenbeck with the exact discrete update, frame rate independent
  class OU {
    constructor(tau = 1, sigma = 1, mu = 0) { this.tau = tau; this.sigma = sigma; this.mu = mu; this.x = mu + sigma * gauss() * 0.5; }
    step(dt) { const th = 1 / this.tau, e = Math.exp(-th * dt); this.x = this.mu + (this.x - this.mu) * e + this.sigma * Math.sqrt(1 - e * e) * gauss(); return this.x; }
  }
  // summed octaves of OU: an approximately 1/f drift with no visible period, unit variance
  class Pink {
    constructor(tau0 = 0.4, oct = 6) { this.o = []; for (let k = 0; k < oct; k++) this.o.push(new OU(tau0 * Math.pow(2, k), 1 / Math.sqrt(oct))); this.x = 0; }
    step(dt) { let s = 0; for (const o of this.o) s += o.step(dt); this.x = s; return s; }
  }
  // offset inertialization over a set of three.js bones: call capture() at a transition, apply(dt) after the new pose is written
  class PoseInert {
    constructor(bones, posBone) {
      this.bones = bones.filter(Boolean); this.posBone = posBone;
      this.prev = this.bones.map(b => b.quaternion.clone()); this.prev2 = this.bones.map(b => b.quaternion.clone());
      this.off = this.bones.map(() => ({ x: [0, 0, 0], v: [0, 0, 0] })); this.pp = posBone ? posBone.position.clone() : null; this.pp2 = this.pp && this.pp.clone();
      this.po = { x: [0, 0, 0], v: [0, 0, 0] }; this.want = false; this.dt = 1 / 60; this.active = 0;
      this._q = new THREE.Quaternion(); this._q2 = new THREE.Quaternion(); this._v = new THREE.Vector3();
    }
    capture() { this.want = true; }
    static log(q, out) { let w = Math.max(-1, Math.min(1, q.w)); const s = Math.sqrt(Math.max(0, 1 - w * w)); const a = 2 * Math.acos(w); const k = s < 1e-6 ? 2 : a / s; out[0] = q.x * k; out[1] = q.y * k; out[2] = q.z * k; if (w < 0) { /* shortest arc */ } return out; }
    static exp(v, out) { const a = Math.hypot(v[0], v[1], v[2]); if (a < 1e-8) return out.set(v[0] / 2, v[1] / 2, v[2] / 2, 1).normalize(); const s = Math.sin(a / 2) / a; return out.set(v[0] * s, v[1] * s, v[2] * s, Math.cos(a / 2)); }
    apply(dt, hl, enabled) {
      const q = this._q, q2 = this._q2, tmp = [0, 0, 0];
      if (this.want && enabled) {
        // offset = previous output minus new source, velocity offset = previous output velocity (source velocity treated as unknown, zero)
        this.bones.forEach((b, i) => {
          q.copy(this.prev[i]).multiply(q2.copy(b.quaternion).invert()); if (q.w < 0) q.set(-q.x, -q.y, -q.z, -q.w);
          const o = this.off[i]; const cur = PoseInert.log(q, [0, 0, 0]);
          q.copy(this.prev[i]).multiply(q2.copy(this.prev2[i]).invert()); if (q.w < 0) q.set(-q.x, -q.y, -q.z, -q.w);
          const w = PoseInert.log(q, tmp);
          for (let k = 0; k < 3; k++) { o.x[k] = cur[k]; o.v[k] = w[k] / Math.max(this.dt, 1e-3); }
        });
        if (this.posBone) { for (let k = 0; k < 3; k++) { const c = ['x', 'y', 'z'][k]; this.po.x[k] = this.pp[c] - this.posBone.position[c]; this.po.v[k] = (this.pp[c] - this.pp2[c]) / Math.max(this.dt, 1e-3) * 0.5; } }
        this.active = 1;
      }
      this.want = false; this.dt = dt;
      if (this.active && enabled) {
        let mag = 0;
        this.bones.forEach((b, i) => {
          const o = this.off[i];
          for (let k = 0; k < 3; k++) { const s = { x: o.x[k], v: o.v[k] }; decay(s, hl, dt); o.x[k] = s.x; o.v[k] = s.v; mag += Math.abs(s.x); }
          PoseInert.exp(o.x, q); b.quaternion.premultiply(q);
        });
        if (this.posBone) for (let k = 0; k < 3; k++) { const s = { x: this.po.x[k], v: this.po.v[k] }; decay(s, hl, dt); this.po.x[k] = s.x; this.po.v[k] = s.v; this.posBone.position.setComponent(k, this.posBone.position.getComponent(k) + s.x); }
        if (mag < 1e-4) this.active = 0;
      }
      this.bones.forEach((b, i) => { this.prev2[i].copy(this.prev[i]); this.prev[i].copy(b.quaternion); });
      if (this.posBone) { this.pp2.copy(this.pp); this.pp.copy(this.posBone.position); }
    }
  }
  // minimum jerk profile, tau in 0..1
  const mj = t => { t = Math.max(0, Math.min(1, t)); return t * t * t * (10 - 15 * t + 6 * t * t); };
  return { spring, vspring, decay, S, hl2d, nexp, mulberry, hash, gauss, exg, levy, vonMises, poisson, gamma, lognorm, OU, Pink, PoseInert, mj };
})();

// ---------- tunables: every number that shapes behavior lives here, persisted, live editable ----------
// the registry is @hackbuild/tunables: values clamp to their range, saves keep only what differs
// from the defaults as { ver: 2, d } under the old storage key, and a save from the first format
// keeps its personality only. TUNE.v reads and writes the registry, so the call sites stay as they were.
const TREG = HTUNE.createRegistry({
  master: 'L.organic', version: 2, storageKey: 'hackle.tune',
  storage: { getItem: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, setItem: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } },
  migrate: { 0: v => Object.fromEntries(Object.entries(v).filter(([k]) => k.startsWith('P.'))) }
});
const TUNE = {
  defs: {}, order: [], groups: {},
  v: new Proxy({}, {
    get: (_, k) => (typeof k === 'string' && TREG.has(k) ? TREG.get(k) : undefined),
    set: (_, k, v) => { TREG.set(k, v); return true; },
    has: (_, k) => typeof k === 'string' && TREG.has(k),
    ownKeys: () => TREG.keys(),
    getOwnPropertyDescriptor: (_, k) => (typeof k === 'string' && TREG.has(k) ? { value: TREG.get(k), enumerable: true, configurable: true, writable: true } : undefined)
  })
};
function tdef(group, key, label, def, min, max, step, note) {
  TUNE.defs[key] = { group, key, label, def, min, max, step, note }; TUNE.order.push(key);
  (TUNE.groups[group] = TUNE.groups[group] || []).push(key);
  TREG.define(note ? { key, group, label, def, min, max, step, note } : { key, group, label, def, min, max, step });
}
const TV = k => TREG.get(k);
const ON = k => TREG.layer(k);
// layers
[['L.organic', 'organic (off is the old canned build)'], ['L.springs', 'springs on posture and gaze'], ['L.inert', 'inertialized transitions'], ['L.secondary', 'secondary motion: ears, tail, lean'],
 ['L.noise', 'noise and heavy tailed latencies'], ['L.sample', 'sampled choice with commitment'], ['L.drives', 'homeostatic drive reward'], ['L.sleep', 'sleep cycles and body clock'],
 ['L.social', 'social signals: bow, appease, bond, pointing'], ['L.learn', 'attention learning, traces, offers'], ['L.salience', 'visual saliency and inhibition of return'],
 ['L.plume', 'sniffing in a turbulent plume'], ['L.hgaze', 'human gaze statistics'], ['L.hbody', 'human body layers'], ['L.neural', 'neural gait (AI4Animation mocap)'], ['L.day', 'day and night']]
  // the neural gait fetches CC-BY-NC-4.0 weights, so it waits until you turn it on
  .forEach(([k, l]) => tdef('layers', k, l, k === 'L.neural' ? 0 : 1, 0, 1, 1));
// personality: seven temperament dimensions from Jones and Gosling 2005, as z scores, plus age
[['P.reactivity', 'reactivity'], ['P.fearfulness', 'fearfulness'], ['P.aggression', 'bark and guard'], ['P.sociability', 'sociability'],
 ['P.trainability', 'trainability'], ['P.independence', 'independence'], ['P.activity', 'activity']].forEach(([k, l]) => tdef('personality', k, l, 0, -2, 2, 0.1));
tdef('personality', 'P.age', 'age in months', 30, 2, 160, 1, 'puppies answer pitch, play more, sleep more');
// body
tdef('body', 'B.postureHL', 'posture spring halflife s', 0.2, 0.04, 0.8, 0.01);
tdef('body', 'B.headHL', 'head gaze halflife s', 0.09, 0.02, 0.4, 0.01);
tdef('body', 'B.inertHL', 'inertialization halflife s', 0.14, 0.03, 0.5, 0.01);
tdef('body', 'B.earHL', 'ear spring halflife s', 0.07, 0.02, 0.3, 0.01);
tdef('body', 'B.tailHL', 'tail spring halflife s', 0.06, 0.02, 0.3, 0.01);
tdef('body', 'B.stabilize', 'head stabilization', 0.7, 0, 1, 0.05);
tdef('body', 'B.lean', 'turn lean gain', 1, 0, 2, 0.05);
tdef('body', 'B.loadShift', 'fore hind load shift rad per m/s2', 0.045, 0, 0.15, 0.005);
tdef('body', 'B.paceBias', 'pace gait share', 0.35, 0, 1, 0.05, 'how much this dog paces between walk and trot');
tdef('body', 'B.frPace', 'Froude: walk to pace', 0.12, 0.03, 0.4, 0.01);
tdef('body', 'B.frTrot', 'Froude: to trot', 0.42, 0.15, 1.2, 0.01);
tdef('body', 'B.frCanter', 'Froude: to canter', 1.5, 0.6, 3.5, 0.05);
tdef('body', 'B.mass', 'body mass kg (sets shake rate)', 20, 3, 60, 1);
tdef('body', 'B.wagHz', 'wag rate scale (1.5 + 3.5 x arousal Hz)', 1, 0.5, 2, 0.05, 'Martin 2024: about 1.8 Hz typical, 1 to 4 Hz band');
tdef('body', 'B.nnSpeed', 'neural gait speed scale', 1, 0.5, 1.6, 0.05);
// brain
tdef('brain', 'Br.temp', 'choice temperature', 0.06, 0.005, 0.3, 0.005, 'higher means less predictable');
tdef('brain', 'Br.commit', 'commitment bonus', 0.12, 0, 0.4, 0.01);
tdef('brain', 'Br.driveN', 'drive exponent n', 3, 1, 5, 0.1);
tdef('brain', 'Br.driveM', 'drive root m', 4, 1, 6, 0.1);
tdef('brain', 'Br.gain', 'drive reward gain', 2.4, 0.5, 6, 0.1);
tdef('brain', 'Br.dwellMu', 'dwell mu s', 5, 1, 20, 0.5);
tdef('brain', 'Br.dwellTau', 'dwell tail s', 7, 0, 30, 0.5);
tdef('brain', 'Br.reactMu', 'react latency mu s', 0.3, 0.05, 1.5, 0.01);
tdef('brain', 'Br.reactTau', 'react latency tail s', 0.3, 0, 2, 0.01);
tdef('brain', 'Br.cueMu', 'cue latency mu s', 0.45, 0.1, 2, 0.01);
tdef('brain', 'Br.cueTau', 'cue latency tail s', 0.45, 0, 3, 0.01);
tdef('brain', 'Br.cortexMin', 'cortex min interval s (each think shares the GPU with rendering)', 25, 4, 90, 1);
tdef('brain', 'Br.ignore', 'cue non compliance base', 0.25, 0, 0.6, 0.01, 'Browne: dogs ignored 44 percent of everyday sit and down commands');
tdef('brain', 'Br.lookBack', 'look back time scale', 0.5, 0.1, 1.5, 0.05, 'Marshall-Pescini 2009: first look back about 14 s in an unsolvable task; scaled for play');
tdef('brain', 'Br.reflect', 'cortex importance budget', 12, 3, 40, 1, 'Generative Agents style: think when summed importance passes this');
// learning
tdef('learn', 'Ln.alpha', 'learning rate', 0.35, 0.05, 1, 0.01);
tdef('learn', 'Ln.theta', 'associability rate (Pearce Kaye Hall)', 0.3, 0.02, 1, 0.01);
tdef('learn', 'Ln.trace', 'eligibility trace s', 1.2, 0.3, 8, 0.1, 'a 1 s food delay cut learners from 60 to 25 percent (Waikato thesis)');
tdef('learn', 'Ln.inhib', 'inhibition decay per min', 0.06, 0, 0.5, 0.01, 'faster than excitation, so extinguished cues partly come back');
tdef('learn', 'Ln.offer', 'free operant offer rate', 0.5, 0, 2, 0.05);
// sleep and world
tdef('world', 'W.dayMin', 'real minutes per day', 20, 2, 120, 1);
tdef('world', 'W.hour', 'start hour', 10, 0, 23.9, 0.1);
tdef('world', 'W.wind', 'wind m/s', 0.7, 0, 3, 0.05);
tdef('world', 'W.meander', 'wind meander', 0.35, 0, 1, 0.05);
tdef('world', 'S.up', 'sleep pressure rise per hour awake', 0.055, 0.01, 0.2, 0.005);
tdef('world', 'S.down', 'sleep pressure fall per hour asleep', 0.11, 0.02, 0.4, 0.005);
tdef('world', 'S.nrem', 'NREM min game minutes', 6, 2, 30, 0.5);
tdef('world', 'S.rem', 'REM game minutes', 2.5, 0.5, 10, 0.5);
tdef('world', 'S.wake', 'wake after REM chance', 0.45, 0, 1, 0.05);
// senses
tdef('senses', 'Se.sal', 'saliency gain', 1, 0, 3, 0.05);
tdef('senses', 'Se.fix', 'fixation median s', 0.83, 0.2, 2, 0.01, 'Barber 2016: mean fixation 827 ms');
tdef('senses', 'Se.ior', 'inhibition of return s', 0.7, 0.2, 3, 0.05);
tdef('senses', 'Se.loom', 'looming startle tau s', 0.6, 0.1, 2, 0.05);
tdef('senses', 'Se.az', 'sound azimuth error deg', 7.6, 1.3, 13.2, 0.1, 'Guerineau 2022: dogs 1.3 to 13.2, mean 7.6');
tdef('senses', 'Se.sniffHz', 'sniff rate Hz', 6, 4, 7, 0.1, 'Thesen 1993: 6 Hz while tracking');
tdef('senses', 'Se.boutHz', 'sniff bout rate Hz', 1, 0.5, 1.5, 0.05);
tdef('senses', 'Se.puffs', 'puffs per s per source', 5, 1, 15, 0.5);
tdef('senses', 'Se.trail', 'ground trail halflife game min', 45, 5, 240, 5);
tdef('senses', 'Se.cpdBright', 'acuity bright cpd', 12, 5.5, 19.5, 0.5, 'Lind 2017');
tdef('senses', 'Se.cpdDim', 'acuity dim cpd', 2.6, 1.8, 3.5, 0.1);
// human
tdef('human', 'Hu.eyeRange', 'eye only range deg', 35.8, 10, 60, 0.5, 'Stahl 1999');
tdef('human', 'Hu.headSlope', 'head recruitment slope', 0.77, 0.3, 1, 0.01);
tdef('human', 'Hu.headHL', 'head halflife s', 0.1, 0.03, 0.4, 0.01);
tdef('human', 'Hu.blink', 'blinks per min at rest', 17, 2, 40, 1, 'Bentivoglio 1997: 17 rest, 26 talking, 4.5 reading');
tdef('human', 'Hu.listen', 'mutual gaze listening', 0.75, 0, 1, 0.01, 'SmartBody');
tdef('human', 'Hu.talk', 'mutual gaze talking', 0.41, 0, 1, 0.01);
tdef('human', 'Hu.think', 'mutual gaze thinking', 0.2, 0, 1, 0.01);
tdef('human', 'Hu.rootHL', 'root velocity halflife s', 0.28, 0.05, 1, 0.01);
tdef('human', 'Hu.beta', 'curve speed exponent', 0.2, 0, 0.34, 0.01, 'Hicheur 2005: 0.13 to 0.26 for walking');
tdef('human', 'Hu.breath', 'breaths per min', 14, 8, 30, 0.5);
tdef('human', 'Hu.sway', 'postural sway mm', 5, 0, 20, 0.5);
tdef('human', 'Hu.throw', 'throw effort', 0.55, 0.2, 1, 0.05);
tdef('human', 'Hu.side', 'approach the dog from the side', 1, 0, 1, 1);
const TUNE_LABEL = { layers: 'layers', personality: 'personality', body: 'body', brain: 'choice', learn: 'learning', world: 'day and sleep', senses: 'senses', human: 'human' };
// personality presets, z scores
const PRESETS = {
  balanced: { label: 'balanced', P: {} },
  velcro: { label: 'velcro lab', P: { sociability: 1.6, trainability: 1.2, activity: 0.4, independence: -1, fearfulness: -0.6 } },
  anxious: { label: 'anxious rescue', P: { fearfulness: 1.7, reactivity: 1.4, sociability: -0.4, trainability: -0.3, activity: -0.2 } },
  herder: { label: 'herding nut', P: { activity: 1.8, reactivity: 1.2, trainability: 1.4, aggression: 0.4, independence: -0.3 } },
  couch: { label: 'couch potato', P: { activity: -1.8, reactivity: -1, sociability: 0.6, fearfulness: -0.5 }, age: 96 },
  hound: { label: 'stubborn hound', P: { independence: 1.7, trainability: -1.2, activity: 0.3, sociability: 0.2 } },
  puppy: { label: 'puppy', P: { activity: 1.4, trainability: -0.8, reactivity: 0.8, sociability: 1 }, age: 4 }
};
const TRAITS = ['reactivity', 'fearfulness', 'aggression', 'sociability', 'trainability', 'independence', 'activity'];
const PT = t => (TUNE.v['P.' + t] || 0) + (PDRIFT[t] ? PDRIFT[t].x : 0); // trait plus slow drift
const PDRIFT = {};
TRAITS.forEach(t => { PDRIFT[t] = new ORG.OU(600, 0.12); });
// only values that differ from the defaults are kept, so a new build's defaults reach saved sessions.
// the first format saved every value; from that one only the personality survives, the rest go back to current defaults.
function tuneLoad() { if (store.get('tune', null)) TREG.restore(); }
function tuneSave() { store.set('tune', TREG.toJSON()); }
function applyPreset(name) {
  const p = PRESETS[name]; if (!p) return;
  TRAITS.forEach(t => { TUNE.v['P.' + t] = p.P[t] || 0; }); TUNE.v['P.age'] = p.age || 30; tuneSave(); tuneUI.refresh();
}
function seedPersonality(name) {
  const r = ORG.mulberry(ORG.hash('hackle:' + name.toLowerCase()));
  TRAITS.forEach(t => { TUNE.v['P.' + t] = Math.round(clamp(ORG.gauss(r) * 0.75, -2, 2) * 10) / 10; });
  TUNE.v['P.age'] = Math.round(8 + r() * 90);
  TUNE.v['Se.az'] = Math.round((1.3 + r() * 11.9) * 10) / 10; // every dog hears direction a little differently
  tuneSave(); tuneUI.refresh();
}
// the tune panel builds itself from the registry
const tuneUI = {
  el: null,
  build(el) {
    this.el = el; let h = '';
    for (const g of Object.keys(TUNE.groups)) {
      const keys = TUNE.groups[g];
      if (g === 'personality') {
        h += `<details class="hb-fold" open><summary>personality <span class="aux" id="tuneWho">seeded by name</span></summary><div><div class="chips" id="presetBtns">` +
          Object.entries(PRESETS).map(([k, p]) => `<button class="hb-chip" type="button" data-preset="${k}">${p.label}</button>`).join('') +
          `<button class="hb-chip" type="button" id="bSeed">from the name</button></div>` + keys.map(k => this.row(k)).join('') +
          `<p class="note">seven temperament dimensions from the jones and gosling review, as z scores. each feeds startle thresholds, latencies, drive growth, learning rate and how far the dog roams. traits drift a little over days, since real temperament test retest reliability is only about .45.</p></div></details>`;
      } else if (g === 'layers') {
        h += `<details class="hb-fold" open><summary>turn parts of the model off <span class="aux">${keys.length} layers</span></summary><div>` + keys.map(k => `<label class="hb-check"><input type="checkbox" data-tk="${k}"${TUNE.v[k] ? ' checked' : ''}>${TUNE.defs[k].label}</label>`).join('') + `</div></details>`;
      } else {
        h += `<details class="hb-fold"><summary>${TUNE_LABEL[g] || g} <span class="aux">${keys.length}</span></summary><div>` + keys.map(k => this.row(k)).join('') + `</div></details>`;
      }
    }
    h += `<div class="btns" style="margin-top:var(--hb-s3)"><button class="hb-btn" type="button" id="bTuneExp">Export settings</button><label class="hb-btn" for="tuneImp" tabindex="0">Import settings</label><input type="file" id="tuneImp" accept=".json,application/json" hidden><button class="hb-btn" type="button" id="bTuneReset">Reset every number</button></div>`;
    el.innerHTML = uiHtml(h);
    el.querySelectorAll('input[data-tk]').forEach(inp => {
      const k = inp.dataset.tk;
      inp.addEventListener(inp.type === 'checkbox' ? 'change' : 'input', () => {
        TUNE.v[k] = inp.type === 'checkbox' ? (inp.checked ? 1 : 0) : +inp.value; tuneSave();
        const o = el.querySelector(`[data-tv="${k}"]`); if (o) o.textContent = this.fmt(k);
        if (TUNE.onChange) TUNE.onChange(k);
      });
    });
    el.querySelectorAll('[data-preset]').forEach(b => b.onclick = () => { applyPreset(b.dataset.preset); toast('personality: ' + PRESETS[b.dataset.preset].label); });
    $('bSeed').onclick = () => { seedPersonality($('dogName').value || 'Pixel'); toast('personality drawn from the name ' + ($('dogName').value || 'Pixel')); };
    $('bTuneExp').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(TREG.snapshot(), null, 1)], { type: 'application/json' })); a.download = 'hackle-tune.json'; a.click(); };
    $('tuneImp').onchange = async e => { try { const j = JSON.parse(await e.target.files[0].text()); TREG.load(j); tuneSave(); this.refresh(); toast('settings imported'); } catch (err) { toast('could not read that file'); } };
    $('bTuneReset').onclick = () => { TREG.reset(); tuneSave(); this.refresh(); toast('defaults restored'); };
  },
  fmt(k) { const d = TUNE.defs[k], v = TUNE.v[k]; return d.step >= 1 ? String(Math.round(v)) : v.toFixed(d.step < 0.01 ? 3 : 2); },
  row(k) { const d = TUNE.defs[k], id = 'tk-' + k.replace(/\W/g, '-'); return `<div class="rangerow tunerow" title="${(d.note || '').replace(/"/g, '')}"><label for="${id}">${d.label}</label><input type="range" id="${id}" data-tk="${k}" min="${d.min}" max="${d.max}" step="${d.step}" value="${TUNE.v[k]}"><output data-tv="${k}" for="${id}">${this.fmt(k)}</output></div>`; },
  refresh() { if (!this.el) return; this.el.querySelectorAll('input[data-tk]').forEach(inp => { const k = inp.dataset.tk; if (inp.type === 'checkbox') inp.checked = !!TUNE.v[k]; else inp.value = TUNE.v[k]; const o = this.el.querySelector(`[data-tv="${k}"]`); if (o) o.textContent = this.fmt(k); }); }
};
// game clock: hours 0..24, advanced by tempo
const CLOCK = { h: 10, day: 0, light: 1 };
function clockTick(dt, tempo) {
  if (!ON('L.day')) { CLOCK.light = 1; return; }
  CLOCK.h += dt * tempo * 24 / (TV('W.dayMin') * 60);
  if (CLOCK.h >= 24) { CLOCK.h -= 24; CLOCK.day++; }
  // smooth daylight: 0 at night, 1 in the day, dawn 5.5 to 7.5, dusk 18 to 20
  const h = CLOCK.h; CLOCK.light = h < 12 ? ss(5.5, 7.5, h) : 1 - ss(18.2, 20.2, h);
}
const gameMin = dtReal => dtReal * 24 * 60 / (TV('W.dayMin') * 60); // real seconds to game minutes
