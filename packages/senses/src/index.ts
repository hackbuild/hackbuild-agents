// @hackbuild/senses: perception for simulated animals. The heavy parts run
// in wasm after load(); scalar helpers are plain TypeScript (./scalar.ts).
// Every class that draws random numbers takes an injected Rng and seeds its
// wasm stream from it, so a seeded run replays.
import { assertReady, loadWasm, loadWasmSync, type WasmSource } from "./load.js";
import { type Rng, seedFrom } from "./scalar.js";
import * as w from "./wasm/senses.js";

export * from "./scalar.js";
export type { WasmSource } from "./load.js";

const PKG = "@hackbuild/senses";

/** Loads the wasm. With no argument the inlined copy is used (works from file://). */
export async function load(source?: WasmSource): Promise<void> {
  await loadWasm(source);
}

/** Loads the wasm synchronously from bytes or a compiled module. */
export function loadSync(source: ArrayBuffer | ArrayBufferView | WebAssembly.Module): void {
  loadWasmSync(source);
}

/** The golden scenario run in wasm, for the native and wasm agreement test. */
export function goldenTrace(seed: number): Float64Array {
  assertReady(PKG);
  return w.goldenTrace(seed);
}

export type Vec3 = { x: number; y: number; z: number };
const opt = (v: number | undefined) => (v === undefined ? Number.NaN : v);

/**
 * A camera as 16 numbers: position, right, up, back (the columns of
 * three's matrixWorld), vertical fov in degrees, aspect, near, far.
 * `cameraFromThree` in `/three` builds one from a PerspectiveCamera.
 */
export type CameraArray = Float64Array;

/** A camera at a point looking along yaw (0 is +Z) and pitch (up positive). */
export function cameraLook(pos: Vec3, yaw: number, pitch: number, fov: number, aspect: number, near = 0.05, far = 100): CameraArray {
  assertReady(PKG);
  return w.cameraLook(pos.x, pos.y, pos.z, yaw, pitch, fov, aspect, near, far);
}

export interface SaliencyOptions {
  rng: Rng;
  /** feature grid the frame is sampled to (default 80 by 40) */
  width?: number;
  height?: number;
  gain?: number;
  /** the winner must beat this to become a fixation (default 0.35) */
  threshold?: number;
  /** fixation dwell median in seconds (default 0.83, Barber 2016) */
  fixationMedian?: number;
  /** inhibition of return in seconds (default 0.7) */
  iorSeconds?: number;
  /** an object within this angle of the winner ray takes the fixation (default 0.25 rad) */
  snapAngle?: number;
  groundY?: number;
  /** channel weights (default 1, 0.7, 0.6, 1.7) */
  channels?: { intensity?: number; blueYellow?: number; edges?: number; motion?: number };
}

export interface Fixation {
  /** cell in the saliency map */
  x: number;
  y: number;
  value: number;
  point: Vec3;
  /** index into the objects passed to shift, or -1 for the ground */
  object: number;
}

/** Itti Koch saliency with top down bias and world space inhibition of return. */
export class Saliency {
  readonly inner: w.Saliency;
  constructor(o: SaliencyOptions) {
    assertReady(PKG);
    const c = o.channels ?? {};
    this.inner = new w.Saliency(
      Float64Array.from([o.width, o.height, o.gain, o.threshold, o.fixationMedian, o.iorSeconds, o.snapAngle, o.groundY, c.intensity, c.blueYellow, c.edges, c.motion].map(opt)),
      seedFrom(o.rng),
    );
  }
  get mapWidth(): number {
    return this.inner.mapWidth;
  }
  get mapHeight(): number {
    return this.inner.mapHeight;
  }
  /** RGBA frame, row 0 at the top. Returns the map (mapWidth by mapHeight). */
  update(frame: Uint8Array | Uint8ClampedArray, width: number, height: number, now: number, camera: CameraArray): Float32Array {
    const f = frame instanceof Uint8Array ? frame : new Uint8Array(frame.buffer, frame.byteOffset, frame.byteLength);
    return this.inner.update(f, width, height, now, camera);
  }
  map(): Float32Array {
    return this.inner.map();
  }
  /** Top down bias for the next update: `weight * exp(-d^2 / 6)` around the point's projection. */
  biasPoint(p: Vec3, weight: number): void {
    this.inner.biasPoint(p.x, p.y, p.z, weight);
  }
  biasUv(u: number, v: number, weight: number): void {
    this.inner.biasUv(u, v, weight);
  }
  inhibit(dir: Vec3, until: number): void {
    this.inner.inhibit(dir.x, dir.y, dir.z, until);
  }
  get inhibited(): number {
    return this.inner.inhibited();
  }
  ready(now: number): boolean {
    return this.inner.ready(now);
  }
  winner(): { index: number; value: number } | null {
    const r = this.inner.winner();
    return r.length ? { index: r[0] as number, value: r[1] as number } : null;
  }
  shift(now: number, camera: CameraArray, objects: Vec3[], arousal: number): Fixation | null {
    const p = new Float64Array(objects.length * 3);
    objects.forEach((o, i) => p.set([o.x, o.y, o.z], i * 3));
    const r = this.inner.shift(now, camera, p, arousal);
    if (!r.length) return null;
    const g = (i: number) => r[i] as number;
    return { x: g(0), y: g(1), value: g(2), point: { x: g(3), y: g(4), z: g(5) }, object: g(6) };
  }
  free(): void {
    this.inner.free();
  }
}

export interface LoomOptions {
  /** startle under this tau in seconds (default 0.6) */
  tau?: number;
  minAngle?: number;
  maxGap?: number;
  refractory?: number;
}

/** Looming detector keyed by small integer ids; `observe` returns the tau of a startle or null. */
export class Looming {
  readonly inner: w.Loom;
  constructor(o: LoomOptions = {}) {
    assertReady(PKG);
    this.inner = new w.Loom(o.tau ?? 0.6, o.minAngle ?? 0.04, o.maxGap ?? 0.3, o.refractory ?? 2.5);
  }
  observe(id: number, size: number, dist: number, now: number): number | null {
    const t = this.inner.observe(id, size, dist, now);
    return Number.isNaN(t) ? null : t;
  }
  forget(id: number): void {
    this.inner.forget(id);
  }
  /** Frees the wasm memory now, before the garbage collector would; the object is unusable after. */
  free(): void {
    this.inner.free();
  }
}

export interface OdourOptions {
  rng: Rng;
  /** side of the square world in metres, centred on the origin (default 34) */
  size?: number;
  /** trail cells per side (default 64) */
  cells?: number;
  maxPuffs?: number;
  puffLife?: number;
  bounds?: number;
  /** puffs per second per source at strength 1 (default 5) */
  puffRate?: number;
  wind?: number;
  meander?: number;
  windHeading?: number;
}

export interface OdourSource {
  /** a small integer per source */
  id: number;
  x: number;
  z: number;
  strength: number;
}

/** Puff plume in a meandering wind plus a ground trail grid. */
export class OdourField {
  readonly inner: w.OdourField;
  private buf = new Float64Array(0);
  constructor(o: OdourOptions) {
    assertReady(PKG);
    this.inner = new w.OdourField(Float64Array.from([o.size, o.cells, o.maxPuffs, o.puffLife, o.bounds, o.puffRate, o.wind, o.meander, o.windHeading].map(opt)), seedFrom(o.rng));
  }
  setWind(speed: number, meander: number): void {
    this.inner.setWind(speed, meander);
  }
  setPuffRate(rate: number): void {
    this.inner.setPuffRate(rate);
  }
  step(dt: number, sources: OdourSource[]): void {
    if (this.buf.length !== sources.length * 4) this.buf = new Float64Array(sources.length * 4);
    sources.forEach((s, i) => this.buf.set([s.id, s.x, s.z, s.strength], i * 4));
    this.inner.step(dt, this.buf);
  }
  clearPuffs(): void {
    this.inner.clearPuffs();
  }
  concentration(x: number, z: number): number {
    return this.inner.concentration(x, z);
  }
  puffConcentration(x: number, z: number): number {
    return this.inner.puffConcentration(x, z);
  }
  groundConcentration(x: number, z: number): number {
    return this.inner.groundConcentration(x, z);
  }
  deposit(x: number, z: number, amount: number, now: number): void {
    this.inner.deposit(x, z, amount, now);
  }
  /** Fades the trail by `elapsed / halflife` halvings. */
  decayTrail(elapsed: number, halflife: number): void {
    this.inner.decayTrail(elapsed, halflife);
  }
  trailDirection(x: number, z: number, prev?: { x: number; z: number }): { x: number; z: number } | null {
    const r = this.inner.trailDirection(x, z, prev?.x ?? Number.NaN, prev?.z ?? Number.NaN);
    return r.length ? { x: r[0] as number, z: r[1] as number } : null;
  }
  /** x, z, age, mass per puff */
  puffs(): Float64Array {
    return this.inner.puffs();
  }
  get puffCount(): number {
    return this.inner.puffCount;
  }
  wind(): { x: number; z: number } {
    const r = this.inner.wind();
    return { x: r[0] as number, z: r[1] as number };
  }
  trail(): Float32Array {
    return this.inner.trail();
  }
  free(): void {
    this.inner.free();
  }
}

/** Two nostril sniffing in bouts (Craven 2010; Thesen 1993: 6 Hz while tracking). */
export class Sniffer {
  readonly inner: w.Sniffer;
  constructor(o: { rng: Rng; sniffHz?: number; boutHz?: number }) {
    assertReady(PKG);
    this.inner = new w.Sniffer(o.sniffHz ?? 6, o.boutHz ?? 1, seedFrom(o.rng));
  }
  /** Returns true when a sniff was taken. `side` is the offset to the left nostril. */
  tick(field: OdourField, dt: number, now: number, active: boolean, nose: { x: number; z: number }, side: { x: number; z: number }): boolean {
    return this.inner.tick(field.inner, dt, now, active, nose.x, nose.z, side.x, side.z);
  }
  whiff(now: number, window = 0.9): boolean {
    return this.inner.whiff(now, window);
  }
  state(): { left: number; right: number; conc: number; mean: number; whiffT: number } {
    const s = this.inner.state();
    const g = (i: number) => s[i] as number;
    return { left: g(0), right: g(1), conc: g(2), mean: g(3), whiffT: g(4) };
  }
  /** Frees the wasm memory now, before the garbage collector would; the object is unusable after. */
  free(): void {
    this.inner.free();
  }
}

export type TrackMode = "decide" | "trail" | "surge" | "cast";
const MODES: TrackMode[] = ["decide", "trail", "surge", "cast"];

export interface TrackStep {
  mode: TrackMode;
  waypoint: { x: number; z: number } | null;
  speed: number;
  stopDist: number;
  done: boolean;
  changed: boolean;
}

/** Scent tracking: decide over a ground trail, follow it, surge upwind on whiffs, cast crosswind on a loss. */
export class Tracker {
  readonly inner: w.Tracker;
  constructor(o: { rng: Rng }) {
    assertReady(PKG);
    this.inner = new w.Tracker(seedFrom(o.rng));
  }
  step(field: OdourField, sniffer: Sniffer, dt: number, now: number, pos: { x: number; z: number }, heading: number, arrived: boolean): TrackStep {
    const r = this.inner.step(field.inner, sniffer.inner, dt, now, pos.x, pos.z, heading, arrived);
    const g = (i: number) => r[i] as number;
    return { mode: MODES[g(0)] as TrackMode, waypoint: g(1) ? { x: g(2), z: g(3) } : null, speed: g(4), stopDist: g(5), done: g(6) === 1, changed: g(7) === 1 };
  }
  /** Replaces the waypoint, for a caller that keeps it out of obstacles. */
  setWaypoint(x: number, z: number): void {
    this.inner.setWaypoint(x, z);
  }
  /** Frees the wasm memory now, before the garbage collector would; the object is unusable after. */
  free(): void {
    this.inner.free();
  }
}

export interface VisionOptions {
  rng: Rng;
  /** half the horizontal field of view in rad (default 2.09, a 240 degree field) */
  halfFov?: number;
  rangePerSize?: number;
  motionGain?: number;
  motionSpeed?: number;
  nightFloor?: number;
  forgetAfter?: number;
  drift?: number;
}

export interface Sighting {
  pos: Vec3;
  vel?: Vec3;
  size: number;
  occluded?: boolean;
  hidden?: boolean;
  fixed?: boolean;
}

export interface Percept {
  visible: boolean;
  seen: number | null;
  salience: number;
  confidence: number;
  dist: number;
  speed: number;
}

/** Geometric vision with percept memory that drifts with sqrt(age) (Fiset 2003). */
export class PerceptMemory {
  readonly inner: w.PerceptMemory;
  private eye = new Float64Array(3);
  private obj = new Float64Array(10);
  constructor(o: VisionOptions) {
    assertReady(PKG);
    this.inner = new w.PerceptMemory(Float64Array.from([o.halfFov, o.rangePerSize, o.motionGain, o.motionSpeed, o.nightFloor, o.forgetAfter, o.drift].map(opt)), seedFrom(o.rng));
  }
  sense(id: number, eye: Vec3, facingYaw: number, s: Sighting, light: number, t: number): Percept {
    this.eye.set([eye.x, eye.y, eye.z]);
    const v = s.vel ?? { x: 0, y: 0, z: 0 };
    this.obj.set([s.pos.x, s.pos.y, s.pos.z, v.x, v.y, v.z, s.size, s.occluded ? 1 : 0, s.hidden ? 1 : 0, s.fixed ? 1 : 0]);
    const r = this.inner.sense(id, this.eye, facingYaw, this.obj, light, t);
    const g = (i: number) => r[i] as number;
    return { visible: g(0) === 1, seen: Number.isNaN(g(1)) ? null : g(1), salience: g(2), confidence: g(3), dist: g(4), speed: g(5) };
  }
  recall(id: number, now: number): { pos: Vec3; confidence: number } | null {
    const r = this.inner.recall(id, now);
    if (!r.length) return null;
    const g = (i: number) => r[i] as number;
    return { pos: { x: g(0), y: g(1), z: g(2) }, confidence: g(3) };
  }
  /** Frees the wasm memory now, before the garbage collector would; the object is unusable after. */
  free(): void {
    this.inner.free();
  }
}

export const UNKNOWN = 0;
export const FREE = 1;
export const OCCUPIED = 2;

export interface GridOptions {
  /** cells per side (default 220) */
  cells?: number;
  /** cell size in metres (default 0.1) */
  cell?: number;
  /** obstacle inflation and free footprint in cells (default 2) */
  radius?: number;
  floorY?: number;
  headY?: number;
  maxRange?: number;
  hitsToMark?: number;
  bucket?: number;
  center?: { x: number; z: number };
}

export interface Frontier {
  x: number;
  z: number;
  dist: number;
  size: number;
}

/** Occupancy grid from eye depth renders, with A* paths and frontiers. */
export class OccupancyGrid {
  readonly inner: w.OccupancyGrid;
  constructor(o: GridOptions = {}) {
    assertReady(PKG);
    const c = o.center ?? { x: 0, z: 0 };
    this.inner = new w.OccupancyGrid(Float64Array.from([o.cells, o.cell, o.radius, o.floorY, o.headY, o.maxRange, o.hitsToMark, o.bucket].map(opt)), c.x, c.z);
  }
  /** Depth in metres along the view ray, row 0 at the top. */
  integrate(camera: CameraArray, depth: Float32Array, width: number, height: number, far: number, agent: Vec3): void {
    this.inner.integrate(camera, depth, width, height, far, agent.x, agent.y, agent.z);
  }
  mark(x: number, z: number, obstacle: boolean): void {
    this.inner.mark(x, z, obstacle);
  }
  freeAround(x: number, z: number): void {
    this.inner.freeAround(x, z);
  }
  bump(x: number, z: number): void {
    this.inner.bump(x, z);
  }
  at(x: number, z: number): number {
    return this.inner.at(x, z);
  }
  canStand(x: number, z: number): boolean {
    return this.inner.canStand(x, z);
  }
  path(a: { x: number; z: number }, b: { x: number; z: number }): { x: number; z: number }[] | null {
    const r = this.inner.path(a.x, a.z, b.x, b.z);
    if (!r.length) return null;
    const out: { x: number; z: number }[] = [];
    for (let i = 0; i < r.length; i += 2) out.push({ x: r[i] as number, z: r[i + 1] as number });
    return out;
  }
  frontiers(p: { x: number; z: number }): Frontier[] {
    const r = this.inner.frontiers(p.x, p.z);
    const out: Frontier[] = [];
    for (let i = 0; i < r.length; i += 4) out.push({ x: r[i] as number, z: r[i + 1] as number, dist: r[i + 2] as number, size: r[i + 3] as number });
    return out;
  }
  markDead(x: number, z: number): void {
    this.inner.markDead(x, z);
  }
  known(): { free: number; occupied: number } {
    const r = this.inner.known();
    return { free: r[0] as number, occupied: r[1] as number };
  }
  cells(): Uint8Array {
    return this.inner.cells();
  }
  get revision(): number {
    return this.inner.revision;
  }
  /** Frees the wasm memory now, before the garbage collector would; the object is unusable after. */
  free(): void {
    this.inner.free();
  }
}
