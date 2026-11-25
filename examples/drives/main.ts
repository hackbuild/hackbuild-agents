import { Chooser, Drives, load, seededRng } from "@hackbuild/drives";
import { $, FrameTimer, auto, check, chips, chipsHtml, evlog, finish, readout, result, sleep, status, token } from "../shared/ui.js";

const r = result("drives");
$("#controls").innerHTML = `
${chipsHtml("speed", "sim speed", ["1", "4", "16"], "4")}
<button class="hb-btn" id="ball" type="button">throw the ball</button>
<button class="hb-btn hb-btn-2" id="feed" type="button">fill the bowl</button>`;
const speedIn = chips("speed");
// why the chooser switched, on the hackbuild-ui event log, newest at the foot
const log = evlog($("#readout"), "why log", "no switch yet.");
const whys: string[] = [];

status("loading the drives wasm.");
await load();

type K = "hunger" | "fatigue" | "play" | "social";
type B = "idle" | "eat" | "fetch" | "rest" | "greet";
const KEYS: K[] = ["hunger", "fatigue", "play", "social"];
// data on the void takes the hackbuild-ui lit set: --hb-lit-err, --hb-lit-info, --hb-lit-warn, --hb-slime, --hb-lit-label
const LIT = { err: token("--hb-lit-err", "#ff5c4d"), info: token("--hb-lit-info", "#58a6ff"), warn: token("--hb-lit-warn", "#ffb020"), ok: token("--hb-slime", "#a6e22e"), label: token("--hb-lit-label", "#9a9184") };
const VOID = token("--hb-void", "#0a0a0a");
const INK = token("--hb-paper", "#f5f0e6");
const COLORS: Record<K, string> = { hunger: LIT.err, fatigue: LIT.info, play: LIT.warn, social: LIT.ok };
const ACT_COLOR: Record<B, string> = { idle: LIT.label, eat: LIT.err, fetch: LIT.warn, rest: LIT.info, greet: LIT.ok };
// what each act does to the drives per second while it runs, and how long it runs (inferred starting values)
const EFFECT: Record<B, Partial<Record<K, number>>> = { idle: {}, eat: { hunger: -0.5 }, fetch: { play: -0.4, fatigue: 0.05 }, rest: { fatigue: -0.25 }, greet: { social: -0.3 } };
const LENGTH: Record<B, number> = { idle: 3, eat: 4, fetch: 6, rest: 10, greet: 3 };
const GROW: Partial<Record<K, number>> = { hunger: 0.008, fatigue: 0.006, play: 0.012, social: 0.01 };

const drives = new Drives<K>({ hunger: 1, fatigue: 1, play: 0.8, social: 0.9 });
drives.set({ hunger: 0.3, fatigue: 0.2, play: 0.5, social: 0.4 });
const choose = new Chooser<B>({ rng: seededRng(42), options: ["idle", "eat", "fetch", "rest", "greet"], start: "idle" });

const canvas = document.createElement("canvas");
$("#stage").classList.add("hb-stage-void");
$("#stage").append(canvas);
const ctx = canvas.getContext("2d")!;
const history: { t: number; v: Record<K, number>; act: B }[] = [];
let simT = 0;
let actStart = 0;
let ballUntil = -1;
let bowlFull = true;
const counts: Record<B, number> = { idle: 0, eat: 0, fetch: 0, rest: 0, greet: 0 };
let decisions = 0;
let switches = 0;
let bounded = true;
const timer = new FrameTimer();
const choiceMs: number[] = [];
let prev = performance.now();
$("#ball").addEventListener("click", () => (ballUntil = simT + 4));
$("#feed").addEventListener("click", () => (bowlFull = true));
status("drives grow; the chooser picks an act by drive reduction and says why.", "ok");

function utilities(): Partial<Record<B, number>> {
  return {
    idle: 0.12,
    eat: bowlFull ? drives.rewardOf({ hunger: -0.5 }) : 0,
    fetch: drives.rewardOf({ play: -0.4, fatigue: 0.05 }) + (simT < ballUntil ? 0.4 : 0),
    rest: drives.rewardOf({ fatigue: -0.25 }),
    greet: drives.rewardOf({ social: -0.3 }, 0.35),
  };
}

function step(dt: number) {
  simT += dt;
  const act = choose.current;
  const rates: Partial<Record<K, number>> = { ...GROW };
  for (const [k, v] of Object.entries(EFFECT[act]) as [K, number][]) rates[k] = (rates[k] ?? 0) + v;
  drives.grow(dt, rates);
  // keep levels inside 0 to 1 the way a sim clamps them
  const v = drives.values;
  const clamped: Partial<Record<K, number>> = {};
  for (const k of KEYS) clamped[k] = Math.min(1, Math.max(0, v[k]));
  drives.set(clamped);
  if (!choose.done && simT - actStart > LENGTH[act]) {
    choose.markDone();
    if (act === "eat") bowlFull = false;
  }
  const t0 = performance.now();
  const d = choose.update(simT, utilities(), simT < ballUntil ? ["fetch"] : []);
  choiceMs.push(performance.now() - t0);
  if (choiceMs.length > 2000) choiceMs.shift();
  decisions++;
  if (d.switched) {
    switches++;
    counts[d.current]++;
    actStart = simT;
    log.push(d.reason === "reactive" ? "react" : "switch", d.why, `${simT.toFixed(1)} s`);
    whys.push(d.why);
  }
  const now = drives.values;
  for (const k of KEYS) if (!(now[k] >= -1e-9 && now[k] <= 1 + 1e-9)) bounded = false;
  history.push({ t: simT, v: now, act: choose.current });
  while (history.length && history[0]!.t < simT - 120) history.shift();
}

function draw() {
  // drawn at the device pixel ratio capped at 2, resized every frame, so a rotation never stretches it
  const dpr = Math.min(devicePixelRatio, 2);
  const w = (canvas.width = Math.round(canvas.clientWidth * dpr));
  const h = (canvas.height = Math.round(canvas.clientHeight * dpr));
  ctx.fillStyle = VOID;
  ctx.fillRect(0, 0, w, h);
  const x = (t: number) => ((t - (simT - 120)) / 120) * w;
  const band = 18 * dpr;
  for (let i = 1; i < history.length; i++) {
    ctx.fillStyle = ACT_COLOR[history[i]!.act];
    ctx.fillRect(x(history[i - 1]!.t), h - band, x(history[i]!.t) - x(history[i - 1]!.t) + 1, band);
  }
  ctx.lineWidth = 2 * dpr;
  for (const k of KEYS) {
    ctx.strokeStyle = COLORS[k];
    ctx.beginPath();
    history.forEach((p, i) => {
      const y = (h - band - 8) * (1 - p.v[k]) + 4;
      if (i) ctx.lineTo(x(p.t), y);
      else ctx.moveTo(x(p.t), y);
    });
    ctx.stroke();
  }
  ctx.font = `${16 * dpr}px VT323, ui-monospace, monospace`;
  KEYS.forEach((k, i) => {
    ctx.fillStyle = COLORS[k];
    ctx.fillText(k, 10 * dpr, (18 + i * 16) * dpr);
  });
  ctx.fillStyle = INK;
  ctx.fillText(`last 120 sim s; band is the current act: ${choose.current}`, 90 * dpr, 18 * dpr);
}

function frame(now: number) {
  timer.tick(now);
  const dt = Math.min(0.05, Math.max(0, (now - prev) / 1000)) * Number(speedIn.value);
  prev = now;
  timer.time(() => {
    // fixed sim steps of 1/30 s so the choice stream does not depend on the frame rate
    let left = dt;
    while (left > 1e-9) {
      const s = Math.min(1 / 30, left);
      step(s);
      left -= s;
    }
    draw();
  });
  if (Math.floor(now / 250) !== Math.floor((now - 17) / 250)) {
    const v = drives.values;
    const st = timer.stats();
    readout({
      ...Object.fromEntries(KEYS.map((k) => [`${k} (computed)`, v[k]])),
      act: choose.current,
      "sim seconds (computed)": simT,
      bowl: bowlFull ? "full" : "empty",
      "fps p50 (measured)": st.fpsP50,
      "frame work ms p95 (measured)": st.workMsP95,
    });
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

if (auto) {
  speedIn.value = "16";
  await sleep(500);
  timer.reset();
  const t0 = performance.now();
  // refill the bowl and throw the ball now and then, as a person would
  while (performance.now() - t0 < 20_000) {
    await sleep(2000);
    bowlFull = true;
    if (Math.floor((performance.now() - t0) / 5000) % 2 === 0) ballUntil = simT + 4;
  }
  const s = [...choiceMs].sort((a, b) => a - b);
  const q = (p: number) => Math.round((s[Math.floor(p * (s.length - 1))] ?? Number.NaN) * 1000) / 1000;
  Object.assign(r.numbers, timer.numbers(), {
    "sim seconds (computed)": Math.round(simT),
    "decisions (measured)": decisions,
    "switches (measured)": switches,
    "choice update ms p50 (measured)": q(0.5),
    "choice update ms p95 (measured)": q(0.95),
    ...Object.fromEntries(Object.entries(counts).map(([k, n]) => [`times chose ${k} (measured)`, n])),
  });
  const used = Object.values(counts).filter((n) => n > 0).length;
  const why = whys.length > 0 && whys.every((w) => /^\w+: /.test(w));
  const ok = used >= 4 && bounded && why && r.notes.length === 0;
  check(r, "drives: an animal driven by drives and the chooser in a running page", ok ? "pass" : "fail", `${used} of 5 acts chosen over ${Math.round(simT)} sim s, ${switches} switches, every switch logged a why (measured)`);
  check(r, "drives: a person reads the why log against the drive plot", "not run", "needs the owner to look; screenshot in .local/shots/drives.png");
  finish(r, ok ? "pass" : "fail");
}
