// A small element maker for the views. The look is the hackbuild-ui class
// layer; the views write classes and data, never colours or faces of their own.

export function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, cls = "", text?: string): HTMLElementTagNameMap[K] {
  const e = doc.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** An instrument panel: an ink head with a quieter value at its right. */
export function panel(doc: Document, title: string, aux = ""): { root: HTMLElement; aux: HTMLElement } {
  const root = el(doc, "section", "hb-panel");
  const hd = el(doc, "h3", "hb-panel-hd-inst");
  const aside = el(doc, "span", "hb-hd-aux", aux);
  hd.append(el(doc, "span", "", title), aside);
  root.append(hd);
  return { root, aux: aside };
}

export const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
export const f2 = (v: number): string => (Number.isFinite(v) ? v.toFixed(2) : "0.00");

/** The panels of a view stand apart by hackle's 16 px, the one layout rule a view sets. The
 * column is a child, so the host keeps its own display and a hidden rack pane stays hidden. */
export function stack(host: HTMLElement): HTMLElement {
  const col = host.ownerDocument.createElement("div");
  col.style.display = "grid";
  col.style.gap = "16px";
  col.style.alignContent = "start";
  col.style.minWidth = "0";
  return col;
}
