// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Chooser, CueLearner, Drives, load, seededRng } from "@hackbuild/drives";
import { FirstPerson } from "@hackbuild/cameras";
import { beforeAll, describe, expect, it } from "vitest";
import { createApp, h, nextTick, reactive, ref } from "vue";
import {
  associationsState,
  associationsTable,
  defineViews,
  drivesBars,
  drivesBarsState,
  eyeInset,
  type AssociationsTableElement,
  type DrivesBarsElement,
  type EyeInsetElement,
} from "../src/index.js";
import { AssociationsTable, DrivesBars, EyeInset } from "../src/vue.js";

const here = dirname(fileURLToPath(import.meta.url));
beforeAll(async () => {
  await load(readFileSync(join(here, "../../drives/src/wasm/drives_bg.wasm")));
});

type K = "hunger" | "play";
type B = "idle" | "eat" | "fetch";

function brain() {
  const drives = new Drives<K>({ hunger: 1, play: 1 });
  drives.set({ hunger: 0.7, play: 0.2 });
  const chooser = new Chooser<B>({ rng: seededRng(3), options: ["idle", "eat", "fetch"], start: "idle", sample: false, noise: false });
  const d = chooser.update(0, { idle: 0.1, eat: drives.rewardOf({ hunger: -0.5 }), fetch: 0.05 });
  return { drives, chooser, d };
}

describe("DrivesBars", () => {
  it("draws the behavior, a utility row per act with the choice pink, and the drives", () => {
    const { drives, d } = brain();
    const host = document.createElement("div");
    const v = drivesBars(host);
    v.update(drivesBarsState(d, drives, { seconds: 2.5, sampled: false, pink: ["play"] }));
    expect(host.querySelector(".hb-marker")?.textContent).toBe(d.current);
    expect(host.querySelectorAll(".hb-panel-hd-inst")).toHaveLength(3);
    expect(host.style.display).toBe("");
    const util = host.querySelectorAll(".hb-gauges")[0] as HTMLElement;
    expect(util.querySelectorAll(".hb-gauge")).toHaveLength(3);
    const cur = util.querySelectorAll(".hb-gauge.is-cur");
    expect(cur).toHaveLength(1);
    expect(cur[0]?.querySelector(".hb-gauge-label")?.textContent).toBe(d.current);
    expect(host.textContent).toContain("2.5 s");
    expect(host.textContent).toContain("argmax");
    const drv = host.querySelectorAll(".hb-gauges")[1] as HTMLElement;
    expect([...drv.querySelectorAll(".hb-gauge-label")].map((e) => e.textContent)).toEqual(["hunger", "play"]);
    expect((drv.querySelector(".hb-meter > i") as HTMLElement).style.width).toBe("70.0%");
    expect(drv.querySelector(".hb-gauge.is-cur .hb-gauge-label")?.textContent).toBe("play");
  });

  it("moves the bars in place when the state changes", () => {
    const { drives, d } = brain();
    const host = document.createElement("div");
    const v = drivesBars(host);
    v.update(drivesBarsState(d, drives));
    const bar = host.querySelectorAll(".hb-gauges")[1]?.querySelector(".hb-meter > i") as HTMLElement;
    drives.set({ hunger: 0.2 });
    v.update(drivesBarsState(d, drives));
    expect(host.querySelectorAll(".hb-gauges")[1]?.querySelector(".hb-meter > i")).toBe(bar);
    expect(bar.style.width).toBe("20.0%");
  });

  it("says when a switch is on its way", () => {
    const { drives, d } = brain();
    const host = document.createElement("div");
    drivesBars(host).update(drivesBarsState({ ...d, pending: { id: "fetch", at: 1.25, latency: 0.25 } }, drives, { now: 1 }));
    expect(host.textContent).toContain("next: fetch in 250 ms");
  });
});

describe("AssociationsTable", () => {
  it("draws cues by acts with attention from a CueLearner, and resets", () => {
    const learner = new CueLearner<"sit" | "spin">({ rng: seededRng(1), actions: ["sit", "spin"], noise: false });
    learner.prior("sit", "sit", 0.8);
    learner.prior("spin", "spin", 0.3);
    let resets = 0;
    const host = document.createElement("div");
    const v = associationsTable(host, { onReset: () => resets++ });
    v.update(associationsState(learner, { last: { cue: "sit", action: "sit" } }));
    const head = [...host.querySelectorAll("thead th")].map((e) => e.textContent);
    expect(head).toEqual(["cue", "sit", "spin", "attn"]);
    const rows = host.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(2);
    const sit = rows[0]?.querySelectorAll("td") as NodeListOf<HTMLElement>;
    expect(sit[0]?.textContent).toBe("79");
    expect(sit[0]?.classList.contains("is-hi")).toBe(true);
    expect(sit[0]?.getAttribute("aria-current")).toBe("true");
    expect(host.querySelector("table")?.classList.contains("is-pink")).toBe(true);
    expect(Number(sit[1]?.textContent)).toBeLessThan(10);
    expect(sit).toHaveLength(3);
    expect(host.textContent).toContain("the attn column");
    (host.querySelector("button") as HTMLButtonElement).click();
    expect(resets).toBe(1);
  });

  it("says what to do with no cues yet", () => {
    const host = document.createElement("div");
    associationsTable(host).update({ actions: ["sit"], cues: [] });
    expect(host.querySelector("tbody")?.textContent).toContain("no cues yet");
  });
});

describe("EyeInset", () => {
  it("is an inset with a who switch and a mode line, drawn inside the eye", () => {
    const head = { scale: { x: 1, y: 1, z: 1, set(x: number, y: number, z: number) { Object.assign(this, { x, y, z }); } } };
    const cam = { position: { x: 0, y: 0, z: 0, set() {} }, lookAt() {}, fov: 60, aspect: 2 };
    const eye = new FirstPerson(cam, head);
    const seen: number[] = [];
    const picked: string[] = [];
    const host = document.createElement("div");
    const v = eyeInset(host, {
      who: [{ id: "dog", label: "dog eye", eye }, { id: "his", label: "his eyes" }],
      draw: (_c, w) => {
        seen.push(head.scale.x);
        return w.id === "dog" ? "dichromat" : "human colour";
      },
      onWho: (id) => picked.push(id),
    });
    expect(host.dataset.ux).toBe("inset");
    expect(host.classList.contains("hb-inset")).toBe(true);
    expect(v.canvas.width).toBe(320);
    v.frame();
    expect(seen[0]).toBe(0.001);
    expect(head.scale.x).toBe(1);
    expect(host.querySelector(".hb-hd-aux")?.textContent).toBe("dichromat");
    const modes = host.querySelectorAll<HTMLButtonElement>(".hb-inset-hd > .hb-inset-who > button");
    expect(modes[0]?.getAttribute("aria-pressed")).toBe("true");
    modes[1]?.click();
    expect(picked).toEqual(["his"]);
    v.frame();
    expect(modes[1]?.getAttribute("aria-pressed")).toBe("true");
    expect(host.querySelector(".hb-hd-aux")?.textContent).toBe("human colour");
    modes[0]?.click();
    expect(v.who.id).toBe("dog");
  });
});

describe("custom elements", () => {
  it("defines the three and renders from properties", () => {
    defineViews();
    defineViews();
    const { drives, d } = brain();
    const bars = document.createElement("hb-drives-bars") as DrivesBarsElement;
    bars.state = drivesBarsState(d, drives);
    document.body.append(bars);
    expect(bars.querySelectorAll(".hb-gauge")).toHaveLength(5);
    const table = document.createElement("hb-associations-table") as AssociationsTableElement;
    document.body.append(table);
    table.state = { actions: ["sit"], cues: [{ cue: "sit", values: [0.5], attention: 0.6 }] };
    let reset = 0;
    table.addEventListener("reset", () => reset++);
    table.querySelector("button")?.click();
    expect(reset).toBe(1);
    expect(table.querySelectorAll("tbody td")).toHaveLength(2);
    const eye = document.createElement("hb-eye-inset") as EyeInsetElement;
    document.body.append(eye);
    eye.options = { who: [{ id: "a", label: "a" }], draw: () => "plain" };
    eye.frame();
    expect(eye.dataset.ux).toBe("inset");
    expect(eye.querySelector(".hb-hd-aux")?.textContent).toBe("plain");
  });
});

describe("vue components", () => {
  it("mount the same markup and follow their props", async () => {
    const { drives, d } = brain();
    const state = reactive({ bars: drivesBarsState(d, drives), table: { actions: ["sit"], cues: [] as { cue: string; values: number[]; attention: number }[] } });
    const resets = ref(0);
    const eyeRef = ref<{ frame(): void } | null>(null);
    const host = document.createElement("div");
    document.body.append(host);
    const app = createApp({
      render: () => [
        h(DrivesBars, { state: state.bars }),
        h(AssociationsTable, { state: state.table, onReset: () => resets.value++ }),
        h(EyeInset, { ref: eyeRef, who: [{ id: "a", label: "a" }], draw: () => "plain" }),
      ],
    });
    app.mount(host);
    expect(host.querySelectorAll(".hb-gauge")).toHaveLength(5);
    state.bars = { ...state.bars, behavior: "chase" };
    state.table.cues.push({ cue: "sit", values: [0.9], attention: 0.2 });
    await nextTick();
    expect(host.querySelector(".hb-marker")?.textContent).toBe("chase");
    expect(host.querySelectorAll("tbody td")).toHaveLength(2);
    (host.querySelector(".hb-panel .hb-btn") as HTMLButtonElement | null)?.click();
    expect(resets.value).toBe(1);
    eyeRef.value?.frame();
    expect(host.querySelector('[data-ux="inset"] .hb-hd-aux')?.textContent).toBe("plain");
    app.unmount();
  });
});
