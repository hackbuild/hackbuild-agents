// The body clock in plain TypeScript with Math.exp, for apps that hash
// JavaScript state: on one engine and platform it is bit identical to a
// JavaScript implementation of the same formula. Math.exp is not the same
// on every platform (V8 on macOS arm64 and on Linux x64 differ by one ulp
// for some arguments, measured), so it is within 2.3e-16 of the wasm
// `bodyClock` and of other platforms. No load() needed.

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Sleepiness from the body clock at an hour 0 to 24, with Math.exp (see the wasm `bodyClock`). */
export function bodyClockJs(hour: number): number {
  const h = hour;
  const day = smoothstep(5.5, 7.5, h) * (1 - smoothstep(20, 22.5, h));
  const pk = Math.exp(-(((h - 7) / 1.6) ** 2)) + Math.exp(-(((h - 19) / 1.6) ** 2));
  const dip = Math.exp(-(((h - 13.5) / 1.8) ** 2));
  return clamp01(1 - (0.6 * day + 0.45 * pk - 0.22 * dip));
}
