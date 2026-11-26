// ---------- setup panel: the first screen of a first visit, and the setup button after ----------
// One card over the live yard: the dog's name, three ways to start, and every optional row of the
// capability registry (caps.js, CAPS and CAP_META) on one line each. Start runs the same run() each
// row runs from the rack and the drawer; then the list becomes compact check rows with a bar per
// download, and the card closes only when every row is on. A failure stays on screen with its
// reason and a try again. View only: nothing here runs inside a sim step.
// #stubloads in the hash stands each run in with a scripted progress (shots and the setup smoke:
// no request, no permission prompt); #stubloads=fail makes the detector fail.
const SETUP = { started: null, timer: 0, ret: null, fake: {}, ticks: new Set(), hash: new URLSearchParams(ENV.params) };
SETUP.stub = SETUP.hash.has('stubloads');
const SETUP_GROUPS = ['see', 'move', 'think', 'voice', 'your input'];
// one cortex line in the list; the select on it picks the small or the large model
const SETUP_ITEMS = ['yolo', 'gait', 'cortex', 'autoThink', 'humMind', 'voice', 'sound', 'talk', 'webcam', 'clap'];
const SETUP_MODES = { play: [], eyes: ['gait', 'yolo'], think: ['gait', 'yolo', 'cortex', 'voice'] };
const setupCortexId = () => 'cortex-' + (SETUP.cortex || 'lfm');
const setupCapId = it => it === 'cortex' ? setupCortexId() : it;
const setupCap = it => CAPS.find(c => c.id === setupCapId(it));
const mb = b => b >= 1e9 ? (b / 1e9).toFixed(1) + ' GB' : b >= 1e8 ? Math.round(b / 1e6) + ' MB' : (Math.round(b / 1e5) / 10) + ' MB';
const setupSize = c => { const m = CAP_META[c.id]; return m.bytes == null ? '' : (m.about ? 'about ' : '') + mb(m.bytes); };
function setupState(c) { const f = SETUP.fake[c.id]; return f ? f.state : c.state(); }
const setupCan = it => setupState(setupCap(it)) !== 'unavailable';
function setupProg(c) {
  const f = SETUP.fake[c.id]; if (f) return f.state === 'loading' ? f.pct : null;
  const p = c.progress ? c.progress() : null; if (!p) return null;
  return p.pct != null ? p.pct : p.total ? Math.round(p.loaded / p.total * 100) : null;
}
// what a set of items costs here: only what can run here and is not on already
function setupBytes(items) {
  let b = 0, about = false;
  for (const it of items) { const c = setupCap(it), m = CAP_META[c.id]; if (!setupCan(it) || setupState(c) === 'on' || !m.bytes) continue; b += m.bytes; about = about || !!m.about; }
  return b ? (about ? 'about ' : '') + mb(b) : 'nothing to download';
}
const modeItems = m => SETUP_MODES[m].filter(setupCan);
function setupRenderModes() {
  const btns = [...ENV.qsa('#setupModes [data-mode]')];
  let any = false;
  for (const b of btns) {
    const m = b.dataset.mode, items = modeItems(m).filter(it => setupState(setupCap(it)) !== 'on');
    const on = items.length === SETUP.ticks.size && items.every(it => SETUP.ticks.has(it)) && (m !== 'play' || !SETUP.ticks.size);
    b.setAttribute('aria-checked', String(on)); any = any || on;
    b.querySelector('em').textContent = setupBytes(modeItems(m));
    const miss = SETUP_MODES[m].filter(it => !setupCan(it));
    b.querySelector('.badge').textContent = miss.includes('cortex') ? 'cortex cannot run here' : '';
  }
  // roving tabindex: the checked mode, else the first, is the one tab stop
  const cur = btns.find(b => b.getAttribute('aria-checked') === 'true') || btns[0];
  for (const b of btns) b.tabIndex = b === cur ? 0 : -1;
}
function setupLine(it) {
  const c = setupCap(it), st = setupState(c), m = CAP_META[c.id], L = c.licence, off = st === 'unavailable', on = st === 'on' || st === 'loading';
  const checked = SETUP.ticks.has(it) || on;
  const mark = L && L[3] ? `<span class="srow-mark">${/NC/.test(L[1]) ? 'non commercial' : /GPL/.test(L[1]) ? 'copyleft' : 'limited use'}</span>` : '';
  const what = typeof c.what === 'function' ? c.what() : c.what;
  const note = off ? c.why() : st === 'on' ? 'on' : st === 'loading' ? 'loading' : m.perm ? 'asks for ' + m.perm + ' on start. ' + what : what;
  const sel = it === 'cortex' ? ` <select class="srow-sel" id="setupCortex" aria-label="which cortex"${on || off ? ' disabled' : ''}><option value="lfm"${SETUP.cortex !== 'gemma' ? ' selected' : ''}>small, lfm2-vl 450m</option><option value="gemma"${SETUP.cortex === 'gemma' ? ' selected' : ''}>large, gemma 4 e2b</option></select>` : '';
  return `<li class="srow${off ? ' is-off' : ''}"><input type="checkbox" id="sx-${it}" data-item="${it}"${checked ? ' checked' : ''}${off || on ? ' disabled' : ''}><span class="srow-name"><label for="sx-${it}">${esc(it === 'cortex' ? 'dog cortex' : c.name)}</label>${sel}</span><span class="srow-size">${esc(setupSize(c))}</span>${mark || '<span></span>'}<p class="srow-note" title="${esc(note)}">${esc(note)}</p></li>`;
}
// the licences and the source of every size, in one fold under the list
function setupLicences() {
  const rows = SETUP_ITEMS.flatMap(it => it === 'cortex' ? ['cortex-lfm', 'cortex-gemma'].map(id => CAPS.find(c => c.id === id)) : [setupCap(it)]);
  return `<li class="slic"><details><summary>licences and sizes</summary><ul>${rows.map(c => { const L = c.licence, m = CAP_META[c.id]; return `<li><b>${esc(c.name)}</b>: ${L ? esc(L[0] + ' ' + L[1] + ', ' + L[2]) : 'no download'}${m.bytes ? ' ' + esc(setupSize(c)) + ' (' + esc(m.src) + ').' : ''}</li>`; }).join('')}</ul></details></li>`;
}
// once started: ferrule's check rows, one per download, all on screen at once
function setupChecks() {
  return SETUP.started.items.map(it => {
    const c = setupCap(it), st = setupState(c), pct = setupProg(c);
    const note = st === 'loading' ? (pct == null ? 'downloading' : pct + ' percent') : st === 'on' ? 'on' : st === 'failed' ? (c.why() || 'failed') : st === 'unavailable' ? c.why() : 'not on yet';
    const retry = st === 'failed' || (st === 'off' && SETUP.started.settled) ? `<button type="button" class="hb-btn chk-retry" data-retry="${it}">try again</button>` : '';
    return `<li class="chk is-${st}"><b>${esc(CAP_META[c.id].short)}</b><div class="bar2${st === 'on' ? ' ok' : st === 'failed' ? ' err' : ''}" aria-hidden="true"><i style="width:${st === 'on' ? 100 : pct || 0}%"></i></div><span class="chk-note">${esc(note)}</span>${retry}</li>`;
  }).join('');
}
function setupRender() {
  const list = $('setupList'), focusId = document.activeElement && document.activeElement.closest && document.activeElement.closest('#setupList') ? document.activeElement.id || document.activeElement.dataset.retry : null;
  const lic = list.querySelector('.slic details'), licOpen = !!(lic && lic.open);
  list.classList.toggle('is-checks', !!SETUP.started);
  list.innerHTML = SETUP.started ? setupChecks() : SETUP_GROUPS.map(g => {
    const items = SETUP_ITEMS.filter(it => CAP_META[setupCap(it).id].group === g);
    return `<li class="sgroup"><h3>${g}</h3><ul>${items.map(setupLine).join('')}</ul></li>`;
  }).join('') + setupLicences();
  if (licOpen) { const d = list.querySelector('.slic details'); if (d) d.open = true; }
  if (focusId) { const f = $(focusId) || list.querySelector(`[data-retry="${focusId}"]`); if (f) f.focus(); }
  $('setupGpu').hidden = !!navigator.gpu || !!SETUP.started;
  $('setupModes').hidden = !!SETUP.started;
  setupRenderModes();
  $('setupStart').textContent = SETUP.started ? 'start now, load in the background' : 'start, ' + setupBytes([...SETUP.ticks]);
  $('setupLook').hidden = !!SETUP.started;
}
function setupPick(mode) {
  if (SETUP.started) return;
  SETUP.ticks = new Set(modeItems(mode).filter(it => setupState(setupCap(it)) !== 'on'));
  setupRender();
}
$('setupModes').addEventListener('click', e => { const b = e.target.closest('[data-mode]'); if (b) { setupPick(b.dataset.mode); b.focus(); } });
$('setupModes').addEventListener('keydown', e => {
  const btns = [...ENV.qsa('#setupModes [data-mode]')], i = btns.indexOf(document.activeElement); if (i < 0) return;
  const k = e.key, n = btns.length, j = k === 'ArrowRight' || k === 'ArrowDown' ? (i + 1) % n : k === 'ArrowLeft' || k === 'ArrowUp' ? (i - 1 + n) % n : k === 'Home' ? 0 : k === 'End' ? n - 1 : null;
  if (j == null) { if (k === ' ' || k === 'Enter') { e.preventDefault(); setupPick(btns[i].dataset.mode); btns[i].focus(); } return; }
  e.preventDefault(); setupPick(btns[j].dataset.mode); btns[j].focus();
});
$('setupList').addEventListener('change', e => {
  if (e.target.id === 'setupCortex') { SETUP.cortex = e.target.value; setupRender(); return; }
  const i = e.target.closest('[data-item]'); if (!i) return;
  if (i.checked) SETUP.ticks.add(i.dataset.item); else SETUP.ticks.delete(i.dataset.item);
  setupRender();
});
$('setupList').addEventListener('click', e => {
  const b = e.target.closest('[data-retry]'); if (!b) return;
  const it = b.dataset.retry, c = setupCap(it);
  if (SETUP.stub) setupFake(c.id, false); else c.run(c.state());
  SETUP.started.t = performance.now(); SETUP.started.settled = false; setupWatch();
});
$('setupNameIn').addEventListener('input', e => { $('setupName').textContent = (e.target.value.trim() || 'the dog').toLowerCase(); });
// the scripted stand in for a download: a few seconds of progress, then on (or failed when asked)
function setupFake(id, fail) {
  const f = SETUP.fake[id] = { state: 'loading', pct: 0 }, step = 9 + (id.length % 5) * 3;
  const t = setInterval(() => { f.pct = Math.min(100, f.pct + step); if (fail && f.pct >= 40) { f.state = 'failed'; clearInterval(t); } else if (f.pct >= 100) { f.state = 'on'; clearInterval(t); } }, 200);
}
if (SETUP.stub) for (const it of ['yolo']) { const c = CAPS.find(x => x.id === it); const why = c.why; c.why = () => SETUP.fake[it] && SETUP.fake[it].state === 'failed' ? 'the detector did not load: stub failure' : why(); }
function setupWatch() {
  clearInterval(SETUP.timer);
  SETUP.timer = setInterval(() => {
    if ($('setup').hidden) { clearInterval(SETUP.timer); return; }
    const S = SETUP.started, sts = S.items.map(it => setupState(setupCap(it)));
    // settled: nothing loading and the permission rows had a moment to answer
    S.settled = !sts.includes('loading') && performance.now() - S.t > 1500;
    setupRender();
    if (sts.every(s => s === 'on')) { clearInterval(SETUP.timer); setTimeout(() => { if (SETUP.started && SETUP.started.items.every(it => setupState(setupCap(it)) === 'on')) setupClose(); }, 700); }
    else if (S.settled) clearInterval(SETUP.timer);
  }, 250);
}
function setupStart() {
  if (SETUP.started) { setupClose(); return; }
  audio(); setupName();
  const items = [...SETUP.ticks].filter(it => { const st = setupState(setupCap(it)); return st !== 'on' && st !== 'loading' && st !== 'unavailable'; });
  if (!items.length) { setupClose(); return; }
  SETUP.started = { t: performance.now(), items, settled: false };
  const cortex = items.includes('cortex'), fail = SETUP.hash.get('stubloads') === 'fail';
  if (cortex && !SETUP.stub) vlmPick(SETUP.cortex || 'lfm');
  for (const it of items) {
    const c = setupCap(it);
    if (SETUP.stub) { setupFake(c.id, fail && it === 'yolo'); continue; }
    if (c.dependsOn === 'cortex' && cortex) { capsWant[it] = true; continue; }
    c.run(c.state());
  }
  logEvent('note', 'setup started: ' + items.join(', '));
  setupRender(); capsRefresh(); setupWatch();
  $('setupStart').focus();
}
// the name typed here is the dog's name: a new name draws a new temperament, as in train
function setupName() {
  const v = $('setupNameIn').value.trim();
  if (v && v !== $('dogName').value) { $('dogName').value = v; $('dogName').dispatchEvent(new Event('change')); }
}
function setupOpen() {
  SETUP.ret = document.activeElement; if ($('setup').hidden) SETUP.started = null;
  SETUP.ticks = new Set(); SETUP.cortex = vlm.kind === 'gemma' ? 'gemma' : 'lfm';
  $('setupNameIn').value = $('dogName').value; $('setupName').textContent = ($('dogName').value.trim() || 'the dog').toLowerCase();
  $('setup').hidden = false; setupRender(); $('setupStart').focus();
}
function setupClose() {
  if ($('setup').hidden) return;
  if (!SETUP.started) setupName();
  $('setup').hidden = true; store.set('setup', 1); clearInterval(SETUP.timer);
  if (SETUP.ret && SETUP.ret.focus && SETUP.ret !== document.body) SETUP.ret.focus(); else stage.focus();
}
$('setupStart').onclick = setupStart;
$('setupLook').onclick = () => { SETUP.ticks.clear(); setupClose(); };
$('setupClose').onclick = () => setupClose();
$('bSetup').onclick = () => setupOpen();
$('setup').addEventListener('click', e => { if (e.target === $('setup')) setupClose(); });
$('setup').addEventListener('keydown', e => {
  if (e.key === 'Escape') { e.preventDefault(); setupClose(); return; }
  if (e.key !== 'Tab') return;
  const f = [...$('setup').querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),summary')].filter(x => x.offsetParent !== null && x.tabIndex >= 0);
  if (!f.length) return;
  if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); } else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
});
