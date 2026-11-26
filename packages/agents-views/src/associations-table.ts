// AssociationsTable: what the creature has learned, cues by acts. Ported
// from hackle's train tab: the heat table always open, the attention column,
// the explanation under it and reset learning.
import { clamp01, el, panel, stack } from "./dom.js";

/** One cue row of the table. */
export interface AssociationsRow {
  /** the cue, as a word or `gesture:name` */
  cue: string;
  /** net strength per action, 0 to 1, in the order of `actions` */
  values: number[];
  /** how much it still pays attention to the cue, 0 to 1 */
  attention: number;
}

/** What the table draws. Built from a CueLearner with `associationsState`, or by hand. */
export interface AssociationsState {
  /** the act columns */
  actions: string[];
  /** newest last; the table shows the last 16 */
  cues: AssociationsRow[];
  /** the cell of the last reward, outlined */
  last?: { cue: string; action: string } | null;
  /** one line on the last trial */
  trial?: string;
}

/** The @hackbuild/drives LearnerState shape (CueLearner.toJSON()). */
export interface LearnerStateLike {
  cues: Record<string, { w: Record<string, number>; n: Record<string, number>; associability: number }>;
}

/** A @hackbuild/drives CueLearner, or anything with its actions and toJSON. */
export interface LearnerLike {
  readonly actions: readonly string[];
  toJSON(): LearnerStateLike;
}

/** Builds the table from a CueLearner: net strength is excitation minus inhibition. */
export function associationsState(learner: LearnerLike, o: { last?: { cue: string; action: string } | null; trial?: string } = {}): AssociationsState {
  const actions = [...learner.actions];
  const cues = Object.entries(learner.toJSON().cues).map(([cue, r]) => ({
    cue,
    values: actions.map((a) => clamp01((r.w[a] ?? 0) - (r.n[a] ?? 0))),
    attention: clamp01(r.associability),
  }));
  const s: AssociationsState = { actions, cues };
  if (o.last) s.last = o.last;
  if (o.trial) s.trial = o.trial;
  return s;
}

/** Options of `associationsTable`. */
export interface AssociationsOptions {
  /** reset learning was pressed */
  onReset?: () => void;
  /** the explanation under the table; `ASSOCIATIONS_NOTE` by default */
  note?: string;
  /** rows shown, newest last (default 16) */
  limit?: number;
}

/** What `associationsTable` returns: the host, an update and a dispose. */
export interface AssociationsHandle {
  /** the host element */
  readonly root: HTMLElement;
  /** draws a new state */
  update(state: AssociationsState): void;
  /** empties the host */
  dispose(): void;
}

/** The explanation under the table: how net strength, attention and delayed credit work. */
export const ASSOCIATIONS_NOTE =
  "rows are cues, columns are acts. cells show net strength, excitation minus a separate inhibition that fades faster, so an extinguished cue partly comes back after a break. the attn column is each cue's associability: it rises after surprises and falls as the outcome becomes predictable. credit fades with delay, so a slow treat can reward whatever it is doing when it lands. if nothing is strong it offers tricks it was rewarded for before; teach a new word by praising whatever it does.";

/** hackle's cell: .hb-heat.is-pink fills by --v, the figure paper past 0.55. */
function paint(td: HTMLElement, v: number): void {
  const t = clamp01(v);
  td.style.setProperty("--v", t.toFixed(2));
  td.classList.toggle("is-hi", t > 0.55);
  td.textContent = String(Math.round(t * 99));
}

/** Renders the associations panel into `host`. */
export function associationsTable(host: HTMLElement, o: AssociationsOptions = {}): AssociationsHandle {
  const doc = host.ownerDocument;
  const col = stack(host);
  const p = panel(doc, "associations", "rw + pearce kaye hall");
  const scroll = el(doc, "div", "hb-scroll-x");
  const table = el(doc, "table", "hb-heat is-pink");
  const cap = el(doc, "caption", "hb-hint", "link strength 0 to 99, cue by act");
  const thead = el(doc, "thead");
  const tbody = el(doc, "tbody");
  table.append(cap, thead, tbody);
  scroll.append(table);
  const trial = el(doc, "p", "hb-hint");
  const note = el(doc, "p", "hb-note", o.note ?? ASSOCIATIONS_NOTE);
  const reset = el(doc, "button", "hb-btn", "reset learning");
  reset.type = "button";
  reset.addEventListener("click", () => o.onReset?.());
  p.root.append(scroll, trial, note, reset);
  col.append(p.root);
  host.replaceChildren(col);
  let head = "";
  return {
    root: host,
    update(s) {
      const key = s.actions.join("\n");
      if (key !== head) {
        head = key;
        const tr = el(doc, "tr");
        const corner = el(doc, "th", "", "cue");
        corner.scope = "col";
        tr.append(corner);
        for (const a of s.actions) {
          const th = el(doc, "th", "", a.slice(0, 4));
          th.scope = "col";
          th.title = a;
          tr.append(th);
        }
        const at = el(doc, "th", "", "attn");
        at.scope = "col";
        at.title = "how much it still pays attention to the cue";
        tr.append(at);
        thead.replaceChildren(tr);
      }
      const shown = s.cues.slice(-(o.limit ?? 16));
      if (!shown.length) {
        const tr = el(doc, "tr");
        const td = el(doc, "td", "hb-hint", "no cues yet. say a word, then praise whatever it does.");
        td.colSpan = s.actions.length + 2;
        tr.append(td);
        tbody.replaceChildren(tr);
      } else {
        tbody.replaceChildren(
          ...shown.map((r) => {
            const tr = el(doc, "tr");
            const th = el(doc, "th", "", r.cue.replace("gesture:", "g:"));
            th.scope = "row";
            th.title = r.cue;
            tr.append(th);
            s.actions.forEach((a, i) => {
              const td = el(doc, "td");
              paint(td, r.values[i] ?? 0);
              // the last rewarded cell; hackbuild-ui has no outline mark for it yet
              if (s.last && s.last.cue === r.cue && s.last.action === a) td.setAttribute("aria-current", "true");
              tr.append(td);
            });
            const td = el(doc, "td");
            paint(td, r.attention);
            tr.append(td);
            return tr;
          }),
        );
      }
      trial.textContent = s.trial ?? "";
      trial.hidden = !s.trial;
    },
    dispose() {
      host.replaceChildren();
    },
  };
}
