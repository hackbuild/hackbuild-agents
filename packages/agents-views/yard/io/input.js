// ---------- input ----------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let downAt = null;
renderer.domElement.addEventListener('pointerdown', e => { downAt = { x: e.clientX, y: e.clientY, t: performance.now() }; audio(); });
// what is under a screen point: the dog, a spot on the ground, or nothing (taps and the context menu share it)
function yardAt(cx, cy) {
  const r = renderer.domElement.getBoundingClientRect(); ndc.set((cx - r.left) / r.width * 2 - 1, -(cy - r.top) / r.height * 2 + 1);
  ray.setFromCamera(ndc, camera);
  // dog hit: ray vs body segment
  if (dog.ready) {
    const a = dog.root.localToWorld(V3(0, 0.33, -0.25)), b = dog.root.localToWorld(V3(0, 0.38, 0.35));
    if (ray.ray.distanceSqToSegment(a, b) < 0.2 * 0.2) return { dog: true };
  }
  const hit = ray.intersectObject(ground)[0];
  return hit ? { p: hit.point.clone() } : null;
}
function pointAt(p) {
  marker.position.copy(p).add(V3(0, 0.015, 0)); marker.material.opacity = 1;
  if (HUM.ready && ON('L.social')) { startTask('point', { p: p.clone(), user: true }, 'you asked him to point there'); return; }
  emitSound(V3(YOU.x, 1.4, YOU.z), 0.25, 'point');
  if (brain.cur !== 'sleep' && brain.cur !== 'obey') { brain.pointT = now; }
}
renderer.domElement.addEventListener('pointerup', e => {
  if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6 || performance.now() - downAt.t > 450) return;
  const at = yardAt(e.clientX, e.clientY); if (!at) return;
  if (at.dog) { pet(); return; }
  if (e.shiftKey) { throwBall(at.p); return; }
  pointAt(at.p);
});
function pet() { brain.d.social = clamp(brain.d.social - 0.12, 0, 1); brain.v = clamp(brain.v + 0.12, -1, 1); brain.a = clamp(brain.a - 0.05, 0, 1); brain.say(pick(['mmm', 'yes there', 'happy', 'more pets']), 1.6); dog.head.tRoll = 0.25; if (brain.trial && !brain.trial.rewarded) brain.reward(0.4, 'pet'); }
// keys drive the dog or the camera only while the yard has focus (or nothing does), never while you tab through panels
const keysToYard = e => e.target === document.body || e.target === stage || e.target === renderer.domElement || (e.target.id === 'manual' && !/^(tab| )$/i.test(e.key));
addEventListener('keydown', e => { if (!keysToYard(e)) return; manualKeys[e.key.toLowerCase()] = true; if (e.key === 'Shift') manualKeys.shift = true; if ($('manual').checked && /^(arrow|w|a|s|d)/i.test(e.key)) e.preventDefault(); });
addEventListener('keyup', e => { manualKeys[e.key.toLowerCase()] = false; if (e.key === 'Shift') manualKeys.shift = false; });
$('bThrow').onclick = () => { audio(); throwBall(); };
$('bTreat').onclick = () => { audio(); tossTreat(); };
$('bCall').onclick = () => { audio(); startTask('call', { user: true }, 'you asked'); };
$('bPet').onclick = () => { audio(); startTask('pet', { user: true }, 'you asked'); };
$('bTrainNow').onclick = () => { audio(); const p = pick(NEW_WORDS.concat([['sit', 'sit'], ['spin', 'spin'], ['paw', 'paw']])); startTask('train', { word: p[0], trick: p[1], reps: 5, user: true }, 'you asked: teach "' + p[0] + '" as ' + p[1]); };
// pocket tts: loaded from the capability panel; voiceLoad.state is off, loading, on or failed
const voiceLoad = { state: 'off', err: '' };
function loadVoice() {
  if (voiceLoad.state === 'loading' || voiceLoad.state === 'on') return; audio(); voiceLoad.state = 'loading'; voiceLoad.err = ''; capsRefresh();
  Voice.init(t => { $('voiceSt').textContent = t; }).then(r => { voiceLoad.state = 'on'; $('voiceSt').textContent = r.cloned ? 'pocket tts, his cloned voice' : 'pocket tts, stock voice ' + r.voice; capsRefresh(); })
    .catch(e => { voiceLoad.state = 'failed'; voiceLoad.err = 'pocket tts failed: ' + String(e.message || e).slice(0, 60).toLowerCase() + '. the browser voice stays.'; $('voiceSt').textContent = 'browser voice'; capsRefresh(); });
}
// a build without the owner asset pack has no voice clip: pocket tts can only use a stock voice
if (!voiceClip()) $('voiceNote').textContent = 'starts with the browser voice. this build has no voice clip, so pocket tts speaks in a stock voice.';
$('humVoiceOn').onchange = e => { Voice.on = e.target.checked; };
$('bGood').onclick = () => { audio(); if (HUM.ready) { humSay(pick(H_LINES.praise), 2, true); HUM.mood.pleasedT = 1; } brain.reward(0.8, 'good dog'); };
$('bNo').onclick = () => { audio(); if (HUM.ready) { humSay(pick(H_LINES.no), 2); HUM.shakeT = 1.1; HUM.mood.frusT = Math.min(1, (HUM.mood.frusT || 0) + 0.4); } brain.reward(-0.8, 'no'); };
$('bFill').onclick = () => { foodAmt = 1; toast('bowl filled'); emitSound(V3(BOWL.x, 0.2, BOWL.z), 0.45, 'kibble'); scentSrc.push({ x: BOWL.x, z: BOWL.z, s: 1.2, t: now }); };
$('bSquirrel').onclick = () => { if (squirrel.state === 'gone') spawnSquirrel(); };
let camMode = 0; const CAMS = ['follow', 'free', 'dog eye', 'side', 'his eyes'];
const sideCam = new HCAM.Follow(camera, { distance: Math.hypot(2.4, 0.3, 0.25), pitch: Math.asin(0.25 / Math.hypot(2.4, 0.3, 0.25)), lookHeight: 0.3, smoothing: 8, yawSmoothing: 6 });
function setCamMode(m) { camMode = m; $('camLab').textContent = CAMS[m]; $('bCam').setAttribute('aria-label', 'camera: ' + CAMS[m] + '. press for the next view'); controls.maxDistance = m === 1 ? 45 : 26; }
// one camera button on the yard, as the original: each press moves to the next view
$('bCam').onclick = () => { audio(); setCamMode((camMode + 1) % CAMS.length); };
// free camera: right drag pans, two fingers pan, WASD or arrows fly, Q and E lower and raise, F goes back to following the dog
renderer.domElement.addEventListener('pointerdown', e => { if ((e.button === 2 || e.button === 1) && camMode !== 1 && camMode !== 2 && camMode !== 4) setCamMode(1); });
renderer.domElement.addEventListener('touchstart', e => { if (e.touches.length > 1 && camMode !== 1) setCamMode(1); }, { passive: true });
renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());
const FLY = { w: [0, 1], arrowup: [0, 1], s: [0, -1], arrowdown: [0, -1], a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0] };
addEventListener('keydown', e => {
  if (!keysToYard(e) || $('manual').checked) return;
  const k = e.key.toLowerCase();
  if (k === 'f') { setCamMode(0); return; }
  if (FLY[k] || k === 'q' || k === 'e') { e.preventDefault(); if (camMode !== 1) { if (camMode === 2 || camMode === 4) { camera.position.copy(camMode === 2 ? eyeCam.position : povCam.position); controls.target.copy(camera.position).add(tmpV[5].set(0, 0, -2).applyQuaternion((camMode === 2 ? eyeCam : povCam).quaternion)); } setCamMode(1); } }
});
function flyCam(dt) {
  if ($('manual').checked || document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
  let fx = 0, fz = 0, up = 0; for (const k in FLY) if (manualKeys[k]) { fx += FLY[k][0]; fz += FLY[k][1]; }
  if (manualKeys.q) up -= 1; if (manualKeys.e) up += 1;
  if (!fx && !fz && !up) return;
  const fwd = tmpV[6].copy(controls.target).sub(camera.position); fwd.y = 0; if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1); fwd.normalize();
  const right = tmpV[7].set(-fwd.z, 0, fwd.x), sp = (manualKeys.shift ? 12 : 5) * dt, n = Math.hypot(fx, fz) || 1;
  const mv = tmpV[8].copy(fwd).multiplyScalar(fz / n * sp).addScaledVector(right, fx / n * sp); mv.y = up * sp * 0.6;
  const nt = tmpV[9].copy(controls.target).add(mv), r = Math.hypot(nt.x, nt.z); if (r > 18) { mv.x -= nt.x / r * (r - 18); mv.z -= nt.z / r * (r - 18); }
  if (controls.target.y + mv.y < 0.05) mv.y = 0.05 - controls.target.y; if (controls.target.y + mv.y > 8) mv.y = 8 - controls.target.y;
  controls.target.add(mv); camera.position.add(mv); if (camera.position.y < H(camera.position.x, camera.position.z) + 0.2) camera.position.y = H(camera.position.x, camera.position.z) + 0.2;
}
$('eyeWhoDog').onclick = () => setEyeWho('dog'); $('eyeWhoHis').onclick = () => setEyeWho('his');
$('eyeFold').onclick = () => { const c = $('eyecard'), f = !c.classList.contains('is-folded'); c.classList.toggle('is-folded', f); $('eyeFold').setAttribute('aria-expanded', String(!f)); $('eyeFold').textContent = f ? '+' : '-'; $('eyeFold').setAttribute('aria-label', f ? 'show the eye view' : 'fold the eye view'); };
$('tempo').oninput = e => $('tempoV').textContent = e.target.value + 'x';
$('dogColor').onchange = drawEyeDisplay;
$('netOn').onchange = e => { if (e.target.checked) loadNet(); else { boxCtx.clearRect(0, 0, EW, EH); } };
$('cueIn').addEventListener('keydown', e => { if (e.key === 'Enter') { handleSpeech(e.target.value); e.target.value = ''; } });
$('dogName').addEventListener('change', e => { store.set('name', e.target.value); seedPersonality(e.target.value || 'Pixel'); toast('a new name is a new dog: temperament redrawn'); nameUI(); });
$('dogName').value = store.get('name', 'Pixel');
function renderCueButtons() {
  const cues = Object.keys(brain.W).filter(c => !c.startsWith('gesture:')).slice(0, 14);
  $('cueBtns').innerHTML = cues.map(c => `<button class="hb-chip" type="button" data-cue="${c.replace(/[<>"&]/g, '')}">${c.replace(/[<>&]/g, '')}</button>`).join('') + '<button class="hb-chip" type="button" data-cue="__free" title="ends a stay or any cue">free</button>';
  $('cueBtns').querySelectorAll('button').forEach(b => b.onclick = () => { audio(); if (b.dataset.cue === '__free') brain.release(); else if (HUM.ready) humCue(b.dataset.cue); else { $('heard').textContent = '"' + b.dataset.cue + '"'; brain.cue(b.dataset.cue); } });
}
function renderHeat(hiCue, hiAct) {
  const cues = Object.keys(brain.W).slice(-16), esc = t => String(t).replace(/[<>&"]/g, '');
  const cell = w => { const t = clamp(w, 0, 1); return `--v:${t.toFixed(2)}`; };
  const L = ON('L.learn');
  $('heat').innerHTML = '<caption>link strength 0 to 99, word by act</caption><thead><tr><th scope="col">word</th>' + ACTIONS.map(a => `<th scope="col" title="${a}">${a.slice(0, 4)}</th>`).join('') + (L ? '<th scope="col" title="how much it still pays attention to the word">attn</th>' : '') + '</tr></thead><tbody>' + cues.map(c => `<tr><th scope="row">${esc(c.replace('gesture:', 'g:'))}</th>` + ACTIONS.map(a => { const v = brain.V(c, a); return `<td class="${v > 0.55 ? 'is-hi' : ''}" style="${cell(v)}${c === hiCue && a === hiAct ? ';outline:2px solid var(--hb-pink);outline-offset:-2px' : ''}">${Math.round(clamp(v, 0, 1) * 99)}</td>`; }).join('') + (L ? `<td class="${(brain.al[c] ?? 0.6) > 0.55 ? 'is-hi' : ''}" style="${cell(brain.al[c] ?? 0.6)}">${Math.round((brain.al[c] ?? 0.6) * 99)}</td>` : '') + '</tr>').join('') + '</tbody>';
  knownUI();
}

