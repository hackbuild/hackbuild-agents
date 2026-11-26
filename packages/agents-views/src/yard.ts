// Yard: the dog simulator's stage and rack as one view. A dog and his person in a 3D yard, the
// care verbs on the stage, the dog eye inset, the seven tabs of the rack (brain with the drives
// bars, body, sense, train with the associations table, human, tune, how), the cortex model
// select, the setup panel and the command palette. The host passes what the yard loads: the
// physics module, the dog and person models, the person's clips and voice, and a model hub.
// Needs three.js (the WebGPU build) and the @hackbuild packages the yard runs on; see README.
import { runYard, YARD_BAR_HTML, YARD_CSS, YARD_HTML, type YardEnv } from "./yard/scope.js";

/**
 * Where a yard asset comes from: a URL (fetched), the bytes, a Blob, or a function that returns
 * any of those. A string that starts with `data:` is read as a data URL.
 */
export type YardAsset = string | URL | ArrayBuffer | Uint8Array | Blob | (() => Promise<string | URL | ArrayBuffer | Uint8Array | Blob>);

/** Options of `mountYard`. */
export interface YardOptions {
  /**
   * Returns the `@dimforge/rapier3d-compat` module (or its default export). The yard calls
   * `init()` on it. It is a function so a host can load the 1.6 MB gzip (measured) core lazily,
   * from its own bundle or from a plain file.
   */
  physics: () => Promise<unknown>;
  /** The dog model, a binary glTF with the rig the yard expects. */
  dog: YardAsset;
  /** The person model, a binary glTF; null or left out draws a placeholder of capsules. */
  human?: YardAsset | null;
  /** The person's clip pack (JSON with roles, fps and clips), as an object or an asset. */
  anims: YardAsset | object;
  /** His voice reference, a wav for the cloned voice; left out, he speaks in a browser voice. */
  voice?: YardAsset | null;
  /** A model hub base URL for the cortex models in place of https://huggingface.co/. */
  hub?: string;
  /**
   * Where the readout chips, the setup button and the command button go, such as the host's
   * header. Left out, the two buttons float in the stage's top right corner, apart from the verbs,
   * and the chips are not shown.
   */
  bar?: HTMLElement | null;
  /**
   * The yard's switches as a query string: `test&seed=N` for lockstep, `seed=N&speed=S`,
   * `cortex=stub`, `stubloads`. Default: the page hash, when `reseed` is also left out.
   */
  params?: string;
  /** Runs a new seed (the tune tab's seed row). Left out with `params`, the row only reads. */
  reseed?: (params: string) => void;
  /** Opens the setup panel on a first visit (default true); the setup button opens it anyway. */
  setup?: boolean;
  /** The suite's base URL; links into it show only when it is set. */
  suiteUrl?: string;
}

/** What `mountYard` returns. */
export interface YardHandle {
  /** the yard root inside the host */
  readonly root: HTMLElement;
  /** resolves with the scope's test handle once the dog and his person stand in the yard */
  readonly ready: Promise<unknown>;
  /** stops the loop, the workers, the voice and the microphone, and empties the host */
  dispose(): void;
}

const STYLE_ID = "hb-yard-style";

async function bytes(a: YardAsset): Promise<ArrayBuffer> {
  const v = typeof a === "function" ? await a() : a;
  if (v instanceof ArrayBuffer) return v;
  if (v instanceof Uint8Array) return v.slice().buffer;
  if (v instanceof Blob) return v.arrayBuffer();
  const r = await fetch(String(v));
  if (!r.ok) throw new Error(`${String(v).slice(0, 80)} http ${r.status}`);
  return r.arrayBuffer();
}

function base64(buf: ArrayBuffer): string {
  const u = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}

const isAsset = (a: unknown): a is YardAsset =>
  typeof a === "string" || typeof a === "function" || a instanceof URL || a instanceof ArrayBuffer || a instanceof Uint8Array || a instanceof Blob;

/**
 * Mounts the yard in `host`. The yard keeps one instance per page: its parts find each other by
 * id. Its stylesheet goes into the document head once. Load hackbuild-ui's `hackbuild.css` on the
 * page for the look.
 */
export async function mountYard(host: HTMLElement, o: YardOptions): Promise<YardHandle> {
  if (typeof o.physics !== "function") throw new Error("@hackbuild/agents-views: mountYard needs physics, a function returning the rapier3d-compat module");
  if (!o.dog) throw new Error("@hackbuild/agents-views: mountYard needs the dog model");
  const doc = host.ownerDocument;
  const win = doc.defaultView ?? window;
  if (doc.querySelector(".hb-yard")) throw new Error("@hackbuild/agents-views: a yard is mounted on this page already");
  if (!doc.getElementById(STYLE_ID)) {
    const st = doc.createElement("style");
    st.id = STYLE_ID;
    st.textContent = YARD_CSS;
    doc.head.append(st);
  }
  const root = doc.createElement("div");
  root.className = "hb-yard";
  root.innerHTML = YARD_HTML;
  const barTpl = doc.createElement("div");
  barTpl.innerHTML = YARD_BAR_HTML;
  const barParts = [...barTpl.children] as HTMLElement[];
  if (o.bar) {
    o.bar.classList.add("hb-yard-bar");
    o.bar.append(...barParts);
  } else {
    // no bar: setup and commands float in the stage corner, apart from the verbs; no chips
    const corner = doc.createElement("div");
    corner.id = "corner";
    corner.setAttribute("aria-label", "setup and commands");
    corner.setAttribute("role", "group");
    for (const p of barParts) if (p.tagName === "BUTTON") corner.append(p);
    root.querySelector("#stage")?.prepend(corner);
  }
  host.replaceChildren(root);

  const cleanups: Array<() => void> = [];
  const timers = new Set<number>();
  const observers: ResizeObserver[] = [];
  const streams: MediaStream[] = [];
  const disposers: Array<() => void> = [];
  const lookIn = [root, barTpl, ...(o.bar ? [o.bar] : [])];
  const cache = new Map<string, HTMLElement>();
  const byId = (id: string): HTMLElement | null => {
    const c = cache.get(id);
    if (c?.isConnected || (c && barTpl.contains(c))) return c;
    for (const r of lookIn) {
      const e = r.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
      if (e) { cache.set(id, e); return e; }
    }
    return doc.getElementById(id);
  };
  class TrackedObserver extends win.ResizeObserver {
    constructor(cb: ResizeObserverCallback) {
      super(cb);
      observers.push(this);
    }
  }
  const usesHash = o.params == null && !o.reseed;
  let readyOk: (v: unknown) => void = () => {};
  let readyErr: (e: unknown) => void = () => {};
  const ready = new Promise<unknown>((res, rej) => { readyOk = res; readyErr = rej; });
  const [rapier, voice] = await Promise.all([o.physics(), o.voice ? bytes(o.voice).then(base64).catch(() => "") : Promise.resolve("")]);

  const env: YardEnv = {
    rapier,
    suiteUrl: o.suiteUrl ?? "",
    params: o.params ?? (usesHash ? win.location.hash.slice(1) : ""),
    canReseed: !!o.reseed || usesHash,
    setup: o.setup ?? true,
    hub: o.hub ?? "",
    voice,
    byId,
    qsa: (sel) => lookIn.flatMap((r) => [...r.querySelectorAll<HTMLElement>(sel)]),
    docOn(type, fn, opts) {
      doc.addEventListener(type, fn, opts);
      cleanups.push(() => doc.removeEventListener(type, fn, opts));
    },
    on(type, fn, opts) {
      win.addEventListener(type, fn, opts);
      cleanups.push(() => win.removeEventListener(type, fn, opts));
    },
    setTimeout(fn, ms) {
      const id = win.setTimeout(() => { timers.delete(id); fn(); }, ms);
      timers.add(id);
      return id;
    },
    setInterval(fn, ms) {
      const id = win.setInterval(fn, ms);
      timers.add(id);
      return id;
    },
    ResizeObserver: TrackedObserver,
    stream(s) {
      streams.push(s);
      return s;
    },
    dog: () => bytes(o.dog),
    human: () => (o.human ? bytes(o.human) : Promise.resolve(null)),
    anims: async () => (isAsset(o.anims) ? JSON.parse(new TextDecoder().decode(await bytes(o.anims))) : o.anims),
    reseed: o.reseed ?? ((q) => { win.location.hash = q; win.location.reload(); }),
    dispose: (fn) => { disposers.push(fn); },
    ready: (h) => readyOk(h),
    fail: (e) => readyErr(e),
  };
  runYard(env);
  ready.catch(() => {});

  let gone = false;
  return {
    root,
    ready,
    dispose() {
      if (gone) return;
      gone = true;
      for (const f of disposers) { try { f(); } catch { /* keep tearing down */ } }
      for (const f of cleanups) f();
      for (const t of timers) { win.clearTimeout(t); win.clearInterval(t); }
      for (const ob of observers) ob.disconnect();
      for (const s of streams) for (const t of s.getTracks()) t.stop();
      for (const p of barParts) p.remove();
      o.bar?.classList.remove("hb-yard-bar");
      root.remove();
      if (!doc.querySelector(".hb-yard")) doc.getElementById(STYLE_ID)?.remove();
    },
  };
}
