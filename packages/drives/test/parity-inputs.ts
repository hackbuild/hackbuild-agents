// Seeded inputs shared by the legacy parity fixtures and the tests that
// read them. fixtures/legacy-brain.json holds the numbers the legacy dog
// simulator's own JavaScript (legacy/det in the public dog-simulator
// repository, commit named in the file) produced on exactly these inputs;
// only those numbers are committed.

/** Mulberry32, the generator the legacy code and the wasm both use. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DRIVE_KEYS = ["hunger", "fatigue", "play", "social", "curiosity", "prey"] as const;
export type DriveKey = (typeof DRIVE_KEYS)[number];
/** The legacy brain's drive weights. */
export const WEIGHTS: Record<DriveKey, number> = { hunger: 1, fatigue: 1, play: 0.8, social: 0.9, curiosity: 0.6, prey: 1.1 };
/** Scales the legacy brain passes to gain (1, the greet 0.35, the explore 1.25). */
export const SCALES = [1, 0.35, 1.25] as const;

export const REWARD_STATES = 150;
/** Drive state k of the reward run, every deficit in 0 to 1. */
export function rewardState(k: number): Record<DriveKey, number> {
  const r = mulberry32(2000 + k);
  return { hunger: r(), fatigue: r(), play: r(), social: r(), curiosity: r(), prey: r() };
}

/** The nine acts of the choice run; fetch and greet are reactive. */
export const ACTS = ["idle", "explore", "sniff", "eat", "fetch", "greet", "playbow", "rest", "sleep"] as const;
export const REACTIVE_ACTS = ["fetch", "greet"] as const;

export const DECISIONS = 6000;
/**
 * Decision k: utilities (three in ten zero), the current act, whether it
 * is done, whether its dwell ran out (the chooser starts with dwell 0, so
 * time 10 is past it and time 0 is not), and the seed of the stream.
 */
export function decision(k: number): { utilities: Record<string, number>; current: string; done: boolean; now: number; seed: number } {
  const r = mulberry32(3000 + k);
  const utilities: Record<string, number> = {};
  for (const b of ACTS) utilities[b] = r() < 0.3 ? 0 : r();
  const current = ACTS[(r() * ACTS.length) | 0] as string;
  const done = r() < 0.5;
  const now = r() < 0.5 ? 10 : 0;
  return { utilities, current, done, now, seed: (k * 2654435761) >>> 0 };
}

/** Hour k of a body clock run, spread over 0 to 24. */
export const clockHour = (k: number): number => mulberry32(4000 + k)() * 24;
/** Hours scanned for the body clock fixture; it keeps the first 1,000 and every one where the wasm differs from the legacy JavaScript. */
export const CLOCK_SCAN = 2000000;
