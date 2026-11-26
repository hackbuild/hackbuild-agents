// @vitest-environment happy-dom
// Yard: the assembled scope, the markup its parts reach by id, the command palette over it, and
// mountYard's option checks and teardown with the scope stood in (the scope itself needs WebGPU
// or WebGL2 and runs in the dog simulator's browser smokes).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const Y = join(import.meta.dirname, "..", "yard");
const read = (f: string) => readFileSync(join(Y, f), "utf8");
const order = JSON.parse(read("scope.json")) as string[];
const markup = read("yard.html") + read("bar.html");
const ids = new Set([...markup.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));

const runs: Array<Record<string, unknown>> = [];
vi.mock("../src/yard/scope.js", () => ({
  YARD_CSS: ".hb-yard{}",
  YARD_HTML: '<div id="work"><section id="stage"><div id="tool"></div></section></div>',
  YARD_BAR_HTML: '<div class="hchips"><span id="chipGpu"></span></div><button id="bSetup"></button><button id="bPalette"></button>',
  runYard: (env: Record<string, unknown>) => runs.push(env),
}));

describe("yard scope", () => {
  it("lists every part once, mount last", async () => {
    const { yardSource } = (await import("../../../tools/gen-yard.mjs")) as { yardSource: () => string };
    expect(new Set(order).size).toBe(order.length);
    expect(order.at(-1)).toBe("view/mount.js");
    const src = yardSource();
    let at = 0;
    for (const f of order) {
      const i = src.indexOf(`// ---- yard/${f}\n`);
      expect(i, f).toBeGreaterThan(at);
      at = i;
    }
  });

  it("finds every literal id its parts look up", () => {
    const made = new Set<string>();
    const used = new Set<string>();
    for (const f of order) {
      const s = read(f);
      for (const m of s.matchAll(/\bid="([A-Za-z0-9]+)"/g)) made.add(m[1] as string);
      for (const m of s.matchAll(/\$\('([A-Za-z][A-Za-z0-9]*)'\)/g)) used.add(m[1] as string);
    }
    const missing = [...used].filter((id) => !ids.has(id) && !made.has(id));
    expect(missing).toEqual([]);
  });

  it("reads the page only through its host", () => {
    for (const f of order) {
      const s = read(f);
      expect(s, f).not.toMatch(/document\.(getElementById|querySelectorAll|addEventListener)\(/);
      expect(s, f).not.toMatch(/location\.hash/);
    }
  });

  it("scopes every stylesheet selector to the yard", async () => {
    const { scopeCss } = (await import("../../../tools/gen-yard.mjs")) as { scopeCss: (s: string) => string };
    expect(scopeCss("a,b>c{x:1}@media (max-width:9px){ #d{y:2} }.hb-yard{z:3}")).toBe(
      ":where(.hb-yard,.hb-yard-bar) a,:where(.hb-yard,.hb-yard-bar) b>c{x:1}@media (max-width:9px){ :where(.hb-yard,.hb-yard-bar) #d{y:2} }.hb-yard{z:3}",
    );
  });
});

// the command palette reaches every verb by an id in the yard
describe("yard palette", () => {
  const pal = read("view/palette.js");
  it("presses, flips and opens only ids in the markup", () => {
    const used = [...pal.matchAll(/(?:palPress|palFlip|palOff|palState|\$)\('([A-Za-z0-9]+)'\)|palGo\('p[A-Za-z]+', '([A-Za-z0-9]+)'\)/g)].map((m) => m[1] ?? m[2]);
    expect(used.length).toBeGreaterThan(30);
    for (const id of used) expect(ids.has(id as string), `#${id}`).toBe(true);
  });
  it("has unique keys and a command for every stage verb", () => {
    const keys = [...pal.matchAll(/\{ k: '([a-z0-9]+)'/g)].map((m) => m[1]);
    expect(new Set(keys).size).toBe(keys.length);
    const skip = new Set(["bPalette", "bMore", "bResetKeep", "bCaps", "bSeedGo", "bPhotoYes", "bPhotoNo"]);
    const verbs = [...markup.matchAll(/<button[^>]*id="(b[A-Z][A-Za-z]+)"/g)].map((m) => m[1] as string).filter((id) => !skip.has(id));
    for (const v of verbs) expect(pal.includes(`'${v}'`), `${v} has no command`).toBe(true);
  });
});

describe("mountYard", () => {
  beforeEach(() => {
    runs.length = 0;
    document.head.innerHTML = "";
    document.body.innerHTML = '<header id="bar"></header><main id="host"></main>';
  });
  const host = () => document.getElementById("host") as HTMLElement;
  const base = { physics: async () => ({ init: async () => {} }), dog: new Uint8Array([1, 2, 3]), anims: { roles: [], fps: 30, clips: {} } };

  it("needs physics and a dog", async () => {
    const { mountYard } = await import("../src/yard.js");
    await expect(mountYard(host(), { ...base, physics: undefined as never })).rejects.toThrow(/physics/);
    await expect(mountYard(host(), { ...base, dog: undefined as never })).rejects.toThrow(/dog/);
  });

  it("puts the chips in the bar, reads assets and tears down", async () => {
    const { mountYard } = await import("../src/yard.js");
    const bar = document.getElementById("bar") as HTMLElement;
    const y = await mountYard(host(), { ...base, bar, params: "cortex=stub", hub: "https://hub.example/", voice: new Uint8Array([104, 105]) });
    const env = runs[0] as Record<string, never> & { byId(id: string): HTMLElement | null; dog(): Promise<ArrayBuffer>; anims(): Promise<unknown>; on(t: string, f: () => void): void; setInterval(f: () => void, ms: number): number };
    expect(bar.classList.contains("hb-yard-bar")).toBe(true);
    expect(bar.querySelector("#chipGpu")).not.toBeNull();
    expect(env.byId("stage")?.id).toBe("stage");
    expect(env.params).toBe("cortex=stub");
    expect(env.canReseed).toBe(false);
    expect(env.hub).toBe("https://hub.example/");
    expect(env.voice).toBe("aGk=");
    expect([...new Uint8Array(await env.dog())]).toEqual([1, 2, 3]);
    expect(await env.anims()).toEqual(base.anims);
    expect(document.getElementById("hb-yard-style")).not.toBeNull();
    await expect(mountYard(host(), base)).rejects.toThrow(/mounted/);
    const key = vi.fn();
    env.on("keydown", key);
    const tick = vi.fn();
    env.setInterval(tick, 5);
    y.dispose();
    window.dispatchEvent(new KeyboardEvent("keydown"));
    await new Promise((r) => setTimeout(r, 20));
    expect(key).not.toHaveBeenCalled();
    expect(tick).not.toHaveBeenCalled();
    expect(host().children.length).toBe(0);
    expect(bar.children.length).toBe(0);
    expect(document.getElementById("hb-yard-style")).toBeNull();
  });

  it("without a bar puts setup and commands in the verb row", async () => {
    const { mountYard } = await import("../src/yard.js");
    await mountYard(host(), base);
    const env = runs[0] as { byId(id: string): HTMLElement | null };
    expect(document.querySelector("#tool #bSetup")).not.toBeNull();
    expect(document.getElementById("chipGpu")).toBeNull();
    expect(env.byId("chipGpu")).not.toBeNull();
  });
});
