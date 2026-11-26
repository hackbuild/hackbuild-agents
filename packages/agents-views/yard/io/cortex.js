// ---------- cortex: local vision language model on WebGPU, in a worker ----------
// each model pinned to a Hugging Face commit; the licence line shows when it loads (vendor, model cards)
const VLM = {
  gemma: { id: 'onnx-community/gemma-4-E2B-it-ONNX', rev: '6f21c99d7e18237f8d2ce92aadfdbfeba877f63a', name: 'gemma 4 e2b', licence: 'weights apache 2.0' },
  lfm: { id: 'onnx-community/LFM2-VL-450M-ONNX', rev: '308cf784b35ce25274540e1bf5592c33a0433469', name: 'lfm2-vl 450m', licence: 'weights lfm open license 1.0' },
  // no weights: replies written in code from the drives, so the prompt inspector and every cortex
  // control run on any device. Token counts are computed at four characters a token.
  stub: { id: 'stub', rev: '', name: 'stub cortex', licence: 'no weights, replies written in code' }
};
// the goal words the dog cortex may answer with: the only tool list it sees
const DOG_GOALS = ['explore', 'sniff', 'eat', 'fetch', 'chase', 'greet', 'beg', 'playbow', 'zoomies', 'rest', 'sleep', 'idle'];
// vlm.log: the last 40 model calls of both agents, newest first (read by the brain and human tabs).
// vlm.last: the last call in full for the prompt inspector: prompt, reply, token counts and the tool list.
const vlm = { worker: null, state: 'off', kind: store.get('vlm', 'lfm'), nid: 0, wait: new Map(), ms: 0, progress: null, err: '', log: [], last: null, calls: 0 };
function vlmLog(e) { vlm.log.unshift(e); if (vlm.log.length > 40) vlm.log.pop(); }
function vlmPick(kind) { if (!VLM[kind] || kind === vlm.kind) return; vlm.kind = kind; if (kind !== 'stub') store.set('vlm', kind); if (vlm.worker) { vlm.worker.terminate(); vlm.worker = null; vlm.state = 'off'; vlm.progress = null; setVlm('off'); } }
// the cortex controls in brain stay hidden, with the reason beside them, until a model is ready
function setVlm(st) {
  vlm.label = st; $('cortexSt').textContent = st; const ready = vlm.state === 'ready';
  // the think, ask and auto controls appear once a model can answer; the load button until then
  $('bThink').disabled = !ready; $('askIn').disabled = !ready; $('autoThink').disabled = !ready; $('autoThinkL').classList.toggle('is-disabled', !ready);
  $('bThink').hidden = !ready; $('askRow').hidden = !ready; $('autoThinkL').hidden = !ready;
  $('bVlmLoad').hidden = ready || vlm.state === 'loading' || !navigator.gpu; $('vlmSel').disabled = vlm.state === 'loading';
  $('cortexWhy').textContent = ready ? '' : !navigator.gpu ? 'no webgpu adapter. the cortex needs it.' : vlm.state === 'loading' ? 'the model is downloading.' : '';
  if (typeof capsRefresh === 'function') capsRefresh();
}
setVlm(navigator.gpu ? 'off' : 'needs webgpu');
// the stub answers in the same shape as the worker, a tick later, with computed counts
function stubCortex() {
  const top = () => { const d = brain.d, k = ['hunger', 'fatigue', 'play', 'social', 'curiosity', 'prey'].sort((a, b) => d[b] - d[a])[0]; return [k, { hunger: 'eat', fatigue: 'rest', play: 'fetch', social: 'greet', curiosity: 'sniff', prey: 'chase' }[k]]; };
  const reply = p => {
    if (/GOAL:/.test(p)) { const [k, g] = top(); return 'SAW: the yard from low down\nTHOUGHT: my ' + k + ' is the strongest thing right now\nGOAL: ' + g; }
    if (/DO:/.test(p)) return 'SAY: stub mind, no model loaded\nDO: watch';
    return 'stub cortex: no model is loaded, so this reply is written in code.';
  };
  return { postMessage(m) { if (m.t !== 'ask') return; const t0 = performance.now(); setTimeout(() => { const w = vlm.wait.get(m.id); vlm.wait.delete(m.id); const text = reply(m.prompt); if (w) w.res({ text, ms: performance.now() - t0, tokens: HBV.tokenEstimate(text), inTokens: HBV.tokenEstimate(m.prompt), count: 'computed' }); }, 0); }, terminate() {} };
}
function vlmLoad() {
  if (vlm.kind === 'stub') { if (vlm.worker) return; vlm.worker = stubCortex(); vlm.state = 'ready'; setVlm('ready, stub cortex'); toast('cortex on: the stub. no weights; replies are written in code.'); return; }
  if (!navigator.gpu) { toast('no webgpu adapter. the cortex stays off.'); return; }
  if (vlm.worker) return;
  const BODY = CORTEX_WORKER;
  const onmsg = e => {
    const m = e.data;
    if (m.t === 'progress') { vlm.alive = true; vlm.progress = { loaded: m.loaded, total: m.total }; logLive('cortex', 'cortex ' + VLM[vlm.kind].name + ', ' + (m.loaded / 1e6).toFixed(0) + ' of ' + (m.total / 1e6).toFixed(0) + ' MB', m.total ? m.loaded / m.total : null); $('cortexSt').textContent = (m.loaded / 1e6).toFixed(0) + ' / ' + (m.total / 1e6).toFixed(0) + ' MB' + (vlm.inPage ? ' (in page)' : ''); if (typeof capsRefresh === 'function') capsRefresh(true); }
    else if (m.t === 'ready') { vlm.state = 'ready'; vlm.progress = null; logLive('cortex', null); wStored[vlm.kind] = true; setVlm('ready, ' + VLM[vlm.kind].name); console.info(VLM[vlm.kind].id + ' at ' + VLM[vlm.kind].rev + ': ' + VLM[vlm.kind].licence); toast('cortex on: ' + VLM[vlm.kind].name + '. ' + VLM[vlm.kind].licence + '.'); }
    else if (m.t === 'cache-match') { wMatch(m.url).then(blob => { if (vlm.worker) vlm.worker.postMessage({ t: 'cache', cid: m.cid, blob }); }); }
    else if (m.t === 'cache-put') { wPut(m.url, m.blob); }
    else if (m.t === 'answer' || m.t === 'error') { if (m.t === 'error' && m.id == null) { vlm.state = 'failed'; vlm.err = m.msg.slice(0, 80).toLowerCase(); vlm.progress = null; logLive('cortex', null); logEvent('fail', 'the cortex did not load: ' + vlm.err); setVlm('failed'); if (vlm.worker) vlm.worker.terminate(); vlm.worker = null; return; } const w = vlm.wait.get(m.id); vlm.wait.delete(m.id); if (w) (m.t === 'answer' ? w.res(m) : w.rej(new Error(m.msg))); }
  };
  const inPage = () => { // fallback when module workers from blob URLs are refused
    vlm.inPage = true;
    const h = new Function('post', BODY)(m => onmsg({ data: m }));
    vlm.worker = { postMessage: m => { setTimeout(() => h(m), 0); }, terminate() {} };
    vlm.worker.postMessage({ t: 'load', id: VLM[vlm.kind].id, rev: VLM[vlm.kind].rev, kind: vlm.kind, hub: ENV.hub });
  };
  vlm.state = 'loading'; vlm.alive = false; vlm.err = ''; vlm.progress = { loaded: 0, total: 0 }; setVlm('loading ' + VLM[vlm.kind].name);
  try {
    const src = 'const h = (new Function("post", ' + JSON.stringify(BODY) + '))(m => postMessage(m)); onmessage = e => h(e.data);';
    const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })), { type: 'module' });
    w.onmessage = onmsg;
    w.onerror = e => { if (!vlm.alive && vlm.state === 'loading') { console.warn('worker failed, running in page', e); w.terminate(); inPage(); } };
    vlm.worker = w;
    w.postMessage({ t: 'load', id: VLM[vlm.kind].id, rev: VLM[vlm.kind].rev, kind: vlm.kind, hub: ENV.hub });
  } catch (e) { inPage(); }
}
let vlmChain = Promise.resolve();
// tools: the words the prompt lets the model answer with, kept for the prompt inspector
function vlmAsk(canvas, prompt, max = 80, tools = []) {
  const job = vlmChain.then(() => vlmAsk1(canvas, prompt, max)).then(r => { vlmLast(prompt, tools, r); return r; }, e => { vlmLast(prompt, tools, null, e); throw e; });
  vlmChain = job.catch(() => {}); return job;
}
function vlmLast(prompt, tools, r, err) {
  vlm.calls++;
  vlm.last = { t: now, provider: VLM[vlm.kind].name, prompt, tools, plan: null, ok: !!r, text: r ? r.text.trim() : String(err && err.message || err),
    ms: r ? r.ms : null, inTokens: r && r.inTokens != null ? r.inTokens : HBV.tokenEstimate(prompt), inCount: r && r.inTokens != null ? r.count || 'measured' : 'computed',
    outTokens: r ? r.tokens : 0, outCount: r ? r.count || 'measured' : 'computed' };
}
function vlmAsk1(canvas, prompt, max) {
  return new Promise((res, rej) => {
    if (vlm.state !== 'ready') return rej(new Error('not ready'));
    const id = ++vlm.nid; vlm.wait.set(id, { res, rej });
    const img = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    vlm.worker.postMessage({ t: 'ask', id, prompt, max, rgba: img.data.buffer, w: img.width, h: img.height }, [img.data.buffer]);
  });
}
const pct = v => Math.round(v * 100) + '%';
let thinking = false;
// automatic cortex calls go through @hackbuild/drives InferenceScheduler: one at a time, at least
// Br.cortexMin s apart while something important happened, otherwise 60 s apart
const cortexOpts = { minInterval: 60 }, cortexSched = new HDRIVE.InferenceScheduler(cortexOpts);
// memory stream retrieval: recency (0.995 per game hour) plus importance plus relevance to what is in view (Park et al. 2023)
function memRank(vis) { const hNow = CLOCK.day * 24 + CLOCK.h; return brain.mem.map(m => ({ m, s: Math.pow(0.995, hNow - m.h) + m.imp / 6 + (vis.some(v => m.txt.includes(v)) ? 0.5 : 0) })).sort((a, b) => b.s - a.s); }
async function think() {
  if (vlm.state !== 'ready' || thinking || !ball) return; thinking = true; $('cortexSt').textContent = 'thinking';
  const d = brain.d, vis = Object.values(percepts).filter(p => p.vis).map(p => p.id.replace(/\d+$/, ''));
  const ranked = memRank(vis).slice(0, 4), mems = ranked.map(x => x.m.txt);
  brain.lastRecall = { t: now, items: ranked.map(x => ({ m: x.m, s: x.s })) };
  const callT = now, cause = EV.n;
  const prompt = `You are the mind of a dog in a backyard. The picture is what your eyes see right now. How you feel: hunger ${pct(d.hunger)}, tiredness ${pct(d.fatigue)}, wanting to play ${pct(d.play)}, wanting company ${pct(d.social)}, curiosity ${pct(d.curiosity)}, urge to chase ${pct(d.prey)}. ${ball.held ? 'You have the ball in your mouth.' : ''} Your nose and ears also notice: ${vis.join(', ') || 'nothing much'}. It is ${Math.floor(CLOCK.h)} o'clock. Things you remember: ${mems.join('; ') || 'nothing yet'}.
Reply in exactly three lines and nothing else:
SAW: what you see, under 10 words
THOUGHT: your inner thought as a dog, first person, under 12 words
GOAL: one word from ${DOG_GOALS.join(', ')}`;
  try {
    const r = await vlmAsk(rawEye, prompt, 72, DOG_GOALS); vlm.ms = r.ms;
    const txt = r.text.trim();
    vlmLog({ t: callT, who: 'dog', kind: 'think', prompt, text: txt, ms: r.ms, tokens: r.tokens, ok: true });
    const saw = (txt.match(/SAW:\s*(.+)/i) || [])[1] || '';
    const thought = ((txt.match(/THOUGHT:\s*(.+)/i) || [])[1] || txt.split('\n')[0] || '...').replace(/^["']|["']$/g, '');
    const gl = ((txt.match(/GOAL:\s*(.+)/i) || [])[1] || txt).toLowerCase();
    const goal = BEH.find(b => new RegExp('\\b' + b + '\\b').test(gl)) || 'idle';
    brain.cortexGoal = { b: goal, until: now + 20 };
    if (vlm.last) vlm.last.plan = { saw: saw.trim(), thought: thought.trim(), goal };
    EV.emit({ agent: 'dog', kind: 'model', text: 'cortex in ' + (r.ms / 1000).toFixed(1) + ' s: "' + thought.trim().slice(0, 60) + '", goal ' + goal + ', +0.35 for 20 s', cause });
    brain.say(thought.slice(0, 80), 5);
    $('cortexOut').textContent = (saw ? 'saw ' + saw.trim() + '. ' : '') + '"' + thought.trim() + '" goal: ' + goal;
    $('cortexSt').textContent = 'ready, ' + (r.ms / 1000).toFixed(1) + ' s, ' + r.tokens + ' tok';
  } catch (e) { $('cortexSt').textContent = 'error'; vlmLog({ t: callT, who: 'dog', kind: 'think', prompt, text: String(e.message || e), ms: 0, tokens: 0, ok: false }); console.warn('cortex', e); }
  thinking = false;
}
$('bThink').onclick = think;
$('askIn').addEventListener('keydown', async e => {
  if (e.key !== 'Enter' || !e.target.value.trim() || thinking) return;
  const q = e.target.value.trim().slice(0, 200); e.target.value = ''; thinking = true; $('cortexSt').textContent = 'thinking';
  brain.named();
  try {
    const prompt = `You are a dog. The picture is what you see right now with your own eyes. Your human asks: "${q}". Answer in one or two short sentences, in a dog's voice.`;
    const r = await vlmAsk(rawEye, prompt, 64);
    const a = r.text.trim().split('\n').filter(Boolean).slice(0, 2).join(' ');
    vlmLog({ t: now, who: 'dog', kind: 'ask', prompt, text: r.text.trim(), ms: r.ms, tokens: r.tokens, ok: true });
    EV.emit({ agent: 'dog', kind: 'model', text: 'you asked "' + q.slice(0, 40) + '", it answered in ' + (r.ms / 1000).toFixed(1) + ' s' });
    $('cortexOut').textContent = 'you: ' + q + '\ndog: ' + a; brain.say(a.slice(0, 90), 6);
    $('cortexSt').textContent = 'ready, ' + (r.ms / 1000).toFixed(1) + ' s';
  } catch (err) { $('cortexSt').textContent = 'error'; }
  thinking = false;
});

