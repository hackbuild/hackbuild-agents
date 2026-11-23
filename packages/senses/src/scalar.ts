// Scalar helpers in plain TypeScript: a call into wasm costs more than the
// arithmetic here. Written in the same operation order as the Rust crate.

/** Uniform numbers in [0, 1). The family contract: injected, never Math.random. */
export type Rng = () => number;

/** Mulberry32, the same stream as the Rust `Mulberry32`. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a) >>> 0;
    t = ((t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A 32 bit seed drawn from an injected Rng; how a wasm object is seeded. */
export const seedFrom = (rng: Rng): number => Math.floor(rng() * 4294967296) >>> 0;

/** Standard normal by Box Muller, u then v, as the crate draws them. */
export function gauss(rng: Rng): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Angular size in radians of an object of `size` metres at `dist` metres. */
export const angularSize = (size: number, dist: number): number => 2 * Math.atan(size / 2 / Math.max(dist, 0.05));

/** Time to contact tau = theta / (d theta / dt); Infinity when not growing. */
export function timeToContact(prevAngle: number, angle: number, dt: number): number {
  if (dt <= 0) return Infinity;
  const rate = (angle - prevAngle) / dt;
  return rate <= 0 ? Infinity : angle / rate;
}

/**
 * Heard azimuth (radians, 0 is +Z) for a source at `trueAzimuth`. Facing
 * the source narrows the error to 0.35 of `sdDeg`; otherwise 6 percent of
 * sounds mirror front to back about the body `yaw` (Guerineau 2022: dogs
 * 1.3 to 13.2 degrees, mean 7.6).
 */
export function localizeSound(trueAzimuth: number, yaw: number, sdDeg: number, facing: boolean, rng: Rng): number {
  const sd = ((sdDeg * Math.PI) / 180) * (facing ? 0.35 : 1);
  let a = trueAzimuth + gauss(rng) * sd;
  if (!facing && rng() < 0.06) a = 2 * yaw - a + Math.PI;
  return a;
}
