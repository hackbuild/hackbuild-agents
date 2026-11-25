// DrivesBars: what the creature is doing and why, what each act is worth to
// it now, and how much it needs each thing. Ported from hackle's brain tab:
// the behavior block (the name in Permanent Marker, the why under it), the
// utility rows with the current choice in pink, and the drive rows.
import { clamp01, el, f2, panel, stack } from "./dom.js";

/** What the view draws. Built from @hackbuild/drives with `drivesBarsState`, or by hand. */
export interface DrivesBarsState {
  /** what it is doing now */
  behavior: string;
  /** seconds in it */
  seconds?: number;
  /** why it is doing it, one line */
  why?: string;
  /** how it chooses, the utility head's right end: sampled or argmax */
  mode?: string;
  /** what each act is worth now; any scale, drawn against the largest (at least 1) */
  utilities: Record<string, number>;
  /** the act drawn pink; defaults to `behavior` */
  current?: string;
  /** need per drive, 0 to 1 */
  drives: Record<string, number>;
  /** drive rows drawn pink, as hackle drew prey and bond */
  pink?: readonly string[];
  /** a switch that is on its way */
  pending?: { id: string; inMs: number } | null;
}

/** The parts of a @hackbuild/drives Chooser decision the view reads. */
export interface DecisionLike {
  current: string;
  reason: string;
  why: string;
  utilities: Record<string, number>;
  pending: { id: string; at: number; latency: number } | null;
}

/** Drives values, or a @hackbuild/drives Drives object. */
export type DrivesLike = Record<string, number> | { readonly values: Record<string, number> };

export interface DrivesBarsFrom {
  /** sim seconds now, for the pending switch */
  now?: number;
  /** seconds in the current act */
  seconds?: number;
  /** false when the chooser runs argmax */
  sampled?: boolean;
  /** a longer name than the act id, as "fetch / chase" */
  behavior?: string;
  /** a why of your own in place of the decision's */
  why?: string;
  pink?: readonly string[];
}

/** Builds the view state from a Chooser decision and the drives. */
export function drivesBarsState(d: DecisionLike, drives: DrivesLike, o: DrivesBarsFrom = {}): DrivesBarsState {
  const values = "values" in drives && typeof drives.values === "object" ? (drives.values as Record<string, number>) : (drives as Record<string, number>);
  const s: DrivesBarsState = {
    behavior: o.behavior ?? d.current,
    current: d.current,
    why: o.why ?? d.why,
    mode: o.sampled === false ? "argmax" : "sampled",
    utilities: { ...d.utilities },
    drives: { ...values },
    pending: d.pending && o.now !== undefined ? { id: d.pending.id, inMs: Math.max(0, (d.pending.at - o.now) * 1000) } : null,
  };
  if (o.seconds !== undefined) s.seconds = o.seconds;
  if (o.pink) s.pink = o.pink;
  return s;
}

export interface DrivesBarsOptions {
  /** the note under the utility rows while no switch is pending */
  note?: string;
}

export interface DrivesBarsHandle {
  readonly root: HTMLElement;
  update(state: DrivesBarsState): void;
  dispose(): void;
}

export const DRIVES_NOTE = "each act scores by how much it would ease what it needs. it usually picks the best one and sticks with what it is doing.";

interface Rows {
  host: HTMLElement;
  keys: string;
}

/** One gauge row per key, rebuilt only when the keys change. */
function rows(doc: Document, r: Rows, label: string, items: { k: string; v: number; max: number; cur: boolean }[]): void {
  const keys = items.map((i) => i.k).join("\n");
  if (keys !== r.keys) {
    r.keys = keys;
    r.host.replaceChildren(
      ...items.map((i) => {
        const row = el(doc, "div", "hb-gauge");
        row.setAttribute("role", "listitem");
        const meter = el(doc, "div", "hb-meter");
        meter.setAttribute("role", "meter");
        meter.setAttribute("aria-label", `${label} ${i.k}`);
        meter.setAttribute("aria-valuemin", "0");
        meter.append(el(doc, "i"));
        const lab = el(doc, "span", "hb-gauge-label", i.k);
        lab.title = i.k;
        row.append(lab, meter, el(doc, "span", "hb-gauge-value"));
        return row;
      }),
    );
  }
  items.forEach((i, n) => {
    const row = r.host.children[n] as HTMLElement;
    row.classList.toggle("is-cur", i.cur);
    const meter = row.children[1] as HTMLElement;
    meter.setAttribute("aria-valuemax", String(i.max));
    meter.setAttribute("aria-valuenow", f2(i.v));
    (meter.firstChild as HTMLElement).style.width = `${(clamp01(i.v / i.max) * 100).toFixed(1)}%`;
    (row.children[2] as HTMLElement).textContent = f2(i.v);
  });
}

/** Renders the behavior, utility and drives panels into `host`. */
export function drivesBars(host: HTMLElement, o: DrivesBarsOptions = {}): DrivesBarsHandle {
  const doc = host.ownerDocument;
  const col = stack(host);
  const beh = panel(doc, "behavior", "0.0 s");
  const name = el(doc, "p", "hb-display", "idle");
  // hackle's behavior name: Permanent Marker at 28 px
  name.style.fontSize = "28px";
  name.style.lineHeight = "1.05";
  name.setAttribute("aria-live", "polite");
  const why = el(doc, "p", "hb-choice-why");
  why.style.marginTop = "4px";
  beh.root.append(name, why);
  const util = panel(doc, "utility", "sampled");
  const utilRows = el(doc, "div", "hb-gauges");
  utilRows.setAttribute("role", "list");
  utilRows.setAttribute("aria-label", "what each act is worth now");
  const note = el(doc, "p", "hb-spark-note", o.note ?? DRIVES_NOTE);
  note.style.margin = "6px 0 0";
  util.root.append(utilRows, note);
  const drv = panel(doc, "drives", "need 0 to 1");
  const driveRows = el(doc, "div", "hb-gauges");
  driveRows.setAttribute("role", "list");
  driveRows.setAttribute("aria-label", "drives");
  drv.root.append(driveRows);
  col.append(beh.root, util.root, drv.root);
  host.replaceChildren(col);
  const ur: Rows = { host: utilRows, keys: "" };
  const dr: Rows = { host: driveRows, keys: "" };
  return {
    root: host,
    update(s) {
      name.textContent = s.behavior;
      beh.aux.textContent = `${(s.seconds ?? 0).toFixed(1)} s`;
      why.textContent = s.why ?? "";
      why.hidden = !s.why;
      util.aux.textContent = s.mode ?? "sampled";
      const cur = s.current ?? s.behavior;
      const u = Object.entries(s.utilities).map(([k, v]) => ({ k, v: Number.isFinite(v) ? Math.max(0, v) : 0 }));
      const max = Math.max(1, ...u.map((x) => x.v));
      rows(doc, ur, "utility", u.map((x) => ({ ...x, max, cur: x.k === cur })));
      note.textContent = s.pending ? `next: ${s.pending.id} in ${Math.round(s.pending.inMs)} ms` : (o.note ?? DRIVES_NOTE);
      const pink = new Set(s.pink ?? []);
      rows(doc, dr, "drive", Object.entries(s.drives).map(([k, v]) => ({ k, v: clamp01(v), max: 1, cur: pink.has(k) })));
    },
    dispose() {
      host.replaceChildren();
    },
  };
}
