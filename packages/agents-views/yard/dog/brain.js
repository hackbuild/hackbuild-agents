// ---------- brain ----------
const BEH = ['idle', 'explore', 'sniff', 'eat', 'treat', 'fetch', 'chase', 'greet', 'beg', 'playbow', 'zoomies', 'rest', 'sleep', 'obey', 'confused', 'shake', 'appease', 'stretch', 'investigate', 'follow', 'waitdoor', 'nudge'];
const LINES = {
  idle: ['...', 'hm.', 'what was that', 'nice out', 'ears on'], explore: ['what is over there', 'patrol', 'new smells', 'checking the perimeter'],
  sniff: ['sniff sniff', 'someone was here', 'smells like food', 'following my nose'], eat: ['nom', 'food time', 'crunch crunch'], treat: ['TREAT', 'mine'],
  fetch: ['BALL', 'ball ball ball', 'mine.', 'BALL.', 'zoom'], chase: ['SQUIRREL', 'intruder.', 'get back here'],
  greet: ['hi hi hi', 'my human.', 'pet me'], beg: ['please', 'so hungry', 'look at my eyes'], playbow: ['play with me', 'chase me.', 'ready ready'],
  zoomies: ['ZOOM', 'cannot stop', 'wheee'], rest: ['flop', 'just a minute', 'resting my legs'], sleep: ['zzz', 'zzz zzz', 'dreaming of balls'], obey: ['on it', 'like this?', 'did it'], confused: ['?', 'huh?', 'what does that mean'],
  shake: ['brrrr', 'shake it off'], appease: ['sorry sorry', 'I did not mean it', '...'], stretch: ['mmmmh', 'big stretch'], investigate: ['what is that', 'careful...', 'over there?'],
  follow: ['walkies', 'right behind you', 'sniff, catch up, sniff'], waitdoor: ['where did he go', 'waiting...', 'any minute now'], nudge: ['hey', 'look at me', 'pay attention to me']
};
// expected effect of each behavior on the internal deficits, for drive reduction reward (Keramati and Gutkin 2011)
const EFFECT = {
  explore: { curiosity: -0.35, fatigue: 0.03 }, sniff: { curiosity: -0.2 }, eat: { hunger: -0.5 }, treat: { hunger: -0.15, play: -0.05 },
  fetch: { play: -0.4, social: -0.1, fatigue: 0.05 }, chase: { prey: -0.7, play: -0.15, fatigue: 0.06 }, greet: { social: -0.45 }, beg: { hunger: -0.2, social: -0.05 },
  playbow: { play: -0.25, social: -0.15 }, zoomies: { play: -0.6, fatigue: 0.08 }, rest: { fatigue: -0.25 }, sleep: { fatigue: -0.7 }, investigate: { curiosity: -0.3 }
};
const REACTIVE = new Set(['obey', 'confused', 'chase', 'treat', 'fetch', 'appease', 'shake', 'stretch', 'investigate', 'follow', 'greet']);
const brain = {
  cur: 'idle', t: 0, sub: '', subT: 0, v: 0.25, a: 0.35,
  d: { hunger: 0.35, fatigue: 0.15, play: 0.5, social: 0.4, curiosity: 0.5, prey: 0 },
  util: {}, goal: null, goalT: 0, cmd: null, trial: null, sayT: 0, line: '...',
  W: {}, N: {}, al: {}, offer: {}, trace: [], mem: [], imp: 0, visits: new Map(), barkT: 0, startle: 0, sleepWake: 0,
  bond: 0.5, Sp: 0.25, stage: 'awake', stageT: 0, stageDur: 0, hyp: [], pending: null, dwell: 0, done: false, begRel: { n: 2, ok: 1 }, prevD: {}, negT: -99,
  speedMul() { return (this.cur === 'sleep' ? 0.6 : 1) * (1 - this.d.fatigue * 0.35) * (this.v < -0.3 ? 0.85 : 1) * (ON('L.organic') ? 1 + 0.08 * PT('activity') : 1); },
  init() {
    const saved = store.get('W', null);
    if (saved && saved.W) { this.W = saved.W; this.N = saved.N || {}; this.al = saved.al || {}; this.offer = saved.offer || {}; this.bond = saved.bond ?? 0.5; }
    else if (saved && !saved.W) this.W = saved; else this.seed();
    for (const c in this.W) this.ensure(c);
    renderCueButtons(); renderHeat();
  },
  persist() { store.set('W', { W: this.W, N: this.N, al: this.al, offer: this.offer, bond: this.bond }); },
  ensure(c) { if (!this.N[c]) this.N[c] = Object.fromEntries(ACTIONS.map(a => [a, 0])); if (this.al[c] == null) this.al[c] = 0.6; },
  seed() {
    this.W = {}; this.N = {}; this.al = {}; this.offer = {};
    const prior = { sit: 0.5, come: 0.55, down: 0.3, fetch: 0.35, bed: 0.15, speak: 0.12, spin: 0.08, stay: 0.2, paw: 0.08 };
    for (const a of ACTIONS) { this.W[a] = Object.fromEntries(ACTIONS.map(b => [b, b === a ? prior[a] : 0.02 + RNG() * 0.03])); this.ensure(a); }
    for (const a of ACTIONS) this.offer[a] = a === 'sit' ? 1 : a === 'down' ? 0.5 : 0.15;
  },
  V(c, a) { return (this.W[c] ? this.W[c][a] : 0) - (ON('L.learn') && this.N[c] ? this.N[c][a] : 0); },
  say(s, dur = 2.5) { if (!s) return; this.line = s; this.sayT = dur; },
  remember(txt, imp) { this.mem.unshift({ t: now, h: CLOCK.day * 24 + CLOCK.h, txt, imp, ev: EV.n }); if (this.mem.length > 60) this.mem.pop(); this.imp += imp; },
  set(b, why = '') {
    // read only taps: the why, which path chose it, and an act event caused by the pending choice
    const kind = this.kindNext || 'top', cause = this.causeNext || null; this.kindNext = null; this.causeNext = null;
    if (b !== this.cur) this.evAct = EV.emit({ agent: 'dog', kind: 'act', text: b + (why ? ', ' + why : ''), b, cause });
    this.why = why; this.whyKind = kind; this.whyAt = now;
    if (b !== this.cur) {
      const prev = this.cur;
      this.cur = b; this.t = 0; this.sub = ''; this.subT = 0; this.done = false; this.say(pick(LINES[b] || ['...']), 2.6);
      motor.mode = 'stop'; motor.face = null; motor.ignore = null; dog.postureT.sit = dog.postureT.down = dog.postureT.bow = dog.postureT.reach = 0; dog.pawLift = 0;
      if (dog.org) dog.org.inert.capture();
      if (prev === 'sleep') { this.stage = 'awake'; if (dog.org) dog.org.rem = 0; }
      this.dwell = now + (ON('L.noise') ? ORG.exg(TV('Br.dwellMu'), 1, TV('Br.dwellTau')) : 6);
    }
  },
  stimulus(kind, s = 1) {
    if (kind === 'prey') { this.d.prey = clamp(this.d.prey + 0.7 * s, 0, 1); this.a = clamp(this.a + 0.4, 0, 1); bark(dog.root.position, 1, 2); dog.earPerk = 1; }
    else if (kind === 'food') { this.d.hunger = clamp(this.d.hunger + 0.25 * s, 0, 1); this.a += 0.15; if (dist2(dog.pos, YOU) < 9) this.force('beg', 5); }
    else if (kind === 'play') { this.d.play = clamp(this.d.play + 0.3, 0, 1); this.a = clamp(this.a + 0.3, 0, 1); this.v = clamp(this.v + 0.2, -1, 1); this.force('playbow', 2.5); }
    else if (kind === 'bow') { this.d.play = clamp(this.d.play + 0.25, 0, 1); this.force('playbow', 2.5); }
    else if (kind === 'social' || kind === 'smile') { this.d.social = clamp(this.d.social - 0.05, 0, 1); this.v = clamp(this.v + 0.1 * s, -1, 1); this.a = clamp(this.a + 0.05, 0, 1); }
    else if (kind === 'fear') { this.v = clamp(this.v - 0.5, -1, 1); this.a = clamp(this.a + 0.4, 0, 1); dog.earPerk = -1; dog.hop = 0.03; whine(dog.root.position); this.negT = now; }
    else if (kind === 'bark') { bark(dog.root.position, 0.9, 3); this.a = clamp(this.a + 0.3, 0, 1); }
    else if (kind === 'sniff') { this.d.curiosity = clamp(this.d.curiosity + 0.3, 0, 1); this.force('sniff', 5); }
    else if (kind === 'rest') { this.d.fatigue = clamp(this.d.fatigue + 0.1, 0, 1); }
  },
  force(b, dur) { this.forced = { b, until: now + dur }; },
  wake(why) { if (this.cur !== 'sleep') return; this.Sp = Math.max(0, this.Sp - 0.05); this.stage = 'awake'; this.kindNext = 'woke'; this.set('stretch', why || 'woke up'); },
  hear(pos, loud, type) {
    { const az = wrapA(Math.atan2(pos.x - dog.pos.x, pos.z - dog.pos.z) - dog.yaw); this.lastHeard = { type, loud, az, t: now };
      const lt = (this.heardT || (this.heardT = {}))[type]; if (loud >= 0.2 && !(lt > now - 1.5)) { this.heardT[type] = now; this.evHeard = EV.emit({ agent: 'dog', kind: 'sense', sense: 'ear', text: 'heard a ' + type + ', loudness ' + loud.toFixed(2) + ', ' + Math.abs(az * 180 / Math.PI).toFixed(0) + ' deg ' + (az >= 0 ? 'left' : 'right') }); } }
    // sleepers wake to loud sounds more easily in light sleep and REM than in deep NREM
    if (this.cur === 'sleep') { const thr = this.stage === 'nrem' ? 0.75 : 0.45; if (loud < thr) return; this.wake('woken by a ' + type); }
    const react = ON('L.organic') ? 0.75 - 0.08 * PT('reactivity') : 0.75;
    if (loud > react) { this.startle = 0.6; this.a = clamp(this.a + 0.35, 0, 1); dog.hop = 0.03; dog.earPerk = 1; }
    if (type !== 'bounce' || !ball.held) {
      // localization error: per dog azimuth noise, smaller once the head points at it, with rare front back confusion
      let p = pos.clone();
      if (ON('L.noise')) {
        const to = p.clone().sub(dog.root.position), az = Math.atan2(to.x, to.z), r = Math.hypot(to.x, to.z);
        const facing = Math.abs(wrapA(az - dog.yaw - dog.head.yaw)) < 0.4;
        const a2 = HSENSE.localizeSound(az, dog.yaw, TV('Se.az'), facing, RNG); p.set(dog.root.position.x + Math.sin(a2) * r, pos.y, dog.root.position.z + Math.cos(a2) * r);
      }
      this.soundLook = { p, until: now + 1.0 }; dog.earPerk = Math.max(dog.earPerk, 0.7);
    }
  },
  named(pitchUp = 0) {
    // dog directed speech: higher pitch pulls puppies in, adults barely care (Ben-Aderet 2017)
    const pup = TV('P.age') < 12 ? 1 : 0, gain = 1 + pitchUp * (pup ? 1.5 : 0.2);
    this.attn = now + 6 * gain; if (this.cur === 'sleep' && RNG() < 0.7 * gain) this.wake('heard its name'); dog.earPerk = 1; this.soundLook = { p: V3(YOU.x, 1.5, YOU.z), until: now + 1.5 };
  },
  // reunion: greeting intensity rises with absence and levels off by about 2 h (Rehn and Keeling 2011)
  reunion(hours) {
    const I = clamp(0.35 + 0.65 * Math.min(hours / 2, 1), 0, 1); this.reunionI = I; this.d.social = 1; this.a = clamp(this.a + 0.5 * I, 0, 1); this.v = clamp(this.v + 0.4, -1, 1);
    if (this.cur === 'sleep') this.wake('he came home'); this.force('greet', 4 + 4 * I); this.remember('my human came home after ' + hours.toFixed(1) + ' hours', 6 * I);
  },
  release() { if (this.cmd) this.cmd = null; this.v = clamp(this.v + 0.15, -1, 1); this.say('free.', 1.5); },
  cue(word) {
    if (!word) return;
    word = word.toLowerCase().slice(0, 18);
    const cueEv = EV.emit({ agent: 'dog', kind: 'cue', text: 'heard "' + word + '"' });
    if (!this.W[word]) { this.W[word] = Object.fromEntries(ACTIONS.map(b => [b, 0.02 + RNG() * 0.03])); this.ensure(word); renderCueButtons(); }
    if (this.cur === 'sleep') this.wake('heard "' + word + '"');
    const tr = ON('L.organic') ? PT('trainability') : 0;
    const distract = this.d.prey * 1.5 + (this.cur === 'chase' ? 1 : 0) + (this.attn > now ? -0.4 : 0) - tr * 0.12;
    // everyday non compliance is high (Browne: 44 percent of sit and down ignored); more when he is not watching
    const watched = HUM.lookingAtDog || (HUM.task && HUM.task.name === 'train');
    if (ON('L.organic') && RNG() < clamp(TV('Br.ignore') - 0.08 * tr + 0.4 * distract + (watched ? 0 : 0.15), 0.03, 0.85) && this.V(word, pick(ACTIONS)) < 2) {
      this.trial = { cue: word, action: 'ignored', t0: now, done: now, rewarded: false, ev: cueEv }; dog.earPerk = Math.max(dog.earPerk, 0.5); this.say(pick(['...', 'hm?', '']), 1); renderHeat(word, null); return;
    }
    let best = 'none', bs = 0.75 + distract;
    for (const a of ACTIONS) { const g = -Math.log(-Math.log(RNG() + 1e-9) + 1e-9) * 0.55; const s = this.V(word, a) * 4 * (1 + 0.1 * tr) + g; if (s > bs) { bs = s; best = a; } }
    // nothing strong: offer something it has been rewarded for before (free operant history), or a random guess
    if (best === 'none' && RNG() < 0.5 && distract < 0.8) { best = ON('L.learn') ? this.sampleOffer() : pick(['sit', 'down', 'spin', 'speak', 'paw', 'come']); this.say('this?', 2); }
    this.trial = { cue: word, action: best, t0: now, done: null, rewarded: false, ev: cueEv };
    dog.postureT.sit = dog.postureT.down = dog.postureT.bow = dog.postureT.reach = 0; dog.pawLift = 0; motor.mode = 'stop';
    const lat = ON('L.noise') ? ORG.exg(TV('Br.cueMu') * (1 - 0.15 * tr), 0.08, TV('Br.cueTau') * (1 - 0.2 * tr)) : 0;
    const go = () => {
      this.kindNext = 'cue'; this.causeNext = cueEv;
      if (best === 'none') { this.set('confused', 'did not understand "' + word + '"'); this.cmd = { action: 'none', t: 0 }; }
      else { this.cmd = { action: best, t: 0, cue: word }; this.set('obey', '"' + word + '" means ' + best + ' (V=' + this.V(word, best).toFixed(2) + ', latency ' + Math.round(lat * 1000) + ' ms)'); }
      this.trace.unshift({ cue: word, action: best, t: now, done: null }); if (this.trace.length > 8) this.trace.pop();
    };
    this.pending = null; if (lat > 0.05) { this.pending = { fn: go, at: now + lat, look: V3(YOU.x, 1.5, YOU.z), b: best === 'none' ? 'confused' : 'obey' }; dog.earPerk = 1; } else go();
    renderHeat(word, best);
  },
  sampleOffer() { const e = ACTIONS.filter(a => a !== 'fetch' && a !== 'bed' && a !== 'come').map(a => [a, Math.exp((this.offer[a] || 0.1) * 2)]); let tot = e.reduce((s, x) => s + x[1], 0), r = RNG() * tot; for (const [a, w] of e) if ((r -= w) <= 0) return a; return 'sit'; },
  // a trick the dog does on its own (free operant): reward can later attach it to whatever cue the human says
  offerTrick(a) { this.offered = { a, t: now }; this.trace.unshift({ cue: null, action: a, t: now, done: now }); if (this.trace.length > 8) this.trace.pop(); },
  reward(r, src) {
    EV.emit({ agent: 'dog', kind: 'reward', text: (r > 0 ? 'got ' : 'was told off: ') + src + ' (' + (r > 0 ? '+' : '') + r.toFixed(1) + ')', cause: this.trial && now - this.trial.t0 < 25 ? this.trial.ev : null });
    this.v = clamp(this.v + 0.3 * r, -1, 1); this.a = clamp(this.a + 0.12 * Math.abs(r), 0, 1);
    if (r > 0) { this.d.social = clamp(this.d.social - 0.15 * r, 0, 1); this.bond = clamp(this.bond + 0.012 * r, 0, 1); }
    if (r < 0) this.negT = now;
    if (ON('L.learn')) this.learnTrace(r, src);
    else {
      const tr = this.trial;
      if (tr && !tr.rewarded && tr.action !== 'none' && now - (tr.done || now) < 4.5 && now - tr.t0 < 25) {
        const row = this.W[tr.cue], alpha = 0.35 * Math.abs(r);
        if (r > 0) { row[tr.action] += alpha * (1 - row[tr.action]); for (const a of ACTIONS) if (a !== tr.action) row[a] -= alpha * 0.25 * row[a]; }
        else row[tr.action] += alpha * (0 - row[tr.action]);
        tr.rewarded = true; this.persist(); renderHeat(tr.cue, tr.action);
        $('heard').textContent = (r > 0 ? 'learned: ' : 'unlearned: ') + '"' + tr.cue + '" -> ' + tr.action + ' = ' + row[tr.action].toFixed(2);
      }
    }
    this.remember((r > 0 ? 'got ' : 'was told off: ') + src, Math.abs(r) * 3);
    if (r > 0) { this.say(pick(['yes yes yes', 'yes.', 'I am good', 'happy']), 1.6); } else { this.say(pick(['sorry', 'oh no', '...']), 2); dog.earPerk = -0.8; }
    // a scolding from the human brings the appeasement set, keyed to the human's posture, not to any misdeed (Horowitz 2009)
    if (r < 0 && ON('L.social') && (src === 'no' || src === 'scold') && this.cur !== 'sleep' && (r <= -0.7 || RNG() < 0.2 + 0.25 * PT('fearfulness'))) this.force('appease', 2.5);
  },
  // eligibility traces plus Pearce Kaye Hall associability: credit fades with delay, so a late treat can teach the wrong thing
  learnTrace(r, src) {
    // spaced beats massed practice (Meyer and Ladewig 2008, Demant 2011): many recent trials damp the learning rate
    const recentN = this.trace.filter(e => now - e.t < 120).length;
    const lam = r > 0 ? 1 : 0, base = TV('Ln.alpha') * (1 + 0.15 * PT('trainability')) / (1 + 0.12 * recentN), th = TV('Ln.theta');
    let any = false, txt = '';
    for (const e of this.trace) {
      if (e.credited) continue;
      const age = now - (e.done || e.t), w = Math.exp(-age / TV('Ln.trace')); if (w < 0.05) continue;
      if (e.action === 'none' || e.action === 'ignored') continue;
      if (e.cue) {
        this.ensure(e.cue); const Vv = this.V(e.cue, e.action), al = this.al[e.cue], k = base * al * w * Math.abs(r); const tap = { cue: e.cue, action: e.action, before: Vv, credit: w, r, src, t: now, age };
        if (lam > Vv) { this.W[e.cue][e.action] = clamp(this.W[e.cue][e.action] + k * (lam - Vv), 0, 1.2); for (const a of ACTIONS) if (a !== e.action) this.W[e.cue][a] *= 1 - k * 0.15; }
        else this.N[e.cue][e.action] = clamp(this.N[e.cue][e.action] + k * (Vv - lam), 0, 1.2);
        this.al[e.cue] = clamp((1 - th) * al + th * Math.abs(lam - Vv), 0.05, 1);
        txt = (r > 0 ? 'learned: ' : 'unlearned: ') + '"' + e.cue + '" -> ' + e.action + ' V=' + this.V(e.cue, e.action).toFixed(2) + ' (credit ' + Math.round(w * 100) + '%)';
        tap.after = this.V(e.cue, e.action); this.lastLearn = tap;
        renderHeat(e.cue, e.action);
      }
      this.offer[e.action] = clamp((this.offer[e.action] || 0.1) + (r > 0 ? 0.25 : -0.15) * w * TV('Ln.offer'), 0, 3);
      e.credited = true; any = true;
      if (this.trial && this.trial.cue === e.cue && this.trial.action === e.action) this.trial.rewarded = true;
      break; // the most recent eligible pair takes the credit
    }
    if (txt) $('heard').textContent = txt;
    if (any) this.persist();
  },
  memory(id) { const p = percepts[id]; return p && p.seen > -1e8 ? p : null; },
  driveD(h) { const n = TV('Br.driveN'), m = TV('Br.driveM'), w = { hunger: 1, fatigue: 1, play: 0.8, social: 0.9, curiosity: 0.6, prey: 1.1 }; let s = 0; for (const k in w) s += w[k] * Math.pow(Math.max(h[k] || 0, 0), n); return Math.pow(s, 1 / m); },
  gain(K, scale = 1) { const h = Object.assign({}, this.d); for (const k in K) h[k] = clamp(h[k] + K[k] * (K[k] < 0 ? scale : 1), 0, 1); return TV('Br.gain') * (this.driveD(this.d) - this.driveD(h)); },
  bodyClock(h) { // sleepiness from the body clock: activity peaks near 7 and 19 with a midday dip (Scientific Reports 2020)
    const day = ss(5.5, 7.5, h) * (1 - ss(20, 22.5, h)), pk = Math.exp(-Math.pow((h - 7) / 1.6, 2)) + Math.exp(-Math.pow((h - 19) / 1.6, 2)), dip = Math.exp(-Math.pow((h - 13.5) / 1.8, 2));
    return clamp(1 - (0.6 * day + 0.45 * pk - 0.22 * dip), 0, 1);
  },
  tick(dt) {
    const d = this.d, tempo = +$('tempo').value, org = ON('L.organic');
    const moving = Math.abs(dog.v);
    const act = org ? PT('activity') : 0, soc = org ? PT('sociability') : 0, pup = TV('P.age') < 12 && org;
    d.hunger = clamp(d.hunger + 0.0022 * dt * tempo, 0, 1);
    // sleep pressure plus the body clock, or the old linear fatigue
    if (ON('L.sleep')) {
      const gh = dt * tempo * 24 / (TV('W.dayMin') * 60); // game hours this frame
      if (this.cur === 'sleep' && this.stage !== 'goto') this.Sp = clamp(this.Sp - TV('S.down') * gh, 0, 1);
      else this.Sp = clamp(this.Sp + TV('S.up') * gh * (0.7 + 0.6 * clamp(moving / 2, 0, 1)) * (pup ? 1.4 : 1) * (1 - 0.1 * act), 0, 1);
      this.circ = ON('L.day') ? this.bodyClock(CLOCK.h) : 0.3;
      d.fatigue = clamp(0.8 * this.Sp + 0.45 * this.circ - 0.15 + (moving > 2 ? 0.05 : 0), 0, 1);
    } else d.fatigue = clamp(d.fatigue + (0.0007 + 0.0035 * moving) * dt * tempo - (this.cur === 'sleep' ? 0.014 : this.cur === 'rest' ? 0.004 : 0) * dt * tempo, 0, 1);
    d.play = clamp(d.play + 0.0045 * dt * tempo * (1 + 0.25 * act) * (pup ? 1.3 : 1) - ((this.cur === 'fetch' || this.cur === 'chase') ? 0.006 : this.cur === 'zoomies' ? 0.03 : 0) * dt, 0, 1);
    const nearYou = Math.hypot(dog.pos.x - YOU.x, dog.pos.z - YOU.z) < 1.8;
    d.social = clamp(d.social + 0.0032 * dt * tempo * (1 + 0.3 * soc) - (nearYou ? 0.01 : 0) * dt, 0, 1);
    d.curiosity = clamp(d.curiosity + 0.004 * dt * tempo * (1 + 0.15 * act), 0, 1);
    d.prey = clamp(d.prey - 0.03 * dt, 0, 1);
    dog.heat = clamp(dog.heat + (moving > 2 ? 0.05 : -0.025) * dt, 0, 1);
    // drives crossing a threshold count as important events for the cortex
    for (const k in d) { if ((this.prevD[k] || 0) < 0.7 && d[k] >= 0.7) this.remember(k + ' got strong', 2); this.prevD[k] = d[k]; }
    // affect relaxes toward a baseline set by needs
    const need = (d.hunger + d.fatigue + d.social) / 3;
    this.v += ((0.35 - need * 0.7) - this.v) * dt * 0.08;
    this.a += ((0.25 + d.play * 0.3 + d.prey * 0.4 - (this.cur === 'sleep' ? 0.25 : 0)) - this.a) * dt * 0.15;
    dog.earPerk += ((this.a - 0.4) * 1.2 - dog.earPerk) * dt * 1.5;
    dog.hop = Math.max(0, dog.hop - dt * 0.12); this.startle = Math.max(0, this.startle - dt);
    if (ON('L.learn')) { const k = Math.exp(-TV('Ln.inhib') * dt / 60); for (const c in this.N) for (const a in this.N[c]) this.N[c][a] *= k; }
    // bond: mutual gaze, praise and touch raise it (MacLean and Hare 2015), it decays very slowly
    if (ON('L.social')) {
      const youH = humHead(tmpV[6]); const hf = headForward(tmpV[7]); const toY = youH.clone().sub(headWorld(dog.eyeL, V3())).normalize();
      this.lookingAtYou = hf.dot(toY) > 0.86; this.mutual = this.lookingAtYou && HUM.lookingAtDog;
      if (this.mutual) { this.bond = clamp(this.bond + dt * 0.0025 * (1 + 0.3 * soc), 0, 1); this.v = clamp(this.v + dt * 0.01, -1, 1); }
      this.bond = clamp(this.bond - dt * 0.00002, 0.05, 1);
    }
    if (ON('L.social')) this.signals(dt);
    const cell = Math.round(dog.pos.x / 2) + ',' + Math.round(dog.pos.z / 2);
    if (!this.visits.has(cell) || now - this.visits.get(cell) > 60) d.curiosity = clamp(d.curiosity - 0.04, 0, 1);
    this.visits.set(cell, now);
    const sp = percepts.squirrel; if (sp && sp.vis) d.prey = clamp(d.prey + dt * 0.8 * (1 + 0.2 * (org ? PT('aggression') : 0)), 0, 1);
    if (this.cortexGoal && this.cortexGoal.until < now) this.cortexGoal = null;
    this.utilities();
    this.choose(dt);
    this.t += dt;
    if ($('manual').checked) { this.cmd = null; for (const k in dog.postureT) dog.postureT[k] = 0; dog.pawLift = 0; const s = percepts.ball; if (s && s.vis) lookAt(s.pos); else lookForward(-0.05); this.why = 'manual drive: you are the motor cortex'; this.whyKind = 'you'; return; }
    if (this.pending && this.pending.look) lookAt(this.pending.look); else this.run(dt);
    this.sayT -= dt; if (this.sayT < -4 + RNG()) this.say(pick(LINES[this.cur] || ['...']), 2.4);
  },
  // anticipation, frustration and fear drive ears and face rules; calming signals rise with close social pressure (Mariti 2017)
  signals(dt) {
    const watching = HUM.lookingAtDog && !HUM.phoneOn && !HUM.away; this.watched = watching;
    if (this.mutual) this.mutualT = now;
    const holding = HUM.holding || (HUM.task && (HUM.task.name === 'throw' || HUM.task.name === 'get_ball')), near = dist2(dog.pos, YOU) < 3;
    const anticT = (holding && (this.cur === 'fetch' || this.lookingAtYou) ? 0.9 : 0) + (this.pending && this.pending.b === 'obey' ? 0.6 : 0) + (this.cur === 'beg' && dog.posture.sit > 0.8 ? 0.5 : 0) + (HUM.task && HUM.task.name === 'feed' ? 0.8 : 0);
    const frusT = (this.cur === 'beg' && this.t > 5 ? 0.6 : 0) + (this.cur === 'fetch' && this.sub === 'wait' && this.subT > 5 ? 0.7 : 0) + (this.cur === 'nudge' && this.t > 4 ? 0.6 : 0) + ((this.search || 0) > 2 ? 0.5 : 0);
    const fearT = clamp(-this.v - 0.2, 0, 1) * this.a + HUM.threat * clamp(0.3 + 0.35 * PT('fearfulness'), 0, 1) + (this.startle > 0 ? 0.4 : 0);
    const k = 1 - Math.exp(-dt * 2.5); this.antic = clamp((this.antic || 0) + (clamp(anticT, 0, 1) - (this.antic || 0)) * k, 0, 1); this.frus = clamp((this.frus || 0) + (clamp(frusT, 0, 1) - (this.frus || 0)) * k * 0.6, 0, 1); this.fear = clamp((this.fear || 0) + (clamp(fearT, 0, 1) - (this.fear || 0)) * k, 0, 1);
    // nose licks: about one every 18 s when frustrated (derived from Bremhorst rates); also part of the calming set
    if (this.frus > 0.5 && RNG() < dt / 18) this.lickUntil = now + 0.35;
    // calming signals near a pressing human: head turns, nose licks, freezing, ground sniffing; head pats on a wary dog count too
    const press = (near ? 1 : 0) * (HUM.threat * 1.5 + (HUM.reach && dist2(dog.pos, YOU) < 1.2 ? 0.4 : 0) + this.fear * 0.8) * (0.6 + 0.3 * PT('fearfulness') - 0.3 * (this.bond - 0.5));
    if (press > 0.2 && !this.calm && RNG() < dt * press * 0.5) {
      const r = RNG(); this.calm = r < 0.4 ? { k: 'turn', until: now + ORG.exg(0.8, 0.2, 0.5), side: RNG() < 0.5 ? 1 : -1 } : r < 0.7 ? { k: 'lick', until: now + 0.35 } : r < 0.85 ? { k: 'freeze', until: now + ORG.exg(1, 0.3, 0.8) } : { k: 'sniff', until: now + ORG.exg(1.5, 0.4, 1) };
      if (this.calm.k === 'lick') this.lickUntil = this.calm.until;
    }
    if (this.calm && now > this.calm.until) this.calm = null;
    // stay holds while he watches; unwatched it frays (Call 2003: watched dogs behave differently)
    if (this.cmd && this.cmd.action === 'stay' && !watching) { this.unw = (this.unw || 0) + dt; if (this.unw > 2 && RNG() < dt * 0.15 * (1 + 0.4 * PT('independence'))) { this.cmd = null; this.done = true; this.say('he is not looking...', 1.6); } } else this.unw = 0;
    if (this.reunionI) this.reunionI = Math.max(0, this.reunionI - dt * 0.02);
  },
  utilities() {
    const U = this.util, d = this.d, org = ON('L.organic');
    const ballP = this.memory('ball'), treatK = Object.keys(percepts).find(k => k.startsWith('treat') && percepts[k].conf > 0.3);
    const ballMoving = ballP && ballP.vis && ballP.speed > 1.2;
    const ballAtYou = ball && !ball.held && bodyPos(ball).distanceTo(V3(YOU.x, bodyPos(ball).y, YOU.z)) < 1.3;
    const nearYou = Math.hypot(dog.pos.x - YOU.x, dog.pos.z - YOU.z) < 1.8, youDist = dist2(dog.pos, YOU);
    const sc = scentAt(dog.pos.x, dog.pos.z), youVis = percepts.you && percepts.you.vis;
    const sleepy = ON('L.sleep') ? 0.8 * this.Sp + 0.5 * (this.circ ?? 0.3) : d.fatigue;
    if (ON('L.drives')) {
      const G = (b, s = 1) => this.gain(EFFECT[b], s);
      const base = (org ? 1 : 1), sb = ON('L.social') ? (youVis ? 1.25 : 0.8) : 1; // secure base: exploring is worth more with the human in view
      U.idle = 0.12;
      U.explore = G('explore', sb) * (1 + 0.1 * PT('activity'));
      U.sniff = sc > 0.04 || this.cur === 'sniff' ? G('sniff') * 0.8 + d.hunger * sc * 0.6 : G('sniff') * 0.3;
      U.eat = foodAmt > 0.05 ? this.gain({ hunger: -Math.min(0.6, foodAmt) }) : d.hunger > 0.6 ? 0.12 : 0;
      U.treat = treatK ? 0.35 + G('treat') : 0;
      U.fetch = ball ? (ball.held ? 0.85 : ballMoving ? 0.35 + G('fetch') * 1.2 : ballP && !ballAtYou ? G('fetch') : ballAtYou ? G('fetch') * 0.25 : 0) : 0;
      U.chase = d.prey > 0.25 && sq.visible ? 0.3 + G('chase') : 0;
      U.greet = G('greet', nearYou ? 0.35 : 1) * (1 + 0.2 * PT('sociability') - 0.15 * PT('independence'));
      const rel = this.begRel.ok / this.begRel.n;
      U.beg = nearYou && d.hunger > 0.4 ? this.gain({ hunger: -0.35 * rel, social: -0.05 }) : 0;
      const lull = Math.abs(dog.v) < 0.4 && HUM.v < 0.6;
      U.playbow = ON('L.social') ? (youDist < 5 && d.play > 0.45 && lull && this.cur !== 'sleep' ? G('playbow') * (HUM.lookingAtDog ? 1.2 : 0.4) : 0) : (ballAtYou && d.play > 0.45 && nearYou ? 0.55 : 0);
      U.zoomies = (d.play > 0.82 && d.fatigue < 0.35 && this.v > 0.3) ? G('zoomies') : 0;
      U.rest = d.fatigue > 0.4 ? G('rest') : 0;
      U.sleep = sleepy > 0.72 || (this.cur === 'sleep' && sleepy > 0.3) ? 0.4 + G('sleep') : 0;
      U.investigate = this.inv && this.inv.until > now ? 0.35 + G('investigate') : 0;
    } else {
      U.idle = 0.14; U.explore = d.curiosity * 0.55; U.sniff = clamp(d.curiosity * 0.25 + d.hunger * sc * 0.5, 0, 0.7);
      U.eat = d.hunger > 0.3 ? d.hunger * (foodAmt > 0.05 ? 1.05 : 0.15) : 0; U.treat = treatK ? 0.55 + d.hunger * 0.4 : 0;
      U.fetch = ball ? (ball.held ? 0.8 : (ballMoving ? 0.55 + d.play * 0.5 : ballP && !ballAtYou ? d.play * 0.75 : ballAtYou ? d.play * 0.2 : 0)) : 0;
      U.chase = d.prey > 0.25 && sq.visible ? 0.4 + d.prey * 0.6 : 0; U.greet = d.social * (nearYou ? 0.35 : 0.85);
      U.beg = nearYou && d.hunger > 0.55 ? d.hunger * 0.6 : 0; U.playbow = ballAtYou && d.play > 0.45 && nearYou ? 0.55 : 0;
      U.zoomies = (d.play > 0.82 && d.fatigue < 0.35 && this.v > 0.3) ? 0.62 : 0; U.rest = d.fatigue > 0.45 ? d.fatigue * 0.55 : 0;
      U.sleep = d.fatigue > 0.7 ? 0.5 + (d.fatigue - 0.7) * 2 : (this.cur === 'sleep' && d.fatigue > 0.12 ? 0.8 : 0); U.investigate = this.inv && this.inv.until > now ? 0.6 : 0;
    }
    U.follow = this.stroll && !HUM.away ? 0.75 + 0.2 * this.bond : 0;
    U.waitdoor = HUM.away ? 0.3 + 0.35 * this.bond + 0.15 * PT('sociability') : 0;
    U.nudge = ON('L.social') && !HUM.away && !this.watched && this.d.social > 0.55 && dist2(dog.pos, YOU) < 6 && HUM.phoneOn ? 0.35 + 0.6 * this.d.social : 0;
    if (this.reunionI > 0.1) U.greet += 0.6 * this.reunionI;
    if (HUM.away) { U.greet = 0; U.beg = 0; U.playbow = 0; }
    U.obey = this.cmd && this.cmd.action !== 'none' ? 0.97 : 0;
    U.confused = this.cmd && this.cmd.action === 'none' ? 0.97 : 0;
    U.shake = U.appease = U.stretch = 0;
    if (this.cortexGoal && U[this.cortexGoal.b] !== undefined) U[this.cortexGoal.b] += 0.35;
    for (const b of BEH) U[b] = U[b] === undefined || !isFinite(U[b]) ? 0 : Math.max(0, U[b]);
    if (this.cur === 'fetch' && (ball.held || this.sub === 'drop' || (percepts.ball && percepts.ball.vis && percepts.ball.speed > 0.5))) U.fetch += 0.3;
    // he left through the gate: nobody to bring the ball to, so fetch ends and waiting at the door can win
    if (HUM.away) U.fetch = 0;
    if (this.cur === 'chase' && this.t < 8) U.chase += 0.3;
    if (this.cur === 'zoomies' && this.t < 7) U.zoomies += 0.5;
    if (this.cur === 'playbow' && this.sub !== 'done') U.playbow += 0.6;
    if (this.cur === 'shake' || this.cur === 'stretch' || this.cur === 'appease') U[this.cur] = this.done ? 0 : 1.2;
    if (this.forced && this.forced.until > now) U[this.forced.b] = Math.max(U[this.forced.b], ['shake', 'appease', 'stretch'].includes(this.forced.b) ? 1.6 : 0.9);
  },
  choose(dt) {
    const U = this.util;
    if (this.pending) { if (now >= this.pending.at) { const p = this.pending; this.pending = null; if (p.fn) p.fn(); else { this.kindNext = p.kind; this.causeNext = p.ev; this.set(p.b, p.why); } } return; }
    let best = 'idle', bv = -1; for (const b of BEH) if (U[b] > bv) { bv = U[b]; best = b; }
    if (!ON('L.sample')) { U[this.cur] += 0.12; if (U[this.cur] >= bv) best = this.cur; if (best !== this.cur) { this.lastChoice = { at: now, U: Object.assign({}, U), cur: this.cur, best, picked: best, path: 'argmax' }; this.kindNext = 'top'; this.causeNext = this.choiceEv(best, whyOf(best), 'top'); this.set(best, whyOf(best)); } return; }
    const commit = TV('Br.commit') * (1 + 0.35 * PT('independence'));
    const curU = U[this.cur] + (this.done ? -1 : commit);
    const lat = mul => ON('L.noise') ? ORG.exg(TV('Br.reactMu') * mul * (1 - 0.12 * PT('reactivity')), 0.06, TV('Br.reactTau') * mul) : 0;
    // react: something much better that cannot wait starts after a short heavy tailed latency, while the head already turns to it
    if (best !== this.cur && bv > curU + 0.05 && (REACTIVE.has(best) || (this.forced && this.forced.b === best && this.forced.until > now))) {
      this.pending = { b: best, why: whyOf(best), at: now + lat(1), look: this.causeOf(best) };
      { const P = this.pending, kind = this.forced && this.forced.b === best && this.forced.until > now ? 'forced' : 'react'; P.kind = kind; this.lastChoice = { at: now, U: Object.assign({}, U), cur: this.cur, curU, commit, best, picked: best, path: 'react', lat: P.at - now }; P.ev = this.choiceEv(best, P.why, kind, P.at - now); }
      return;
    }
    // otherwise choose only when the current act is done or its dwell ran out: sample, so the best option usually but not always wins
    if (this.done || now > this.dwell) {
      const T = TV('Br.temp'), ex = BEH.map(b => [b, Math.exp(((b === this.cur ? curU : U[b]) - bv) / T)]);
      let tot = ex.reduce((s, x) => s + x[1], 0), r = RNG() * tot, pickB = best; for (const [b, w] of ex) if ((r -= w) <= 0) { pickB = b; break; }
      this.dwell = now + ORG.exg(TV('Br.dwellMu'), 1, TV('Br.dwellTau'));
      if (pickB !== this.cur) this.pending = { b: pickB, why: whyOf(pickB) + (pickB !== best ? ', took a lower scored option this time' : ''), at: now + lat(0.6), look: this.causeOf(pickB) };
      else this.done = false;
      this.lastChoice = { at: now, U: Object.assign({}, U), cur: this.cur, curU, commit, T, probs: Object.fromEntries(ex.map(([b, w]) => [b, w / tot])), best, picked: pickB, path: 'sample' };
      if (pickB !== this.cur) { const P = this.pending; P.kind = pickB !== best ? 'sampled' : 'top'; this.lastChoice.lat = P.at - now; P.ev = this.choiceEv(pickB, P.why, P.kind, P.at - now); }
    }
  },
  // the sense event a choice answers: the newest sighting of the thing causeOf() turns the head to
  causeKey(b) { return ({ fetch: 'ball', chase: 'squirrel', greet: 'you', beg: 'you', playbow: 'you', obey: 'you', eat: 'bowl', treat: 'treat', sniff: 'scent', investigate: 'point' })[b] || null; },
  choiceEv(b, why, kind, lat) {
    const k = this.causeKey(b); let cause = null;
    if (k === 'scent') cause = this.evScent || null;
    else if (k === 'treat') { for (const id in percepts) if (id.startsWith('treat') && percepts[id].ev) cause = Math.max(cause || 0, percepts[id].ev); }
    else if (k === 'point') cause = this.evPoint || null;
    else if (k && percepts[k] && percepts[k].ev) cause = percepts[k].ev;
    if (cause && EV.get(cause) && SIMQ.t - EV.get(cause).t > 60) cause = null;
    return EV.emit({ agent: 'dog', kind: 'choice', b, text: b + (why ? ', ' + why : '') + (lat > 0.02 ? ', ' + (kind === 'react' || kind === 'forced' ? 'react' : 'start') + ' in ' + Math.round(lat * 1000) + ' ms' : ''), cause });
  },
  causeOf(b) {
    const p = id => percepts[id] && percepts[id].seen > -1e8 ? percepts[id].pos.clone() : null;
    return ({ fetch: p('ball'), chase: sq.visible ? sq.position.clone() : null, greet: V3(YOU.x, 1.5, YOU.z), beg: V3(YOU.x, 1.5, YOU.z), eat: V3(BOWL.x, 0.1, BOWL.z), playbow: V3(YOU.x, 1.5, YOU.z), investigate: this.inv && this.inv.p, obey: V3(YOU.x, 1.5, YOU.z) })[b] || null;
  },
  // pointing: following depends on gesture type, bond, and distance (Clark et al. 2019 meta analysis)
  point(target, proximal, dynamic) {
    if (this.cur === 'sleep' || this.cur === 'obey') return;
    let follow = true;
    if (ON('L.social')) {
      const dd = dist2(dog.pos, target), z = -0.4 + (proximal ? 1.2 : 0.2) + (dynamic ? 0.6 : 0.1) + 1.4 * (this.bond - 0.5) - 0.3 * PT('independence') - dd * 0.05;
      follow = RNG() < 1 / (1 + Math.exp(-z * 1.6));
    }
    this.evPoint = EV.emit({ agent: 'dog', kind: 'sense', sense: 'eye', text: (follow ? 'saw his point and followed it' : 'saw his point, ignored it') });
    if (follow) { this.inv = { p: target.clone(), until: now + 14, why: 'followed the point' }; this.force('investigate', 1.2); this.remember('the human pointed somewhere', 1.5); }
    else { this.pointT = now; this.say(pick(['?', 'your hand?', 'what']), 1.6); }
  },
  run(dt) {
    const b = this.cur, d = this.d;
    motor.ignore = null;
    const youP = V3(YOU.x, 0, YOU.z), youHead = V3(YOU.x, H(YOU.x, YOU.z) + 1.6, YOU.z);
    const lookSalient = () => {
      const s = attention.focus();
      if (this.soundLook && this.soundLook.until > now) lookAt(this.soundLook.p);
      else if (s) lookAt(s);
      else if (ON('L.noise')) { dog.head.tYaw = dog.org.hn1.x * 0.6; dog.head.tPitch = 0.05; dog.head.tRoll = 0; }
      else { const sw = Math.sin(now * 0.4) * 0.7; dog.head.tYaw = sw; dog.head.tPitch = 0.05; dog.head.tRoll = 0; }
    };
    const P = dog.postureT;
    for (const k in P) P[k] = 0; // each executor states the posture it wants every frame
    if (this.calm && this.calm.k === 'freeze' && b !== 'obey') { motor.mode = 'stop'; return; }
    if (b === 'idle') {
      if (!this.sub) { this.sub = RNG() < 0.35 + 0.1 * PT('activity') * -1 ? 'sit' : 'stand'; this.subT = ON('L.noise') ? ORG.exg(5, 1, 5) : rnd(5, 11); }
      motor.mode = 'stop'; P.sit = this.sub === 'sit' ? 1 : 0; lookSalient();
      if (this.sub === 'sit' && dog.posture.sit > 0.9 && !this.offeredSit && ON('L.learn')) { this.offeredSit = true; this.offerTrick('sit'); }
      this.subT -= dt; if (this.subT < 0) { this.sub = ''; this.offeredSit = false; this.done = true; }
    } else if (b === 'explore') {
      if (!this.wp || this.subT <= 0 || motor.done) { this.wp = exploreTarget(); this.subT = 14; motor.done = false; this.hops = (this.hops || 0) + 1; if (this.hops > 3 && RNG() < 0.4) { this.done = true; this.hops = 0; } }
      motor.mode = 'goto'; motor.target.copy(this.wp); motor.speed = (d.curiosity > 0.6 ? 1.9 : 1.0) * (this.wpFast ? 1.4 : 0.8); motor.stopDist = 0.5; this.subT -= dt;
      lookSalient();
    } else if (b === 'sniff') sniffRun(this, dt);
    else if (b === 'eat') {
      const bp = V3(BOWL.x, 0, BOWL.z);
      motor.mode = 'goto'; motor.target.copy(bp); motor.speed = 1.6; motor.stopDist = 0.52; motor.face = bp; motor.ignore = null;
      if (motor.done && dist2(dog.pos, bp) < 0.6) { P.reach = 1; lookAt(V3(BOWL.x, H(BOWL.x, BOWL.z), BOWL.z)); dog.head.tPitch += Math.sin(now * 9) * 0.08 + (NG.active ? 0.4 : 0); if (foodAmt > 0) { foodAmt = Math.max(0, foodAmt - dt * 0.05); d.hunger = clamp(d.hunger - dt * 0.09, 0, 1); this.v = clamp(this.v + dt * 0.04, -1, 1); } else if (this.t > 4) this.done = true; }
      else lookAt(V3(BOWL.x, 0.1, BOWL.z));
    } else if (b === 'treat') {
      const k = Object.keys(percepts).find(k => k.startsWith('treat') && percepts[k].conf > 0.3); const p = k && percepts[k];
      if (!p || !p.obj || !treats.includes(p.obj)) { this.done = true; return; }
      const tp = bodyPos(p.obj);
      motor.mode = 'goto'; motor.target.copy(tp); motor.speed = 3; motor.stopDist = 0.42; lookAt(tp);
      if (dist2(headWorld(dog.mouthL, tmpV[1]), tp) < 0.2 || (motor.done && this.t > 1)) { P.reach = 1; if (NG.active) dog.head.tPitch += 0.4; if (dist2(headWorld(dog.mouthL, tmpV[1]), tp) < 0.36 || (NG.active && dist2(dog.pos, tp) < 0.55)) { removeDyn(p.obj); d.hunger = clamp(d.hunger - 0.12, 0, 1); this.v = clamp(this.v + 0.2, -1, 1); this.say('crunch', 1.4); if (this.begStart && now - this.begStart < 12) { this.begRel.ok++; this.begStart = 0; } if (ON('L.learn')) this.reward(0.6, 'treat'); } }
    } else if (b === 'fetch') this.fetch(dt, youP, youHead);
    else if (b === 'chase') {
      const spp = sq.position.clone();
      motor.mode = 'goto'; motor.target.copy(spp); motor.speed = 5.2; motor.stopDist = squirrel.state === 'tree' ? 0.75 : 0.25; lookAt(spp.clone().add(V3(0, 0.1, 0)));
      const barkGap = ON('L.organic') ? 0.8 / (1 + 0.4 * PT('aggression')) : 0.8;
      if (squirrel.state === 'tree') { motor.ignore = OBST.find(o => o.kind === 'tree' && Math.hypot(o.x - spp.x, o.z - spp.z) < 0.6); lookAt(spp.clone().add(V3(0, 0.2, 0))); if (now - this.barkT > barkGap && motor.done) { this.barkT = now; bark(dog.root.position, 1.05, 2); emitSound(dog.root.position, 0.5, 'bark'); } }
      else if (now - this.barkT > 1.4 && RNG() < 0.4) { this.barkT = now; bark(dog.root.position, 1.1, 1); }
      if (!sq.visible) this.done = true;
    } else if (b === 'greet') {
      // calm dogs come in on a curve, excited ones straight; then sit and look up
      motor.mode = 'goto'; motor.target.copy(youP); motor.speed = d.social > 0.6 ? 2.8 : 1.4; motor.stopDist = 1.15; motor.face = youP;
      lookAt(youHead); if (motor.done) { P.sit = this.t > 4 ? 1 : 0; if (this.t > 10) this.done = true; }
      if (motor.done && this.lookingAtYou && HUM.lookingAtDog && ON('L.learn') && RNG() < dt * 0.15 * TV('Ln.offer')) { const a = this.sampleOffer(); if (a === 'sit') P.sit = 1; else if (a === 'down') P.down = 1; this.offerTrick(a); }
    } else if (b === 'beg') {
      if (!this.begStart) { this.begStart = now; this.begRel.n++; }
      motor.mode = 'goto'; motor.target.copy(youP); motor.speed = 1.2; motor.stopDist = 0.9; motor.face = youP; lookAt(youHead, 0.2);
      if (motor.done) { P.sit = 1; if (RNG() < dt * 0.25) whine(dog.root.position); if (ON('L.learn') && dog.posture.sit > 0.9 && !this.begOff) { this.begOff = true; this.offerTrick('sit'); } }
      if (this.t > 9) { this.done = true; this.begOff = false; }
    } else if (b === 'playbow') playbowRun(this, dt, youP, youHead);
    else if (b === 'zoomies') {
      if (!this.wp || motor.done || this.subT <= 0) { const a = Math.atan2(dog.pos.x, dog.pos.z) + rnd(1.2, 2.2), r = rnd(4, 9); this.wp = V3(Math.sin(a) * r, 0, Math.cos(a) * r); this.subT = 3; motor.done = false; }
      motor.mode = 'goto'; motor.target.copy(this.wp); motor.speed = 5.6; motor.stopDist = 0.8; this.subT -= dt; lookForward(-0.1);
      if (d.play < 0.4) this.done = true;
    } else if (b === 'rest') {
      motor.mode = 'stop'; P.down = 1; lookSalient(); dog.head.tPitch = Math.max(dog.head.tPitch, 0.1);
      if (this.t > 8 && d.fatigue < 0.3) this.done = true;
    } else if (b === 'sleep') sleepRun(this, dt);
    else if (b === 'obey') this.obey(dt, youP, youHead);
    else if (b === 'confused') {
      motor.mode = 'face'; motor.face = youP; lookAt(youHead, 0.42); this.cmd && (this.cmd.t += dt); if (!this.cmd || this.cmd.t > 2.6) { this.cmd = null; this.trial && (this.trial.done = now); this.done = true; }
    } else if (b === 'shake') {
      motor.mode = 'stop'; lookForward(0); if (this.t < 0.05) startShake(); if (this.t > 0.3 && !dog.org.shake) this.done = true;
    } else if (b === 'stretch') {
      // a play bow shaped front stretch, then a hind stretch, then often a shake
      motor.mode = 'stop'; P.bow = this.t < 1.6 ? 1 : 0; P.sit = 0; lookForward(this.t < 1.6 ? -0.3 : 0.1);
      if (this.t > 1.2 && this.t < 1.4) this.say(pick(LINES.stretch), 1.5);
      if (this.t > 2.4) { this.done = true; if (RNG() < 0.6) this.force('shake', 1); }
    } else if (b === 'appease') {
      // avoid eye contact, ears back, tail low, head down, a lick and sometimes a paw lift, all within 10 s of the scolding
      motor.mode = 'stop'; dog.earPerk = -1; this.v = Math.min(this.v, -0.2); if (dog.posture.sit > 0.5) P.sit = 1; if (dog.posture.down > 0.5) P.down = 1;
      const away = wrapA(Math.atan2(YOU.x - dog.pos.x, YOU.z - dog.pos.z) - dog.yaw) + (this.awaySide || (this.awaySide = RNG() < 0.5 ? 0.9 : -0.9));
      dog.head.tYaw = clamp(away, -1.3, 1.3); dog.head.tPitch = 0.55; dog.head.tRoll = 0;
      if (dog.posture.sit > 0.6 && this.t > 0.8 && this.t < 1.6) dog.pawLift = 0.6; else dog.pawLift = 0;
      if (dog.tongue && Math.sin(this.t * 7) > 0.92) dog.tongue.visible = true;
      if (this.t > (this.appDur || (this.appDur = ON('L.noise') ? ORG.exg(2.2, 0.4, 1.4) : 3))) { this.done = true; this.appDur = 0; this.awaySide = 0; if (RNG() < 0.4) this.force('shake', 1.5); }
    } else if (b === 'investigate') investigateRun(this, dt);
    else if (b === 'follow') {
      // walk with him a little behind and to the side; sniff detours, then trot to catch up
      const hf = V3(Math.sin(HUM.yaw), 0, Math.cos(HUM.yaw)), hl = V3(Math.cos(HUM.yaw), 0, -Math.sin(HUM.yaw)), side = this.fSide || (this.fSide = RNG() < 0.5 ? 1 : -1);
      const spot = V3(HUM.pos.x - hf.x * 0.7 + hl.x * side * 0.9, 0, HUM.pos.z - hf.z * 0.7 + hl.z * side * 0.9), far = dist2(dog.pos, HUM.pos);
      // sniff detours start only from beside him, and a lag past 1.8 m is closed at a trot; before, detours started up to 3 m back
      // and the dog only trotted past 3 m, so it hung 2 to 3 m behind (stroll-follow, 2026-11-22)
      if (!this.fSniff && far < 1.6 && RNG() < dt / 9) this.fSniff = now + ORG.exg(2, 0.5, 1.5);
      if (this.fSniff && now < this.fSniff) { motor.mode = 'stop'; dog.head.tPitch = 0.95; dog.head.tYaw = Math.sin(now * 2.5) * 0.3; }
      else { this.fSniff = 0; motor.mode = 'goto'; motor.target.copy(spot); motor.speed = far > 3 ? 2.6 : far > 1.8 ? 2.2 : clamp(HUM.v * 1.1 + 0.2, 0.6, 2); motor.stopDist = 0.4; if (RNG() < 0.02) lookAt(humHead(V3())); else lookForward(0.1); }
      if (!this.stroll) this.done = true;
    } else if (b === 'waitdoor') {
      // waits by the gate, lies down, whines now and then, ears up at every sound; often dozes off
      const g = V3(GATE.x + 0.8, 0, GATE.z - 1.6); motor.mode = 'goto'; motor.target.copy(g); motor.stopDist = 0.6; motor.speed = 1.4; motor.face = V3(GATE.x, 0, GATE.z);
      if (motor.done) { P.down = this.t > 6 ? 1 : 0; P.sit = this.t <= 6 ? 1 : 0; lookAt(V3(GATE.x, 0.8, GATE.z)); if (RNG() < dt * 0.05) { whine(dog.root.position); this.say(pick(LINES.waitdoor), 2); } }
      if (!HUM.away) this.done = true;
    } else if (b === 'nudge') {
      // attention seeking while he is on his phone: come close, sit, paw, a demand bark
      const youP2 = V3(YOU.x, 0, YOU.z); motor.mode = 'goto'; motor.target.copy(youP2); motor.speed = 1.6; motor.stopDist = 0.85; motor.face = youP2; lookAt(humHead(V3()));
      if (motor.done) { P.sit = 1; if (dog.posture.sit > 0.8 && Math.sin(this.t * 1.7) > 0.9) dog.pawLift = 0.5; else dog.pawLift = 0; if (this.t > 3 && now - this.barkT > ORG.exg(3, 0.5, 2)) { this.barkT = now; bark(dog.root.position, 1.1, 1); emitSound(dog.root.position, 0.45, 'bark'); } }
      if (!HUM.phoneOn || this.watched || this.t > 14) { this.done = true; dog.pawLift = 0; }
    }
    // calming overlays: a head turn away or ground sniff on top of whatever the dog is doing
    if (this.calm && this.calm.k === 'turn') { dog.head.tYaw = clamp(dog.head.tYaw + this.calm.side * 1.0, -1.4, 1.4); dog.head.tPitch += 0.15; }
    if (this.calm && this.calm.k === 'sniff') { dog.head.tPitch = 0.95; }
    // gaze following: after eye contact he looks somewhere else, and the dog often follows his gaze (Teglas 2012)
    if (ON('L.social') && now - (this.mutualT || -9) < 2 && !HUM.lookingAtDog && HUM.look && b !== 'sleep' && b !== 'obey') {
      if (!this.gfPos || this.gfPos.distanceTo(HUM.look) > 1) { this.gfPos = HUM.look.clone(); this.gf = RNG() < 0.65 ? now + 1.2 : 0; }
      if (this.gf > now) lookAt(HUM.look);
    }
  },
  obey(dt, youP, youHead) {
    const c = this.cmd, P = dog.postureT; if (!c) { this.done = true; return; } c.t += dt;
    const finish = (hold = 6) => { if (this.trial && !this.trial.done) { this.trial.done = now; const e = this.trace.find(x => x.cue === c.cue && !x.done); if (e) e.done = now; this.say(pick(LINES.obey), 1.8); } if (c.t > hold) { this.cmd = null; this.done = true; } };
    const sitDone = () => NG.active ? (NG.guidance === 'Sit' && this.t > 1.4) : dog.posture.sit > 0.85, downDone = () => NG.active ? (NG.guidance === 'Lie' && this.t > 1.8) : dog.posture.down > 0.85;
    switch (c.action) {
      case 'sit': motor.mode = 'stop'; P.sit = 1; lookAt(youHead); if (sitDone()) finish(7); break;
      case 'down': motor.mode = 'stop'; P.down = 1; lookAt(youHead); if (downDone()) finish(8); break;
      case 'paw': motor.mode = 'stop'; P.sit = 1; lookAt(youHead); if (dog.posture.sit > 0.8) { dog.pawLift = lerp(dog.pawLift, c.t < 4.5 ? 1 : 0, 1 - Math.exp(-dt * 6)); if (dog.pawLift > 0.8) finish(5); } break;
      case 'come': motor.mode = 'goto'; motor.target.copy(youP); motor.speed = 3.2; motor.stopDist = 0.95; motor.face = youP; lookAt(youHead); if (motor.done) { P.sit = 1; if (sitDone() || dog.posture.sit > 0.8) finish(5); } if (c.t > 14) { this.cmd = null; this.done = true; } break;
      case 'stay': motor.mode = 'stop'; P.sit = dog.posture.sit > 0.5 ? 1 : 0; lookAt(youHead); if (c.t > 1.5) finish(11); break;
      case 'spin': if (!c.spun) { c.spun = 0; } motor.mode = 'turn'; motor.turnRate = 3.4; c.spun += Math.abs(dog.w) * dt * (NG.active ? 0.8 : 1); lookForward(0); if (c.spun > Math.PI * 2) { motor.mode = 'stop'; motor.turnRate = 0; finish(0.6); } if (c.t > 8) { this.cmd = null; this.done = true; } break;
      case 'speak': motor.mode = 'stop'; lookAt(youHead); if (!c.b) { c.b = 1; SIMQ.after(0.3, () => { bark(dog.root.position, 1, 2); dog.head.tPitch -= 0.3; }); } if (c.t > 1.2) finish(2); break;
      case 'fetch': if (ball && !ball.held) { this.cmd = null; this.trial.done = now; this.force('fetch', 3); } else this.cmd = null; this.done = true; break;
      case 'bed': { const bp = V3(BED.x, 0, BED.z); motor.mode = 'goto'; motor.target.copy(bp); motor.speed = 1.8; motor.stopDist = 0.2; if (motor.done) { P.down = 1; if (downDone()) finish(6); } if (c.t > 16) { this.cmd = null; this.done = true; } break; }
      default: this.cmd = null; this.done = true;
    }
  },
  fetch(dt, youP, youHead) {
    const P = dog.postureT, bp = bodyPos(ball);
    if (ball.held) {
      if (this.sub !== 'return' && this.sub !== 'drop' && this.sub !== 'keep') {
        // independent dogs sometimes play keep away before bringing it back
        this.sub = ON('L.organic') && RNG() < 0.12 + 0.12 * PT('independence') ? 'keep' : 'return'; this.subT = 0; this.say(this.sub === 'keep' ? 'catch me first' : pick(['got it.', 'bringing it', 'mine but yours']), 2);
      }
      if (this.sub === 'keep') { this.subT += dt; if (!this.wp || motor.done) { const a = Math.atan2(dog.pos.x - YOU.x, dog.pos.z - YOU.z) + rnd(-0.8, 0.8); this.wp = V3(YOU.x + Math.sin(a) * rnd(3, 5), 0, YOU.z + Math.cos(a) * rnd(3, 5)); motor.done = false; } motor.mode = 'goto'; motor.target.copy(this.wp); motor.speed = 2.6; motor.stopDist = 0.6; lookAt(youHead); if (this.subT > rnd(4, 7)) this.sub = 'return'; }
      if (this.sub === 'return') { motor.mode = 'goto'; motor.target.copy(youP); motor.speed = 2.4; motor.stopDist = 0.85; motor.face = youP; lookAt(youHead); if (motor.done) { this.sub = 'drop'; this.subT = 0; } }
      if (this.sub === 'drop') { motor.mode = 'face'; motor.face = youP; P.reach = 1; this.subT += dt; if (this.subT > 0.7) { setHeld(ball, false); const f = V3(Math.sin(dog.yaw), 0, Math.cos(dog.yaw)); ball.rb.setLinvel({ x: f.x * 0.6, y: 0.2, z: f.z * 0.6 }, true); this.sub = 'wait'; this.subT = 0; this.d.play = clamp(this.d.play - 0.12, 0, 1); this.v = clamp(this.v + 0.15, -1, 1); } }
      return;
    }
    if (this.sub === 'wait') { motor.mode = 'face'; motor.face = youP; P.sit = 1; lookAt(youHead, 0.15); this.subT += dt; if (this.subT > 1.2 && this.subT < 1.4) this.say('again? again?', 2.4); const pv = percepts.ball; if (pv && pv.vis && pv.speed > 1.5) { this.sub = 'seek'; P.sit = 0; } if (this.subT > 9) { this.d.play = clamp(this.d.play - 0.2, 0, 1); this.done = true; this.dwell = 0; } return; }
    const pv = percepts.ball;
    if (this.sub !== 'seek') this.say(pv && pv.vis ? pick(['BALL', 'mine.', 'ball ball ball']) : 'where did it go', 2);
    this.sub = 'seek';
    let target = null;
    if (pv && pv.vis) { target = pv.pos.clone().addScaledVector(pv.vel || V3(), 0.25); }
    else if (pv && pv.seen > -1e8) { target = memPos(pv); if (dist2(dog.pos, target) < 0.8) {
      // blocked goal: search, then a look back at the human for help (Marshall-Pescini 2009: first look about 14 s, scaled)
      if (!this.search) this.lbAt = ON('L.social') ? Math.min(30, ORG.gamma(1.36, 10.3)) * TV('Br.lookBack') : 99;
      this.search = (this.search || 0) + dt;
      if (this.search > this.lbAt && this.search < this.lbAt + 1.5) { lookAt(humHead(V3())); this.lookBackT = now; }
      else { dog.head.tYaw = Math.sin(now * 2.2) * 1.1; dog.head.tPitch = 0.3; }
      if (this.search > Math.max(4, Math.min(this.lbAt + 3, 12))) { pv.seen = -1e9; this.search = 0; } return; } }
    if (!target) { motor.mode = 'turn'; motor.turnRate = 1.6; dog.head.tYaw = Math.sin(now * 2) * 0.9; return; }
    this.search = 0;
    const dd = dist2(dog.pos, target);
    motor.mode = 'goto'; motor.target.copy(target); motor.speed = dd > 2.5 ? 4.6 : clamp(dd * 1.3, 0.6, 2.6); motor.stopDist = 0.4; motor.face = target; lookAt(pv && pv.vis ? pv.pos : target);
    const mouth = headWorld(dog.mouthL, tmpV[1]);
    if (pv && pv.vis && dd < 0.9) { P.reach = 1; if (NG.active) dog.head.tPitch += 0.45; }
    const hd = Math.hypot(mouth.x - bp.x, mouth.z - bp.z);
    if ((hd < 0.3 || (NG.active && dd < 0.5)) && bp.y < mouth.y + 0.1 && bodyVel(ball).length() < 2.2) { setHeld(ball, true); this.grabT = now; this.v = clamp(this.v + 0.2, -1, 1); this.a = clamp(this.a + 0.1, 0, 1); }
  }
};
// play bow: about 2.25 s, given when the partner is looking, after a lull, then a run away invitation (Byosiere, Espinosa and Smuts 2016)
function playbowRun(B, dt, youP, youHead) {
  const P = dog.postureT;
  if (!B.sub) { B.sub = 'face'; B.subT = 0; B.bowDur = ON('L.noise') ? ORG.exg(1.8, 0.3, 0.45) : 2.25; }
  B.subT += dt;
  if (B.sub === 'face') { motor.mode = 'face'; motor.face = youP; lookAt(youHead); if (motor.done || B.subT > 1.2) { B.sub = 'bow'; B.subT = 0; } }
  else if (B.sub === 'bow') {
    motor.mode = 'stop'; P.bow = 1; lookAt(youHead);
    // without eye contact the dog barks to get it
    if (ON('L.social') && !HUM.lookingAtDog && now - B.barkT > 1.2) { B.barkT = now; bark(dog.root.position, 1.15, 1); emitSound(dog.root.position, 0.4, 'bark'); }
    else if (!ON('L.social') && now - B.barkT > 1.5) { B.barkT = now; bark(dog.root.position, 1.15, 1); }
    if (B.subT > B.bowDur) { B.sub = ON('L.social') ? 'run' : 'done'; B.subT = 0; const a = Math.atan2(dog.pos.x - YOU.x, dog.pos.z - YOU.z) + rnd(-0.9, 0.9); B.wp = V3(clamp(dog.pos.x + Math.sin(a) * rnd(2.5, 4), -11, 11), 0, clamp(dog.pos.z + Math.cos(a) * rnd(2.5, 4), -11, 11)); motor.done = false; }
  } else if (B.sub === 'run') { motor.mode = 'goto'; motor.target.copy(B.wp); motor.speed = 3.4; motor.stopDist = 0.5; lookForward(0); if (motor.done || B.subT > 3) { B.sub = 'look'; B.subT = 0; } }
  else if (B.sub === 'look') { motor.mode = 'face'; motor.face = youP; lookAt(youHead, 0.2); B.d.play = clamp(B.d.play - dt * 0.03, 0, 1); if (HUM.v > 0.8 && dist2(HUM.pos, dog.pos) < 4) { B.sub = 'run'; B.subT = 0; const a = Math.atan2(dog.pos.x - HUM.pos.x, dog.pos.z - HUM.pos.z); B.wp = V3(clamp(dog.pos.x + Math.sin(a) * 3, -11, 11), 0, clamp(dog.pos.z + Math.cos(a) * 3, -11, 11)); } if (B.subT > 3.5) B.sub = 'done'; }
  else { B.done = true; }
}
// sleep: onset, NREM of at least a set number of game minutes, short REM with paddling, often a wake after REM (PMC8458274)
function sleepRun(B, dt) {
  const P = dog.postureT, O = dog.org;
  if (!ON('L.sleep')) {
    const bp = V3(BED.x, 0, BED.z);
    if (B.sub !== 'down') { motor.mode = 'goto'; motor.target.copy(bp); motor.speed = 1.1; motor.stopDist = 0.15; lookForward(0.2); if (motor.done) { B.sub = 'circle'; B.subT += dt; motor.mode = 'turn'; motor.turnRate = 2.2; if (B.subT > 2.4) B.sub = 'down'; } }
    else { motor.mode = 'stop'; P.down = 1; dog.head.tYaw = 0.5; dog.head.tPitch = 0.55; dog.head.tRoll = 0.15; if (RNG() < dt * 0.3) B.say(pick(LINES.sleep), 2.5); }
    return;
  }
  const gm = gameMin(dt) * +$('tempo').value;
  if (!B.sub) {
    // most dogs sleep near their people (Kinsman 2020): pick a spot by the human if he is settled, else the bed
    const nearHuman = HUM.v < 0.3 && RNG() < 0.45 + 0.2 * PT('sociability');
    B.spot = nearHuman ? V3(YOU.x + rnd(-1.2, 1.2), 0, YOU.z + rnd(0.8, 1.6)) : V3(BED.x, 0, BED.z); pushOut(B.spot, 0.5);
    B.sub = 'goto'; B.stage = 'goto'; B.subT = 0;
  }
  if (B.sub === 'goto') { motor.mode = 'goto'; motor.target.copy(B.spot); motor.speed = 1.1; motor.stopDist = 0.25; lookForward(0.2); if (motor.done) { B.sub = 'circle'; B.subT = 0; B.turns = RNG() < 0.4 ? (RNG() < 0.19 ? 2 : 1) : 0; } return; }
  if (B.sub === 'circle') { motor.mode = B.turns ? 'turn' : 'stop'; motor.turnRate = 2.2; B.subT += dt; lookForward(0.3); if (B.subT > B.turns * 2.9 * (NG.active ? 1.4 : 1) + 0.3) { if (ball && ball.held) setHeld(ball, false); B.sub = 'lie'; B.stage = 'onset'; B.stageT = 0; B.stageDur = ORG.exg(1.5, 0.4, 1.5) * (now - B.negT < 120 ? 0.5 : 1); } return; }
  motor.mode = 'stop'; P.down = 1; B.stageT += gm;
  const neg = now - B.negT < 180; // after a bad experience: faster onset, more REM (Kis 2017)
  if (B.stage === 'onset') { lookSalientSoft(); if (B.stageT > B.stageDur) { B.stage = 'nrem'; B.stageT = 0; B.stageDur = ORG.exg(TV('S.nrem'), 0.8, TV('S.nrem') * 0.6) * (neg ? 0.7 : 1); } }
  else if (B.stage === 'nrem') { dog.head.tYaw = 0.5; dog.head.tPitch = 0.62; dog.head.tRoll = 0.15; O.rem = 0; if (B.stageT > B.stageDur) { B.stage = 'rem'; B.stageT = 0; B.stageDur = ORG.exg(TV('S.rem') * 0.7, 0.3, TV('S.rem') * 0.4) * (neg ? 1.6 : 1); } }
  else if (B.stage === 'rem') {
    dog.head.tYaw = 0.5; dog.head.tPitch = 0.62; O.rem = ss(0, 0.3, B.stageT) * 0.8;
    if (RNG() < dt * 0.2) { if (RNG() < 0.5) whine(dog.root.position); B.say(pick(['wf', 'mm', 'zzz', '...wuf']), 1.4); }
    if (B.stageT > B.stageDur) { O.rem = 0; B.stageT = 0; if (RNG() < TV('S.wake')) { B.stage = 'wake'; B.stageDur = ORG.exg(0.6, 0.2, 0.6); } else { B.stage = 'nrem'; B.stageDur = ORG.exg(TV('S.nrem'), 0.8, TV('S.nrem') * 0.6); } }
  } else if (B.stage === 'wake') {
    lookSalientSoft();
    if (B.stageT > B.stageDur) { const sleepy = 0.8 * B.Sp + 0.5 * (B.circ ?? 0.3); if (sleepy < 0.45) { B.wake('slept enough'); return; } B.stage = 'nrem'; B.stageT = 0; B.stageDur = ORG.exg(TV('S.nrem'), 0.8, TV('S.nrem') * 0.6); }
  }
  if (RNG() < dt * 0.1 && B.stage === 'nrem') B.say(pick(LINES.sleep), 2.5);
  B.hypT = (B.hypT || 0) + dt; if (B.hypT > 0.5) { B.hypT = 0; B.hyp.push(B.stage); if (B.hyp.length > 160) B.hyp.shift(); }
}
function lookSalientSoft() { dog.head.tYaw = Math.sin(now * 0.3) * 0.4; dog.head.tPitch = 0.25; dog.head.tRoll = 0; }
// cautious approach to something new: approach and retreat as fear and curiosity trade places
function investigateRun(B, dt) {
  const I = B.inv; if (!I) { B.done = true; return; }
  const fear = ON('L.organic') ? clamp(0.3 + 0.25 * PT('fearfulness') - 0.2 * B.bond, 0, 1) : 0;
  const dd = dist2(dog.pos, I.p), safe = 0.5 + fear * 1.4;
  if (!B.sub) { B.sub = 'approach'; B.subT = 0; }
  B.subT += dt;
  if (B.sub === 'approach') { motor.mode = 'goto'; motor.target.copy(I.p); motor.speed = 1.2 - fear * 0.5; motor.stopDist = safe; motor.face = I.p; lookAt(I.p); dog.earPerk = 0.8; if (motor.done) { B.sub = fear > 0.5 && RNG() < fear ? 'retreat' : 'sniff'; B.subT = 0; } }
  else if (B.sub === 'retreat') { const a = Math.atan2(dog.pos.x - I.p.x, dog.pos.z - I.p.z); motor.mode = 'goto'; motor.target.set(I.p.x + Math.sin(a) * (safe + 1.2), 0, I.p.z + Math.cos(a) * (safe + 1.2)); motor.speed = 1.6; motor.stopDist = 0.3; lookAt(I.p); if (motor.done || B.subT > 2) { B.sub = 'approach'; B.subT = 0; } }
  else if (B.sub === 'sniff') { motor.mode = 'stop'; dog.postureT.reach = 1; lookAt(V3(I.p.x, H(I.p.x, I.p.z), I.p.z)); if (B.subT > 2.5) { B.done = true; B.inv = null; B.d.curiosity = clamp(B.d.curiosity - 0.25, 0, 1); } }
  if (B.t > 16) { B.done = true; B.inv = null; }
}
function whyOf(b) {
  const d = brain.d, B = brain;
  return ({ idle: 'nothing pressing', explore: 'curiosity ' + d.curiosity.toFixed(2) + (percepts.you && percepts.you.vis ? ', human in view' : ''), sniff: 'nose picked up a scent', eat: 'hunger ' + d.hunger.toFixed(2), treat: 'treat on the ground', fetch: 'play drive ' + d.play.toFixed(2), chase: 'prey drive ' + d.prey.toFixed(2), greet: 'social need ' + d.social.toFixed(2), beg: 'hungry and you are close', playbow: HUM.lookingAtDog ? 'he is looking, invite play' : 'wants play', zoomies: 'too much energy', rest: 'fatigue ' + d.fatigue.toFixed(2), sleep: 'sleep pressure ' + (B.Sp || 0).toFixed(2) + ', body clock ' + (B.circ ?? 0).toFixed(2), obey: 'cue', confused: 'cue', shake: 'shaking it off', appease: 'he sounded upset', stretch: 'just woke up', investigate: B.inv ? B.inv.why : 'something new' })[b] || '';
}
const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
function exploreTarget() {
  // truncated power law steps with von Mises turns: mostly short hops, now and then a long run (Viswanathan 1999, a believable look rather than a law)
  if (ON('L.noise')) {
    const mu = clamp(2 - 0.15 * PT('activity'), 1.4, 2.8);
    for (let i = 0; i < 12; i++) {
      const l = ORG.levy(1.2, mu, 11), a = dog.yaw + ORG.vonMises(1.2);
      const x = dog.pos.x + Math.sin(a) * l, z = dog.pos.z + Math.cos(a) * l;
      if (Math.hypot(x, z) > FENCE_R - 1.5 || OBST.some(o => Math.hypot(o.x - x, o.z - z) < o.r + 0.5)) continue;
      brain.wpFast = l > 5; return V3(x, 0, z);
    }
  }
  let best = null, bs = -1;
  for (let i = 0; i < 14; i++) {
    const a = rnd(0, Math.PI * 2), r = Math.sqrt(RNG()) * 11.5, x = Math.sin(a) * r, z = Math.cos(a) * r;
    if (OBST.some(o => Math.hypot(o.x - x, o.z - z) < o.r + 0.5)) continue;
    const cell = Math.round(x / 2) + ',' + Math.round(z / 2), last = brain.visits.get(cell) ?? -999;
    const s = (now - last) / 60 - Math.hypot(x - dog.pos.x, z - dog.pos.z) * 0.04 + RNG() * 0.3;
    if (s > bs) { bs = s; best = V3(x, 0, z); }
  }
  brain.wpFast = false; return best || V3(rnd(-6, 6), 0, rnd(-6, 6));
}
