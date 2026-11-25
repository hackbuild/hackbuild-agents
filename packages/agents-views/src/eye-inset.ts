// EyeInset: the eye card on the stage. Ported from hackle's eye card: a
// canvas of what one of them sees, a who switch (the dog's eye, his eyes)
// and a mode line (dichromat, human colour). The card is a hackbuild-ui
// inset marked data-ux="inset", so a layout and the screen gate find it.
import { el } from "./dom.js";

/** A @hackbuild/cameras FirstPerson, or anything that hides a head round a draw. */
export interface EyeLike {
  render(draw: () => void): void;
}

export interface EyeWho {
  id: string;
  /** the switch label, as "dog eye" */
  label: string;
  /** a longer name for assistive tech, as "what the dog sees" */
  title?: string;
  /** the eye whose render wraps the draw, so its own head is hidden */
  eye?: EyeLike;
}

export interface EyeInsetOptions {
  who: readonly EyeWho[];
  /** the selected id; the first by default */
  selected?: string;
  /**
   * Draws one frame of `who` on the canvas, inside `who.eye.render` when there
   * is an eye. A returned string becomes the mode line.
   */
  draw: (canvas: HTMLCanvasElement, who: EyeWho) => string | void;
  /** canvas pixels (default 320 by 160, hackle's 2 to 1) */
  width?: number;
  height?: number;
  /** the canvas, when a renderer owns it already (a three WebGLRenderer's) */
  canvas?: HTMLCanvasElement;
  onWho?: (id: string) => void;
}

export interface EyeInsetHandle {
  readonly root: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly who: EyeWho;
  select(id: string): void;
  /** draws one frame of the selected eye */
  frame(): void;
  /** sets the mode line */
  mode(text: string): void;
  dispose(): void;
}

/** Makes `host` the eye card: head with the mode line, the who switch, the canvas. */
export function eyeInset(host: HTMLElement, o: EyeInsetOptions): EyeInsetHandle {
  if (!o.who.length) throw new Error("@hackbuild/agents-views: eyeInset needs at least one who");
  const doc = host.ownerDocument;
  host.classList.add("hb-inset");
  host.dataset.ux = "inset";
  host.setAttribute("role", "figure");
  const w = o.width ?? 320;
  const h = o.height ?? 160;
  let sel = o.who.find((x) => x.id === o.selected) ?? (o.who[0] as EyeWho);

  const hd = el(doc, "div", "hb-inset-hd");
  const title = el(doc, "span", "hb-inset-title");
  const aux = el(doc, "span", "hb-hd-aux");
  const cycle = el(doc, "button", "hb-inset-cycle");
  cycle.type = "button";
  hd.append(title, aux);
  if (o.who.length > 1) hd.append(cycle);
  const modes = el(doc, "div", "hb-inset-modes");
  modes.setAttribute("role", "group");
  modes.setAttribute("aria-label", "whose eyes");
  const buttons = o.who.map((x) => {
    const b = el(doc, "button", "hb-inset-mode", x.label);
    b.type = "button";
    if (x.title) b.title = x.title;
    b.addEventListener("click", () => pick(x.id, true));
    return b;
  });
  modes.append(...buttons);
  const media = el(doc, "div", "hb-inset-media");
  media.style.setProperty("--hb-inset-ratio", `${w} / ${h}`);
  const canvas = o.canvas ?? el(doc, "canvas");
  if (!o.canvas) {
    canvas.width = w;
    canvas.height = h;
  }
  canvas.setAttribute("role", "img");
  media.append(canvas);
  host.replaceChildren(hd, ...(o.who.length > 1 ? [modes] : []), media);

  function pick(id: string, user: boolean): void {
    const next = o.who.find((x) => x.id === id);
    if (!next) return;
    sel = next;
    title.textContent = "eye";
    canvas.setAttribute("aria-label", sel.title ?? sel.label);
    buttons.forEach((b, i) => b.setAttribute("aria-pressed", String(o.who[i] === sel)));
    const i = o.who.indexOf(sel);
    const after = o.who[(i + 1) % o.who.length] as EyeWho;
    cycle.textContent = sel.label;
    cycle.setAttribute("aria-label", `${sel.label}, press for ${after.label}`);
    if (user) o.onWho?.(sel.id);
  }
  cycle.addEventListener("click", () => {
    const i = o.who.indexOf(sel);
    pick((o.who[(i + 1) % o.who.length] as EyeWho).id, true);
  });
  pick(sel.id, false);

  const handle: EyeInsetHandle = {
    root: host,
    canvas,
    get who() {
      return sel;
    },
    select: (id) => pick(id, false),
    frame() {
      const who = sel;
      const run = () => {
        const m = o.draw(canvas, who);
        if (typeof m === "string") aux.textContent = m;
      };
      if (who.eye) who.eye.render(run);
      else run();
    },
    mode(text) {
      aux.textContent = text;
    },
    dispose() {
      host.replaceChildren();
      host.classList.remove("hb-inset");
      delete host.dataset.ux;
    },
  };
  return handle;
}
