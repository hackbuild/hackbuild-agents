// A requestAnimationFrame sampler injected before any page script runs:
// it records every frame interval and, when the page defines
// `window.__rafSample`, its value at each frame. The runner reads it back
// to get frame time p50, p95 and max at real frame rate.
import type { Page } from "puppeteer-core";
import { frameStats, type Stats } from "./metrics.js";

const SOURCE = `(() => {
  const s = { frames: [], samples: [], max: 20000, on: true };
  window.__raf = s;
  let last = 0;
  const tick = (t) => {
    if (last) { s.frames.push(t - last); if (s.frames.length > s.max) s.frames.shift(); }
    last = t;
    if (typeof window.__rafSample === "function") { try { s.samples.push(window.__rafSample(t)); if (s.samples.length > s.max) s.samples.shift(); } catch (e) { s.error = String(e); } }
    if (s.on) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();`;

/** Installs the sampler on every new document of the page. Call before goto. */
export async function installRafSampler(page: Page): Promise<void> {
  await page.evaluateOnNewDocument(SOURCE);
}

/** What `readRaf` returns: frame intervals in ms, the per frame samples and their stats. */
export interface RafReading<T = unknown> {
  frames: number[];
  samples: T[];
  stats: Stats;
  error?: string;
}

/** Reads and clears what the sampler has recorded. */
export async function readRaf<T = unknown>(page: Page): Promise<RafReading<T>> {
  const r = (await page.evaluate(`(() => { const s = window.__raf; if (!s) return null; const out = { frames: s.frames.slice(), samples: s.samples.slice(), error: s.error }; s.frames.length = 0; s.samples.length = 0; return out; })()`)) as { frames: number[]; samples: T[]; error?: string } | null;
  if (!r) throw new Error("no raf sampler on the page. call installRafSampler before goto.");
  const out: RafReading<T> = { frames: r.frames, samples: r.samples, stats: frameStats(r.frames) };
  if (r.error) out.error = r.error;
  return out;
}
