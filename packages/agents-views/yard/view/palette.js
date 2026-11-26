// ---------- command palette: every action on the page by name ----------
// The kit palette (HBV.palette) over .hb-palette markup, opened by ctrl or cmd k, by / and by the
// header button. One table builds the rows, their keys and what they run, so a new verb lands in
// one place. A control the page has disabled stays listed, disabled, with the page's reason.
// View only: nothing here runs inside a sim step.
const palPress = id => () => { audio(); $(id).click(); };
const palFlip = id => () => { $(id).click(); toast($(id).closest('label').textContent.trim().split(':')[0] + (($(id).checked) ? ': on' : ': off')); };
const palGo = (tab, id) => () => { showTab(tab); let el = $(id); if (!el) return; const d = el.closest('details'); if (d) d.open = true; if (el.tagName === 'DETAILS') el = el.querySelector('summary'); el.scrollIntoView({ block: 'center' }); el.focus(); };
const palOff = id => () => $(id).disabled ? ($('cortexWhy').textContent || 'not available now') : '';
const palState = id => () => $(id).checked ? 'on' : 'off';
const PAL_COMMANDS = [
  ['play', [
    { k: 'throw', label: 'throw the ball', hint: 'he throws, the dog fetches', run: palPress('bThrow') },
    { k: 'treat', label: 'toss a treat', run: palPress('bTreat') },
    { k: 'good', label: 'good dog', hint: 'praise teaches what it just did', run: palPress('bGood') },
    { k: 'no', label: 'no', hint: 'a scolding', run: palPress('bNo') },
    { k: 'squirrel', label: 'send a squirrel', run: palPress('bSquirrel') },
    { k: 'fill', label: 'fill the bowl', run: palPress('bFill') },
    { k: 'pet', label: 'pet the dog yourself', hint: 'same as a tap on the dog', run: () => { audio(); pet(); } },
    { k: 'free', label: 'free the dog from a cue', hint: 'ends a stay', run: () => { audio(); brain.release(); } },
    { k: 'talk', label: 'talk to the dog', hint: 'the microphone', run: palPress('bMic') },
    { k: 'cue', label: 'type a cue', run: palGo('pTrain', 'cueIn') },
    { k: 'name', label: 'rename the dog', hint: 'a new name draws a new temperament', run: palGo('pTrain', 'dogName') },
  ]],
  ['moheeb', [
    { k: 'hcall', label: 'he calls the dog', run: palPress('bCall') },
    { k: 'hpet', label: 'he pets the dog', run: palPress('bPet') },
    { k: 'htrain', label: 'he trains a new word', run: palPress('bTrainNow') },
    { k: 'hday', label: 'he runs his own day', state: palState('humAI'), run: palFlip('humAI') },
    { k: 'hvoice', label: 'he speaks out loud', state: palState('humVoiceOn'), run: palFlip('humVoiceOn') },
  ]],
  ['go to', [
    { k: 'tbrain', label: 'brain', hint: 'tab: why it does what it does', run: () => showTab('pBrain', true) },
    { k: 'tbody', label: 'body', hint: 'tab', run: () => showTab('pBody', true) },
    { k: 'tsense', label: 'sense', hint: 'tab', run: () => showTab('pSense', true) },
    { k: 'ttrain', label: 'train', hint: 'tab: cues and associations', run: () => showTab('pTrain', true) },
    { k: 'thuman', label: 'human', hint: 'tab: moheeb', run: () => showTab('pHuman', true) },
    { k: 'ttune', label: 'tune', hint: 'tab: every number, seeds', run: () => showTab('pTune', true) },
    { k: 'thow', label: 'how', hint: 'tab: how it works, licences', run: () => showTab('pAbout', true) },
    { k: 'setup', label: 'setup', hint: 'ways to start, every model and permission', run: palPress('bSetup') },
    { k: 'caps', label: 'turn on more', hint: 'models, voice, detector', run: () => capsOpen() },
    { k: 'vlmload', label: 'load the cortex model', hint: 'the size shows on the button', run: () => { showTab('pBrain'); $('bVlmLoad').click(); } },
    { k: 'nnload', label: 'load the neural gait', hint: '17.7 mb, cc by-nc 4.0', run: palPress('bNnLoad') },
    { k: 'voiceload', label: 'load his voice', hint: 'pocket tts', run: palPress('bVoiceLoad') },
    { k: 'seed', label: 'reopen with a seed', run: palGo('pTune', 'seedIn') },
  ]],
  ['camera', [
    { k: 'cam', label: 'camera: next view', run: palPress('bCam') },
    { k: 'c0', label: 'camera: follow', kbd: 'f', run: () => setCamMode(0) },
    { k: 'c1', label: 'camera: free', hint: 'w a s d fly, q e lower and raise', run: () => setCamMode(1) },
    { k: 'c2', label: 'camera: dog eye', run: () => setCamMode(2) },
    { k: 'c3', label: 'camera: side', run: () => setCamMode(3) },
    { k: 'c4', label: 'camera: his eyes', run: () => setCamMode(4) },
    { k: 'eyefold', label: 'fold or show the eye view', run: palPress('eyeFold') },
    { k: 'eyedog', label: 'eye view: the dog', run: palPress('eyeWhoDog') },
    { k: 'eyehis', label: 'eye view: his eyes', run: palPress('eyeWhoHis') },
  ]],
  ['cortex', [
    { k: 'think', label: 'look and think', hint: 'one cortex call', off: palOff('bThink'), run: () => { showTab('pBrain'); $('bThink').click(); } },
    { k: 'ask', label: 'ask the dog a question', off: palOff('askIn'), run: palGo('pBrain', 'askIn') },
    { k: 'auto', label: 'cortex thinks on its own', off: palOff('autoThink'), state: palState('autoThink'), run: palFlip('autoThink') },
    { k: 'hmind', label: 'his mind picks what he does', off: () => $('humMindOn').disabled ? ($('humMindWhy').textContent || 'needs a cortex model') : '', state: palState('humMindOn'), run: palFlip('humMindOn') },
    { k: 'inspect', label: 'prompt inspector', hint: 'the last prompt, reply and token counts', run: palGo('pBrain', 'pinspFold') },
    { k: 'stub', label: 'use the stub cortex', hint: 'no download, replies written in code', off: () => vlm.kind === 'stub' && vlm.state === 'ready' ? 'the stub is on' : vlm.state === 'loading' ? 'a model is still downloading' : '', run: () => { vlmPick('stub'); vlmLoad(); } },
  ]],
  ['memory', [
    { k: 'memadd', label: 'add a memory', run: palGo('pBrain', 'memNote') },
    { k: 'memsearch', label: 'search memories', run: palGo('pBrain', 'memSearch') },
    { k: 'memexport', label: 'export memories', hint: 'a json file', run: palPress('memExport') },
    { k: 'memwipe', label: 'erase every memory', hint: 'asks first', run: palGo('pBrain', 'memWipe') },
    { k: 'reset', label: 'forget every word', hint: 'asks first', run: palGo('pTrain', 'bReset') },
  ]],
  ['senses and body', [
    { k: 'photo', label: 'show the dog a photo', run: palGo('pSense', 'photoIn') },
    { k: 'webcam', label: 'webcam gestures', run: palPress('bWebcam') },
    { k: 'clap', label: 'clap detection', run: palPress('bClap') },
    { k: 'det', label: 'object detector on the eye', state: palState('netOn'), run: palFlip('netOn') },
    { k: 'color', label: 'dichromat color', state: palState('dogColor'), run: palFlip('dogColor') },
    { k: 'sal', label: 'saliency on the eye', state: palState('showSal'), run: palFlip('showSal') },
    { k: 'puffs', label: 'scent puffs', state: palState('showPuffs'), run: palFlip('showPuffs') },
    { k: 'manual', label: 'manual drive', hint: 'w a s d or arrows, shift to run', state: palState('manual'), run: palFlip('manual') },
    { k: 'xray', label: 'x-ray', state: palState('xray'), run: palFlip('xray') },
    { k: 'prints', label: 'footprints', state: palState('prints'), run: palFlip('prints') },
    { k: 'ik', label: 'leg ik', state: palState('ikOn'), run: palFlip('ikOn') },
    { k: 'sound', label: 'sound', state: palState('sound'), run: palFlip('sound') },
    { k: 'tempo', label: 'tempo', run: palGo('pBrain', 'tempo') },
  ]],
];
const PAL_CMD = new Map(PAL_COMMANDS.flatMap(([, items]) => items.map(c => [c.k, c])));
const palKeys = HBV.hotkeys();
function paletteRows() {
  $('paletteList').innerHTML = PAL_COMMANDS.map(([g, items]) => `<div role="group" aria-label="${esc(g)}"><span class="hb-palette-head" aria-hidden="true">${esc(g)}</span>` + items.map(c => {
    const off = c.off ? c.off() : '', hint = off || [c.state ? c.state() : '', c.hint || ''].filter(Boolean).join(', ');
    const kbd = c.kbd ? `<span class="hb-palette-kbd">${palKeys.format(c.kbd).map(k => `<kbd class="hb-kbd">${esc(k)}</kbd>`).join('+')}</span>` : '';
    return `<button type="button" class="hb-palette-item" role="option" tabindex="-1" data-key="${c.k}" data-search="${esc(g + ' ' + c.label + ' ' + (c.hint || ''))}"${off ? ' disabled aria-disabled="true"' : ''}><span class="hb-palette-label">${esc(c.label)}</span>${hint ? `<span class="hb-palette-hint">${esc(hint)}</span>` : ''}${kbd}</button>`;
  }).join('') + '</div>').join('');
}
paletteRows();
const palH = HBV.palette($('palette'), {
  registry: palKeys, openKeys: ['ctrl+k', '/'],
  onOpen: paletteRows,
  onRun(k) { const c = PAL_CMD.get(k); if (c) c.run(); }
});
$('bPalette').append(HBV.strokeIconEl('search'));
$('bPalette').onclick = () => palH.open();
ENV.dispose(() => { palH.dispose?.(); palKeys.dispose?.(); });
