// @hackbuild/tunables: a parameter registry with layer switches for A/B work.
// Every number that shapes behaviour is defined once with its range, step and
// where the value comes from; layers gate whole features behind one master
// switch, so each feature keeps a fallback path that can be compared live.

/** Where a default value comes from (RULES.md: every number says which). */
export type Source = "measured" | "computed" | "vendor" | "inferred" | "unknown";

export interface ParamDef {
  key: string;
  group: string;
  label: string;
  def: number;
  min: number;
  max: number;
  step: number;
  /** unit shown beside the value: "s", "Hz", "m/s", "x" for a multiplier */
  unit?: string;
  note?: string;
  source?: Source;
  /** a citation for the default, shown beside the source */
  cite?: string;
}

export interface Preset {
  label: string;
  values: Record<string, number>;
}

/** Minimal storage surface; `localStorage` fits, so does a Map wrapper in tests. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface RegistryOptions {
  /** the master layer: when it is 0 every `layer()` answers false */
  master?: string;
  storage?: StorageLike;
  storageKey?: string;
  /** schema version written with saved values (`{ ver, d }`) */
  version?: number;
  /**
   * Explicit migrations by the saved version. A save of another version with
   * no migration keeps nothing: its values go back to the current defaults.
   * Version 0 is a bare values object with no `ver` (the legacy export).
   */
  migrate?: Record<number, (values: Record<string, number>) => Record<string, number>>;
  /**
   * Old key to new key, applied when loading saves, URL hashes and JSON.
   * Never change what an existing key means; give the new meaning a new key
   * and rename or drop the old one.
   */
  renames?: Record<string, string>;
}

export type ChangeListener = (key: string, value: number) => void;

/** Saved form: the schema version and only the values that differ from their defaults. */
export interface Saved {
  ver: number;
  d: Record<string, number>;
}

export interface Registry {
  define(def: ParamDef): void;
  /** a layer switch: 1 on, 0 off, in group `layers` unless another is named */
  defineLayer(key: string, label: string, opts?: { group?: string; def?: 0 | 1; note?: string }): void;
  has(key: string): boolean;
  def(key: string): ParamDef;
  get(key: string): number;
  /** clamps into the defined range; unknown keys throw */
  /** clamps into the defined range; unknown keys throw; NaN and the infinities are ignored */
  set(key: string, value: number): void;
  /** master switch and layer switch both on */
  layer(key: string): boolean;
  reset(key?: string): void;
  keys(): string[];
  groups(): { group: string; keys: string[] }[];
  layers(): string[];
  snapshot(): Record<string, number>;
  /** current version values; unknown keys are skipped and returned */
  load(values: Record<string, number>): string[];
  /** only values that differ from their defaults, so new defaults reach old sessions */
  toJSON(): Saved;
  /** `{ ver, d }`; another version goes through `migrate` or keeps nothing */
  fromJSON(saved: unknown): string[];
  /** only the values that differ from their defaults */
  toUrlHash(): string;
  fromUrlHash(hash: string): string[];
  definePreset(name: string, preset: Preset): void;
  presets(): { name: string; label: string }[];
  applyPreset(name: string): void;
  /** two snapshots of the current values, one with the layer on and one with it off */
  abPair(layer: string): { on: Record<string, number>; off: Record<string, number> };
  /** reads the saved values from storage, if any */
  restore(): string[];
  onChange(fn: ChangeListener): () => void;
}

const HASH_KEY = "tune";

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : Number.NaN;
  return Number.isFinite(n) ? n : null;
};

/** Shortest decimal text that reads back to the same number. */
const fmt = (v: number): string => String(v);

export function createRegistry(opts: RegistryOptions = {}): Registry {
  const defs = new Map<string, ParamDef>();
  const values = new Map<string, number>();
  const groupOrder: string[] = [];
  const groupKeys = new Map<string, string[]>();
  const layerKeys: string[] = [];
  const presets = new Map<string, Preset>();
  const listeners = new Set<ChangeListener>();
  const version = opts.version ?? 1;
  const renames = opts.renames ?? {};
  const storageKey = opts.storageKey ?? "tunables";

  const rename = (k: string): string => {
    let key = k;
    for (let i = 0; i < 8 && renames[key] !== undefined && !defs.has(key); i++) key = renames[key] as string;
    return key;
  };
  const need = (key: string): ParamDef => {
    const d = defs.get(key);
    if (!d) throw new Error(`tunables: no parameter named ${key}`);
    return d;
  };
  const clamp = (d: ParamDef, v: number) => Math.min(d.max, Math.max(d.min, v));
  const persist = () => {
    if (!opts.storage) return;
    try {
      opts.storage.setItem(storageKey, JSON.stringify(reg.toJSON()));
    } catch {
      // storage full or refused: values stay live in memory
    }
  };
  const write = (key: string, v: number, save: boolean) => {
    const d = need(key);
    // NaN and the infinities are ignored: they would save as null and
    // write "NaN" into the URL hash
    if (!Number.isFinite(v)) return;
    const nv = clamp(d, v);
    if (values.get(key) === nv) return;
    values.set(key, nv);
    for (const fn of listeners) fn(key, nv);
    if (save) persist();
  };
  const loadValues = (vals: Record<string, number>): string[] => {
    const skipped: string[] = [];
    for (const [k, raw] of Object.entries(vals)) {
      const key = rename(k);
      const v = num(raw);
      if (!defs.has(key) || v === null) {
        skipped.push(k);
        continue;
      }
      write(key, v, false);
    }
    persist();
    return skipped;
  };

  const reg: Registry = {
    define(def) {
      if (defs.has(def.key)) throw new Error(`tunables: ${def.key} is defined twice`);
      if (!(def.min <= def.def && def.def <= def.max)) throw new Error(`tunables: ${def.key} default ${def.def} is outside ${def.min} to ${def.max}`);
      if (!(def.step > 0)) throw new Error(`tunables: ${def.key} step must be above 0`);
      defs.set(def.key, { ...def });
      values.set(def.key, def.def);
      if (!groupKeys.has(def.group)) {
        groupKeys.set(def.group, []);
        groupOrder.push(def.group);
      }
      groupKeys.get(def.group)?.push(def.key);
    },
    defineLayer(key, label, o = {}) {
      const d: ParamDef = { key, group: o.group ?? "layers", label, def: o.def ?? 1, min: 0, max: 1, step: 1 };
      if (o.note !== undefined) d.note = o.note;
      reg.define(d);
      layerKeys.push(key);
    },
    has: (key) => defs.has(key),
    def: (key) => ({ ...need(key) }),
    get(key) {
      const v = values.get(key);
      if (v === undefined) throw new Error(`tunables: no parameter named ${key}`);
      return v;
    },
    set: (key, value) => write(key, value, true),
    layer(key) {
      if (opts.master && key !== opts.master && defs.has(opts.master) && reg.get(opts.master) <= 0) return false;
      return reg.get(key) > 0;
    },
    reset(key) {
      if (key !== undefined) write(key, need(key).def, true);
      else {
        for (const d of defs.values()) write(d.key, d.def, false);
        persist();
      }
    },
    keys: () => [...defs.keys()],
    groups: () => groupOrder.map((group) => ({ group, keys: [...(groupKeys.get(group) ?? [])] })),
    layers: () => [...layerKeys],
    snapshot: () => Object.fromEntries(values),
    load: (vals) => loadValues(vals),
    toJSON() {
      const d: Record<string, number> = {};
      for (const def of defs.values()) {
        const v = values.get(def.key) as number;
        if (v !== def.def) d[def.key] = v;
      }
      return { ver: version, d };
    },
    fromJSON(saved) {
      if (!saved || typeof saved !== "object") throw new Error("tunables: saved settings must be an object");
      const s = saved as Partial<Saved> & Record<string, unknown>;
      const versioned = typeof s.ver === "number" && !!s.d && typeof s.d === "object";
      const ver = versioned ? (s.ver as number) : 0;
      const vals = versioned ? (s.d as Record<string, number>) : (s as Record<string, number>);
      if (ver === version) return loadValues(vals);
      const m = opts.migrate?.[ver];
      if (!m) {
        // no explicit migration: nothing from that save is safe to keep
        persist();
        return Object.keys(vals);
      }
      const kept = m({ ...vals });
      const dropped = Object.keys(vals).filter((k) => !(k in kept));
      return [...dropped, ...loadValues(kept)];
    },
    toUrlHash() {
      const parts: string[] = [];
      for (const d of defs.values()) {
        const v = values.get(d.key) as number;
        if (v !== d.def) parts.push(`${encodeURIComponent(d.key)}:${fmt(v)}`);
      }
      return parts.length ? `${HASH_KEY}=${version}|${parts.join("|")}` : "";
    },
    fromUrlHash(hash) {
      const h = hash.replace(/^#/, "");
      const dec = (p: string) => {
        try {
          return decodeURIComponent(p);
        } catch {
          return p;
        }
      };
      const field = h.split("&").map(dec).find((p) => p.startsWith(`${HASH_KEY}=`));
      if (!field) return [];
      const [, ...pairs] = field.slice(HASH_KEY.length + 1).split("|");
      const vals: Record<string, number> = {};
      const bad: string[] = [];
      for (const p of pairs) {
        const i = p.lastIndexOf(":");
        const v = i > 0 ? num(p.slice(i + 1)) : null;
        if (v === null) bad.push(p);
        else vals[p.slice(0, i)] = v;
      }
      return [...bad, ...loadValues(vals)];
    },
    definePreset(name, preset) {
      for (const k of Object.keys(preset.values)) need(k);
      presets.set(name, { label: preset.label, values: { ...preset.values } });
    },
    presets: () => [...presets.entries()].map(([name, p]) => ({ name, label: p.label })),
    applyPreset(name) {
      const p = presets.get(name);
      if (!p) throw new Error(`tunables: no preset named ${name}`);
      loadValues(p.values);
    },
    abPair(layer) {
      need(layer);
      const base = reg.snapshot();
      return { on: { ...base, [layer]: 1 }, off: { ...base, [layer]: 0 } };
    },
    restore() {
      if (!opts.storage) return [];
      let text: string | null = null;
      try {
        text = opts.storage.getItem(storageKey);
      } catch {
        return [];
      }
      if (!text) return [];
      try {
        return reg.fromJSON(JSON.parse(text));
      } catch {
        return [];
      }
    },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  return reg;
}

/** Decimal places a value of this step shows: 0 for whole steps, else enough for the step. */
export function decimalsFor(step: number): number {
  if (step >= 1) return 0;
  return Math.min(6, Math.max(2, Math.ceil(-Math.log10(step) - 1e-9)));
}

export function formatValue(def: ParamDef, v: number): string {
  return v.toFixed(decimalsFor(def.step));
}
