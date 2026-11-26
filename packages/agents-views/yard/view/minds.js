// ---------- brain and human tabs: what each agent wants, weighed, sensed and did ----------
// View only. Everything here reads sim state and writes the DOM; nothing draws from RNG or feeds
// back into the sim. History is sampled at 2 Hz of sim time, 240 samples (120 s) per series.
const HIST = { n: 240, dt: 0.5, last: -1, dog: {}, hum: {}, dogTick: [], humTick: [], cur: '', task: '' };
const DOG_SERIES = [
  ['hunger', () => brain.d.hunger], ['fatigue', () => brain.d.fatigue], ['play', () => brain.d.play], ['social', () => brain.d.social],
  ['curiosity', () => brain.d.curiosity], ['prey', () => brain.d.prey], ['sleep pressure', () => brain.Sp || 0], ['body clock', () => brain.circ ?? 0], ['bond', () => brain.bond]
];
const HUM_SERIES = [['dog', 'time with the dog'], ['fun', 'fun'], ['rest', 'rest'], ['screen', 'screen'], ['chores', 'chores']];
brain.hist = HIST.dog; HUM.hist = HIST.hum;
const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const f2 = x => (+x || 0).toFixed(2);
const dogName = () => ($('dogName').value.trim() || 'the dog').toLowerCase();
const stamp = s => { s = Math.max(0, s); const m = Math.floor(s / 60), r = s - m * 60; return m + ':' + (r < 10 ? '0' : '') + r.toFixed(1); };
function push(arr, v) { arr.push(v); if (arr.length > HIST.n) arr.shift(); }
function sampleMinds() {
  if (!dog.ready || (HIST.last >= 0 && now - HIST.last < HIST.dt && now >= HIST.last)) return;
  HIST.last = now;
  for (const [k, f] of DOG_SERIES) push(HIST.dog[k] || (HIST.dog[k] = []), clamp(+f() || 0, 0, 1));
  push(HIST.dogTick, brain.cur !== HIST.cur && HIST.cur !== '' ? 1 : 0); HIST.cur = brain.cur;
  if (HUM.ready && HUM.need) {
    for (const [k] of HUM_SERIES) push(HIST.hum[k] || (HIST.hum[k] = []), clamp(+HUM.need[k] || 0, 0, 1));
    const tn = HUM.task ? HUM.task.name : ''; push(HIST.humTick, tn !== HIST.task && HIST.task !== '' ? 1 : 0); HIST.task = tn;
  }
}
// ---------- live region: polite, one message per gap at most, the newest waiting one wins ----------
const LIVE = { last: 0, pending: '', timer: 0, said: '' };
function announce(msg, gap = 4000) {
  if (!msg || msg === LIVE.said || msg === LIVE.pending) return;
  LIVE.pending = msg; const w = LIVE.last + gap - Date.now();
  if (w <= 0) liveFlush(); else if (!LIVE.timer) LIVE.timer = setTimeout(liveFlush, w);
}
function liveFlush() { LIVE.timer = 0; if (!LIVE.pending) return; $('live').textContent = LIVE.pending; LIVE.said = LIVE.pending; LIVE.pending = ''; LIVE.last = Date.now(); }
// ---------- spark rows ----------
const trendOf = v => { const n = v.length; if (n < 3) return 'steady'; const d = v[n - 1] - v[Math.max(0, n - 60)]; return d > 0.04 ? 'rising' : d < -0.04 ? 'falling' : 'steady'; };
const pts = (v, h, n) => v.map((x, i) => `${((i + n - v.length) / (n - 1) * 100).toFixed(2)},${(h - x * h).toFixed(2)}`).join(' ');
function sparkRows(el, rows, th = 0.7) {
  if (el.dataset.built !== String(rows.length)) {
    el.innerHTML = rows.map((r, i) => { const id = el.id + '-big-' + i; return `<li><button class="hb-spark" type="button" aria-expanded="false" aria-controls="${id}"><span class="hb-sr"></span><span class="hb-spark-label" aria-hidden="true">${esc(r.label)}</span><svg class="hb-spark-line" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true"><line class="hb-spark-th" x1="0" x2="100" y1="${(24 - th * 24).toFixed(1)}" y2="${(24 - th * 24).toFixed(1)}"/><g class="tk"></g><polyline class="hb-spark-trace" points=""/></svg><span class="hb-spark-value" aria-hidden="true">0</span><span class="hb-spark-chip" aria-hidden="true"></span></button><div class="hb-spark-big" id="${id}" hidden><svg viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true"><line class="hb-spark-th" x1="0" x2="100" y1="${(60 - th * 60).toFixed(1)}" y2="${(60 - th * 60).toFixed(1)}"/><g class="tk"></g><polyline class="hb-spark-trace" points=""/></svg><div class="hb-spark-axis"><span>2 minutes ago</span><span class="nowv"></span></div><p class="hb-spark-note"></p></div></li>`; }).join('');
    el.querySelectorAll('button.hb-spark').forEach(b => b.onclick = () => { const big = $(b.getAttribute('aria-controls')), open = big.hidden; big.hidden = !open; b.setAttribute('aria-expanded', String(open)); });
    el.dataset.built = String(rows.length);
  }
  rows.forEach((r, i) => {
    const li = el.children[i], b = li.firstChild, v = r.values || [], x = r.value, tr = trendOf(v), over = x >= th, n = HIST.n;
    const ticks = (r.ticks || []).map((t, k) => t ? ((k + n - r.ticks.length) / (n - 1) * 100).toFixed(1) : null).filter(Boolean);
    b.classList.toggle('is-over', over);
    b.querySelector('.hb-sr').textContent = `${r.label} ${f2(x)}, ${tr} over 30 s, ${over ? 'over' : 'under'} the ${th.toFixed(2)} mark`;
    b.querySelector('.hb-spark-trace').setAttribute('points', pts(v, 24, n));
    b.querySelector('.tk').innerHTML = ticks.map(t => `<line class="hb-spark-tick" x1="${t}" x2="${t}" y1="19" y2="24"/>`).join('');
    b.querySelector('.hb-spark-value').textContent = f2(x);
    const chip = b.querySelector('.hb-spark-chip'); chip.textContent = over ? 'over ' + th.toFixed(2) : tr; chip.className = 'hb-spark-chip' + (over ? ' is-hi' : tr === 'steady' ? ' is-lo' : '');
    const big = li.lastChild;
    if (!big.hidden) {
      big.querySelector('.hb-spark-trace').setAttribute('points', pts(v, 60, n));
      big.querySelector('.tk').innerHTML = ticks.map(t => `<line class="hb-spark-tick" x1="${t}" x2="${t}" y1="0" y2="60"/>`).join('');
      big.querySelector('.nowv').textContent = 'now ' + f2(x);
      big.querySelector('.hb-spark-note').textContent = `${r.label} is ${f2(x)} and ${tr} over the last 30 s. ${r.note || ''} ticks mark each switch of what ${r.who || 'it'} does.`;
    }
  });
}
// ---------- choice bars ----------
function choiceBars(el, opts, sr) {
  const max = Math.max(1e-6, ...opts.map(o => o.score + (o.bonus || 0) + (o.penalty || 0)));
  el.innerHTML = opts.map(o => {
    const p = o.prob == null ? '' : Math.round(o.prob * 100) + '%';
    const w = x => (Math.max(0, x) / max * 100).toFixed(1) + '%';
    return `<li class="hb-opt${o.chosen ? ' is-chosen' : ''}${o.top ? ' is-top' : ''}${o.score <= 0.005 ? ' is-zero' : ''}"><span class="hb-sr">${esc(sr(o))}</span><span class="hb-opt-label" aria-hidden="true">${esc(o.label)}</span><span class="hb-opt-bar" aria-hidden="true"><i class="hb-opt-base" style="width:${w(o.score)}"></i>${o.bonus ? `<i class="hb-opt-bonus" style="width:${w(o.bonus)}"></i>` : ''}${o.penalty ? `<i class="hb-opt-penalty" style="width:${w(o.penalty)}"></i>` : ''}</span><span class="hb-opt-score" aria-hidden="true">${f2(o.score + (o.bonus || 0))}</span><span class="hb-opt-prob" aria-hidden="true">${p}</span></li>`;
  }).join('');
}
// the original's rows: a label, a bar and a number; the current one pink
function barRows(el, rows) {
  if (el.dataset.n !== String(rows.length)) { el.innerHTML = rows.map(() => '<div class="row"><span class="lab"></span><div class="bar" aria-hidden="true"><i></i></div><span class="v"></span></div>').join(''); el.dataset.n = String(rows.length); }
  rows.forEach((r, i) => {
    const d = el.children[i]; d.classList.toggle('cur', !!r.cur);
    d.children[0].textContent = r.label; d.children[1].firstChild.style.width = (clamp(r.value / (r.max || 1), 0, 1) * 100).toFixed(1) + '%';
    d.children[2].textContent = f2(r.value); d.title = r.title || '';
  });
}
// the probabilities choose() would use now: the same formula, no draw
function dogPreview() {
  const U = brain.util, sample = ON('L.sample'), indep = PT('independence'), commit = TV('Br.commit') * (1 + 0.35 * indep);
  let best = 'idle', bv = -1; for (const b of BEH) if ((U[b] || 0) > bv) { bv = U[b] || 0; best = b; }
  const bonus = sample ? (brain.done ? -1 : commit) : 0.12, curU = (U[brain.cur] || 0) + bonus, T = TV('Br.temp');
  const raw = BEH.map(b => [b, b === brain.cur ? curU : (U[b] || 0)]);
  let probs;
  if (sample) { const ex = raw.map(([b, u]) => [b, Math.exp((u - bv) / T)]), tot = ex.reduce((s, x) => s + x[1], 0); probs = Object.fromEntries(ex.map(([b, w]) => [b, w / tot])); }
  else { const top = raw.reduce((a, x) => x[1] > a[1] ? x : a); probs = Object.fromEntries(raw.map(([b]) => [b, b === top[0] ? 1 : 0])); }
  return { U, best, bv, curU, commit, bonus, T, indep, probs, sample };
}
const KIND_WORD = { react: 'reacted: something much better could not wait', sampled: 'took a lower scored option this time', top: 'the best score won', forced: 'forced for a moment', cue: 'answered a cue', woke: 'woke up', you: 'you drive it', cortex: 'the cortex asked for it' };
const PEND_NOTE = 'each act scores by how much it would ease what the dog needs. it usually picks the best one and sticks with what it is doing.';
function dogNow(P) {
  const B = brain, sub = B.sub && B.cur === 'fetch' ? ' / ' + B.sub : B.cmd && B.cur === 'obey' ? ' / ' + B.cmd.action : '';
  $('behName').textContent = B.cur + sub; $('behT').textContent = B.t.toFixed(1) + ' s';
  $('behWhy').textContent = B.why || 'nothing pressing';
  const kind = B.cortexGoal && B.cortexGoal.b === B.cur ? 'cortex' : B.whyKind;
  $('behKind').textContent = kind ? 'how: ' + (KIND_WORD[kind] || kind) : '';
  $('pendNote').textContent = B.pending ? 'next: ' + B.pending.b + ' in ' + Math.max(0, (B.pending.at - now) * 1000).toFixed(0) + ' ms' + (B.pending.why ? ', ' + B.pending.why : '') : PEND_NOTE;
  $('goalNote').textContent = (B.cortexGoal ? 'the cortex asked for ' + B.cortexGoal.b + ', +0.35 for ' + Math.max(0, B.cortexGoal.until - now).toFixed(0) + ' s more. ' : '') + (B.forced && B.forced.until > now ? 'forced: ' + B.forced.b + ' for ' + (B.forced.until - now).toFixed(1) + ' s.' : '');
}
function dogChoice(P) {
  const all = BEH.map(b => ({ id: b, score: P.U[b] || 0, bonus: b === brain.cur && P.sample && !brain.done ? P.commit : 0, prob: P.probs[b], chosen: b === brain.cur }));
  const max = Math.max(1, ...all.map(o => o.score));
  barRows($('utilRows'), all.map(o => ({ label: o.id, value: o.score, max, cur: o.chosen, title: o.id + ', score ' + f2(o.score) + ', chance ' + Math.round((o.prob || 0) * 100) + ' percent' + (o.bonus ? ', commitment bonus ' + f2(o.bonus) : '') })));
  $('utilMode').textContent = P.sample ? 'sampled' : 'argmax';
  $('choiceMeta').textContent = P.sample
    ? `temperature ${P.T.toFixed(2)}, commitment ${TV('Br.commit').toFixed(2)} x ${(1 + 0.35 * P.indep).toFixed(2)} (independence)${brain.done ? ', the current act is done' : ''}, next look in ${Math.max(0, brain.dwell - now).toFixed(1)} s. computed.`
    : 'the highest score wins, plus 0.12 for the current act. computed.';
  const fe = $('choiceFeed');
  if (foldOpen(fe)) fe.innerHTML = all.filter(o => o.score > 0.005).sort((x, y) => y.score - x.score).map(o => { const K = EFFECT[o.id]; const g = K ? brain.gain(K) : 0; const terms = K ? Object.entries(K).map(([k, v]) => (v < 0 ? 'lowers ' : 'raises ') + k + ' ' + Math.abs(v).toFixed(2) + ' (now ' + f2(brain.d[k]) + ')').join(', ') : 'no drive term; set by the situation'; return `<li><b>${esc(o.id)} ${f2(o.score)}</b>: ${K ? 'drive gain ' + f2(g) + ', ' : ''}${esc(terms)}${o.bonus ? ', plus commitment ' + f2(o.bonus) : ''}</li>`; }).join('') || '<li>no option above zero</li>';
}
function dogSenses() {
  const want = attention.want || {}, lab = attention.focusId, vis = Object.values(percepts).filter(p => p.vis).sort((a, b) => b.sal - a.sal);
  const nm = id => id === 'you' ? 'moheeb' : id.replace(/\d+$/, '');
  const seen = vis.slice(0, 5).map(p => { const w = want[p.kind] ?? (p.kind === 'treat' ? 1.2 + brain.d.hunger : 0.2); return (p.id === lab ? '<b>' : '') + esc(nm(p.id)) + ' ' + p.dist.toFixed(1) + ' m, pull ' + w.toFixed(2) + (p.id === lab ? ', looking at it</b>' : ''); }).join('; ') || 'nothing in view';
  const mem = Object.values(percepts).filter(p => !p.vis && p.seen > -1e8).sort((a, b) => b.seen - a.seen).slice(0, 3).map(p => esc(nm(p.id)) + ' ' + Math.round(now - p.seen) + ' s ago').join('; ');
  const sn = brain.sn ? ', tracking: ' + brain.sn.mode : '';
  const sm = ON('L.plume') ? 'scent ' + sniff.c.toFixed(3) + ', left ' + sniff.cL.toFixed(3) + ' right ' + sniff.cR.toFixed(3) + (sniff.inBout > 0 ? ', sniffing' : '') + sn + ', wind ' + TV('W.wind').toFixed(1) + ' m/s' : 'the scent layer is off';
  const hs = sounds.filter(s => now - s.t < 20).slice(-3).reverse().map(s => { const az = wrapA(Math.atan2(s.pos.x - dog.pos.x, s.pos.z - dog.pos.z) - dog.yaw); return esc(s.type) + ' ' + s.loud.toFixed(2) + ', ' + Math.abs(az * 57.3).toFixed(0) + ' deg ' + (az >= 0 ? 'left' : 'right') + ', ' + Math.round(now - s.t) + ' s ago'; }).join('; ') || 'quiet';
  const st = brain.startle > 0 ? '<li><span class="k">startle</span>' + brain.startle.toFixed(2) + ', something came at it fast</li>' : '';
  $('dogSenses').innerHTML = `<li><span class="k">seen</span>${seen}</li>${mem ? `<li><span class="k">recalls</span>${mem}</li>` : ''}<li><span class="k">smelled</span>${esc(sm)}</li><li><span class="k">heard</span>${hs}</li>${st}`;
  $('kFocusMind').textContent = ON('L.salience') ? (attention.label ? 'looking at ' + nm(attention.label) : '-') : 'saliency off';
}
function knownRows() {
  return Object.keys(brain.W).filter(c => !c.startsWith('gesture:')).map(c => { let a = null, v = -1; for (const x of ACTIONS) { const s = brain.V(c, x); if (s > v) { v = s; a = x; } } return { c, a, v }; }).filter(r => r.v > 0.45).sort((x, y) => y.v - x.v);
}
function knownUI() {
  const rows = knownRows(), html = rows.map(r => `<li>"${esc(r.c)}" means <b>${esc(r.a)}</b>, ${f2(r.v)}</li>`).join('');
  $('knownList').innerHTML = html || '<li>no word passes 0.45 yet. say one, then praise what it does.</li>';
  $('knownN').textContent = rows.length + (rows.length === 1 ? ' word' : ' words');
}
function dogMemory() {
  const R = TV('Br.reflect'); $('impMeter').firstChild.style.width = clamp(brain.imp / R * 100, 0, 100).toFixed(0) + '%'; $('impMeter').setAttribute('aria-valuenow', Math.round(clamp(brain.imp / R, 0, 1) * 100));
  $('impV').textContent = brain.imp.toFixed(1); $('memN').textContent = brain.mem.length + ' memories';
  if (foldOpen($('memList'))) memRender();
  const L = brain.lastLearn, T = brain.trial;
  $('lastTrial').textContent = (L ? `last credit: "${L.cue}" with ${L.action}, ${L.src} ${L.age.toFixed(1)} s later, credit ${Math.round(L.credit * 100)} percent, ${f2(L.before)} to ${f2(L.after)} (${L.after >= L.before ? '+' : ''}${(L.after - L.before).toFixed(2)}). ` : '') + (T ? `last cue: "${T.cue}", it ${T.action === 'ignored' ? 'ignored it' : T.action === 'none' ? 'did not understand' : 'did ' + T.action}${T.rewarded ? ', rewarded' : ''}.` : 'no cue yet.');
}
function callsUI(el, who, countEl) {
  const L = vlm.log.filter(c => c.who === who); countEl.textContent = String(L.length);
  if (!foldOpen(el) || el.dataset.n === String(vlm.log.length) + who) return; el.dataset.n = String(vlm.log.length) + who;
  el.innerHTML = L.map(c => `<li><span class="t">${stamp(c.t)}</span>${esc(c.kind)}, ${c.ok ? (c.ms / 1000).toFixed(1) + ' s (measured), ' + (c.tokens || 0) + ' tokens' : 'failed'}<div class="why">${esc(c.text.slice(0, 240))}</div>${c.prompt ? `<details><summary>prompt</summary><pre>${esc(c.prompt)}</pre></details>` : ''}</li>`).join('');
}
function dogCortex() {
  const ready = vlm.state === 'ready', st = cortexSched.state(now);
  $('cortexSched').textContent = !ready ? '' : thinking ? 'thinking now' : !$('autoThink').checked ? 'thinks only when you ask' : 'on its own: ' + (st === 'cooling down' ? 'waiting ' + Math.max(0, cortexOpts.minInterval - (now - cortexSched.lastStart)).toFixed(0) + ' s' : st) + ', importance ' + brain.imp.toFixed(1) + ' of ' + TV('Br.reflect').toFixed(0);
  callsUI($('dogCalls'), 'dog', $('dogCallsN'));
  pinspUI();
}
// ---------- the human ----------
const PLAN_RULE_WORD = { rule: 'a rule fired', routine: 'his routine: the top three, drawn at random by weight', mind: 'his mind (the cortex model)', you: 'you asked', task: 'the last task led here' };
function humLook() {
  const L = HUM.look; if (HUM.away) return 'away on an errand'; if (HUM.phoneOn) return 'his phone'; if (!L) return 'ahead';
  const near = (p, r = 0.8) => p && Math.hypot(L.x - p.x, L.z - p.z) < r;
  if (dog.ready && near(dog.root.position, 1)) return 'the dog'; if (ball && near(bodyPos(ball), 0.6)) return 'the ball'; if (near(BOWL, 0.7)) return 'the bowl';
  if (HUM.point && near(HUM.point.p, 1)) return 'the point'; return 'the yard';
}
function humNow() {
  const T = HUM.task, ai = $('humAI').checked;
  $('humTask').textContent = !ai && HUM.manualWhy ? 'manual' : T ? T.name.replace('_', ' ') : 'idle';
  $('humWhy').textContent = !ai && HUM.manualWhy ? HUM.manualWhy : T ? T.why || '' : 'between tasks';
  $('humT').textContent = T ? T.t.toFixed(0) + ' s' : '';
  $('humSrc').textContent = T && HUM.taskSrc ? 'source: ' + (PLAN_RULE_WORD[HUM.taskSrc] || HUM.taskSrc) : '';
  $('humMode').textContent = ai ? 'runs his day' : 'you drive him';
}
function humPlanUI() {
  const P = HUM.lastPlan;
  if (!P) { $('humPlanWhy').textContent = 'no plan yet'; $('humPlan').innerHTML = ''; $('humPlanMeta').textContent = ''; return; }
  $('humPlanAux').textContent = P.rule ? 'rule' : 'routine';
  if (P.rule) { $('humPlanWhy').textContent = 'rule: ' + P.rule + '. no scores were drawn; the rule picked ' + P.choice.replace('_', ' ') + '.'; $('humPlan').innerHTML = ''; $('humPlanMeta').textContent = Math.round(now - P.at) + ' s ago'; return; }
  $('humPlanWhy').textContent = 'picked ' + P.choice + ' from the top three, ' + Math.round(now - P.at) + ' s ago.';
  const opts = Object.keys(P.U).map(k => ({ id: k, label: k, score: P.U[k], penalty: Math.max(0, (P.U0[k] || 0) - P.U[k]), prob: P.probs[k] ?? 0, chosen: k === P.choice, top: P.top.includes(k) })).sort((a, b) => b.score - a.score);
  choiceBars($('humPlan'), opts.slice(0, 6), o => `${o.label}, score ${f2(o.score)}${o.penalty ? ', repeat penalty ' + f2(o.penalty) : ''}, chance ${Math.round(o.prob * 100)} percent${o.chosen ? ', picked' : ''}`);
  const R = P.routine; $('humPlanMeta').textContent = (R ? 'routine weight this hour: ' + Object.entries(R).map(([k, v]) => k + ' ' + f2(v)).join(', ') + '. ' : '') + 'each repeat of the last four multiplies a score by 0.55. computed.';
}
function humMoodUI() {
  const M = HUM.mood || {}, x = k => M[k] ? f2(M[k].x) : '-';
  $('humMood').innerHTML = `<div class="hb-kv"><span>pleased</span><span>${x('pleased')}</span></div><div class="hb-kv"><span>frustrated</span><span>${x('frus')}</span></div><div class="hb-kv"><span>tired</span><span>${x('tired')}</span></div><div class="hb-kv"><span>looking at</span><span>${esc(humLook())}</span></div><div class="hb-kv"><span>watching the dog</span><span>${HUM.lookingAtDog ? 'yes' : 'no'}</span></div><div class="hb-kv"><span>threat to the dog</span><span>${f2(HUM.threat)}</span></div>`;
}
function humMindUI() {
  const ready = vlm.state === 'ready', on = $('humMindOn').checked;
  $('humMindOn').disabled = !ready; $('humMindOnL').classList.toggle('is-disabled', !ready);
  $('humMindWhy').textContent = ready ? '' : !navigator.gpu ? 'no webgpu adapter. his mind needs a cortex model, which needs webgpu.' : 'his mind needs a cortex model. load one in turn things on.';
  const st = humMindSched.state(now);
  $('humMindSt').textContent = !ready ? 'needs a model' : !on ? 'off' : HUM.thinking ? 'thinking' : st === 'cooling down' ? 'waiting ' + Math.max(0, 25 - (now - humMindSched.lastStart)).toFixed(0) + ' s' : 'on';
  callsUI($('humCalls'), 'human', $('humCallsN'));
}
// ---------- timeline ----------
const TL = { agents: new Set(['dog', 'human']), kinds: new Set(['sense', 'choice', 'act', 'cue', 'reward', 'model']), pins: new Set(), sig: '' };
const KIND_ICON = { sense: 'M1 8c2-4 5-6 7-6s5 2 7 6c-2 4-5 6-7 6S3 12 1 8zm7 3a3 3 0 100-6 3 3 0 000 6z', choice: 'M4 2v5c0 2 2 3 4 3s4 1 4 3v1M4 2l-2 2M4 2l2 2M12 14v-1', act: 'M5 3a1.5 2 0 103 0 1.5 2 0 10-3 0M9 4a1.5 2 0 103 0 1.5 2 0 10-3 0M3 7a1.4 1.8 0 103 0 1.4 1.8 0 10-3 0M11 8a1.4 1.8 0 103 0 1.4 1.8 0 10-3 0M5 11c1-2 5-2 6 0 1 2-1 3-3 3s-4-1-3-3z', cue: 'M2 3h12v8H7l-3 3v-3H2z', reward: 'M8 14L2 8a3.5 3.5 0 015-5l1 1 1-1a3.5 3.5 0 015 5z', model: 'M5 2a3 3 0 00-3 3v1a3 3 0 000 5v1a3 3 0 006 1V3a2 2 0 00-3-1zm6 0a3 3 0 013 3v1a3 3 0 010 5v1a3 3 0 01-6 1V3a2 2 0 013-1z' };
const icon = k => `<svg class="hb-icon" width="12" height="12" viewBox="0 0 16 16" aria-hidden="true"><path d="${KIND_ICON[k] || ''}" fill="${k === 'choice' ? 'none' : 'currentColor'}" stroke="${k === 'choice' ? 'currentColor' : 'none'}" stroke-width="1.6"/></svg>`;
const PIN = '<svg class="hb-icon" width="11" height="14" viewBox="0 0 384 512" fill="currentColor" aria-hidden="true"><path d="M32 32C32 14.3 46.3 0 64 0L320 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-29.5 0 10.3 134.1c37.1 21.2 65.8 56.4 78.2 99.7l3.8 13.4c2.8 9.7 .8 20-5.2 28.1S362 352 352 352L32 352c-10 0-19.5-4.7-25.5-12.7s-8-18.4-5.2-28.1L5 297.8c12.4-43.3 41-78.5 78.2-99.7L93.5 64 64 64C46.3 64 32 49.7 32 32zM160 400l64 0 0 112c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-112z"/></svg>';
function evItem(e) {
  const chain = []; let c = e.cause; while (c && chain.length < 3) { const p = EV.get(c); if (!p) break; chain.unshift(p); c = p.cause; }
  const who = e.agent === 'human' ? 'moheeb' : 'dog', pinned = TL.pins.has(e.id);
  const after = chain.length ? ', after ' + chain.map(p => p.text).join(', then ') : '';
  return `<li class="hb-cev${pinned ? ' is-pinned' : ''}"><span class="hb-sr">${stamp(e.t)}, ${who}, ${e.kind}: ${esc(e.text)}${esc(after)}</span><div class="hb-cev-hd" aria-hidden="true"><span class="hb-cev-t">${stamp(e.t)}</span><span class="hb-cev-agent">${who}</span><span class="hb-cev-kind">${icon(e.kind)}${e.kind}</span></div><p class="hb-cev-text" aria-hidden="true">${esc(e.text)}</p>${chain.length ? `<ol class="hb-cev-chain" aria-hidden="true">${chain.map(p => `<li>${icon(p.kind)}<span class="hb-cev-t">${stamp(p.t)}</span>${esc(p.text)}</li>`).join('')}</ol>` : ''}<button class="hb-cev-pin" type="button" aria-pressed="${pinned}" aria-label="${pinned ? 'unpin' : 'pin'} ${esc(e.text.slice(0, 40))}" data-pin="${e.id}">${PIN}</button></li>`;
}
function timelineUI(force) {
  const sig = EV.n + '|' + [...TL.agents].join() + [...TL.kinds].join() + [...TL.pins].join();
  if (!force && sig === TL.sig) return; TL.sig = sig;
  const shown = e => TL.agents.has(e.agent) && TL.kinds.has(e.kind);
  const pinned = EV.log.filter(e => TL.pins.has(e.id)), rest = EV.log.filter(e => !TL.pins.has(e.id) && shown(e)).slice(0, 60);
  $('tlEvents').innerHTML = (pinned.length ? '<li><p class="hb-causal-group">pinned</p><ol>' + pinned.map(evItem).join('') + '</ol></li><li><p class="hb-causal-group">newest first</p></li>' : '') + (rest.map(evItem).join('') || '<li class="hb-causal-empty">nothing yet. throw the ball or say a word.</li>');
}
$('tlEvents').addEventListener('click', e => { const b = e.target.closest('[data-pin]'); if (!b) return; const id = +b.dataset.pin; if (TL.pins.has(id)) TL.pins.delete(id); else TL.pins.add(id); timelineUI(true); });
ENV.qsa('#tlAgents [data-agent], #tlKinds [data-kind]').forEach(b => b.onclick = () => {
  const set = b.dataset.agent ? TL.agents : TL.kinds, k = b.dataset.agent || b.dataset.kind, on = !set.has(k);
  if (on) set.add(k); else set.delete(k); b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); timelineUI(true);
});
// ---------- the panes, the spoken why, the eye net chip ----------
let mindsT = 0, lastCurSaid = '';
function mindsUI() {
  const t = performance.now(); if (t - mindsT < 240) return; mindsT = t;
  const dogOn = paneOn('pBrain'), humOn = paneOn('pHuman');
  if (paneOn('pSense')) dogSenses();
  if (paneOn('pTrain')) dogMemory();
  if (dogOn) {
    const P = dogPreview(); dogNow(P);
    barRows($('driveRows'), DOG_SERIES.map(([k, f]) => ({ label: k, value: clamp(+f() || 0, 0, 1) })));
    dogChoice(P); dogMemory(); dogCortex();
    $('affectTxt').textContent = affectWords(); $('affectAux').textContent = 'valence ' + f2(brain.v) + ', arousal ' + f2(brain.a);
    $('affect').setAttribute('aria-label', affectWords());
  }
  if (humOn && HUM.ready) {
    humNow(); humPlanUI(); humMoodUI(); humMindUI();
    if (HUM.need) sparkRows($('humSparks'), HUM_SERIES.map(([k, l]) => ({ label: l, values: HIST.hum[k] || [], value: (HIST.hum[k] || [0]).at(-1) ?? 0, ticks: HIST.humTick, who: 'he', note: '' })));
    else $('humSparks').innerHTML = '<li class="note">needs run with the organic layer on (more, tune, layers).</li>';
  }
  if (dogOn) timelineUI();
}
function affectWords() {
  const v = brain.v, a = brain.a, mood = (a > 0.6 ? (v > 0.2 ? 'excited and happy' : v < -0.2 ? 'tense and upset' : 'alert') : a < 0.3 ? (v > 0.2 ? 'calm and content' : v < -0.2 ? 'low and flat' : 'calm') : (v > 0.2 ? 'content' : v < -0.2 ? 'uneasy' : 'neutral'));
  return mood + ', valence ' + f2(v) + ', arousal ' + f2(a) + '. anticipation ' + f2(brain.antic) + ', frustration ' + f2(brain.frus) + ', fear ' + f2(brain.fear) + (brain.calm ? ', calming signal: ' + brain.calm.k : '') + '.';
}
// the screen reader hears what the dog does now; nothing is drawn on the yard for it
function whyLineUI() {
  if (brain.cur !== lastCurSaid && dog.ready) { lastCurSaid = brain.cur; announce(dogName() + ': ' + brain.cur + (brain.why ? '. ' + brain.why : '')); }
}
function hudTags() { $('chipNet').classList.toggle('on', !!(net.sess && $('netOn').checked)); }
function gaitUI() {
  const on = ON('L.neural');
  ENV.qsa('#gaitSeg>button').forEach(b => { const me = (b.dataset.gait === 'nn') === on; b.classList.toggle('is-on', me); b.setAttribute('aria-pressed', String(me)); });
  hudTags();
}
ENV.qsa('#gaitSeg>button').forEach(b => b.onclick = () => {
  const nn = b.dataset.gait === 'nn'; TUNE.v['L.neural'] = nn ? 1 : 0; tuneSave(); tuneUI.refresh();
  if (nn && !NG.ready) nnLoadUI(); gaitUI(); capsRefresh();
});
