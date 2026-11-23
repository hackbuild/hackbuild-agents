// @hackbuild/drives: homeostatic drives, sampled behaviour choice with a
// why, cue learning, sleep and a memory stream. The cores run in wasm
// after load(); task gating and inference scheduling are plain TypeScript
// (./task.ts, ./schedule.ts). Every class that draws random numbers takes
// an injected Rng and seeds its wasm stream from it.
import { assertReady, loadWasm, loadWasmSync, type WasmSource } from "./load.js";
import * as w from "./wasm/drives.js";

export * from "./clock.js";
export * from "./schedule.js";
export * from "./task.js";
export type { WasmSource } from "./load.js";

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

export const seedFrom = (rng: Rng): number => Math.floor(rng() * 4294967296) >>> 0;

const PKG = "@hackbuild/drives";
const opt = (v: number | boolean | undefined) => (v === undefined ? Number.NaN : typeof v === "boolean" ? (v ? 1 : 0) : v);

export async function load(source?: WasmSource): Promise<void> {
  await loadWasm(source);
}

export function loadSync(source: ArrayBuffer | ArrayBufferView | WebAssembly.Module): void {
  loadWasmSync(source);
}

export function goldenTrace(seed: number): Float64Array {
  assertReady(PKG);
  return w.goldenTrace(seed);
}

/** Sleepiness from the body clock at an hour 0 to 24 (peaks of activity near 7 and 19). */
export function bodyClock(hour: number): number {
  assertReady(PKG);
  return w.bodyClock(hour);
}

/** Drive reduction reward over named deficits (Keramati and Gutkin 2011). */
export class Drives<K extends string> {
  readonly inner: w.Drives;
  readonly keys: K[];
  constructor(weights: Record<K, number>, opts: { n?: number; m?: number; gain?: number } = {}) {
    assertReady(PKG);
    this.keys = Object.keys(weights) as K[];
    this.inner = new w.Drives(Float64Array.from(this.keys.map((k) => weights[k])), opts.n ?? 3, opts.m ?? 4, opts.gain ?? 2.4);
  }
  private vec(p: Partial<Record<K, number>>, base?: Float64Array): Float64Array {
    return Float64Array.from(this.keys.map((k, i) => p[k] ?? (base ? (base[i] as number) : 0)));
  }
  get values(): Record<K, number> {
    const v = this.inner.values();
    return Object.fromEntries(this.keys.map((k, i) => [k, v[i] as number])) as Record<K, number>;
  }
  set(values: Partial<Record<K, number>>): void {
    this.inner.setValues(this.vec(values, this.inner.values()));
  }
  /** The drive of a state, or of the current one. */
  distance(state?: Partial<Record<K, number>>): number {
    return this.inner.distance(state ? this.vec(state, this.inner.values()) : this.inner.values());
  }
  /** Reward of an act with this expected effect; reductions scaled by `scale`. */
  rewardOf(effect: Partial<Record<K, number>>, scale = 1): number {
    return this.inner.rewardOf(this.vec(effect), scale);
  }
  grow(dt: number, rates: Partial<Record<K, number>>): void {
    this.inner.grow(dt, this.vec(rates));
  }
  setShape(n: number, m: number, gain: number): void {
    this.inner.setShape(n, m, gain);
  }
}

export type Reason = "hold" | "top" | "sampled" | "reactive" | "forced" | "argmax" | "fired";
const REASONS: Reason[] = ["hold", "top", "sampled", "reactive", "forced", "argmax", "fired"];

export interface Option<B extends string = string> {
  id: B;
  utility: number;
  /** cannot wait for the dwell: switches after a short latency */
  reactive?: boolean;
}

export interface Decision<B extends string = string> {
  current: B;
  switched: boolean;
  pending: { id: B; at: number; latency: number } | null;
  reason: Reason;
  /** the option the reason is about */
  id: B;
  utility: number;
  best: B;
  bestUtility: number;
  /** sampling probability of `id` when a sample was drawn, else NaN */
  probability: number;
  why: string;
  /** every option's utility at this update, for logging */
  utilities: Record<B, number>;
}

export interface ChooserOptions<B extends string> {
  rng: Rng;
  options: readonly B[];
  start?: B;
  /** softmax temperature (default 0.06) */
  temperature?: number;
  /** bonus on the current act while not done (default 0.12) */
  commitment?: number;
  dwellMu?: number;
  dwellTau?: number;
  reactMu?: number;
  reactTau?: number;
  reactMargin?: number;
  /** false gives argmax with hysteresis (the canned path) */
  sample?: boolean;
  /** false removes latencies and draws a fixed dwell (the canned path) */
  noise?: boolean;
}

/** Softmax with commitment and reactive latencies; every decision has a why. */
export class Chooser<B extends string> {
  readonly inner: w.Chooser;
  readonly options: readonly B[];
  private index: Map<B, number>;
  private u: Float64Array;
  private r: Uint8Array;
  constructor(o: ChooserOptions<B>) {
    assertReady(PKG);
    this.options = o.options;
    this.index = new Map(o.options.map((b, i) => [b, i]));
    const start = o.start === undefined ? 0 : (this.index.get(o.start) ?? -1);
    if (start < 0) throw new Error(`${PKG}: start option ${String(o.start)} is not in the list`);
    this.inner = new w.Chooser(
      [...o.options],
      Float64Array.from([o.temperature, o.commitment, o.dwellMu, o.dwellTau, o.reactMu, o.reactTau, o.reactMargin, o.sample, o.noise].map(opt)),
      seedFrom(o.rng),
      start,
    );
    this.u = new Float64Array(o.options.length);
    this.r = new Uint8Array(o.options.length);
  }
  get current(): B {
    return this.options[this.inner.current] as B;
  }
  /** The executor reports the current act finished. */
  markDone(): void {
    this.inner.markDone();
  }
  get done(): boolean {
    return this.inner.isDone;
  }
  /** Switches now (a cue, a command); the done flag resets and a new dwell is drawn. */
  set(id: B, now: number): void {
    this.inner.set(this.need(id), now);
  }
  private need(id: B): number {
    const i = this.index.get(id);
    if (i === undefined) throw new Error(`${PKG}: no option named ${String(id)}`);
    return i;
  }
  /** One update. Options missing from `utilities` score 0. */
  update(now: number, utilities: Partial<Record<B, number>>, reactive: Iterable<B> = [], forced?: B): Decision<B> {
    this.u.fill(0);
    this.r.fill(0);
    for (const [k, v] of Object.entries(utilities) as [B, number][]) {
      const i = this.index.get(k);
      if (i !== undefined) this.u[i] = Number.isFinite(v) ? Math.max(0, v) : 0;
    }
    for (const k of reactive) this.r[this.need(k)] = 1;
    const d = this.inner.update(now, this.u, this.r, forced === undefined ? -1 : this.need(forced));
    const g = (i: number) => d[i] as number;
    const name = (i: number) => this.options[i] as B;
    return {
      current: name(g(0)),
      switched: g(1) === 1,
      pending: g(2) >= 0 ? { id: name(g(2)), at: g(3), latency: g(10) } : null,
      reason: REASONS[g(4)] as Reason,
      id: name(g(5)),
      utility: g(6),
      best: name(g(7)),
      bestUtility: g(8),
      probability: g(9),
      why: this.inner.why,
      utilities: Object.fromEntries(this.options.map((b, i) => [b, this.u[i] as number])) as Record<B, number>,
    };
  }
  get dwellUntil(): number {
    return this.inner.dwellUntil;
  }
  setTemperature(t: number, commitment: number): void {
    this.inner.setTemperature(t, commitment);
  }
}

export type CueResponse<A extends string> = { kind: "ignored"; latency: number } | { kind: "none"; latency: number } | { kind: "act"; action: A; offered: boolean; latency: number };

export interface LearnerOptions<A extends string> {
  rng: Rng;
  actions: readonly A[];
  alpha?: number;
  theta?: number;
  traceSeconds?: number;
  /** inhibition decay per minute (default 0.06) */
  inhibitionDecay?: number;
  offerRate?: number;
  /** base non compliance (default 0.25) */
  ignore?: number;
  cueMu?: number;
  cueTau?: number;
  noise?: boolean;
}

export interface LearnerState<A extends string> {
  ver: 1;
  cues: Record<string, { w: Record<A, number>; n: Record<A, number>; associability: number }>;
  offer: Record<A, number>;
}

/** Cue learning with associability, eligibility traces and decaying inhibition. */
export class CueLearner<A extends string> {
  readonly inner: w.CueLearner;
  readonly actions: readonly A[];
  private index: Map<A, number>;
  constructor(o: LearnerOptions<A>) {
    assertReady(PKG);
    this.actions = o.actions;
    this.index = new Map(o.actions.map((a, i) => [a, i]));
    this.inner = new w.CueLearner(
      o.actions.length,
      Float64Array.from([o.alpha, o.theta, o.traceSeconds, o.inhibitionDecay, o.offerRate, o.ignore, o.cueMu, o.cueTau, o.noise].map(opt)),
      seedFrom(o.rng),
    );
  }
  private need(a: A): number {
    const i = this.index.get(a);
    if (i === undefined) throw new Error(`${PKG}: no action named ${String(a)}`);
    return i;
  }
  respond(cue: string, now: number, o: { distraction?: number; trainability?: number; watched?: boolean; offerable?: A[] } = {}): CueResponse<A> {
    const off = new Uint8Array(this.actions.length);
    if (o.offerable) for (const a of o.offerable) off[this.need(a)] = 1;
    else off.fill(1);
    const r = this.inner.respond(cue, now, o.distraction ?? 0, o.trainability ?? 0, o.watched ?? true, off);
    const g = (i: number) => r[i] as number;
    if (g(0) === 0) return { kind: "ignored", latency: g(3) };
    if (g(0) === 1) return { kind: "none", latency: g(3) };
    return { kind: "act", action: this.actions[g(1)] as A, offered: g(2) === 1, latency: g(3) };
  }
  markDone(action: A, now: number): void {
    this.inner.markDone(this.need(action), now);
  }
  offerTrick(action: A, now: number): void {
    this.inner.offerTrick(this.need(action), now);
  }
  reward(r: number, now: number, trainability = 0): { cue: string | null; action: A; value: number; credit: number } | null {
    const x = this.inner.reward(r, now, trainability);
    if (!x.length) return null;
    const cues = this.inner.cues();
    const c = x[0] as number;
    return { cue: c >= 0 ? (cues[c] ?? null) : null, action: this.actions[x[1] as number] as A, value: x[2] as number, credit: x[3] as number };
  }
  decay(dt: number): void {
    this.inner.decay(dt);
  }
  value(cue: string, action: A): number {
    const c = this.inner.cueIndex(cue);
    return c < 0 ? 0 : this.inner.value(c, this.need(action));
  }
  /** Sets a prior: excitation `w` for a cue and action. */
  prior(cue: string, action: A, wgt: number): void {
    const c = this.inner.ensure(cue);
    const a = this.need(action);
    this.inner.setWeight(c, a, wgt, this.inner.inhibition(c, a));
  }
  setOffer(action: A, v: number): void {
    this.inner.setOffer(this.need(action), v);
  }
  toJSON(): LearnerState<A> {
    const cues: LearnerState<A>["cues"] = {};
    this.inner.cues().forEach((name, c) => {
      const wv = {} as Record<A, number>;
      const nv = {} as Record<A, number>;
      this.actions.forEach((a, i) => {
        wv[a] = this.inner.excitation(c, i);
        nv[a] = this.inner.inhibition(c, i);
      });
      cues[name] = { w: wv, n: nv, associability: this.inner.associability(c) };
    });
    const offer = Object.fromEntries(this.actions.map((a, i) => [a, this.inner.offer(i)])) as Record<A, number>;
    return { ver: 1, cues, offer };
  }
  load(s: LearnerState<A>): void {
    if (s.ver !== 1) throw new Error(`${PKG}: learner state version ${String(s.ver)} is not 1`);
    for (const [name, row] of Object.entries(s.cues)) {
      const c = this.inner.ensure(name);
      this.actions.forEach((a, i) => this.inner.setWeight(c, i, row.w[a] ?? 0, row.n[a] ?? 0));
      this.inner.setAssociability(c, row.associability);
    }
    this.actions.forEach((a, i) => this.inner.setOffer(i, s.offer[a] ?? 0.15));
  }
}

export type SleepStage = "awake" | "onset" | "nrem" | "rem" | "wake";
const STAGES: SleepStage[] = ["awake", "onset", "nrem", "rem", "wake"];

/** Sleep pressure, body clock and the stage machine of one sleep. */
export class Sleep {
  readonly inner: w.Sleep;
  constructor(o: { rng: Rng; pressure?: number; up?: number; down?: number; nrem?: number; rem?: number; wake?: number; enough?: number }) {
    assertReady(PKG);
    this.inner = new w.Sleep(Float64Array.from([o.up, o.down, o.nrem, o.rem, o.wake, o.enough].map(opt)), o.pressure ?? 0.25, seedFrom(o.rng));
  }
  get pressure(): number {
    return this.inner.pressure;
  }
  set pressure(p: number) {
    this.inner.pressure = p;
  }
  get stage(): SleepStage {
    return STAGES[this.inner.stage] as SleepStage;
  }
  pressureStep(gameHours: number, activity = 1): void {
    this.inner.pressureStep(gameHours, activity);
  }
  sleepiness(hour: number): number {
    return this.inner.sleepiness(hour);
  }
  fatigue(hour: number, running = false): number {
    return this.inner.fatigue(hour, running);
  }
  lieDown(negative = false): void {
    this.inner.lieDown(negative);
  }
  wakeUp(): void {
    this.inner.wakeUp();
  }
  /** Returns true when the sleep ended on its own. */
  step(gameMinutes: number, hour: number, negative = false): boolean {
    return this.inner.step(gameMinutes, hour, negative);
  }
  sample(): void {
    this.inner.sample();
  }
  hypnogram(): SleepStage[] {
    return Array.from(this.inner.hypnogram(), (i) => STAGES[i] as SleepStage);
  }
  wakeThreshold(): number {
    return this.inner.wakeThreshold();
  }
}

/** Memories ranked by recency, importance and relevance (Park et al. 2023). */
export class MemoryStream {
  readonly inner: w.MemoryStream;
  constructor(o: { capacity?: number; decay?: number } = {}) {
    assertReady(PKG);
    this.inner = new w.MemoryStream(o.capacity ?? 60, o.decay ?? Number.NaN);
  }
  add(text: string, importance: number, hour: number): void {
    this.inner.add(text, importance, hour);
  }
  retrieve(hour: number, cues: string[], k: number): string[] {
    const t = this.inner.texts();
    return Array.from(this.inner.retrieve(hour, cues, k), (i) => t[i] as string);
  }
  get pendingImportance(): number {
    return this.inner.pendingImportance;
  }
  /** True once summed importance reaches the budget; resets the sum. */
  shouldReflect(budget: number): boolean {
    return this.inner.shouldReflect(budget);
  }
  get length(): number {
    return this.inner.length;
  }
}

/**
 * A goal set by a slow deliberation (a language model, a planner): adds a
 * bonus to one option's utility until it expires. Model agnostic.
 */
export class GoalBoost<B extends string> {
  private goal: { id: B; until: number; why: string } | null = null;
  constructor(readonly bonus = 0.35) {}
  set(id: B, now: number, seconds: number, why: string): void {
    this.goal = { id, until: now + seconds, why };
  }
  current(now: number): { id: B; why: string } | null {
    if (this.goal && this.goal.until < now) this.goal = null;
    return this.goal;
  }
  apply(now: number, u: Partial<Record<B, number>>): Partial<Record<B, number>> {
    const g = this.current(now);
    if (g && u[g.id] !== undefined) u[g.id] = (u[g.id] as number) + this.bonus;
    return u;
  }
}
