import fc from "fast-check";
import { Window } from "happy-dom";
import { describe, expect, it } from "vitest";
import { bindPanel } from "../src/dom.js";
import { createRegistry, decimalsFor, type Registry } from "../src/index.js";

// a cut of the legacy registry: the master layer, two layers, three numbers
function legacyRegistry(storage?: Map<string, string>): Registry {
  // version 0 is the bare legacy export: from it only the personality is safe to keep
  const o: Parameters<typeof createRegistry>[0] = {
    master: "L.organic",
    version: 2,
    renames: { "Br.temperature": "Br.temp" },
    migrate: { 0: (v) => Object.fromEntries(Object.entries(v).filter(([k]) => k.startsWith("P."))) },
  };
  if (storage) o.storage = { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => void storage.set(k, v) };
  const r = createRegistry(o);
  r.defineLayer("L.organic", "organic (off is the old canned build)");
  r.defineLayer("L.plume", "sniffing in a turbulent plume");
  r.defineLayer("L.sample", "sampled choice with commitment");
  r.define({ key: "Br.temp", group: "brain", label: "choice temperature", def: 0.06, min: 0.005, max: 0.3, step: 0.005, source: "inferred" });
  r.define({ key: "Se.fix", group: "senses", label: "fixation median", unit: "s", def: 0.83, min: 0.2, max: 2, step: 0.01, source: "measured", cite: "Barber 2016" });
  r.define({ key: "P.age", group: "personality", label: "age in months", def: 30, min: 2, max: 160, step: 1 });
  r.definePreset("puppy", { label: "Puppy", values: { "P.age": 4 } });
  return r;
}

describe("registry", () => {
  it("defines, reads, clamps and rejects unknown keys", () => {
    const r = legacyRegistry();
    expect(r.get("Br.temp")).toBe(0.06);
    r.set("Br.temp", 9);
    expect(r.get("Br.temp")).toBe(0.3);
    expect(() => r.get("nope")).toThrow(/no parameter/);
    expect(() => r.set("nope", 1)).toThrow(/no parameter/);
    expect(() => r.define({ key: "Br.temp", group: "g", label: "x", def: 0, min: 0, max: 1, step: 1 })).toThrow(/twice/);
    expect(() => r.define({ key: "bad", group: "g", label: "x", def: 2, min: 0, max: 1, step: 1 })).toThrow(/outside/);
  });

  it("gates every layer behind the master switch", () => {
    const r = legacyRegistry();
    expect(r.layer("L.plume")).toBe(true);
    r.set("L.plume", 0);
    expect(r.layer("L.plume")).toBe(false);
    r.set("L.plume", 1);
    r.set("L.organic", 0);
    expect(r.layer("L.plume")).toBe(false);
    expect(r.layer("L.organic")).toBe(false);
    expect(r.layers()).toEqual(["L.organic", "L.plume", "L.sample"]);
  });

  it("keeps groups in definition order", () => {
    expect(legacyRegistry().groups().map((g) => g.group)).toEqual(["layers", "brain", "senses", "personality"]);
  });

  it("writes only changed values to the URL hash and reads them back", () => {
    const r = legacyRegistry();
    expect(r.toUrlHash()).toBe("");
    r.set("Br.temp", 0.125);
    r.set("L.plume", 0);
    const h = r.toUrlHash();
    expect(h).toBe("tune=2|L.plume:0|Br.temp:0.125");
    const q = legacyRegistry();
    expect(q.fromUrlHash(`#test&seed=3&${encodeURIComponent(h)}`)).toEqual([]);
    expect(q.snapshot()).toEqual(r.snapshot());
  });

  it("reports unknown and malformed hash entries", () => {
    const r = legacyRegistry();
    expect(r.fromUrlHash("tune=1|Gone.key:1|Br.temp:x|Se.fix:1.5")).toEqual(["Br.temp:x", "Gone.key"]);
    expect(r.get("Se.fix")).toBe(1.5);
  });

  it("applies renames within the current version", () => {
    const r = legacyRegistry();
    expect(r.fromJSON({ ver: 2, d: { "Br.temperature": 0.1 } })).toEqual([]);
    expect(r.get("Br.temp")).toBe(0.1);
  });

  it("migrates the bare legacy export explicitly and keeps only the personality", () => {
    const r = legacyRegistry();
    // the first legacy format saved every value, defaults included
    expect(r.fromJSON({ "P.age": 12, "Br.temp": 0.06, "Se.fix": 1.9, "L.day": 1 }).sort()).toEqual(["Br.temp", "L.day", "Se.fix"]);
    expect(r.get("P.age")).toBe(12);
    expect(r.get("Se.fix")).toBe(0.83);
  });

  it("keeps nothing from a version with no migration", () => {
    const r = legacyRegistry();
    expect(r.fromJSON({ ver: 1, d: { "Se.fix": 1.5, "P.age": 9 } })).toEqual(["Se.fix", "P.age"]);
    expect(r.snapshot()).toEqual(legacyRegistry().snapshot());
  });

  it("saves only values that differ from defaults, so new defaults reach old sessions", () => {
    const store = new Map<string, string>();
    const a = legacyRegistry(store);
    a.set("Se.fix", 1.2);
    a.set("Br.temp", 0.06);
    expect(JSON.parse(store.get("tunables") ?? "{}")).toEqual({ ver: 2, d: { "Se.fix": 1.2 } });
    // a later build with a new default for Br.temp still gets the new default
    const b = createRegistry({ storage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v) }, version: 2 });
    b.define({ key: "Br.temp", group: "brain", label: "t", def: 0.09, min: 0, max: 1, step: 0.01 });
    b.define({ key: "Se.fix", group: "senses", label: "f", def: 0.83, min: 0.2, max: 2, step: 0.01 });
    b.restore();
    expect([b.get("Br.temp"), b.get("Se.fix")]).toEqual([0.09, 1.2]);
  });

  it("persists to storage and restores", () => {
    const store = new Map<string, string>();
    const a = legacyRegistry(store);
    a.set("Se.fix", 1.2);
    const b = legacyRegistry(store);
    expect(b.get("Se.fix")).toBe(0.83);
    b.restore();
    expect(b.get("Se.fix")).toBe(1.2);
    expect(JSON.parse(store.get("tunables") ?? "{}").ver).toBe(2);
  });

  it("applies presets, resets, notifies and unsubscribes", () => {
    const r = legacyRegistry();
    const seen: [string, number][] = [];
    const off = r.onChange((k, v) => seen.push([k, v]));
    r.applyPreset("puppy");
    r.set("P.age", 4); // unchanged, no event
    r.reset();
    off();
    r.set("P.age", 50);
    expect(seen).toEqual([
      ["P.age", 4],
      ["P.age", 30],
    ]);
    expect(r.presets()).toEqual([{ name: "puppy", label: "Puppy" }]);
  });

  it("returns an A/B pair that differs in one layer only", () => {
    const r = legacyRegistry();
    r.set("Br.temp", 0.2);
    const { on, off } = r.abPair("L.sample");
    const diff = Object.keys(on).filter((k) => on[k] !== off[k]);
    expect(diff).toEqual(["L.sample"]);
    expect(on["Br.temp"]).toBe(0.2);
  });

  it("round trips any in range values through the hash (property)", () => {
    fc.assert(
      fc.property(fc.double({ min: 0.005, max: 0.3, noNaN: true }), fc.integer({ min: 2, max: 160 }), fc.boolean(), (t, age, plume) => {
        const a = legacyRegistry();
        a.set("Br.temp", t);
        a.set("P.age", age);
        a.set("L.plume", plume ? 1 : 0);
        const b = legacyRegistry();
        b.fromUrlHash(a.toUrlHash());
        expect(b.snapshot()).toEqual(a.snapshot());
      }),
    );
  });

  it("formats with decimals that fit the step", () => {
    expect([decimalsFor(1), decimalsFor(0.1), decimalsFor(0.01), decimalsFor(0.005)]).toEqual([0, 2, 2, 3]);
  });
});

describe("panel", () => {
  it("builds rows, follows the registry both ways and syncs the hash", () => {
    const win = new Window();
    const doc = win.document as unknown as Document;
    const host = doc.createElement("div");
    doc.body.append(host);
    const r = legacyRegistry();
    const loc = { hash: "#test&seed=3" };
    let exported = "";
    const p = bindPanel(host, r, { document: doc, syncHash: true, location: loc, groupLabels: { brain: "CHOICE" }, onExport: (t) => (exported = t) });
    const rows = host.querySelectorAll("[data-key]");
    expect(rows.length).toBe(12); // 6 rows, 6 inputs
    expect(host.querySelector('[data-group="brain"] .tn-title')?.textContent).toBe("choice");
    expect(host.querySelector('[data-key="Se.fix"] .tn-source')?.textContent).toBe("measured");
    expect(host.querySelector('[data-key="Se.fix"] .tn-unit')?.textContent).toBe("s");
    const range = host.querySelector('input[data-key="Br.temp"]') as HTMLInputElement;
    range.value = "0.1";
    range.dispatchEvent(new win.Event("input") as unknown as Event);
    expect(r.get("Br.temp")).toBe(0.1);
    expect(loc.hash).toBe("test&seed=3&tune=2|Br.temp:0.1");
    r.set("L.plume", 0);
    expect((host.querySelector('input[data-key="L.plume"]') as HTMLInputElement).checked).toBe(false);
    expect(host.querySelector('[data-key="Br.temp"] .tn-value')?.textContent).toBe("0.100");
    (host.querySelector('[data-preset="puppy"]') as HTMLButtonElement).click();
    expect((host.querySelector('input[data-key="P.age"]') as HTMLInputElement).value).toBe("4");
    (host.querySelector('[data-reset="P.age"]') as HTMLButtonElement).click();
    expect(r.get("P.age")).toBe(30);
    (host.querySelector(".tn-export") as HTMLButtonElement).click();
    expect(JSON.parse(exported)).toEqual({ ver: 2, d: { "Br.temp": 0.1, "L.plume": 0 } });
    // labels are text, never markup
    r.define({ key: "x", group: "g", label: "<b>x</b>", def: 0, min: 0, max: 1, step: 1 });
    const p2 = bindPanel(host, r, { document: doc });
    expect(p2.root.querySelector("b")).toBeNull();
    p.dispose();
    p2.dispose();
    expect(host.children.length).toBe(0);
  });
});
