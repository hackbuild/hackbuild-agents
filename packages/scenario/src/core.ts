// The lockstep core shared by the Node runner and the browser entry: the
// step scheduler, trace types, trace diff and trace hash. No Node imports;
// a driver supplies the side that touches the sim (a puppeteer page in
// Node, the sim object itself in a browser).
import type { Check } from "./report.js";

/**
 * Page code with `h` bound to the sim handle: a string (a statement body
 * for actions, an expression for `when` and probes) or a function of `h`.
 * In Node a function is sent to the page by its source, so it must not
 * close over anything.
 */
export type Code = string | ((h: any) => unknown);

export interface Action {
  /** sim seconds; or `when`, a page condition checked every `whenEvery` steps, fired once */
  at?: number;
  when?: Code;
  js: Code;
}

export interface Probe {
  every: number;
  /** an expression returning JSON */
  js: Code;
}

export interface Shot {
  at: number;
  path: string;
  js?: Code;
}

export interface Trace {
  rows: unknown[][];
  cols?: string[];
  hash?: string;
  probes: [number, unknown][];
  fired: [number, string][];
  wallSeconds: number;
}

/** What `trace()` on the sim returns. */
export interface SimTrace {
  rows: unknown[][];
  cols?: string[];
  hash?: string;
}

export interface Scenario {
  name: string;
  seed: number;
  seconds: number;
  actions?: Action[];
  probes?: Probe[];
  shots?: Shot[];
  /** extra hash fields after `#test&seed=N`, such as `off=L.neural` */
  hash?: string;
  checks?: (t: Trace) => Check[];
}

/** One event per thing the runner did, in order, for a live view. */
export type ScenarioEvent =
  | { type: "step"; step: number; total: number; simSeconds: number }
  | { type: "action"; step: number }
  | { type: "fired"; step: number; when: string }
  | { type: "probe"; step: number; value: unknown }
  | { type: "shot"; step: number; path: string };

export interface LockstepOptions {
  stepsPerSecond?: number;
  /** steps per call into the page (default 30) */
  chunk?: number;
  /** the page API expression (default `window.__sim`) */
  api?: string;
  /** what `h` is bound to in actions and probes (default the api) */
  handle?: string;
  /** steps between checks of `when` actions (default 15) */
  whenEvery?: number;
  onProgress?: (simSeconds: number, wallSeconds: number) => void;
  onEvent?: (e: ScenarioEvent) => void;
}

/** The side of a run that touches the sim. */
export interface Driver {
  /** runs an action body */
  act(code: Code): unknown;
  /** evaluates an expression or function and returns its value */
  read(code: Code): unknown;
  step(n: number): unknown;
  trace(): SimTrace | Promise<SimTrace>;
  /** renders and records a shot after its optional code ran */
  shot?(path: string): unknown;
}

export const codeText = (c: Code): string => (typeof c === "string" ? c : c.toString());

/** Steps a scenario through a driver; the scheduler both entries share. */
export async function drive(d: Driver, sc: Scenario, o: LockstepOptions = {}): Promise<Trace> {
  const sps = o.stepsPerSecond ?? 60;
  const whenEvery = o.whenEvery ?? 15;
  const emit = o.onEvent ?? (() => undefined);
  const t0 = Date.now();
  const total = Math.round(sc.seconds * sps);
  const whens = (sc.actions ?? []).filter((a) => a.when !== undefined);
  type Ev = { step: number; kind: "action" | "shot"; js?: Code; path?: string };
  const events: Ev[] = [
    ...(sc.actions ?? []).filter((a) => a.when === undefined).map((a) => ({ step: Math.round((a.at ?? 0) * sps), kind: "action" as const, js: a.js })),
    ...(sc.shots ?? []).map((s) => ({ step: Math.round(s.at * sps), kind: "shot" as const, ...(s.js ? { js: s.js } : {}), path: s.path })),
  ].sort((a, b) => a.step - b.step);
  const probes = (sc.probes ?? []).map((p) => ({ ...p, n: Math.max(1, Math.round(p.every * sps)) }));
  const out: Trace = { rows: [], probes: [], fired: [], wallSeconds: 0 };
  let done = 0;
  let lastLog = Date.now();
  const due = async () => {
    while (events.length && (events[0] as Ev).step <= done) {
      const e = events.shift() as Ev;
      if (e.js) await d.act(e.js);
      if (e.kind === "action") emit({ type: "action", step: done });
      if (e.kind === "shot" && e.path) {
        if (d.shot) await d.shot(e.path);
        emit({ type: "shot", step: done, path: e.path });
      }
    }
  };
  while (done < total) {
    await due();
    let n = Math.min(o.chunk ?? 30, total - done);
    if (events.length) n = Math.min(n, Math.max(1, (events[0] as Ev).step - done));
    for (const p of probes) n = Math.min(n, p.n - (done % p.n));
    if (whens.length) n = Math.min(n, whenEvery - (done % whenEvery));
    await d.step(n);
    done += n;
    emit({ type: "step", step: done, total, simSeconds: done / sps });
    if (whens.length && done % whenEvery === 0) {
      for (let i = 0; i < whens.length; i++) {
        const w = whens[i] as Action;
        if (await d.read(w.when as Code)) {
          await d.act(w.js);
          const when = codeText(w.when as Code);
          out.fired.push([done, when]);
          emit({ type: "fired", step: done, when });
          whens.splice(i--, 1);
        }
      }
    }
    for (const p of probes) {
      if (done % p.n !== 0) continue;
      const value = await d.read(p.js);
      out.probes.push([done, value]);
      emit({ type: "probe", step: done, value });
    }
    if (o.onProgress && Date.now() - lastLog > 15000) {
      lastLog = Date.now();
      o.onProgress(done / sps, (Date.now() - t0) / 1000);
    }
  }
  // events at exactly `seconds` (a closing screenshot) fire after the last step
  await due();
  const tr = await d.trace();
  out.rows = tr.rows;
  if (tr.cols) out.cols = tr.cols;
  if (tr.hash !== undefined) out.hash = tr.hash;
  out.wallSeconds = (Date.now() - t0) / 1000;
  return out;
}

/** JSON with NaN and the infinities kept apart from null. */
export const exact = (v: unknown): string => JSON.stringify(v, (_k, x) => (typeof x === "number" && !Number.isFinite(x) ? `${x}` : x)) ?? "undefined";

export type TraceLike = { rows: unknown[][]; hash?: string | null };

/** First differing row between two traces, or null when identical. NaN, Infinity and null all differ. */
export function diffTraces(a: TraceLike, b: TraceLike): { row: number; a: unknown; b: unknown } | null {
  const n = Math.max(a.rows.length, b.rows.length);
  for (let i = 0; i < n; i++) {
    const x = exact(a.rows[i]);
    const y = exact(b.rows[i]);
    if (x !== y) return { row: i, a: a.rows[i] ?? null, b: b.rows[i] ?? null };
  }
  if ((a.hash ?? null) !== (b.hash ?? null)) return { row: n, a: a.hash ?? null, b: b.hash ?? null };
  return null;
}

export interface RowDifference {
  row: number;
  /** the first differing column, or -1 when a row is missing */
  col: number;
  a: unknown;
  b: unknown;
}

/** Every differing row up to `limit`, with the first differing column, for a diff view. */
export function diffRows(a: TraceLike, b: TraceLike, limit = 200): { compared: number; differing: number; rows: RowDifference[] } {
  const n = Math.max(a.rows.length, b.rows.length);
  const rows: RowDifference[] = [];
  let differing = 0;
  for (let i = 0; i < n; i++) {
    const ra = a.rows[i];
    const rb = b.rows[i];
    if (exact(ra) === exact(rb)) continue;
    differing++;
    if (rows.length >= limit) continue;
    let col = -1;
    if (ra && rb) {
      const m = Math.max(ra.length, rb.length);
      for (let k = 0; k < m; k++) if (exact(ra[k]) !== exact(rb[k])) {
        col = k;
        break;
      }
    }
    rows.push({ row: i, col, a: col >= 0 ? (ra as unknown[])[col] : (ra ?? null), b: col >= 0 ? (rb as unknown[])[col] : (rb ?? null) });
  }
  return { compared: n, differing, rows };
}

const short = (v: unknown) => (typeof v === "number" ? String(Number(v.toPrecision(4))) : exact(v));

/** "trace differs at row 88: heading 0.41, expected 0.39", or "traces match". `b` is the expected trace. */
export function diffMessage(a: TraceLike & { cols?: string[] | null }, b: TraceLike): string {
  const d = diffRows(a, b, 1);
  const first = d.rows[0];
  if (!first) return (a.hash ?? null) === (b.hash ?? null) ? "traces match" : `trace hash differs: ${a.hash ?? "none"}, expected ${b.hash ?? "none"}`;
  if (first.col < 0) return `trace differs at row ${first.row}: ${first.a === null ? "row missing" : "extra row"}, ${d.differing} rows differ`;
  const name = a.cols?.[first.col] ?? `column ${first.col}`;
  return `trace differs at row ${first.row}: ${name} ${short(first.a)}, expected ${short(first.b)}`;
}

/** FNV-1a 32 bit over the exact JSON of rows, probes and fired: the same in Node and every browser. */
export function traceHash(t: { rows: unknown[][]; probes?: unknown[]; fired?: unknown[] }): string {
  const s = exact([t.rows, t.probes ?? [], t.fired ?? []]);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
