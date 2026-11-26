// ---------- kit parts: event log, memory panel, in place confirms, yard menu, drive pad, links ----------
// Behaviour comes from the hackbuild-ui vanilla entry (HBV) over its class blocks; this file only
// wires the dog's state to it. View only: nothing here runs inside a sim step.

// events: toasts, loads and failures on one timeline. Created on first use, so a toast at boot logs too.
const EV_KINDS = { note: { tag: 'note', tone: 'dim' }, load: { tag: 'load', tone: 'load' }, warn: { tag: 'warn', tone: 'warn' }, fail: { tag: 'fail', tone: 'err' } };
function evlogH() {
  if (!logEvent.h) logEvent.h = HBV.eventLog($('evlog'), { max: 120, kinds: EV_KINDS });
  return logEvent.h;
}
function evlogCount() { const n = $('evlogRows').querySelectorAll('.hb-evlog-row:not(.is-live)').length; $('evlogN').textContent = String(n); $('evlogEmpty').hidden = n > 0 || !!$('evlogRows').querySelector('.hb-evlog-row'); }
function logEvent(kind, text) { evlogH().push(kind, uiText(text), clockText()); evlogCount(); }
function logLive(key, text, fraction) { evlogH().live(key, text == null ? null : uiText(text), fraction); evlogCount(); }
const clockText = () => typeof CLOCK === 'object' ? String(Math.floor(CLOCK.h)).padStart(2, '0') + ':' + String(Math.floor(CLOCK.h % 1 * 60)).padStart(2, '0') : '';

// links into the suite: hidden unless the build names it (SUITE_URL, set at publish)
if (SUITE_URL) {
  ENV.qsa('[data-suite]').forEach(a => { a.href = SUITE_URL.replace(/\/?$/, '/') + a.dataset.suite; });
  ENV.qsa('[data-suite-only]').forEach(e => { e.hidden = false; });
}

// forget every word: the first press arms, keep backs out, the second press forgets
HBV.confirmInline($('bReset'), {
  label: 'forget every word?', keep: $('bResetKeep'),
  onConfirm() { brain.seed(); store.set('W', brain.W); renderCueButtons(); renderHeat(); toast('every word forgotten'); }
});

// memory panel over brain.mem: counts, search, add, the ranked list with forget, export, erase
const memUi = { sig: '', armed: 0, handles: [] };
function memEntries() {
  const vis = Object.values(percepts).filter(p => p.vis).map(p => p.id.replace(/\d+$/, ''));
  const sc = new Map(memRank(vis).map(x => [x.m, x.s])), used = new Set(brain.lastRecall ? brain.lastRecall.items.map(x => x.m) : []);
  return brain.mem.map((m, i) => ({ id: String(i), text: m.txt, kind: 'memory', score: sc.get(m), when: Math.round(now - m.t) + ' s ago, importance ' + m.imp.toFixed(1), used: used.has(m), m }));
}
function memRender(force) {
  const q = $('memSearch').value.trim(), head = brain.mem[0];
  const sig = brain.mem.length + '|' + (head ? head.t : '') + '|' + q + '|' + (brain.lastRecall ? brain.lastRecall.t : '');
  if (!force && (sig === memUi.sig || memUi.armed)) return;
  memUi.sig = sig;
  memUi.handles.forEach(h => h.dispose()); memUi.handles = [];
  const all = memEntries();
  let shown = q ? HBV.memoryMatch(all, { query: q }).filter(e => e.score > 0) : all.slice().sort((a, b) => b.score - a.score);
  shown = shown.slice(0, 40);
  $('memCounts').textContent = HBV.memoryCounts(all, ['memory']);
  $('memListH').textContent = (q ? 'matches' : 'memories') + ' (' + shown.length + ')';
  $('memEmpty').hidden = shown.length > 0;
  $('memEmpty').textContent = q ? 'nothing matches. try other words.' : 'nothing remembered yet. play with the dog and it fills.';
  const list = $('memList');
  list.innerHTML = shown.map(e => `<div class="hb-mem${e.used ? ' is-used' : ''}"><div class="hb-mem-body"><span class="hb-mem-kind">${esc(e.kind)}<b class="hb-mem-score">${esc(HBV.scoreText(e.score))}</b></span><span class="hb-mem-text">${esc(e.text)}</span><span class="hb-mem-when">${esc([e.used ? 'used in the last thought' : '', e.when].filter(Boolean).join(', '))}</span></div><div class="hb-mem-acts"><button type="button" class="hb-mem-act is-forget" data-mem="${e.id}" aria-label="forget: ${esc(e.text)}">forget</button></div></div>`).join('');
  list.querySelectorAll('[data-mem]').forEach(b => {
    const m = all[+b.dataset.mem].m;
    memUi.handles.push(HBV.confirmInline(b, {
      label: 'forget?',
      onArm(on) { b.classList.toggle('is-armed', on); memUi.armed += on ? 1 : -1; },
      onConfirm() { const i = brain.mem.indexOf(m); if (i >= 0) brain.mem.splice(i, 1); memUi.armed = 0; logEvent('note', 'forgot: ' + m.txt); memRender(true); }
    }));
  });
}
$('memSearch').addEventListener('input', () => memRender(true));
$('memNote').addEventListener('input', e => { $('memAdd').disabled = !e.target.value.trim(); });
$('memNote').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('memAdd').click(); } });
$('memAdd').onclick = () => {
  const t = $('memNote').value.trim().slice(0, 120); if (!t) return;
  brain.remember(t, 3); $('memNote').value = ''; $('memAdd').disabled = true; logEvent('note', 'you added a memory: ' + t); memRender(true);
};
$('memExport').onclick = () => {
  const data = { kind: 'hackle-memory', version: 1, dog: dogName(), memories: brain.mem.map(m => ({ text: m.txt, importance: m.imp, gameHour: m.h })) };
  HBV.saveFile(HBV.withExt(HBV.exportName(['hackle', 'memory', dogName()]), 'json'), JSON.stringify(data, null, 2), 'application/json');
  logEvent('note', 'exported ' + brain.mem.length + ' memories');
};
HBV.confirmInline($('memWipe'), {
  label: 'erase everything?',
  onArm(on) { $('memWipe').classList.toggle('is-armed', on); },
  onConfirm() { brain.mem.length = 0; brain.lastRecall = null; toast('memory erased'); memRender(true); }
});

// yard menu: right click, a long press or the menu key on the yard. A right drag moves the camera,
// so a menu opened by the button closes again once the pointer travels.
const yardMenu = HBV.ctxPanel($('yardMenu'), {
  onPick(item) {
    audio(); const a = item.dataset.act, p = yardMenu.at;
    if (a === 'pet') pet(); else if (a === 'good') $('bGood').click(); else if (a === 'no') $('bNo').click();
    else if (a === 'why') showTab('pBrain', true); else if (a === 'point' && p) pointAt(p); else if (a === 'throw') throwBall(p ? p.clone() : undefined);
    else if (a === 'treat') $('bTreat').click(); else if (a === 'call') $('bCall').click();
  }
});
const YARD_ITEMS = {
  dog: [['pet', 'pet the dog'], ['good', 'good dog'], ['no', 'no'], ['why', 'see why it does that']],
  ground: [['point', 'point here'], ['throw', 'throw the ball here'], ['treat', 'toss a treat'], ['call', 'call the dog']]
};
let yardDown = null;
HBV.contextTrigger($('stage'), {
  onOpen(at, via, target) {
    if (target.closest && target.closest('#tool, .hb-ov-pad, #eyecard, .hb-ctx')) return;
    const r = $('stage').getBoundingClientRect(), hit = yardAt(r.left + at.x, r.top + at.y);
    const kind = hit && hit.dog ? 'dog' : 'ground';
    yardMenu.at = hit && hit.p ? hit.p : null;
    $('yardMenuT').textContent = kind === 'dog' ? dogName().toLowerCase() : 'this spot';
    $('yardMenu').querySelectorAll('.hb-menu-item').forEach(b => b.remove());
    $('yardMenu').insertAdjacentHTML('beforeend', YARD_ITEMS[kind].map(([k, t]) => `<button type="button" class="hb-menu-item" role="menuitem" tabindex="-1" data-act="${k}"${(k === 'point' || k === 'throw') && !yardMenu.at ? ' disabled' : ''}>${esc(t)}</button>`).join(''));
    yardDown = via === 'mouse' ? { x: r.left + at.x, y: r.top + at.y } : null;
    yardMenu.show(at, { w: r.width, h: r.height }, $('stage'));
  }
});
$('stage').addEventListener('pointermove', e => { if (yardDown && (e.buttons & 2) && Math.hypot(e.clientX - yardDown.x, e.clientY - yardDown.y) > 10) { yardDown = null; yardMenu.close(false); } });

// drive pad: shown while manual drive is on; on a fine pointer the kit keeps it hidden and the keys drive
const padState = { run: false };
HBV.pad($('pad'), {
  onMove(v) { manualKeys.w = v.y < -0.3; manualKeys.s = v.y > 0.5; manualKeys.a = v.x < -0.3; manualKeys.d = v.x > 0.3; manualKeys.shift = padState.run; }
});
$('padRun').onclick = () => { padState.run = !padState.run; manualKeys.shift = padState.run; $('padRun').setAttribute('aria-pressed', String(padState.run)); };
$('manual').addEventListener('change', e => { $('padRow').hidden = !e.target.checked; if (!e.target.checked) { padState.run = false; $('padRun').setAttribute('aria-pressed', 'false'); } });
