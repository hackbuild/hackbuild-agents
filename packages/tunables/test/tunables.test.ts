import fc from "fast-check";
import { Window } from "happy-dom";
import { describe, expect, it } from "vitest";
import { bindPanel } from "../src/dom.js";
import { createRegistry, decimalsFor, type Registry } from "../src/index.js";

// a cut of the HACKLE registry: the master layer, two layers, three numbers
function hackle(storage?: Map<string, string>): Registry {
  const o: Parameters<typeof createRegistry>[0] = { master: "L.organic", version: 2, renames: { "Br.temperature": "Br.temp" } };
  if (storage) o.storage = { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => void storage.set(k, v) };
  const r = createRegistry(o);
  r.defineLayer("L.organic", "organic (off is the old canned build)");
  r.defineLayer("L.plume", "sniffing in a turbulent plume");
  r.defineLayer("L.sample", "sampled choice with commitment");
  r.define({ key: "Br.temp", group: "brain", label: "choice temperature", def: 0.06, min: 0.005, max: 0.3, step: 0.005, source: "inferred" });
  r.define({ key: "Se.fix", group: "senses", label: "fixation median s", def: 0.83, min: 0.2, max: 2, step: 0.01, source: "measured", cite: "Barber 2016" });
  r.define({ key: "P.age", group: "personality", label: "age in months", def: 30, min: 2, max: 160, step: 1 });
  r.definePreset("puppy", { label: "Puppy", values: { "P.age": 4 } });
  return r;
}

describe("registry", () => {
  it("defines, reads, clamps and rejects unknown keys", () => {
    const r = hackle();
    expect(r.get("Br.temp")).toBe(0.06);
    r.set("Br.temp", 9);
    expect(r.get("Br.temp")).toBe(0.3);
    expect(() => r.get("nope")).toThrow(/no parameter/);
    expect(() => r.set("nope", 1)).toThrow(/no parameter/);
    expect(() => r.define({ key: "Br.temp", group: "g", label: "x", def: 0, min: 0, max: 1, step: 1 })).toThrow(/twice/);
    expect(() => r.define({ key: "bad", group: "g", label: "x", def: 2, min: 0, max: 1, step: 1 })).toThrow(/outside/);
  });

  it("gates every layer behind the master switch", () => {
    const r = hackle();
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
    expect(hackle().groups().map((g) => g.group)).toEqual(["layers", "brain", "senses", "personality"]);
  });

  it("writes only changed values to the URL hash and reads them back", () => {
    const r = hackle();
    expect(r.toUrlHash()).toBe("");
    r.set("Br.temp", 0.125);
    r.set("L.plume", 0);
    const h = r.toUrlHash();
    expect(h).toBe("tune=2|L.plume:0|Br.temp:0.125");
    const q = hackle();
    expect(q.fromUrlHash(`#test&seed=3&${encodeURIComponent(h)}`)).toEqual([]);
    expect(q.snapshot()).toEqual(r.snapshot());
  });

  it("reports unknown and malformed hash entries", () => {
    const r = hackle();
    expect(r.fromUrlHash("tune=1|Gone.key:1|Br.temp:x|Se.fix:1.5")).toEqual(["Br.temp:x", "Gone.key"]);
    expect(r.get("Se.fix")).toBe(1.5);
  });

  it("applies renames from older saves and accepts the bare HACKLE export", () => {
    const r = hackle();
    expect(r.fromJSON({ version: 1, values: { "Br.temperature": 0.1 } })).toEqual([]);
    expect(r.get("Br.temp")).toBe(0.1);
    expect(r.fromJSON({ "P.age": 12, "L.day": 1 })).toEqual(["L.day"]);
    expect(r.get("P.age")).toBe(12);
  });

  it("persists to storage and restores", () => {
    const store = new Map<string, string>();
    const a = hackle(store);
    a.set("Se.fix", 1.2);
    const b = hackle(store);
    expect(b.get("Se.fix")).toBe(0.83);
    b.restore();
    expect(b.get("Se.fix")).toBe(1.2);
    expect(JSON.parse(store.get("tunables") ?? "{}").version).toBe(2);
  });

  it("applies presets, resets, notifies and unsubscribes", () => {
    const r = hackle();
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
    const r = hackle();
    r.set("Br.temp", 0.2);
    const { on, off } = r.abPair("L.sample");
    const diff = Object.keys(on).filter((k) => on[k] !== off[k]);
    expect(diff).toEqual(["L.sample"]);
    expect(on["Br.temp"]).toBe(0.2);
  });

  it("round trips any in range values through the hash (property)", () => {
    fc.assert(
      fc.property(fc.double({ min: 0.005, max: 0.3, noNaN: true }), fc.integer({ min: 2, max: 160 }), fc.boolean(), (t, age, plume) => {
        const a = hackle();
        a.set("Br.temp", t);
        a.set("P.age", age);
        a.set("L.plume", plume ? 1 : 0);
        const b = hackle();
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
    const r = hackle();
    const loc = { hash: "#test&seed=3" };
    const p = bindPanel(host, r, { document: doc, syncHash: true, location: loc, groupLabels: { brain: "CHOICE" } });
    const rows = host.querySelectorAll("[data-key]");
    expect(rows.length).toBe(12); // 6 rows, 6 inputs
    expect(host.querySelector('[data-group="brain"] .tn-title')?.textContent).toBe("choice");
    expect(host.querySelector('[data-key="Se.fix"] .tn-source')?.textContent).toBe("measured");
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
    // labels are text, never markup
    r.define({ key: "x", group: "g", label: "<b>x</b>", def: 0, min: 0, max: 1, step: 1 });
    const p2 = bindPanel(host, r, { document: doc });
    expect(p2.root.querySelector("b")).toBeNull();
    p.dispose();
    p2.dispose();
    expect(host.children.length).toBe(0);
  });
});
