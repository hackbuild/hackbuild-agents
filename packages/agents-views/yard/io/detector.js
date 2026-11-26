// ---------- yolov8n on the eye (Ultralytics weights, AGPL-3.0, opt in) ----------
const COCO = ['person','bicycle','car','motorcycle','airplane','bus','train','truck','boat','traffic light','fire hydrant','stop sign','parking meter','bench','bird','cat','dog','horse','sheep','cow','elephant','bear','zebra','giraffe','backpack','umbrella','handbag','tie','suitcase','frisbee','skis','snowboard','sports ball','kite','baseball bat','baseball glove','skateboard','surfboard','tennis racket','bottle','wine glass','cup','fork','knife','spoon','bowl','banana','apple','sandwich','orange','broccoli','carrot','hot dog','pizza','donut','cake','chair','couch','potted plant','bed','dining table','toilet','tv','laptop','mouse','remote','keyboard','cell phone','microwave','oven','toaster','sink','refrigerator','book','clock','vase','scissors','teddy bear','hair drier','toothbrush'];
const net = { sess: null, ort: null, loading: false, busy: false, ms: 0, ep: '', last: [] };
const lb = document.createElement('canvas'); lb.width = 640; lb.height = 640; const lbCtx = lb.getContext('2d', { willReadFrequently: true });
const netIn = new Float32Array(3 * 640 * 640);
async function loadNet() {
  if (net.sess || net.loading) return; net.loading = true;
  setNet('loading', 'loading');
  try {
    const ort = await import(window.HACKLE_LIB.ort);
    ort.env.wasm.wasmPaths = ASSETS.wasmDir; ort.env.wasm.numThreads = 1; ort.env.wasm.proxy = false;
    const model = await (await fetchFirst([ASSETS.onnx])).arrayBuffer();
    const hex = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', model)), b => b.toString(16).padStart(2, '0')).join('');
    if (hex !== ASSETS.onnxSha) throw new Error('yolov8n.onnx does not match its pinned sha256');
    console.info('yolov8n (ultralytics): weights agpl 3.0'); toast('yolov8n loaded. weights agpl 3.0.');
    let sess = null, ep = 'wasm';
    if (navigator.gpu) { try { sess = await ort.InferenceSession.create(model, { executionProviders: ['webgpu'] }); ep = 'webgpu'; } catch (e) { console.warn('webgpu EP failed', e); } }
    if (!sess) sess = await ort.InferenceSession.create(model, { executionProviders: ['wasm'] });
    net.sess = sess; net.ort = ort; net.ep = ep;
    setNet('ready ' + ep + ', weights agpl 3.0', 'yolo ' + ep, true);
  } catch (e) { console.warn(e); setNet('failed: ' + (e.message || e).toString().slice(0, 60), 'eye net x'); }
  net.loading = false;
}
function setNet(s, chip, on) { net.label = s; $('netSt').textContent = s; $('chipNet').textContent = on ? chip : chip === 'loading' ? 'eye net ...' : chip === 'eye net x' ? chip : 'eye net off'; hudTags(); if (typeof capsRefresh === 'function') capsRefresh(); }
async function detect(src, sw, sh, thr = 0.3) {
  if (!net.sess || net.busy) return null; net.busy = true;
  const t0 = performance.now();
  try {
    const sc = Math.min(640 / sw, 640 / sh), w = sw * sc, h = sh * sc, ox = (640 - w) / 2, oy = (640 - h) / 2;
    lbCtx.fillStyle = 'rgb(114,114,114)'; lbCtx.fillRect(0, 0, 640, 640); lbCtx.drawImage(src, ox, oy, w, h);
    const d = lbCtx.getImageData(0, 0, 640, 640).data, N = 640 * 640;
    for (let i = 0; i < N; i++) { netIn[i] = d[i * 4] / 255; netIn[i + N] = d[i * 4 + 1] / 255; netIn[i + 2 * N] = d[i * 4 + 2] / 255; }
    const tensor = new net.ort.Tensor('float32', netIn, [1, 3, 640, 640]);
    const out = await net.sess.run({ [net.sess.inputNames[0]]: tensor });
    const o = out[net.sess.outputNames[0]].data, A = 8400;
    const cand = [];
    for (let i = 0; i < A; i++) {
      let best = 0, bc = -1; for (let c = 0; c < 80; c++) { const s = o[(4 + c) * A + i]; if (s > best) { best = s; bc = c; } }
      if (best < thr) continue;
      const cx = o[i], cy = o[A + i], bw = o[2 * A + i], bh = o[3 * A + i];
      cand.push({ c: bc, s: best, x0: (cx - bw / 2 - ox) / sc, y0: (cy - bh / 2 - oy) / sc, x1: (cx + bw / 2 - ox) / sc, y1: (cy + bh / 2 - oy) / sc });
    }
    cand.sort((a, b) => b.s - a.s);
    const keep = [];
    for (const c of cand) { if (keep.some(k => k.c === c.c && iou(k, c) > 0.45)) continue; keep.push(c); if (keep.length > 12) break; }
    net.ms = performance.now() - t0;
    net.busy = false;
    return keep.map(k => ({ label: COCO[k.c], score: k.s, box: k }));
  } catch (e) { console.warn('detect', e); net.busy = false; return null; }
}
const iou = (a, b) => { const ix = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)), iy = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0)), I = ix * iy; return I / ((a.x1 - a.x0) * (a.y1 - a.y0) + (b.x1 - b.x0) * (b.y1 - b.y0) - I + 1e-6); };
function drawBoxes(ctx, dets, sx = 1, sy = 1) {
  ctx.lineWidth = 2; ctx.font = '13px VT323, monospace';
  for (const d of dets) { const b = d.box; ctx.strokeStyle = '#FE0386'; ctx.strokeRect(b.x0 * sx, b.y0 * sy, (b.x1 - b.x0) * sx, (b.y1 - b.y0) * sy); const txt = d.label + ' ' + Math.round(d.score * 100); ctx.fillStyle = '#FE0386'; ctx.fillRect(b.x0 * sx, b.y0 * sy - 14, ctx.measureText(txt).width + 6, 14); ctx.fillStyle = '#fff'; ctx.fillText(txt, b.x0 * sx + 3, b.y0 * sy - 3); }
}
const NETMAP = { 'sports ball': 'ball', person: 'you', bowl: 'bowl', bed: 'bed', cat: 'squirrel', bird: 'squirrel', 'teddy bear': 'squirrel', dog: 'squirrel', mouse: 'squirrel' };
async function eyeDetect() {
  if (!$('netOn').checked || !net.sess) return;
  const dets = await detect(rawEye, EW, EH, 0.28); if (!dets) return;
  net.last = dets;
  boxCtx.clearRect(0, 0, EW, EH); drawBoxes(boxCtx, dets);
  for (const d of dets) { const id = NETMAP[d.label]; if (id && percepts[id]) percepts[id].net = Math.max(percepts[id].net, d.score); }
  $('detList').innerHTML = (dets.length ? dets.map(d => `<div><span>${d.label}</span><span>${(d.score * 100).toFixed(0)}%</span><span class="vis">${NETMAP[d.label] ? '= ' + NETMAP[d.label] : ''}</span></div>`).join('') : '<div><span>nothing above 28%</span><span></span><span></span></div>') + `<div><span>latency</span><span>${net.ms.toFixed(0)} ms</span><span>${net.ep}</span></div>`;
}
// show the dog a photo or the webcam
const REACT = {
  cat: ['prey', 'a cat. A CAT.'], bird: ['prey', 'bird! get it'], squirrel: ['prey', 'squirrel?!'], horse: ['bark', 'very big dog'], cow: ['bark', 'giant dog, suspicious'], sheep: ['bark', 'must herd'], bear: ['fear', 'nope'], dog: ['bow', 'friend! play?'], person: ['social', 'a human, hello'],
  'sports ball': ['play', 'ball ball ball'], frisbee: ['play', 'throw it'], 'teddy bear': ['play', 'squeaky?'], kite: ['play', 'sky toy'],
  banana: ['food', 'snack?'], apple: ['food', 'snack?'], sandwich: ['food', 'share please'], orange: ['food', 'smells odd'], broccoli: ['food', 'meh, ok'], carrot: ['food', 'crunchy'], 'hot dog': ['food', 'HOT DOG'], pizza: ['food', 'pizza for me?'], donut: ['food', 'please'], cake: ['food', 'is it my birthday'],
  umbrella: ['fear', 'scary stick'], 'hair drier': ['fear', 'loud thing'], 'fire hydrant': ['sniff', 'must sniff'], bowl: ['food', 'dinner?'], bed: ['rest', 'nap spot'], couch: ['rest', 'forbidden couch']
};
function reactTo(dets, source) {
  if (!dets || !dets.length) { brain.say(source === 'cam' ? '' : 'nothing interesting', 2); return; }
  const top = dets.find(d => REACT[d.label]) || dets[0];
  const r = REACT[top.label];
  if (!r) { brain.say('a ' + top.label + '?', 2.5); dog.head.tRoll = 0.35; return; }
  brain.stimulus(r[0], top.score);
  brain.say(r[1], 3);
}
async function showPhoto(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const bmp = await createImageBitmap(file);
  const c = $('photo'), ctx = c.getContext('2d');
  const sc = Math.min(320 / bmp.width, 240 / bmp.height); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
  ctx.drawImage(bmp, 0, 0, c.width, c.height); $('photoView').style.display = 'block';
  showTab('pSense');
  // the detector loads only when you say so: a photo asks first and never fetches it on its own
  let dets = null;
  $('photoAsk').hidden = $('netOn').checked;
  if (!$('netOn').checked) photoWaiting = file;
  else {
    if (!net.sess) await loadNet();
    if (!net.sess) toast('detector not available');
  }
  if (net.sess && $('netOn').checked) {
    for (let i = 0; i < 20 && !dets; i++) { dets = await detect(bmp, bmp.width, bmp.height, 0.3); if (!dets) await new Promise(r => setTimeout(r, 120)); }
    if (dets) { drawBoxes(ctx, dets, sc, sc); reactTo(dets, 'photo'); toast(dets.length ? 'dog sees: ' + dets.slice(0, 3).map(d => d.label).join(', ') : 'dog sees nothing it knows'); }
  }
  if (vlm.state === 'ready' && !thinking) {
    const pc = document.createElement('canvas'); pc.width = c.width; pc.height = c.height; pc.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    thinking = true; $('cortexSt').textContent = 'looking at photo';
    const prompt = 'You are a dog and your human is showing you this picture. In one short sentence, in a dog\'s voice, say what it is and how you feel about it.', callT = now;
    vlmAsk(pc, prompt, 48)
      .then(r => { const a = r.text.trim().split('\n')[0]; vlmLog({ t: callT, who: 'dog', kind: 'photo', prompt, text: r.text.trim(), ms: r.ms, tokens: r.tokens, ok: true }); EV.emit({ agent: 'dog', kind: 'model', text: 'looked at your photo in ' + (r.ms / 1000).toFixed(1) + ' s: ' + a.slice(0, 60) }); brain.say(a.slice(0, 90), 6); $('cortexOut').textContent = 'photo: ' + a; $('cortexSt').textContent = 'ready'; })
      .catch(() => { $('cortexSt').textContent = 'error'; }).finally(() => { thinking = false; });
  }
}
let photoWaiting = null;
$('photoIn').addEventListener('change', e => showPhoto(e.target.files[0]));
$('bPhotoYes').onclick = () => { $('netOn').checked = true; loadNet(); $('photoAsk').hidden = true; const f = photoWaiting; photoWaiting = null; if (f) showPhoto(f); };
$('bPhotoNo').onclick = () => { $('photoAsk').hidden = true; photoWaiting = null; };
stage.addEventListener('dragover', e => { e.preventDefault(); $('drop').classList.add('is-over'); });
stage.addEventListener('dragleave', e => { if (e.target === $('drop')) $('drop').classList.remove('is-over'); });
stage.addEventListener('drop', async e => {
  e.preventDefault(); $('drop').classList.remove('is-over');
  const f = e.dataTransfer.files[0]; if (!f) return;
  if (/\.glb$/i.test(f.name)) { const buf = await f.arrayBuffer(); new GLTFLoader().parse(buf, '', g => { if (setupDog(g, f.name)) toast('new body: ' + f.name); }, err => toast('could not read GLB')); }
  else showPhoto(f);
});
// webcam, works only outside sandboxed viewers
const camState = { on: false, gest: null, face: null, lastT: 0 };
$('bWebcam').addEventListener('click', async () => {
  if (camState.on) { const v = $('cam'); v.srcObject && v.srcObject.getTracks().forEach(t => t.stop()); v.style.display = 'none'; camState.on = false; $('bWebcam').setAttribute('aria-pressed', 'false'); camState.err = ''; capsRefresh(); return; }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { camState.err = 'this page cannot reach a camera here. open it over https or localhost.'; toast(camState.err); capsRefresh(); return; }
  try {
    const st = ENV.stream(await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } }));
    const v = $('cam'); v.srcObject = st; v.style.display = 'block'; await v.play(); camState.on = true; camState.err = ''; $('bWebcam').setAttribute('aria-pressed', 'true'); capsRefresh();
    // yolov8n (agpl 3.0 weights) loads only when you turn it on under sense
    if ($('netOn').checked) loadNet();
    try {
      if (!camState.gest) toast('fetching the mediapipe gesture and face models, 27.3 mb, apache 2.0.');
      const mp = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/vision_bundle.mjs');
      const fs = await mp.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm');
      camState.gest = await mp.GestureRecognizer.createFromOptions(fs, { baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task', delegate: 'GPU' }, runningMode: 'VIDEO', numHands: 1 });
      camState.face = await mp.FaceLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task', delegate: 'GPU' }, runningMode: 'VIDEO', outputFaceBlendshapes: true, numFaces: 1 });
      console.info('mediapipe gesture and face landmarker models (version 1): apache 2.0'); toast('gestures and smiles on. mediapipe models apache 2.0.');
      camState.models = true; capsRefresh();
    } catch (e) { console.warn('mediapipe', e); camState.err = 'the camera is on, the gesture models did not download.'; toast(camState.err); capsRefresh(); }
  } catch (e) { camState.err = 'the camera was blocked. allow it in the address bar, then try again.'; toast(camState.err); capsRefresh(); }
});
let lastGesture = '', gestT = 0;
async function camTick(t) {
  if (!camState.on) return;
  const v = $('cam'); if (v.readyState < 2) return;
  if (camState.gest && t - camState.lastT > 0.12) {
    camState.lastT = t;
    try {
      const r = camState.gest.recognizeForVideo(v, performance.now());
      const g = r.gestures && r.gestures[0] && r.gestures[0][0];
      if (g && g.score > 0.6 && g.categoryName !== 'None') {
        if (g.categoryName !== lastGesture || t - gestT > 3) { lastGesture = g.categoryName; gestT = t; gestureCue(g.categoryName); }
      }
      if (camState.face) { const f = camState.face.detectForVideo(v, performance.now() + 1); const bs = f.faceBlendshapes && f.faceBlendshapes[0]; if (bs) { const sm = bs.categories.filter(c => /mouthSmile/.test(c.categoryName)).reduce((a, c) => a + c.score, 0) / 2; if (sm > 0.55) brain.stimulus('smile', sm); } }
    } catch (e) {}
  }
  if (net.sess && !net.busy && Math.floor(t * 1.5) !== camState.det) { camState.det = Math.floor(t * 1.5); const d = await detect(v, v.videoWidth, v.videoHeight, 0.45); if (d) { const inter = d.filter(x => x.label !== 'person'); if (inter.length) reactTo(inter, 'cam'); } }
}
function gestureCue(name) {
  const map = { Thumb_Up: 'praise', Thumb_Down: 'scold' };
  if (map[name] === 'praise') return brain.reward(0.6, 'thumbs up');
  if (map[name] === 'scold') return brain.reward(-0.6, 'thumbs down');
  brain.cue('gesture:' + name.toLowerCase());
}
// clap detection: its own button, the only path that asks for the microphone level
$('bClap').addEventListener('click', async () => {
  if (micAn) { micAn = null; $('bClap').setAttribute('aria-pressed', 'false'); clapErr = ''; capsRefresh(); return; }
  try { startMicLevel(ENV.stream(await navigator.mediaDevices.getUserMedia({ audio: true }))); $('bClap').setAttribute('aria-pressed', 'true'); clapErr = ''; }
  catch (e) { clapErr = 'the microphone was blocked. allow it in the address bar, then try again.'; toast(clapErr); }
  capsRefresh();
});
let micAn = null, clapErr = '';
function startMicLevel(stream) { try { const a = audio() || new AudioContext(); const src = a.createMediaStreamSource(stream); micAn = a.createAnalyser(); micAn.fftSize = 512; src.connect(micAn); } catch (e) {} }
const micBuf = new Float32Array(512); let micCool = 0;
function micTick(dt) { if (!micAn) return; micAn.getFloatTimeDomainData(micBuf); let pk = 0; for (const x of micBuf) pk = Math.max(pk, Math.abs(x)); micCool -= dt; if (pk > 0.5 && micCool <= 0) { micCool = 1; emitSound(V3(YOU.x, 1.4, YOU.z), clamp(pk, 0, 1), 'clap'); } }

