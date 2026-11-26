// ---------- his voice: Pocket TTS with a clone of the owner's voice reference (from the owner's
// earlier voice app), browser voice fallback ----------
// The engine is third party code run in a worker: KevinAHM/pocket-tts-web on Hugging Face, pinned
// to one commit, and each code file is checked against its SHA-256 before it runs. Engine code
// Apache-2.0 (CODE-LICENSE in the space), models CC-BY-NC-4.0 (onnx/ONNX-LICENSE), both vendor;
// the models and voices it fetches are pinned by the commit, not hashed here.
const POCKET_REV = 'd0c0c79b7712256a32d691c67f20b8ae2e020d00';
const POCKET_BASE = 'https://huggingface.co/spaces/KevinAHM/pocket-tts-web/resolve/' + POCKET_REV + '/';
const POCKET_SHA = {
  'inference-worker.js': 'dace0a022e17dffcf60fdb7b86e49facf093f709b352fb306c1d6641ae0f5366',
  'sentencepiece.js': 'fc802c6945931e685d82d0f601cda185bb43990870d712119caf5ea74e6e9c56'
};
const POCKET_LICENCE = 'pocket tts: engine apache 2.0, models cc by-nc 4.0, non commercial use only (kevinahm/pocket-tts-web at ' + POCKET_REV.slice(0, 7) + ')';
async function pocketText(name) {
  const r = await fetch(POCKET_BASE + name);
  if (!r.ok) throw new Error(name + ' http ' + r.status);
  const buf = await r.arrayBuffer();
  const hex = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buf)), b => b.toString(16).padStart(2, '0')).join('');
  if (hex !== POCKET_SHA[name]) throw new Error(name + ' does not match its pinned sha256');
  return new TextDecoder().decode(buf);
}
// the voice reference the host passed (base64 wav); empty when it passed none
const voiceClip = () => ENV.voice;
const SPEAK_FIX = [[/\bhack\.build\b/gi, 'hack dot build'], [/\blol\b/gi, 'haha'], [/\blmk\b/gi, 'let me know'], [/\bidk\b/gi, 'I dunno'], [/\bjk\b/gi, 'just kidding']];
function speakable(text) {
  let t = String(text || '');
  for (const [re, to] of SPEAK_FIX) t = t.replace(re, to);
  t = t.replace(/&/g, ' and ').replace(/[*_`#~^|<>\[\]{}\\]/g, ' ').replace(/\.{2,}/g, '. ').replace(/\s+/g, ' ').trim();
  return t;
}
const Voice = {
  ctx: null, an: null, gain: null, worker: null, mode: 'web', ready: false, voices: [], cur: '', sr: 24000,
  queue: [], genBusy: false, accepting: false, active: 0, nextT: 0, srcs: new Set(), webCount: 0, tbuf: null, watchdog: 0, pend: {}, on: true,
  get speaking() { return this.active > 0 || this.queue.length > 0 || this.genBusy || this.webCount > 0; },
  level() {
    if (this.mode === 'pocket' && this.an) {
      this.an.getFloatTimeDomainData(this.tbuf); let s = 0; for (let i = 0; i < this.tbuf.length; i++) s += this.tbuf[i] * this.tbuf[i];
      return Math.min(1, Math.sqrt(s / this.tbuf.length) * 6);
    }
    if (this.webCount > 0) { const t = performance.now() / 1000; return 0.35 + 0.3 * Math.abs(Math.sin(t * 11)) * (0.6 + 0.4 * Math.sin(t * 3.1)); }
    return 0;
  },
  setup() {
    if (this.ctx) return;
    try { this.ctx = new AudioContext({ sampleRate: 24000, latencyHint: 'interactive' }); } catch (_) { this.ctx = new AudioContext(); }
    this.gain = this.ctx.createGain(); this.an = this.ctx.createAnalyser(); this.an.fftSize = 1024;
    this.gain.connect(this.an); this.an.connect(this.ctx.destination); this.tbuf = new Float32Array(this.an.fftSize);
  },
  async init(onStat) {
    this.setup(); try { await this.ctx.resume(); } catch (_) {}
    onStat('fetching voice engine');
    const [code, spText] = await Promise.all([pocketText('inference-worker.js'), pocketText('sentencepiece.js')]);
    console.info(POCKET_LICENCE); onStat(POCKET_LICENCE);
    let patched = "self.__hackleSP = async () => { const t = " + JSON.stringify(spText) + "; try { return await import(URL.createObjectURL(new Blob([t], { type: 'text/javascript' }))); } catch (e) { const u8 = new TextEncoder().encode(t); let bin = ''; for (let i = 0; i < u8.length; i += 32768) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 32768)); return await import('data:text/javascript;base64,' + btoa(bin)); } };\n" + code;
    patched = patched.replace(/import\(\s*(["'`])\.\/sentencepiece\.js(?:\?[^"'`]*)?\1\s*\)/g, 'self.__hackleSP()');
    patched = patched.replace(/CHUNK_GAP_SEC\s*=\s*0\.25/, 'CHUNK_GAP_SEC = 0.1');
    patched = patched.replace(/(\w+)\.env\.wasm\.wasmPaths\s*=/, '$1.env.wasm.numThreads = 1; $1.env.wasm.proxy = false; $1.env.wasm.wasmPaths =');
    patched = patched.replace(/(["'`])\.\/(?!\.)/g, '$1' + POCKET_BASE);
    const url = URL.createObjectURL(new Blob([patched], { type: 'text/javascript' }));
    let n = 0;
    const start = type => new Promise((res, rej) => {
      const w = this.worker = type ? new Worker(url, { type }) : new Worker(url);
      const to = setTimeout(() => rej(new Error('voice load timed out')), 420000);
      let loaded = false;
      w.onerror = e => { if (!loaded) { clearTimeout(to); rej(new Error(e.message || 'voice worker error')); } };
      w.onmessage = ev => {
        const m = ev.data || {};
        switch (m.type) {
          case 'model_status': onStat(String(m.text || m.status || 'loading ' + (++n)).slice(0, 40)); break;
          case 'voices_loaded': this.voices = (m.voices || []).map(v => typeof v === 'string' ? v : (v.name || v.id)); this.defaultVoice = m.defaultVoice; break;
          case 'bundle_loaded': if (m.sampleRate) this.sr = m.sampleRate; break;
          case 'loaded': loaded = true; clearTimeout(to); this.hook(); res(); break;
          case 'error': if (!loaded) { clearTimeout(to); rej(new Error(m.error || 'voice error')); } else console.warn('tts', m.error); break;
        }
      };
      w.postMessage({ type: 'load' });
    });
    try { await start(null); } catch (e1) { console.warn('classic voice worker failed', e1); try { this.worker.terminate(); } catch (_) {} if (location.protocol === 'file:') throw e1; await start('module'); }
    URL.revokeObjectURL(url);
    this.cur = ['marius', 'jean', 'javert'].find(v => this.voices.includes(v)) || this.defaultVoice || this.voices[0];
    this.send({ type: 'set_voice', data: { voiceName: this.cur } });
    this.mode = 'pocket'; this.ready = true;
    const b64 = voiceClip();
    if (!b64) { onStat('ready, stock voice ' + this.cur); this.pump(); return { cloned: false, voice: this.cur }; }
    onStat('cloning his voice');
    let cloned = false;
    try {
      if (b64.length < 64) throw new Error('voice clip too short');
      const bin = atob(b64), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      const dv = new DataView(u8.buffer), cnt = (u8.length - 44) >> 1, f = new Float32Array(cnt);
      for (let i = 0; i < cnt; i++) f[i] = dv.getInt16(44 + i * 2, true) / 32768;
      await new Promise(res => { this.pend.enc = res; this.send({ type: 'encode_voice', data: { audio: f } }); setTimeout(res, 60000); });
      this.cur = 'custom'; this.send({ type: 'set_voice', data: { voiceName: 'custom' } });
      cloned = true;
      onStat('ready, his cloned voice');
    } catch (e) { console.warn('clone failed', e); onStat('ready, stock voice ' + this.cur); }
    this.pump();
    return { cloned, voice: this.cur };
  },
  send(m) { try { this.worker.postMessage(m); } catch (_) {} },
  hook() {
    this.worker.onmessage = ev => {
      const m = ev.data || {};
      if (m.type === 'generation_started') this.accepting = true;
      else if (m.type === 'audio_chunk') { if (this.accepting && m.data) this.play(m.data); this.touch(); }
      else if (m.type === 'stream_ended') { this.genBusy = false; this.accepting = false; clearTimeout(this.watchdog); this.pump(); }
      else if (m.type === 'voice_encoded' && this.pend.enc) { this.pend.enc(); this.pend.enc = null; }
      else if (m.type === 'error') { console.warn('tts error', m.error); if (this.pend.enc) { this.pend.enc(); this.pend.enc = null; } if (this.genBusy) { this.genBusy = false; this.pump(); } }
    };
  },
  touch() { clearTimeout(this.watchdog); this.watchdog = setTimeout(() => { this.genBusy = false; this.pump(); }, 30000); },
  play(f32) {
    const ctx = this.ctx; if (!ctx) return; const n = f32.length; if (!n) return;
    const copy = new Float32Array(n); copy.set(f32);
    const fade = Math.min(96, n >> 1); for (let i = 0; i < fade; i++) { const g = i / fade; copy[i] *= g; copy[n - 1 - i] *= g; }
    const ab = ctx.createBuffer(1, n, this.sr); ab.copyToChannel(copy, 0);
    const src = ctx.createBufferSource(); src.buffer = ab; src.connect(this.gain);
    const t0 = Math.max(ctx.currentTime + 0.03, this.nextT); src.start(t0); this.nextT = t0 + ab.duration;
    this.active++; this.srcs.add(src); src.onended = () => { this.active = Math.max(0, this.active - 1); this.srcs.delete(src); };
  },
  speak(text, pitchUp = 0) {
    const t = speakable(text); if (!t || !this.on || !$('sound').checked) return;
    if (this.mode === 'pocket') { if (this.queue.length > 2) this.queue.shift(); this.queue.push(t); this.pump(); return; }
    if (!('speechSynthesis' in window) || !audioOK) return;
    const u = new SpeechSynthesisUtterance(t);
    const vs = speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang));
    const p = vs.find(v => /male|daniel|alex|david|fred|google uk english male/i.test(v.name) && !/female/i.test(v.name)) || vs[0];
    if (p) u.voice = p; u.rate = 1.06; u.pitch = 0.95 * (1 + pitchUp * 1.6);
    this.webCount++; u.onend = u.onerror = () => { this.webCount = Math.max(0, this.webCount - 1); };
    speechSynthesis.speak(u);
  },
  pump() {
    if (this.mode !== 'pocket' || !this.ready || this.genBusy || !this.queue.length) return;
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    const text = this.queue.shift(); this.genBusy = true; this.touch();
    this.send({ type: 'generate', data: { text, voice: this.cur } });
  }
};
