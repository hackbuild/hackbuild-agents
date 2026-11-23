// Parity reference: the HACKLE senses.js attention arithmetic (levels,
// csMap, N and the channel sum, with the top down blob), transcribed by
// hand into a pure function for the tests. It is never shipped. Storage is
// Float32Array and arithmetic is in doubles, as in the original.
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
type Level = { d: Float32Array; w: number; h: number };

function levels(src: Float32Array, w: number, h: number): Level[] {
  const L: Level[] = [{ d: src, w, h }];
  for (let k = 0; k < 4; k++) {
    const p = L[L.length - 1] as Level;
    const nw = Math.max(1, p.w >> 1);
    const nh = Math.max(1, p.h >> 1);
    const o = new Float32Array(nw * nh);
    for (let y = 0; y < nh; y++)
      for (let x = 0; x < nw; x++) {
        const x0 = x * 2;
        const y0 = y * 2;
        const x1 = Math.min(x0 + 1, p.w - 1);
        const y1 = Math.min(y0 + 1, p.h - 1);
        o[y * nw + x] = ((p.d[y0 * p.w + x0] as number) + (p.d[y0 * p.w + x1] as number) + (p.d[y1 * p.w + x0] as number) + (p.d[y1 * p.w + x1] as number)) / 4;
      }
    L.push({ d: o, w: nw, h: nh });
  }
  return L;
}

function csMap(L: Level[]): Float32Array {
  const l1 = L[1] as Level;
  const W = l1.w;
  const Hh = l1.h;
  const out = new Float32Array(W * Hh);
  const smp = (l: Level, u: number, v: number) => {
    const x = clamp(Math.floor(u * l.w), 0, l.w - 1);
    const y = clamp(Math.floor(v * l.h), 0, l.h - 1);
    return l.d[y * l.w + x] as number;
  };
  for (let y = 0; y < Hh; y++)
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / W;
      const v = (y + 0.5) / Hh;
      let s = 0;
      for (const c of [1, 2])
        for (const dd of [2, 3]) {
          if (c + dd >= L.length) continue;
          s += Math.abs(smp(L[c] as Level, u, v) - smp(L[c + dd] as Level, u, v));
        }
      out[y * W + x] = s;
    }
  return out;
}

function N(m: Float32Array, W: number, Hh: number): Float32Array {
  let mx = 0;
  for (const v of m) mx = Math.max(mx, v);
  if (mx < 1e-6) return m.fill(0);
  for (let i = 0; i < m.length; i++) m[i] = (m[i] as number) / mx;
  let sum = 0;
  let n = 0;
  for (let y = 1; y < Hh - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      const v = m[i] as number;
      if (v < 0.999 && v > 0.05 && v >= (m[i - 1] as number) && v >= (m[i + 1] as number) && v >= (m[i - W] as number) && v >= (m[i + W] as number)) {
        sum += v;
        n++;
      }
    }
  const mb = n ? sum / n : 0;
  const k = (1 - mb) * (1 - mb);
  for (let i = 0; i < m.length; i++) m[i] = (m[i] as number) * k;
  return m;
}

/** One attention update. `blobs` are top down biases at map cells (cx, cy) with amplitude k * 0.6 already applied. */
export class LegacyAttention {
  prevI: Float32Array | null = null;
  map: Float32Array;
  constructor(
    public SW = 80,
    public SH = 40,
  ) {
    this.map = new Float32Array((SW / 2) * (SH / 2));
  }
  update(img: Uint8Array, EW: number, EH: number, gain: number, blobs: [number, number, number][]): Float32Array {
    const { SW, SH } = this;
    const I = new Float32Array(SW * SH);
    const BY = new Float32Array(SW * SH);
    const sx = EW / SW;
    const sy = EH / SH;
    for (let y = 0; y < SH; y++)
      for (let x = 0; x < SW; x++) {
        const i = (Math.floor(y * sy) * EW + Math.floor(x * sx)) * 4;
        const r = (img[i] as number) / 255;
        const g = (img[i + 1] as number) / 255;
        const b = (img[i + 2] as number) / 255;
        I[y * SW + x] = (r + g + b) / 3;
        BY[y * SW + x] = b - (r + g) / 2;
      }
    const M = new Float32Array(SW * SH);
    if (this.prevI) for (let i = 0; i < M.length; i++) M[i] = Math.abs((I[i] as number) - (this.prevI[i] as number)) * 4;
    this.prevI = I;
    const E = new Float32Array(SW * SH);
    for (let y = 1; y < SH - 1; y++)
      for (let x = 1; x < SW - 1; x++) {
        const i = y * SW + x;
        E[i] = Math.hypot((I[i + 1] as number) - (I[i - 1] as number), (I[i + SW] as number) - (I[i - SW] as number));
      }
    const W = SW / 2;
    const Hh = SH / 2;
    const cs = (d: Float32Array) => N(csMap(levels(d, SW, SH)), W, Hh);
    const mI = cs(I);
    const mB = cs(BY);
    const mE = cs(E);
    const mM = N((levels(M, SW, SH)[1] as Level).d.slice(), W, Hh);
    const S = this.map;
    for (let i = 0; i < S.length; i++) S[i] = gain * ((mI[i] as number) + 0.7 * (mB[i] as number) + 0.6 * (mE[i] as number) + 1.7 * (mM[i] as number));
    for (const [cx, cy, k] of blobs)
      for (let y = 0; y < Hh; y++)
        for (let x = 0; x < W; x++) {
          const d2 = (x - cx) ** 2 + (y - cy) ** 2;
          S[y * W + x] = (S[y * W + x] as number) + k * Math.exp(-d2 / 6);
        }
    return S;
  }
  /** The winner take all of `shift`: first strictly greater cell above 0.35. */
  winner(): number {
    let bi = -1;
    let bv = 0.35;
    for (let i = 0; i < this.map.length; i++)
      if ((this.map[i] as number) > bv) {
        bv = this.map[i] as number;
        bi = i;
      }
    return bi;
  }
}
