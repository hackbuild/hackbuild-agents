// ---------- senses ----------
const eyeCam = new THREE.PerspectiveCamera(70, 2, 0.04, 40);
const EW = 320, EH = 160;
const eyeRT = new THREE.RenderTarget(EW, EH);
const eyeCtx = $('eye').getContext('2d', { willReadFrequently: true }), boxCtx = $('eyeBoxes').getContext('2d');
const rawEye = document.createElement('canvas'); rawEye.width = EW; rawEye.height = EH; const rawCtx = rawEye.getContext('2d', { willReadFrequently: true });
const small = document.createElement('canvas'); small.width = 96; small.height = 48; const smallCtx = small.getContext('2d');
const srgbLUT = new Uint8ClampedArray(256); for (let i = 0; i < 256; i++) { const c = i / 255; srgbLUT[i] = Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)); }
const toLin = new Float32Array(256); for (let i = 0; i < 256; i++) { const c = i / 255; toLin[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
let eyeBusy = false, eyeTimer = 0;
function updateEyeCam() {
  const e = headWorld(dog.eyeL, tmpV[0]);
  const f = headForward(tmpV[1]);
  const up = tmpV[2].set(0, 1, 0).transformDirection(dog.bones['head'].matrixWorld);
  eyeCam.position.copy(e); eyeCam.up.copy(up); eyeCam.lookAt(e.clone().add(f)); eyeCam.updateMatrixWorld();
}
// his eyes: first person from Moheeb's head along his modelled gaze (head plus eye in head), head bone collapsed so the face does not block the lens
const povCam = new THREE.PerspectiveCamera(62, 2, 0.05, 80), povRT = new THREE.RenderTarget(EW, EH);
const humGz = new THREE.Vector3(0, 0, 1); let eyeWho = 'dog';
function updateHumCam(dt = 0.1) {
  const h = humHead(tmpV[0]); h.y += 0.07;
  const g = HUM.gazeDir && HUM.gazeDir.lengthSq() > 0.5 ? HUM.gazeDir : tmpV[1].set(Math.sin(HUM.yaw), -0.15, Math.cos(HUM.yaw));
  humGz.lerp(g, 1 - Math.exp(-dt * 16)).normalize(); // a saccade lands in about 40 ms; keep a trace of it without strobing the view
  povCam.position.copy(h).addScaledVector(humGz, 0.1); povCam.up.set(0, 1, 0); povCam.lookAt(tmpV[2].copy(povCam.position).add(humGz)); povCam.updateMatrixWorld();
}
function humHeadHide(on) { const hb = HUM.map && HUM.map.head; if (!hb) return; hb.scale.setScalar(on ? 0.001 : 1); hb.updateMatrixWorld(true); }
async function renderHumEye() {
  updateHumCam(0.1); humHeadHide(true); const wasM = marker.visible; marker.visible = false;
  renderer.setRenderTarget(povRT); renderer.render(scene, povCam); renderer.setRenderTarget(null);
  humHeadHide(false); marker.visible = wasM;
  const px = await renderer.readRenderTargetPixelsAsync(povRT, 0, 0, EW, EH);
  if (eyeWho !== 'his') return;
  const img = eyeCtx.createImageData(EW, EH), d = img.data, flip = !renderer.backend.isWebGPUBackend, rowBytes = px.length / EH;
  for (let y = 0; y < EH; y++) { const sy = flip ? EH - 1 - y : y; for (let x = 0; x < EW; x++) { const si = sy * rowBytes + x * 4, di = (y * EW + x) * 4; d[di] = srgbLUT[px[si]]; d[di + 1] = srgbLUT[px[si + 1]]; d[di + 2] = srgbLUT[px[si + 2]]; d[di + 3] = 255; } }
  eyeCtx.putImageData(img, 0, 0);
  const G = HUM.gz, tag = HUM.away ? 'out the gate' : G && G.av ? (G.thinkAv ? 'thinking, eyes up' : 'glancing away') : HUM.lookingAtDog ? 'on the dog' : HUM.phoneOn ? 'on his phone' : 'scanning';
  $('eyeMode').textContent = tag;
  if (HUM.away) { eyeCtx.fillStyle = 'rgba(245,240,230,0.88)'; eyeCtx.fillRect(0, 0, EW, EH); eyeCtx.fillStyle = '#1a1a1a'; eyeCtx.font = '22px VT323, monospace'; eyeCtx.fillText('he is away on an errand', 12, 30); }
}
function setEyeWho(w) {
  eyeWho = w; $('eyeWhoDog').classList.toggle('on', w === 'dog'); $('eyeWhoHis').classList.toggle('on', w === 'his');
  $('eyeBoxes').style.visibility = $('eyeSal').style.visibility = w === 'dog' ? '' : 'hidden';
  if (w === 'dog') drawEyeDisplay();
}
async function renderEye() {
  if (eyeBusy || !dog.ready) return; eyeBusy = true;
  try {
    updateEyeCam();
    dog.mesh.visible = false; if (dog.tongue) dog.tongue.visible = false; marker.visible = false;
    renderer.setRenderTarget(eyeRT); renderer.render(scene, eyeCam); renderer.setRenderTarget(null);
    dog.mesh.visible = true; marker.visible = true;
    const px = await renderer.readRenderTargetPixelsAsync(eyeRT, 0, 0, EW, EH);
    const img = rawCtx.createImageData(EW, EH); const d = img.data;
    const flip = !renderer.backend.isWebGPUBackend;
    const rowBytes = px.length / EH;
    for (let y = 0; y < EH; y++) {
      const sy = flip ? EH - 1 - y : y;
      for (let x = 0; x < EW; x++) { const si = sy * rowBytes + x * 4, di = (y * EW + x) * 4; d[di] = srgbLUT[px[si]]; d[di + 1] = srgbLUT[px[si + 1]]; d[di + 2] = srgbLUT[px[si + 2]]; d[di + 3] = 255; }
    }
    rawCtx.putImageData(img, 0, 0); pT = performance.now();
    if (eyeWho === 'dog') drawEyeDisplay(); else if (HUM.map) await renderHumEye(); pm('eyeDisplay');
    attention.update(); const sc2 = $('eyeSal').getContext('2d'); sc2.clearRect(0, 0, EW, EH); attention.draw(sc2); pm('saliency');
  } catch (err) { console.warn('eye', err); }
  eyeBusy = false;
}
function drawEyeDisplay() {
  if ($('dogColor').checked) {
    const img = rawCtx.getImageData(0, 0, EW, EH), d = img.data, night = ON('L.day') ? 1 - CLOCK.light : 0;
    // acuity: Lind 2017 bright 5.5 to 19.5 cpd, dim 1.8 to 3.5 cpd; interpolate in log luminance and resample at that density
    const cpd = Math.exp(lerp(Math.log(TV('Se.cpdDim')), Math.log(TV('Se.cpdBright')), CLOCK.light)), sw = clamp(Math.round(96 * cpd / 12), 18, 160), sh = Math.max(9, sw >> 1);
    if (small.width !== sw) { small.width = sw; small.height = sh; }
    for (let i = 0; i < d.length; i += 4) {
      const r = toLin[d[i]], g = toLin[d[i + 1]], b = toLin[d[i + 2]];
      let rr = 0.29275 * r + 0.70725 * g, bb = -0.02234 * r + 0.02234 * g + b;
      if (night > 0.02) { const y = 0.3 * rr + 0.7 * bb; rr = lerp(rr, y, night * 0.7) * (1 - night * 0.35); bb = lerp(bb, y, night * 0.7) * (1 - night * 0.3); }
      const rv = srgbLUT[clamp(rr * 255, 0, 255) | 0], bv = srgbLUT[clamp(bb * 255, 0, 255) | 0];
      d[i] = rv; d[i + 1] = rv; d[i + 2] = bv;
    }
    eyeCtx.putImageData(img, 0, 0);
    smallCtx.imageSmoothingEnabled = true; smallCtx.drawImage($('eye'), 0, 0, small.width, small.height);
    eyeCtx.imageSmoothingEnabled = true; eyeCtx.drawImage(small, 0, 0, EW, EH);
    $('eyeMode').textContent = 'dichromat ' + cpd.toFixed(1) + ' cpd';
  } else { eyeCtx.drawImage(rawEye, 0, 0); $('eyeMode').textContent = 'human color'; }
  if (brain.cur === 'sleep' && dog.posture.down > 0.7 && (!ON('L.sleep') || brain.stage === 'nrem' || brain.stage === 'rem')) { eyeCtx.fillStyle = 'rgba(26,26,26,0.92)'; eyeCtx.fillRect(0, 0, EW, EH); eyeCtx.fillStyle = '#f5f0e6'; eyeCtx.font = '22px VT323, monospace'; eyeCtx.fillText('eyes closed', 12, 30); $('eyeMode').textContent = 'asleep'; }
}
// geometric percepts
const percepts = {};
const OBJ = () => [
  ball && { id: 'ball', p: bodyPos(ball), v: bodyVel(ball), size: 0.09 },
  bone && { id: 'bone', p: bodyPos(bone), v: bodyVel(bone), size: 0.25 },
  !HUM.away && { id: 'you', p: V3(YOU.x, H(YOU.x, YOU.z) + 1.0, YOU.z), v: V3(), size: 1.7 },
  { id: 'bowl', p: V3(BOWL.x, H(BOWL.x, BOWL.z) + 0.06, BOWL.z), v: V3(), size: 0.45 },
  { id: 'bed', p: V3(BED.x, H(BED.x, BED.z) + 0.1, BED.z), v: V3(), size: 1.2 },
  sq.visible && { id: 'squirrel', p: sq.position.clone().add(V3(0, 0.1, 0)), v: squirrel.vel.clone(), size: 0.3 },
  marker.material.opacity > 0.2 && { id: 'pointer', p: marker.position.clone(), v: V3(), size: 0.4 },
  ...treats.map((t, i) => ({ id: 'treat' + i, kind: 'treat', obj: t, p: bodyPos(t), v: bodyVel(t), size: 0.06 }))
].filter(Boolean);
function occluded(a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz);
  for (const o of OBST) {
    if (o.kind === 'you') continue;
    const t = clamp(((o.x - a.x) * dx + (o.z - a.z) * dz) / (L * L), 0, 1);
    const px = a.x + dx * t, pz = a.z + dz * t;
    if (t > 0.02 && t < 0.98 && Math.hypot(px - o.x, pz - o.z) < o.r * 0.9) { const y = lerp(a.y, b.y, t); if (o.kind === 'tree' || y < H(o.x, o.z) + (o.kind === 'rock' ? 0.7 : 0.45)) return true; }
  }
  for (let s = 0.15; s < 0.95; s += 0.12) { const x = a.x + dx * s, z = a.z + dz * s, y = lerp(a.y, b.y, s); if (y < H(x, z) + 0.02) return true; }
  return false;
}
function sense(t) {
  if (!dog.ready) return;
  const eye = headWorld(dog.eyeL, tmpV[0]).clone(), f = headForward(tmpV[1]).clone();
  const fh = Math.atan2(f.x, f.z);
  for (const o of OBJ()) {
    const d = o.p.clone().sub(eye), dist = d.length();
    const ang = Math.abs(wrapA(Math.atan2(d.x, d.z) - fh));
    const speed = o.v.length();
    // moving things are seen from about 1.5 times further (Miller, VIN); everything less far at night
    const range = (o.size * 120) * (ON('L.organic') ? (speed > 0.2 ? 1.5 : 1) * (ON('L.day') ? 0.35 + 0.65 * CLOCK.light : 1) : 1 + clamp(speed, 0, 3));
    let vis = ang < 2.09 && dist < range && !occluded(eye, o.p);
    if (o.obj && o.obj.held) vis = false;
    if (o.id === 'ball' && ball.held) vis = false;
    if (brain.cur === 'sleep' && dog.posture.down > 0.7 && (!ON('L.sleep') || brain.stage === 'nrem' || brain.stage === 'rem')) vis = false;
    const p = percepts[o.id] || (percepts[o.id] = { id: o.id, seen: -1e9, pos: V3(), vis: false, sal: 0, kind: o.kind || o.id, net: 0 });
    // read only tap: a sense event when something comes into view after 3 s out of it
    if (vis && !p.vis && t - p.seen > 3) p.ev = EV.emit({ agent: 'dog', kind: 'sense', sense: 'eye', text: (p.seen > -1e8 ? 'saw ' : 'first saw ') + (o.id === 'you' ? 'moheeb' : o.id.replace(/\d+$/, '')) + ' at ' + dist.toFixed(1) + ' m' });
    p.vis = vis; p.obj = o.obj; p.dist = dist; p.speed = speed;
    if (vis) { p.seen = t; p.pos.copy(o.p); p.vel = o.v.clone(); }
    if (!vis && p.seen > -1e8 && !['bowl', 'bed'].includes(p.id) && ON('L.organic')) { if (!p.err) p.err = V3(ORG.gauss(), 0, ORG.gauss()); if (t - p.seen > 240) { p.seen = -1e9; p.err = null; } } else if (vis) p.err = null;
    const novelty = clamp(1 - (t - p.seen) / 30, 0, 1);
    p.sal = vis ? clamp((o.size / Math.max(dist, 0.3)) * 2 + clamp(speed, 0, 4) * 0.4 + (ang < 0.5 ? 0.2 : 0) + p.net * 0.3, 0, 2) : 0;
    p.conf = vis ? 1 : novelty;
    p.net = Math.max(0, p.net - 0.02);
  }
  for (const k in percepts) if (k.startsWith('treat') && !treats[+k.slice(5)]) delete percepts[k];
}
// remembered position: errors grow with time but stay near the target (Fiset 2003)
function memPos(p) { const age = Math.max(0, now - p.seen); return p.err ? p.pos.clone().addScaledVector(p.err, 0.25 * Math.sqrt(age / 60)) : p.pos.clone(); }
// sound events
const sounds = [];
let hearLevel = 0;
function emitSound(pos, loud, type) { sounds.push({ pos: pos.clone(), loud, type, t: now }); hearLevel = Math.max(hearLevel, loud); if (brain) brain.hear(pos, loud, type); }
// scent field
const scentSrc = [];
