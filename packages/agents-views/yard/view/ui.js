// ---------- page shell: the seven tabs, temperament chips, seeds ----------
// View only. Tabs follow the aria tabs pattern: arrow keys, Home and End move between them.
const TABS = [...ENV.qsa('#tabs [role=tab]')];
function showTab(id, focus) {
  for (const t of TABS) { const on = t.dataset.p === id; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; if (on && focus) t.focus(); }
  ENV.qsa('.pane').forEach(p => p.classList.toggle('on', p.id === id));
  $('panes').scrollTop = 0;
  if (id === 'pBrain' || id === 'pHuman') { mindsT = 0; if (dog.ready) drawInstruments(); }
  if (id === 'pTrain' && dog.ready) renderHeat();
  store.set('tab', id);
}
TABS.forEach((t, i) => {
  t.onclick = () => showTab(t.dataset.p);
  t.addEventListener('keydown', e => {
    const k = e.key, n = TABS.length; let j = null;
    if (k === 'ArrowRight' || k === 'ArrowDown') j = (i + 1) % n; else if (k === 'ArrowLeft' || k === 'ArrowUp') j = (i - 1 + n) % n; else if (k === 'Home') j = 0; else if (k === 'End') j = n - 1;
    if (j != null) { e.preventDefault(); showTab(TABS[j].dataset.p, true); }
  });
});
ENV.docOn('click', e => { const g = e.target.closest('[data-go]'); if (g) showTab(g.dataset.go, true); });
$('tempo').addEventListener('input', () => { $('tempoV').textContent = $('tempo').value + 'x'; });
function nameUI() {}
// ---------- load rows: each model loads from a light button beside what it powers ----------
$('vlmSel').value = vlm.kind === 'gemma' ? 'gemma' : 'lfm';
function vlmSelUI() {
  const g = $('vlmSel').value === 'gemma';
  $('bVlmLoad').textContent = wStored[$('vlmSel').value] ? 'Load, stored here' : g ? 'Load, about 3.3 GB' : 'Load, about 320 MB';
  $('vlmLic').textContent = g ? 'weights apache 2.0, commercial use allowed. onnx-community on hugging face, pinned to one commit.' : 'weights lfm open license 1.0, commercial use limited. onnx-community on hugging face, pinned to one commit.';
}
$('vlmSel').onchange = () => { vlmPick($('vlmSel').value); vlmSelUI(); };
$('bVlmLoad').onclick = () => { audio(); vlmPick($('vlmSel').value); vlmLoad(); };
vlmSelUI();
function nnBtnUI() { const st = CAPS.find(c => c.id === 'gait').state(); $('bNnLoad').hidden = st === 'on' || st === 'loading'; $('bNnLoad').textContent = NG.ready ? 'Turn on the neural gait' : st === 'failed' ? 'Try again, 17.7 MB' : 'Load neural gait, 17.7 MB'; }
$('bNnLoad').onclick = () => { audio(); const c = CAPS.find(x => x.id === 'gait'); c.run(c.state()); nnBtnUI(); capsRefresh(); };
function voiceBtnUI() { $('bVoiceLoad').hidden = voiceLoad.state === 'on' || voiceLoad.state === 'loading'; $('bVoiceLoad').textContent = voiceLoad.state === 'failed' ? 'Try again' : 'Load his voice'; }
$('bVoiceLoad').onclick = () => { loadVoice(); voiceBtnUI(); };
// ---------- seeds ----------
{
  const h = new URLSearchParams(ENV.params);
  if (SEEDED) { $('seedIn').value = SEEDED.seed; $('speedIn').value = String(SEEDED.speed); $('seedNow').textContent = 'this page runs seed ' + SEEDED.seed + ' at ' + SEEDED.speed + 'x.'; }
  else $('seedNow').textContent = 'this page runs a random seed.';
  $('seedNn').checked = (h.get('on') || '').includes('L.neural');
  $('bSeedGo').onclick = () => { const s = Math.max(1, Math.round(+$('seedIn').value || 1)); ENV.reseed('seed=' + s + '&speed=' + $('speedIn').value + ($('seedNn').checked ? '&on=L.neural' : '')); };
  // a host that keeps its own hash (a router) passes no reseed: the seed row only reads
  if (!ENV.canReseed) $('bSeedGo').hidden = true;
}
// ---------- start: after the yard is up, outside lockstep. No card on entry: the yard first. ----------
function uiStart() {
  window.__capsLive = true; capsRefresh(); gaitUI(); knownUI(); renderHeat();
  if (matchMedia('(pointer:coarse)').matches) $('hint').textContent = 'tap the dog to pet it. tap the ground to point. two fingers move the camera.';
  const tab = store.get('tab', 'pBrain'); if (tab !== 'pBrain' && $(tab) && $(tab).classList.contains('pane')) showTab(tab);
  setTimeout(() => { $('hint').hidden = true; }, 12000);
  // the setup panel on a first visit; the setup button in the bar opens it again
  if (ENV.setup && !SEEDED && !TEST && !store.get('setup', 0)) setupOpen();
}
