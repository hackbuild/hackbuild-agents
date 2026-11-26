// ---------- audio ----------
let actx = null, audioOK = false;
addEventListener('pointerdown', () => { audioOK = true; }, { capture: true });
addEventListener('keydown', () => { audioOK = true; }, { capture: true });
function audio() { if (!$('sound').checked || !audioOK) return null; if (!actx) { try { actx = new AudioContext(); } catch (e) { return null; } } if (actx.state === 'suspended') actx.resume(); return actx; }
function distGain(p) { return clamp(1.6 / (0.6 + camera.position.distanceTo(p) * 0.25), 0.05, 1); }
function bark(p, pitch = 1, n = 1) {
  if (typeof brain !== 'undefined' && p && dog.root && p.distanceTo(dog.root.position) < 1) brain.barkT = now;
  const a = audio(); if (!a) return; const g0 = distGain(p);
  for (let k = 0; k < n; k++) {
    const t = a.currentTime + k * 0.22;
    const o = a.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(520 * pitch, t); o.frequency.exponentialRampToValueAtTime(260 * pitch, t + 0.13);
    const nz = a.createBufferSource(); const buf = a.createBuffer(1, a.sampleRate * 0.15, a.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; nz.buffer = buf;
    const f1 = a.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 900 * pitch; f1.Q.value = 2.5;
    const f2 = a.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 2200 * pitch; f2.Q.value = 3;
    const g = a.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5 * g0, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    const gn = a.createGain(); gn.gain.value = 0.35;
    o.connect(f1); o.connect(f2); nz.connect(gn); gn.connect(f1); f1.connect(g); f2.connect(g); g.connect(a.destination);
    o.start(t); o.stop(t + 0.18); nz.start(t); nz.stop(t + 0.15);
  }
}
function whine(p) { const a = audio(); if (!a) return; const t = a.currentTime; const o = a.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(900, t); o.frequency.linearRampToValueAtTime(1400, t + 0.3); o.frequency.linearRampToValueAtTime(800, t + 0.7); const g = a.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.12 * distGain(p), t + 0.08); g.gain.linearRampToValueAtTime(0.0001, t + 0.75); o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + 0.8); }
function thud(p, v) { const a = audio(); if (!a) return; const t = a.currentTime; const o = a.createOscillator(); o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.08); const g = a.createGain(); g.gain.setValueAtTime(clamp(v * 0.08, 0, 0.35) * distGain(p), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1); o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + 0.12); }
let pantT = 0;
function pant(p) { const a = audio(); if (!a) return; const t = a.currentTime; const nz = a.createBufferSource(); const buf = a.createBuffer(1, a.sampleRate * 0.14, a.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / d.length); nz.buffer = buf; const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 0.8; const g = a.createGain(); g.gain.value = 0.05 * distGain(p); nz.connect(f); f.connect(g); g.connect(a.destination); nz.start(t); }

