// ---------- capabilities: one registry for every optional feature ----------
// Each row: what it is, what it needs, the download with the word for where the number came
// from, the licence, its state, the reason when this device cannot run it, and one action. The
// panel (turn on more, opened from tune), its count and every inline mention read their state from here,
// so a toggle in a tab and the row in the panel never disagree. View only: nothing here runs
// inside a sim step.
const isPhone = () => matchMedia('(max-width:640px), (pointer:coarse) and (max-width:900px)').matches;
const hasMic = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
const cortexRow = kind => ({
  id: 'cortex-' + kind, icon: 'brain',
  name: kind === 'lfm' ? 'dog cortex, small (lfm2-vl 450m)' : 'dog cortex, large (gemma 4 e2b)',
  what: 'a vision language model looks through the dog eye, reads its drives and memories, and sets a goal. nothing leaves the browser; the weights download once and stay cached.',
  needs: () => [['webgpu', !!navigator.gpu], [wStored[kind] ? 'stored in this browser, shared with the other hack.build pages' : kind === 'lfm' ? 'about 320 MB (vendor)' : 'about 3.3 GB (vendor)', true]],
  licence: kind === 'lfm' ? ['weights', 'LFM Open License 1.0', 'commercial use limited, read it first.', true] : ['weights', 'Apache-2.0', 'commercial use allowed.', false],
  state() {
    if (!navigator.gpu) return 'unavailable';
    if (vlm.kind !== kind) return 'off';
    return vlm.state === 'ready' ? 'on' : vlm.state === 'loading' ? 'loading' : vlm.state === 'failed' ? 'failed' : 'off';
  },
  why() {
    if (!navigator.gpu) return 'no webgpu adapter. the cortex needs it.';
    if (vlm.kind === kind && vlm.state === 'failed') return 'the download failed: ' + vlm.err;
    if (vlm.kind !== kind && (vlm.state === 'ready' || vlm.state === 'loading')) return 'the other cortex is ' + (vlm.state === 'ready' ? 'on' : 'loading') + '. this one replaces it.';
    return '';
  },
  ask: () => isPhone() && kind === 'gemma' ? 'this model needs about 3.3 GB. phones usually cannot hold it; the small one fits.' : '',
  action(st) { return st === 'on' ? null : st === 'loading' ? null : st === 'failed' ? 'try again' : wStored[kind] ? 'turn on' : 'download and turn on'; },
  run() { vlmPick(kind); vlmLoad(); },
  progress() { return vlm.kind === kind && vlm.state === 'loading' && vlm.progress ? vlm.progress : null; }
});
const CAPS = [
  { id: 'renderer', icon: 'eye', name: 'webgpu renderer',
    what: 'draws the yard and the dog eye. without webgpu it falls back to webgl2 and the yard still runs.',
    needs: () => [['webgpu, else webgl2', true]], licence: ['renderer', 'three.js MIT', 'commercial use allowed.', false],
    state: () => renderer.backend && renderer.backend.isWebGPUBackend ? 'on' : 'unavailable',
    why: () => renderer.backend && !renderer.backend.isWebGPUBackend ? 'no webgpu adapter. the yard draws on webgl2 instead.' : '', action: () => null, fixed: true },
  { id: 'gait', icon: 'paw', name: 'neural gait',
    what: 'a codebook network trained on dog motion capture drives the legs in place of the pattern generator. compare the two in body.',
    needs: () => [['webgpu worker, else cpu', true], ['17.7 MB (vendor)', true]],
    licence: ['model and mocap', 'CC-BY-NC-4.0', 'no commercial use.', true],
    state: () => nnLoad.state === 'loading' || (NG.loading && !NG.ready && !NG.err) ? 'loading' : NG.err ? 'failed' : NG.ready && ON('L.neural') ? 'on' : 'off',
    why: () => NG.err ? 'the neural gait did not load: ' + NG.err.toLowerCase() : NG.ready && !ON('L.neural') ? 'loaded, the pattern generator drives the legs now.' : '',
    action: st => st === 'on' ? 'turn off' : st === 'loading' ? null : st === 'failed' ? 'try again' : NG.ready ? 'turn on' : 'load and turn on',
    run(st) { if (st === 'on') { TUNE.v['L.neural'] = 0; } else { TUNE.v['L.neural'] = 1; if (!NG.ready) { NG.err = ''; nnLoadUI(); } } tuneSave(); tuneUI.refresh(); gaitUI(); },
    progress() { const m = /(\d+) percent/.exec(NG.state || ''); return nnLoad.state === 'loading' || NG.loading && !NG.ready ? { pct: m ? +m[1] : null, total: 17.7e6 } : null; } },
  { id: 'yolo', icon: 'eye', name: 'object detector on the eye (yolov8n)',
    what: 'labels what the dog eye sees: a ball, a person, a cat. photos you show it are labelled with it too.',
    needs: () => [['webgpu, else wasm', true], ['12.8 MB (vendor)', true]],
    licence: ['weights', 'AGPL-3.0', 'copyleft: share your source if you ship it.', true],
    state: () => net.loading ? 'loading' : net.sess && $('netOn').checked ? 'on' : /failed/.test(net.label || '') ? 'failed' : 'off',
    why: () => /failed/.test(net.label || '') ? 'the detector did not load: ' + net.label.replace(/^failed: /, '') : '',
    action: st => st === 'on' ? 'turn off' : st === 'loading' ? null : st === 'failed' ? 'try again' : 'load and turn on',
    run(st) { if (st === 'on') { $('netOn').checked = false; boxCtx.clearRect(0, 0, EW, EH); setNet('detector off', 'yolo', false); } else { $('netOn').checked = true; loadNet(); } } },
  cortexRow('lfm'), cortexRow('gemma'),
  { id: 'autoThink', icon: 'brain', name: 'cortex thinks on its own', dependsOn: 'cortex',
    what: 'the cortex looks and thinks when enough happens, at most every 25 s, otherwise every 60 s.',
    needs: () => [['a cortex model', vlm.state === 'ready']], licence: null,
    state: () => !navigator.gpu ? 'unavailable' : $('autoThink').checked && vlm.state === 'ready' ? 'on' : 'off',
    why: () => !navigator.gpu ? 'no webgpu adapter. it needs the cortex, which needs webgpu.' : '',
    dep: () => vlm.state === 'ready' ? '' : 'needs a dog cortex. the button downloads the small one (about 320 MB, vendor) and turns this on.',
    action: st => st === 'on' ? 'turn off' : vlm.state === 'ready' ? 'turn on' : vlm.state === 'loading' ? null : 'download the small one and turn on',
    run(st) { if (st === 'on') { $('autoThink').checked = false; return; } capsWant.autoThink = true; if (vlm.state === 'ready') $('autoThink').checked = true; else { vlmPick('lfm'); vlmLoad(); } } },
  { id: 'humMind', icon: 'brain', name: 'his mind', dependsOn: 'cortex',
    what: 'the same cortex model picks what moheeb does and says, at most every 25 s.',
    needs: () => [['a cortex model', vlm.state === 'ready']], licence: null,
    state: () => !navigator.gpu ? 'unavailable' : $('humMindOn').checked && vlm.state === 'ready' ? 'on' : 'off',
    why: () => !navigator.gpu ? 'no webgpu adapter. his mind needs the cortex, which needs webgpu.' : '',
    dep: () => vlm.state === 'ready' ? '' : 'needs a dog cortex. the button downloads the small one (about 320 MB, vendor) and turns this on.',
    action: st => st === 'on' ? 'turn off' : vlm.state === 'ready' ? 'turn on' : vlm.state === 'loading' ? null : 'download the small one and turn on',
    run(st) { if (st === 'on') { $('humMindOn').checked = false; return; } capsWant.humMind = true; if (vlm.state === 'ready') $('humMindOn').checked = true; else { vlmPick('lfm'); vlmLoad(); } } },
  { id: 'voice', icon: 'voice', name: 'his voice (pocket tts)',
    what: () => voiceClip() ? 'moheeb speaks in his cloned voice instead of the browser voice.' : 'moheeb speaks with a text to speech model instead of the browser voice. this build has no voice clip, so it is a stock voice.',
    needs: () => [['about 203 MB (computed from the pinned file list, without the onnx runtime)', true]],
    licence: ['engine Apache-2.0, models', 'CC-BY-NC-4.0', 'no commercial use.', true],
    state: () => voiceLoad.state === 'on' ? 'on' : voiceLoad.state === 'loading' ? 'loading' : voiceLoad.state === 'failed' ? 'failed' : 'off',
    why: () => voiceLoad.err, action: st => st === 'on' || st === 'loading' ? null : st === 'failed' ? 'try again' : 'load', run: () => loadVoice() },
  { id: 'talk', icon: 'mic', name: 'talk to the dog',
    what: 'say a cue out loud: sit, spin, or a new word.',
    needs: () => [['microphone', hasMic()], ['speech recognition', SR_OK]],
    ask: () => 'in chrome your voice goes to the browser\'s speech service to become text. nothing else leaves the page.',
    state: () => !SR_OK ? 'unavailable' : micOn ? 'on' : micErr ? 'failed' : 'off',
    why: () => !SR_OK ? 'this browser has no speech recognition. tap or type a cue in train.' : micErr,
    action: st => st === 'on' ? 'stop listening' : st === 'failed' ? 'try again' : 'allow the microphone', run: () => $('bMic').click() },
  { id: 'webcam', icon: 'cam', name: 'webcam gestures and smiles',
    what: 'thumbs up praises the dog, thumbs down scolds it, a smile cheers it up. other hand signs become cues it can learn.',
    needs: () => [['camera', hasMic()], ['27.3 MB (vendor), two models and a runtime', true]],
    ask: () => 'the camera turns on, and two gesture and face models download from google (apache 2.0). the microphone is not used.',
    licence: ['models', 'Apache-2.0', 'commercial use allowed.', false],
    state: () => !hasMic() ? 'unavailable' : camState.on ? 'on' : camState.err ? 'failed' : 'off',
    why: () => !hasMic() ? 'this page cannot reach a camera here. open it over https or localhost.' : camState.err || '',
    action: st => st === 'on' ? 'turn off' : st === 'failed' ? 'try again' : 'allow the camera', run: () => $('bWebcam').click() },
  { id: 'clap', icon: 'mic', name: 'clap detection',
    what: 'a loud clap reaches the dog as a sound from where you stand.',
    needs: () => [['microphone', hasMic()]],
    ask: () => 'the microphone level is read in the page; no audio is kept or sent.',
    state: () => !hasMic() ? 'unavailable' : micAn ? 'on' : clapErr ? 'failed' : 'off',
    why: () => !hasMic() ? 'this page cannot reach a microphone here. open it over https or localhost.' : clapErr,
    action: st => st === 'on' ? 'turn off' : st === 'failed' ? 'try again' : 'allow the microphone', run: () => $('bClap').click() },
  { id: 'sound', icon: 'voice', name: 'sound',
    what: 'barks, footsteps, the ball and his voice.', needs: () => [], licence: null,
    state: () => $('sound').checked ? 'on' : 'off', why: () => '',
    action: st => st === 'on' ? 'turn off' : 'turn on', run(st) { $('sound').checked = st !== 'on'; } }
];
const capsWant = { autoThink: false, humMind: false };
// the setup panel's view of the same rows: its group, a short label, the download in bytes with
// the word for where the number came from (null when unknown) and the permission it asks for
const CAP_META = {
  yolo: { group: 'see', short: 'detector', bytes: 12.8e6, src: 'vendor' },
  gait: { group: 'move', short: 'gait', bytes: 17.7e6, src: 'vendor' },
  'cortex-lfm': { group: 'think', short: 'cortex', bytes: 320e6, about: true, src: 'vendor' }, 'cortex-gemma': { group: 'think', short: 'cortex', bytes: 3.3e9, about: true, src: 'vendor' },
  autoThink: { group: 'think', short: 'thinks' }, humMind: { group: 'think', short: 'his mind' },
  // computed from the pinned space's file list: the english model set it loads plus the engine
  // code, 203 MB; the onnx runtime it fetches from a cdn is not counted
  voice: { group: 'voice', short: 'voice', bytes: 203e6, about: true, src: 'computed, without the onnx runtime' }, sound: { group: 'voice', short: 'sound' },
  talk: { group: 'your input', short: 'talk', perm: 'the microphone' }, webcam: { group: 'your input', short: 'webcam', bytes: 27.3e6, src: 'vendor', perm: 'the camera' }, clap: { group: 'your input', short: 'clap', perm: 'the microphone' }
};
const CAP_ICON = { eye: 'M1 8c2-4 5-6 7-6s5 2 7 6c-2 4-5 6-7 6S3 12 1 8zm7 3a3 3 0 100-6 3 3 0 000 6z', paw: 'M5 3a1.5 2 0 103 0 1.5 2 0 10-3 0M9 4a1.5 2 0 103 0 1.5 2 0 10-3 0M3 7a1.4 1.8 0 103 0 1.4 1.8 0 10-3 0M11 8a1.4 1.8 0 103 0 1.4 1.8 0 10-3 0M5 11c1-2 5-2 6 0 1 2-1 3-3 3s-4-1-3-3z', brain: 'M5 2a3 3 0 00-3 3v1a3 3 0 000 5v1a3 3 0 006 1V3a2 2 0 00-3-1zm6 0a3 3 0 013 3v1a3 3 0 010 5v1a3 3 0 01-6 1V3a2 2 0 013-1z', voice: 'M2 6h3l4-3v10l-4-3H2zM11 5c1 1 1 5 0 6M13 3c2 2 2 8 0 10', mic: 'M6 1h4v9H6zM3 8a5 5 0 0010 0M8 13v2', cam: 'M1 5h4l1-2h4l1 2h4v8H1zm7 6a2.4 2.4 0 100-4.8A2.4 2.4 0 008 11z' };
const capIcon = k => `<svg class="hb-icon" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="${CAP_ICON[k] || ''}" fill="${k === 'voice' || k === 'mic' ? 'none' : 'currentColor'}" stroke="${k === 'voice' || k === 'mic' ? 'currentColor' : 'none'}" stroke-width="1.6"/></svg>`;
const VERDICT = { on: ['on', 'is-pass'], off: ['off', 'is-skip'], loading: ['loading', 'is-run'], failed: ['failed', 'is-fail'], unavailable: ['cannot run here', 'is-warn'] };
const ev = (f, ...a) => typeof f === 'function' ? f(...a) : f;
function capsCount() { const rows = CAPS.filter(c => !c.fixed), on = rows.filter(c => c.state() === 'on').length; return [on, rows.length]; }
let capsT = 0, capsPend = 0;
// light = a progress tick: redraw at most 4 times a second
function capsRefresh(light) {
  if (!window.__capsLive) return;
  if (light) { const t = performance.now(); if (t - capsT < 250) { if (!capsPend) capsPend = setTimeout(() => { capsPend = 0; capsRefresh(); }, 260); return; } }
  capsT = performance.now();
  // a dependent row waits for the model, then turns itself on
  if (vlm.state === 'ready') { if (capsWant.autoThink) { capsWant.autoThink = false; $('autoThink').checked = true; } if (capsWant.humMind) { capsWant.humMind = false; $('humMindOn').checked = true; } }
  const [on, n] = capsCount(); $('capsCount').textContent = on + ' of ' + n + ' on';
  hudTags(); if (typeof nnBtnUI === 'function') { nnBtnUI(); voiceBtnUI(); }
  if ($('caps').hidden) return;
  const body = $('capsBody'), focusId = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.cap : null;
  let running = false;
  body.innerHTML = `<div class="hb-caps${''}"><p class="hb-caps-sum" style="flex-wrap:wrap"><span style="white-space:nowrap">${on} of ${n} on</span> <small>sizes vendor, computed where measured</small></p><ul class="hb-caps-list" aria-label="what you can turn on">` + CAPS.map(c => {
    const st = c.state(), [vw, vc] = VERDICT[st], why = c.why ? c.why() : '', dep = c.dep ? c.dep() : '', ask = c.ask ? c.ask() : '', act = c.action(st), prog = c.progress ? c.progress() : null, rid = 'cap-why-' + c.id;
    let pg = '';
    if (st === 'loading' && prog) {
      const pct = prog.pct != null ? prog.pct : prog.total ? Math.round(prog.loaded / prog.total * 100) : null, quiet = running; running = true;
      const words = prog.pct != null ? pct + ' percent of ' + (prog.total / 1e6).toFixed(1) + ' MB' : prog.total ? pct + ' percent, ' + (prog.loaded / 1e6).toFixed(0) + ' of ' + (prog.total / 1e6).toFixed(0) + ' MB' : 'starting, total unknown';
      pg = `<div class="hb-progress${pct == null ? ' is-busy' : ''}${quiet ? ' is-quiet' : ''}"><div class="hb-progress-hd"><span class="hb-progress-text">${esc(words)}</span><span class="hb-progress-pct">${pct == null ? '' : pct + '%'}</span></div><div class="hb-meter" role="progressbar" aria-label="${esc(c.name)}" aria-valuemin="0" aria-valuemax="100"${pct == null ? '' : ` aria-valuenow="${pct}" aria-valuetext="${esc(words)}"`}><i style="width:${pct == null ? 30 : pct}%"></i></div></div>`;
    }
    const L = c.licence;
    return `<li class="hb-cap is-${st === 'unavailable' ? 'unavailable' : st}"><div class="hb-cap-hd">${capIcon(c.icon)}<span class="hb-cap-name">${esc(c.name)}</span><span class="hb-verdict ${vc}">${vw}${st === 'loading' && prog && prog.pct != null ? ' ' + prog.pct + ' percent' : ''}</span></div>` +
      (act ? `<button class="hb-btn hb-btn-sm hb-cap-act" type="button" data-cap="${c.id}"${st === 'unavailable' ? ` disabled aria-describedby="${rid}"` : why ? ` aria-describedby="${rid}"` : ''}>${esc(act)}</button>` : '') +
      `<p class="hb-cap-ask">${esc(ev(c.what))}</p>` +
      (c.needs().length ? `<ul class="hb-cap-needs">${c.needs().map(([t, ok]) => `<li class="hb-cap-need${ok ? '' : ' is-missing'}">${ok ? '' : '<span class="hb-sr">missing: </span>'}${esc(t)}</li>`).join('')}</ul>` : '') +
      (ask ? `<p class="hb-cap-ask">${esc(ask)}</p>` : '') + (dep ? `<p class="hb-cap-dep">${esc(dep)}</p>` : '') + (why ? `<p class="hb-cap-why" id="${rid}">${esc(why)}</p>` : '') + pg +
      (L ? `<div class="hb-licence${L[3] ? ' is-nc' : ''}">${esc(L[0])} <b>${esc(L[1])}</b>, ${esc(L[2])}</div>` : '') + '</li>';
  }).join('') + '</ul></div>';
  if (focusId) { const b = body.querySelector(`[data-cap="${focusId}"]`); if (b) b.focus(); }
}
$('capsBody').addEventListener('click', e => { const b = e.target.closest('button[data-cap]'); if (!b) return; const c = CAPS.find(x => x.id === b.dataset.cap); if (!c) return; audio(); c.run(c.state()); announce(c.name + ': ' + c.state(), 3000); capsRefresh(); setTimeout(capsRefresh, 400); });
let capsReturn = null;
function capsOpen(id) {
  capsReturn = document.activeElement; $('caps').hidden = false; capsRefresh(); wScan();
  const row = id ? $('capsBody').querySelector(`[data-cap="${id}"]`) : null;
  (row || $('capsClose')).focus(); if (row) row.closest('.hb-cap').scrollIntoView({ block: 'center' });
}
function capsClose() { $('caps').hidden = true; if (capsReturn && capsReturn.focus) capsReturn.focus(); }
$('capsClose').onclick = capsClose;
$('caps').addEventListener('click', e => { if (e.target === $('caps')) capsClose(); });
$('caps').addEventListener('keydown', e => {
  if (e.key === 'Escape') { capsClose(); return; }
  if (e.key !== 'Tab') return;
  const f = [...$('caps').querySelectorAll('button:not([disabled]),[href],input,select,[tabindex="0"]')]; if (!f.length) return;
  if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); } else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
});
ENV.docOn('click', e => { const b = e.target.closest('[data-caps]'); if (b) capsOpen(b.dataset.caps); });
$('autoThink').addEventListener('change', () => capsRefresh()); $('humMindOn').addEventListener('change', () => capsRefresh()); $('sound').addEventListener('change', () => capsRefresh());
$('netOn').addEventListener('change', () => capsRefresh());
