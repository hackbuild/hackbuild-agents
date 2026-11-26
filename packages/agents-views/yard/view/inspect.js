// ---------- prompt inspector: what the cortex model saw and answered, with the cost beside it ----------
// The kit .hb-pinsp cards over vlm.last (io/cortex.js). Token counts say where they came from:
// measured is the tokenizer count the worker reports, computed is four characters a token.
// Redrawn only when a new call lands and the fold is open. View only.
const pinspCopy = HBV.copier();
pinspCopy.subscribe(st => { const b = $('pinspCopy'); b.classList.toggle('is-copied', st === 'copied'); b.classList.toggle('is-failed', st === 'failed'); b.textContent = st === 'copied' ? 'copied' : st === 'failed' ? 'copy refused' : 'copy'; });
let pinspSeen = null;
function pinspRaw(L) { return L.prompt + '\n\n>>> ' + (L.text || 'no reply yet'); }
function pinspUI() {
  const L = vlm.last;
  $('pinspN').textContent = vlm.calls ? vlm.calls + (vlm.calls === 1 ? ' call' : ' calls') : 'no calls';
  if (!L || L === pinspSeen || !$('pinspFold').open) return; pinspSeen = L;
  $('pinspWho').textContent = L.provider + ', ' + stamp(L.t);
  const rows = [['last prompt', L.inTokens + ' tokens, ' + L.inCount], ['last reply', L.ok ? L.outTokens + ' tokens, ' + L.outCount : 'failed'], ['reply time', L.ms != null ? HBV.msText(L.ms) + ', measured' : 'none'], ['model calls', String(vlm.calls)]];
  $('pinspKv').innerHTML = rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join(''); $('pinspKv').hidden = false; $('pinspKvEmpty').hidden = true;
  $('pinspToolsN').textContent = String(HBV.toolList($('pinspTools'), L.tools));
  const plan = $('pinspPlan'), pt = HBV.planText(L.plan); plan.textContent = pt || 'none in this call'; plan.classList.toggle('is-empty', !pt);
  const raw = $('pinspRaw'); raw.textContent = L.prompt; raw.classList.remove('is-empty'); raw.classList.add('is-raw'); raw.tabIndex = 0;
  const rep = document.createElement('span'); rep.className = 'hb-pinsp-reply'; rep.textContent = '>>> ' + (L.text || 'no reply yet'); raw.append(rep);
  $('pinspCopy').hidden = false;
}
$('pinspCopy').onclick = () => { if (vlm.last) pinspCopy.copy(pinspRaw(vlm.last)); };
$('pinspFold').addEventListener('toggle', () => { pinspSeen = null; pinspUI(); });
// #cortex=stub turns the stub on at boot, for demos, smokes and shots with no download
if (new URLSearchParams(ENV.params).get('cortex') === 'stub') { vlmPick('stub'); vlmLoad(); }
