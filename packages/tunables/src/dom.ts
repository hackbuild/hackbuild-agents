// Panel binding: builds a tune panel from a registry with DOM calls only
// (no innerHTML, so labels and notes are never parsed as markup), keeps it
// in step with the registry in both directions, and tags every number with
// its source.
import { formatValue, type Registry } from "./index.js";

/** Group labels, open groups, class prefix, hash sync and export and import hooks of a panel. */
export interface PanelOptions {
  /** display names per group; groups without one show their key */
  groupLabels?: Record<string, string>;
  /** groups shown open; the layers group is open by default */
  open?: string[];
  /** a class prefix for styling, default "tn" */
  prefix?: string;
  /** writes the URL hash after each change (default false) */
  syncHash?: boolean;
  /** the document to build in, for tests or iframes */
  document?: Document;
  /** receives the export text; without it the panel downloads `fileName` */
  onExport?: (json: string) => void;
  fileName?: string;
  /** called after an import with the skipped keys, or the read error */
  onImport?: (skipped: string[], error: Error | null) => void;
  /** the location to sync, default `globalThis.location` */
  location?: { hash: string };
  /**
   * history used to write the hash without a new entry per slider step,
   * default `globalThis.history` when `location` is the page's own; without
   * one the hash is assigned
   */
  history?: { readonly state: unknown; replaceState(data: unknown, unused: string, url?: string): void };
}

/** A built panel: its root element, `refresh` to read the registry again and `dispose` to remove it. */
export interface Panel {
  root: HTMLElement;
  refresh(): void;
  dispose(): void;
}

/** Builds a tune panel for a registry inside `host` with DOM calls only and keeps both in step. */
export function bindPanel(host: HTMLElement, reg: Registry, opts: PanelOptions = {}): Panel {
  const doc = opts.document ?? host.ownerDocument;
  const px = opts.prefix ?? "tn";
  const open = new Set(opts.open ?? ["layers"]);
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] => {
    const e = doc.createElement(tag);
    if (cls) e.className = `${px}-${cls}`;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const inputs = new Map<string, HTMLInputElement>();
  const outs = new Map<string, HTMLElement>();
  const layerSet = new Set(reg.layers());
  const root = el("div", "panel");
  const loc = opts.location ?? (globalThis as { location?: { hash: string } }).location;
  const hist = opts.history ?? (opts.location ? undefined : (globalThis as { history?: PanelOptions["history"] }).history);

  for (const { group, keys } of reg.groups()) {
    const det = el("details", "group");
    det.dataset.group = group;
    if (open.has(group)) det.open = true;
    const sum = el("summary", "head");
    sum.append(el("span", "title", (opts.groupLabels?.[group] ?? group).toLowerCase()), el("span", "count", String(keys.length)));
    det.append(sum);
    for (const key of keys) {
      const d = reg.def(key);
      const row = el("label", layerSet.has(key) ? "toggle" : "row");
      row.dataset.key = key;
      if (d.note) row.title = d.note;
      const inp = el("input");
      inp.dataset.key = key;
      if (layerSet.has(key)) {
        inp.type = "checkbox";
        inp.checked = reg.get(key) > 0;
        inp.addEventListener("change", () => reg.set(key, inp.checked ? 1 : 0));
        row.append(inp, el("span", "label", d.label));
      } else {
        inp.type = "range";
        inp.min = String(d.min);
        inp.max = String(d.max);
        inp.step = String(d.step);
        inp.value = String(reg.get(key));
        inp.addEventListener("input", () => reg.set(key, Number(inp.value)));
        const out = el("output", "value", formatValue(d, reg.get(key)));
        outs.set(key, out);
        row.append(el("span", "label", d.label), inp, out);
        if (d.unit) row.append(el("span", "unit", d.unit));
        row.append(el("span", "source", d.source ?? "unknown"));
        if (d.cite) row.append(el("span", "cite", d.cite));
      }
      if (!layerSet.has(key)) {
        const rb = el("button", "reset-one", "reset");
        rb.type = "button";
        rb.dataset.reset = key;
        rb.addEventListener("click", (ev) => {
          ev.preventDefault();
          reg.reset(key);
        });
        row.append(rb);
      }
      inputs.set(key, inp);
      det.append(row);
    }
    root.append(det);
  }

  const presets = reg.presets();
  if (presets.length) {
    const bar = el("div", "presets");
    for (const p of presets) {
      const b = el("button", "preset", p.label.toLowerCase());
      b.type = "button";
      b.dataset.preset = p.name;
      b.addEventListener("click", () => reg.applyPreset(p.name));
      bar.append(b);
    }
    root.prepend(bar);
  }
  const bar = el("div", "actions");
  const reset = el("button", "reset", "reset all");
  reset.type = "button";
  reset.addEventListener("click", () => reg.reset());
  const exp = el("button", "export", "export");
  exp.type = "button";
  exp.addEventListener("click", () => {
    const text = JSON.stringify(reg.toJSON(), null, 1);
    if (opts.onExport) return opts.onExport(text);
    const a = el("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    a.download = opts.fileName ?? "tunables.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  const imp = el("input", "import");
  imp.type = "file";
  imp.accept = ".json,application/json";
  imp.addEventListener("change", async () => {
    const f = imp.files?.[0];
    if (!f) return;
    try {
      const skipped = reg.fromJSON(JSON.parse(await f.text()));
      opts.onImport?.(skipped, null);
    } catch (e) {
      opts.onImport?.([], e instanceof Error ? e : new Error(String(e)));
    }
    imp.value = "";
  });
  const impLabel = el("label", "import-label", "import");
  impLabel.append(imp);
  bar.append(reset, exp, impLabel);
  root.append(bar);

  const show = (key: string) => {
    const inp = inputs.get(key);
    if (!inp) return;
    const v = reg.get(key);
    if (inp.type === "checkbox") inp.checked = v > 0;
    else if (Number(inp.value) !== v) inp.value = String(v);
    const out = outs.get(key);
    if (out) out.textContent = formatValue(reg.def(key), v);
  };
  const off = reg.onChange((key) => {
    show(key);
    if (opts.syncHash && loc) {
      const h = loc.hash.replace(/^#/, "").split("&").filter((p) => p && !p.startsWith("tune="));
      const t = reg.toUrlHash();
      if (t) h.push(t);
      if (hist) hist.replaceState(hist.state, "", `#${h.join("&")}`);
      else loc.hash = h.join("&");
    }
  });
  host.append(root);
  return {
    root,
    refresh: () => {
      for (const k of inputs.keys()) show(k);
    },
    dispose: () => {
      off();
      root.remove();
    },
  };
}
