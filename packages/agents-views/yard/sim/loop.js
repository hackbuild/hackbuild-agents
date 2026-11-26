// ---------- main loop ----------
let now = 0, last = performance.now(), acc = 0, fpsN = 0, fpsT = 0, instT = 0;
function resize() { const r = stage.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); camera.aspect = r.width / Math.max(r.height, 1); camera.updateProjectionMatrix(); }
new ResizeObserver(resize).observe(stage);
const bubble = $('bubble');
// fixed step: real time times simSpeed fills an accumulator, the sim runs whole 1/60 s steps,
// at most 3 per frame per unit of simSpeed (the old 1/20 s cap), then one render
let eyeWait = null;
// cheap per system frame profiler: window.__prof holds total and worst ms per label
const PROF = window.__prof = {}; let pT = 0;
function pm(label) { const t = performance.now(), d = t - pT; pT = t; const e = PROF[label] || (PROF[label] = { tot: 0, max: 0, n: 0 }); e.tot += d; e.n++; if (d > e.max) e.max = d; }
function frame() {
  const tnow = performance.now(); ngFrame((tnow - last) / 1000); const dt = Math.min((tnow - last) / 1000, 1 / 20) * (window.__simSpeed || 1); last = tnow;
  acc += dt; let n = 0; const cap = 3 * Math.max(1, Math.round(window.__simSpeed || 1));
  while (acc >= STEP - 1e-9 && n < cap) { simStep(STEP); if (SEEDED) rtRow(); acc -= STEP; n++; }
  if (n >= cap) acc = Math.min(acc, STEP);
  view(dt);
}
function simStep(dt) {
  now += dt; SIMQ.run(now);
  if (dog.ready && world) {
    const tempo = +$('tempo').value;
    pT = performance.now(); clockTick(dt, tempo); lightTick(); for (const t of TRAITS) PDRIFT[t].step(dt * tempo / 60); pm('clock');
    humTick(dt, now); pm('human');
    sense(now); pm('sense'); loomCheck(dt); plumeTick(dt); puffDraw(); pm('plume');
    sniffTick(dt, brain.cur === 'sniff' || brain.cur === 'investigate' || (brain.cur === 'explore' && Math.sin(now * 0.7) > 0.3));
    brain.tick(dt); pm('brain');
    if (brain.pointT && now - brain.pointT < 2.5 && brain.cur !== 'sleep') lookAt(marker.position);
    steer(dt); locomotion(dt); pm('loco');
    poseDog(dt, now); pm('pose');
    // physics
    world.step();
    for (const o of dyn) {
      if (o === ball && ball.held) { const m = headWorld(dog.mouthL, tmpV[0]); ball.rb.setNextKinematicTranslation({ x: m.x, y: m.y, z: m.z }); }
      else if (o === ball && ball.humanHeld) { const m = handPos(tmpV[0]); ball.rb.setNextKinematicTranslation({ x: m.x, y: m.y - 0.04, z: m.z }); }
      const t = o.rb.translation(), q = o.rb.rotation(); o.mesh.position.set(t.x, t.y, t.z); o.mesh.quaternion.set(q.x, q.y, q.z, q.w);
      const vy = o.rb.linvel().y; if (o.prevVy < -1.2 && vy > -0.2 && !o.held && !o.humanHeld) { emitSound(o.mesh.position, clamp(-o.prevVy * 0.12, 0.1, 0.7), 'bounce'); thud(o.mesh.position, -o.prevVy); } o.prevVy = vy;
      if (t.y < -3) { o.rb.setTranslation({ x: 0, y: 1, z: 3 }, true); o.rb.setLinvel({ x: 0, y: 0, z: 0 }, true); }
    }
    pm('physics'); squirrelTick(dt);
    hearLevel = Math.max(0, hearLevel - dt * 0.8);
    // pant sound
    if (dog.heat > 0.5 && brain.cur !== 'sleep') { pantT -= dt; if (pantT < 0) { pantT = 0.33; pant(dog.root.position); } }
    pm('misc'); eyeTimer += dt; if (eyeTimer > 0.1) { eyeTimer = 0; eyeWait = renderEye(); } pm('eyeKick');
    if (!TEST && !eyeDetect.t || now - eyeDetect.t > Math.max(0.45, net.ms * 0.004)) { eyeDetect.t = now; eyeDetect(); } pm('yoloKick');
    camTick(now); micTick(dt); pm('camMic');
    // the cortex thinks on events: when summed importance passes a budget, never more often than a floor (Generative Agents style)
    if ($('autoThink').checked && vlm.state === 'ready' && !thinking) { cortexOpts.minInterval = brain.imp > TV('Br.reflect') ? TV('Br.cortexMin') : 60; if (cortexSched.state(now) === 'ready') { brain.imp = 0; cortexSched.run(now, true, think); } }
  }
  // marker fade and food bowl level are seen by the dog eye, so they advance with the sim
  marker.material.opacity = Math.max(0, marker.material.opacity - dt * 0.35);
  food.scale.set(1, Math.max(foodAmt, 0.02), 1); food.visible = foodAmt > 0.02; food.position.y = 0.02 + 0.03 * foodAmt;
}
function view(dt) {
  fpsN++; fpsT += dt; if (fpsT > 0.5) { $('chipFps').textContent = Math.round(fpsN / fpsT) + ' fps'; fpsN = 0; fpsT = 0;
    // hover the fps chip: average and worst main thread ms per system since the last readout, so a hitch can be traced to its source
    $('chipFps').title = Object.entries(PROF).sort((a, b) => b[1].max - a[1].max).map(([k, e]) => k + ' ' + (e.tot / Math.max(e.n, 1)).toFixed(1) + ' avg, ' + e.max.toFixed(0) + ' worst ms').join('\n') + (thinking ? '\ncortex thinking (shares the GPU)' : '');
    for (const k in PROF) { PROF[k].tot = PROF[k].n = PROF[k].max = 0; } }
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').classList.remove('is-on'); }
  // you
  if (HUM.ready) { const hp = humHead(tmpV[2]).add(V3(0, 0.32, 0)).project(camera), r2 = stage.getBoundingClientRect(), hb = $('hbubble');
    if (hp.z < 1 && camMode !== 2 && camMode !== 4 && HUM.sayT > 0) { hb.style.display = 'block'; hb.style.left = ((hp.x + 1) / 2 * r2.width) + 'px'; hb.style.top = ((1 - hp.y) / 2 * r2.height - 8) + 'px'; hb.textContent = HUM.line; } else hb.style.display = 'none'; }
  // camera
  if (dog.ready) {
    if (camMode === 1) flyCam(dt);
    if (camMode === 0) { const tg = tmpV[0].copy(dog.root.position).add(V3(0, 0.35, 0)); controls.target.lerp(tg, 1 - Math.exp(-dt * 2.5)); }
    if (camMode === 0) { const off = tmpV[3].copy(camera.position).sub(controls.target); const hz = Math.hypot(off.x, off.z); const want = clamp(hz, 3.2, 14); if (hz < 0.01) off.set(0, off.y, 1); if (Math.abs(want - hz) > 0.01) { off.x *= want / Math.max(hz, 0.01); off.z *= want / Math.max(hz, 0.01); } off.y = clamp(off.y, 0.9, 6); camera.position.lerp(tmpV[4].copy(controls.target).add(off), 1 - Math.exp(-dt * 3)); }
    // side view: @hackbuild/cameras Follow, set behind a heading that puts the camera 2.4 m off
    // the dog's left side and 0.3 m ahead, 0.25 m above a look point 0.3 m over the root
    if (camMode === 3) { const c = Math.cos(dog.yaw), s = Math.sin(dog.yaw); sideCam.update(dog.root.position, Math.atan2(-(c * 2.4 + s * 0.3), s * 2.4 - c * 0.3), dt); controls.target.copy(dog.root.position).add(tmpV[1].set(0, 0.3, 0)); }
    else controls.update();
    // bubble
    const hp = headWorld(V3(0, 0.35, 0), tmpV[1]).project(camera);
    const r = stage.getBoundingClientRect();
    if (hp.z < 1 && camMode !== 2) { bubble.style.display = 'block'; bubble.style.left = ((hp.x + 1) / 2 * r.width) + 'px'; bubble.style.top = ((1 - hp.y) / 2 * r.height - 8) + 'px'; bubble.textContent = brain.line; bubble.style.opacity = brain.sayT > 0 ? 1 : 0.45; }
    else bubble.style.display = 'none';
  }
  if (camMode === 4 && HUM.map && !HUM.away) { updateHumCam(dt); povCam.aspect = camera.aspect; povCam.updateProjectionMatrix(); humHeadHide(true); renderer.render(scene, povCam); humHeadHide(false); povCam.aspect = 2; povCam.updateProjectionMatrix(); }
  else if (camMode === 2 && dog.ready) { updateEyeCam(); eyeCam.aspect = camera.aspect; eyeCam.updateProjectionMatrix(); dog.mesh.visible = false; renderer.render(scene, eyeCam); dog.mesh.visible = true; eyeCam.aspect = 2; eyeCam.updateProjectionMatrix(); }
  else { pT = performance.now(); renderer.render(scene, camera); pm('render'); }
  pT = performance.now(); instT += dt; if (instT > 0.1) { instT = 0; if (dog.ready) drawInstruments(); if (!TEST) { const st = NG.status(); if (st && $('nnSt').textContent !== st) $('nnSt').textContent = st; } } pm('instruments');
}

// ---------- seeded real time trace (#seed=N) ----------
// the lockstep row columns every 15 steps, without the hash; window.__rt reads them
let rtSteps = 0; const rtRows = [];
function rtRow() {
  rtSteps++;
  if (rtSteps % 15 === 0) rtRows.push([rtSteps, ...simState().map(x => Math.round(x * 1e4) / 1e4), brain.cur, brain.sub || '', HUM.task ? HUM.task.name : '', ball && ball.held ? 1 : 0, NG.active ? NG.guidance : 'cpg']);
}
if (SEEDED) window.__rt = { seed: SEEDED.seed, speed: () => window.__simSpeed || 1, steps: () => rtSteps, t: () => now, rows: i => rtRows.slice(i || 0) };

// ---------- lockstep hook ----------
// trace rows every 0.25 sim s; a running FNV hash covers full precision state at every step
function simState() {
  const b = ball ? ball.rb.translation() : { x: 0, y: 0, z: 0 }, d = brain.d;
  return [now, dog.pos.x, dog.pos.z, dog.yaw, dog.v, HUM.pos ? HUM.pos.x : 0, HUM.pos ? HUM.pos.z : 0, HUM.yaw || 0, HUM.v || 0, b.x, b.y, b.z,
    d.hunger, d.fatigue, d.play, d.social, CLOCK.h, motor.target.x, motor.target.z];
}
function installSim() {
  const rows = [], f64 = new Float64Array(1), u32 = new Uint32Array(f64.buffer); let hash = 0x811c9dc5 >>> 0, steps = 0;
  const mix = x => { f64[0] = x; for (let i = 0; i < 2; i++) { hash ^= u32[i]; hash = Math.imul(hash, 0x01000193) >>> 0; } };
  const str = s => { for (let i = 0; i < s.length; i++) { hash ^= s.charCodeAt(i); hash = Math.imul(hash, 0x01000193) >>> 0; } };
  const r4 = x => Math.round(x * 1e4) / 1e4;
  const row = () => { const s = simState(); rows.push([steps, ...s.map(r4), brain.cur, brain.sub || '', HUM.task ? HUM.task.name : '', ball && ball.held ? 1 : 0, NG.active ? NG.guidance : 'cpg', (hash >>> 0).toString(16)]); };
  window.__sim = {
    seed: TEST.seed, dt: STEP,
    async step(n) {
      for (let i = 0; i < n; i++) {
        simStep(STEP); steps++;
        if (eyeWait) { const w = eyeWait; eyeWait = null; await w; }
        // a gait prediction asked for in this step lands before the next one
        if (NG.inflight) await NG.inflight;
        for (const x of simState()) mix(x); str(brain.cur + '|' + (brain.sub || '') + '|' + (HUM.task ? HUM.task.name : ''));
        if (steps % 15 === 0) row();
      }
      return now;
    },
    trace: () => ({ seed: TEST.seed, steps, t: now, hash: (hash >>> 0).toString(16), rows }),
    traceFrom: i => rows.slice(i),
    render() { view(0); },
    hash: () => (hash >>> 0).toString(16)
  };
}
