// ---------- shared weight store: one name for every hack.build page on this origin ----------
// The suite, the package pages and this page open @hackbuild/weights under its default name
// (hackbuild-weights), keyed by the file URL, so a cortex model fetched on any of them is read
// here without a second download, and one fetched here is there for them. Opened on first use.
let wStoreP = null;
const wStore = () => wStoreP || (wStoreP = HWEIGHT.openWeightStore({ onNotice: l => logEvent('load', l) }).catch(e => { logEvent('fail', 'the weight store did not open: ' + String(e.message || e).slice(0, 60).toLowerCase() + '. models download each visit.'); return null; }));
const wShort = url => String(url).replace(/^https?:\/\/[^/]+\//, '').replace(/\/resolve\/[0-9a-f]{8,}\//, ' ');
const wLicence = url => { for (const k in VLM) if (url.includes(VLM[k].id)) return VLM[k].licence; return 'unknown, not stated by the caller'; };
async function wMatch(url) {
  const s = await wStore(); if (!s) return null;
  try {
    if (!(await s.has(url))) return null;
    const m = await s.meta(url), b = await s.get({ url, licence: m && m.licence || wLicence(url) });
    logEvent('load', 'from the shared store: ' + wShort(url)); return b;
  } catch (e) { return null; }
}
async function wPut(url, blob) {
  const s = await wStore(); if (!s) return;
  try { if (!(await s.has(url))) await s.put({ key: url, url, licence: wLicence(url) }, blob); } catch (e) { logEvent('warn', 'not stored: ' + wShort(url) + ', ' + String(e.message || e).slice(0, 50).toLowerCase()); }
}
// which cortex models have files in the store; the capability rows read this
const wStored = {};
async function wScan() {
  const s = await wStore(); if (!s) return;
  try { const keys = await s.keys(); for (const k in VLM) wStored[k] = keys.some(u => u.includes(VLM[k].id)); } catch (e) {}
  if (typeof capsRefresh === 'function') capsRefresh();
}
