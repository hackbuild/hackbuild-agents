// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { drawMap, mapInset, planBook, planLog, stepLog } from "../src/index.js";

describe("plan log", () => {
  it("keeps the last plan, steps, goals and thoughts, and draws them", () => {
    const book = planBook({ now: () => 0, max: 2 });
    expect(book.push({ type: "plan", via: "reflex", plan: { think: "the coin is far", do: [{ tool: "walk_to", args: ["coin"] }] } })).toBe(true);
    for (const ok of [true, false, true]) book.push({ type: "step", result: { ok, text: ok ? "there" : "blocked", step: { tool: "walk_to", args: ["coin"] } } });
    book.push({ type: "hint" });
    book.think("mutter", "the floor is cold");
    book.setGoals(["find the coin"]);
    const s = book.state();
    expect(s.via).toBe("rules");
    expect(s.plan).toBe("the coin is far. walk_to(coin)");
    expect(s.steps.map((x) => x.ok)).toEqual([false, true]);
    const host = document.createElement("div");
    planLog(host).update(s);
    expect(host.textContent).toContain("goal find the coin");
    expect(host.textContent).toContain("mutter the floor is cold");
    expect(host.querySelectorAll(".hb-racklog-row.is-warn").length).toBe(1);
    const steps = document.createElement("div");
    const v = stepLog(steps);
    v.update([]);
    expect(steps.querySelector(".hb-racklog.is-empty")).not.toBeNull();
  });
  it("makes a map card with one who and a map title", () => {
    const host = document.createElement("div");
    const m = { cols: 2, rows: 2, cells: [0, 1, 2, 0], half: 1, trail: [{ x: 0, z: 0 }], at: { x: 0, z: 0 } };
    const card = mapInset(host, { map: () => m });
    expect(host.dataset.ux).toBe("inset");
    expect(host.querySelector(".hb-inset-title")?.textContent).toBe("map");
    expect(host.querySelector(".hb-inset-who")).toBeNull();
    card.frame();
    expect(typeof drawMap(card.canvas, m)).toBe("string");
  });
});
