// Types of src/yard/scope.js, which tools/gen-yard.mjs assembles from packages/agents-views/yard.

/** What the yard's scope reads from its host; built by mountYard. */
export interface YardEnv {
  rapier: unknown;
  suiteUrl: string;
  params: string;
  canReseed: boolean;
  setup: boolean;
  hub: string;
  voice: string;
  byId(id: string): HTMLElement | null;
  qsa(sel: string): HTMLElement[];
  docOn(type: string, fn: (e: Event) => void, opts?: AddEventListenerOptions | boolean): void;
  on(type: string, fn: (e: Event) => void, opts?: AddEventListenerOptions | boolean): void;
  setTimeout(fn: () => void, ms?: number): number;
  setInterval(fn: () => void, ms?: number): number;
  ResizeObserver: typeof ResizeObserver;
  stream(s: MediaStream): MediaStream;
  dog(): Promise<ArrayBuffer>;
  human(): Promise<ArrayBuffer | null>;
  anims(): Promise<unknown>;
  reseed(params: string): void;
  dispose(fn: () => void): void;
  ready(handle: unknown): void;
  fail(err: unknown): void;
}

/** The yard's stylesheet, every selector scoped to .hb-yard and .hb-yard-bar. */
export const YARD_CSS: string;
/** The stage and rack, the setup panel, the drawer and the command palette. */
export const YARD_HTML: string;
/** The readout chips, the setup button and the command button. */
export const YARD_BAR_HTML: string;
/** Runs the yard's scope over markup already in place. */
export function runYard(env: YardEnv): void;
