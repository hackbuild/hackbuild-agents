// ---------- determinism: test mode, seeded rng, sim event queue ----------
// #test&seed=N opens in lockstep: no animation loop, window.__sim.step(n) advances n fixed steps.
// &off=L.neural,L.day turns layers off before the first step, &on=L.neural turns them on.
const TEST = (() => { const h = new URLSearchParams(ENV.params); if (!h.has('test')) return null; return { seed: (+h.get('seed') || 1) >>> 0, off: (h.get('off') || '').split(',').filter(Boolean), on: (h.get('on') || '').split(',').filter(Boolean), nnacc: ['f32', 'f64'].includes(h.get('nnacc')) ? h.get('nnacc') : null }; })();
// #seed=N without test: real time mode (animation loop, wall clock frames) with a seeded rng and
// a trace of the same rows as lockstep, read through window.__rt; &speed=S sets simSpeed and
// &on= and &off= set layers as in test mode. tools/runner/speed.mjs compares speeds with it.
const SEEDED = (() => { const h = new URLSearchParams(ENV.params); if (h.has('test') || !h.has('seed')) return null; return { seed: (+h.get('seed') || 1) >>> 0, speed: Math.max(0.25, Math.min(8, +h.get('speed') || 1)), off: (h.get('off') || '').split(',').filter(Boolean), on: (h.get('on') || '').split(',').filter(Boolean) }; })();
// mulberry32, one stream for the whole sim; the seed is random outside test mode
const RNG = (seed => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; })(TEST ? TEST.seed : SEEDED ? SEEDED.seed : crypto.getRandomValues(new Uint32Array(1))[0]);
// timed sim events run in sim time, in the order they were scheduled
const SIMQ = { t: 0, n: 0, q: [],
  after(s, fn) { this.q.push({ at: this.t + s, n: this.n++, fn }); this.q.sort((a, b) => a.at - b.at || a.n - b.n); },
  run(t) { this.t = t; while (this.q.length && this.q[0].at <= t) this.q.shift().fn(); } };
const STEP = 1 / 60;
// ---------- instrumentation: read only taps for the minds tab ----------
// one event list for both agents, newest first. An event names its kind (sense, choice, act,
// model, reward, cue), its agent and, when known, the id of the event that caused it. Emitting
// never draws from RNG and never feeds back into the sim; the time is the sim queue clock.
const EV = { log: [], n: 0,
  emit(e) { e.id = ++this.n; e.t = SIMQ.t; this.log.unshift(e); if (this.log.length > 300) this.log.pop(); return e.id; },
  get(id) { if (!id) return null; for (const e of this.log) if (e.id === id) return e; return null; } };
// optional runtimes fetched on demand, never bundled
window.HACKLE_LIB = { ort: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.2/dist/ort.webgpu.bundle.min.mjs' };
// ---------- asset locations: hosted blobs first, then files beside the page ----------
// yolov8n: Ultralytics weights, AGPL-3.0 (vendor), off until you turn it on; sha256 vendor file
const ASSETS = { onnx: 'https://raw.githubusercontent.com/Hyuto/yolov8-onnxruntime-web/fc4a52c466d15ad4519873a0cef22fbc935b93b6/public/model/yolov8n.onnx', onnxSha: '505648ada344cd9f3f31e51d49c489c070819bc96cc758258a8fd51488e00579', wasmDir: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.2/dist/' };
async function fetchFirst(list) { for (const u of list) { if (u.startsWith('__')) continue; try { const r = await fetch(u); if (r.ok) return r; } catch (e) {} } throw new Error('asset not reachable'); }
async function fetchZip(list) {
  // reads the first entry of a zip archive (stored or deflate) using the central directory
  const buf = await (await fetchFirst(list)).arrayBuffer(), dv = new DataView(buf);
  let e = buf.byteLength - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('not a zip');
  const cd = dv.getUint32(e + 16, true);
  const method = dv.getUint16(cd + 10, true), csize = dv.getUint32(cd + 20, true), lho = dv.getUint32(cd + 42, true);
  const start = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true);
  const data = new Uint8Array(buf, start, csize);
  if (method === 0) return data.slice().buffer;
  return await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
}
// ---------- small helpers ----------
const $ = ENV.byId;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const frac = x => x - Math.floor(x);
const wrapH = d => { d = ((d + 0.5) % 1 + 1) % 1; return d - 0.5; };
const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
const rnd = (a, b) => a + RNG() * (b - a);
const pick = arr => arr[(RNG() * arr.length) | 0];
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const tmpV = [V3(), V3(), V3(), V3(), V3(), V3(), V3(), V3(), V3(), V3()];
const tmpQ = [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()];
const store = {
  get(k, d) { try { const v = localStorage.getItem('hackle.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('hackle.' + k, JSON.stringify(v)); } catch (e) {} }
};
let toastT = 0;
// ui copy is lowercase (RULES.md); unit symbols keep their case
const uiText = s => String(s).toLowerCase().replace(/\bhz\b/g, 'Hz');
const uiHtml = h => h.replace(/>([^<>]*)</g, (m, t) => '>' + uiText(t) + '<').replace(/\btitle="([^"]*)"/g, (m, v) => 'title="' + uiText(v) + '"');
function toast(msg) { if (typeof logEvent === 'function') logEvent('note', msg); const t = $('toast'); t.textContent = uiText(msg); t.classList.add('is-on'); toastT = 3.2; }
