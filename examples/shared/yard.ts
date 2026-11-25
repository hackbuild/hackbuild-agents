// The yard of the agents-views pages: hackle's stage and rack. A creature
// with drives, a chooser and a cue learner walks a yard built in code; a
// scripted day from @hackbuild/scenario throws the ball, fills the bowl and
// teaches words, so the bars move with nobody at the keys. No weights.
import { associationsState, associationsTable, drivesBars, drivesBarsState, eyeInset, type EyeWho } from "@hackbuild/agents-views";
import { FirstPerson } from "@hackbuild/cameras";
import { Chooser, CueLearner, type Decision, Drives, load, seededRng } from "@hackbuild/drives";
import { runScenario, type Scenario, type Sim } from "@hackbuild/scenario/browser";
import { stageRack } from "@virgilvox/hackbuild-ui/vanilla";
import * as THREE from "three";
import { auto, check, finish, result } from "./ui.js";

type K = "hunger" | "fatigue" | "play" | "social" | "curiosity";
type B = "idle" | "explore" | "fetch" | "eat" | "rest" | "greet" | "obey";
type A = "sit" | "down" | "paw" | "come" | "spin";
const BEH: B[] = ["idle", "explore", "fetch", "eat", "rest", "greet", "obey"];
const ACTS: A[] = ["sit", "down", "paw", "come", "spin"];
const WHY: Record<B, string> = {
  idle: "standing around",
  explore: "something new to sniff",
  fetch: "the ball is out",
  eat: "hungry, and the bowl is full",
  rest: "tired, off to the kennel",
  greet: "wants company",
  obey: "heard a word",
};
// what each act does to the drives per second while it runs (inferred starting values)
const EFFECT: Record<B, Partial<Record<K, number>>> = {
  idle: {},
  explore: { curiosity: -0.08 },
  fetch: { play: -0.07, fatigue: 0.01 },
  eat: { hunger: -0.15 },
  rest: { fatigue: -0.06 },
  greet: { social: -0.1 },
  obey: {},
};
const GROW: Record<K, number> = { hunger: 0.006, fatigue: 0.004, play: 0.01, social: 0.008, curiosity: 0.012 };
const SPS = 60;

export interface YardPage {
  page: "drives-bars" | "associations-table" | "eye-inset";
  /** the rack tab that opens first, the page's view */
  first: "brain" | "train";
  /** the eye card on the stage */
  inset: boolean;
}

function make<K2 extends keyof HTMLElementTagNameMap>(tag: K2, cls = "", text?: string): HTMLElementTagNameMap[K2] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Rebuilds the page as stage and rack: the bar, the stage with its verbs, the 380 px rack. */
function shell(o: YardPage) {
  const header = document.querySelector<HTMLElement>("header.hb-header");
  const folds = [...document.querySelectorAll<HTMLElement>(".hb-how")];
  const root = make("div", "hb-lay hb is-stage-rack");
  root.dataset.layout = "stage-rack";
  const bar = make("div", "hb-lay-bar");
  if (header) bar.append(header);
  const body = make("div", "hb-lay-body");
  const stage = make("section", "hb-lay-stage");
  const subject = make("div", "hb-lay-subject");
  subject.setAttribute("aria-label", "the yard");
  stage.append(subject);
  const inset = o.inset ? make("div", "hb-lay-inset") : null;
  if (inset) stage.append(inset);
  const verbs = make("div", "hb-lay-verbs");
  verbs.setAttribute("role", "toolbar");
  verbs.setAttribute("aria-label", "yard");
  stage.append(verbs);
  const rack = make("aside", "hb-rack");
  rack.setAttribute("aria-label", "the dog");
  const strip = make("nav", "hb-tabs");
  strip.setAttribute("role", "tablist");
  strip.setAttribute("aria-label", "the dog tabs");
  const order = o.first === "brain" ? ["brain", "train", "how"] : ["train", "brain", "how"];
  const panes: Record<string, HTMLElement> = {};
  rack.append(strip);
  for (const id of order) {
    const t = make("button", "hb-tab", id);
    t.type = "button";
    t.id = `rack-${id}-t`;
    t.dataset.value = id;
    t.setAttribute("role", "tab");
    t.setAttribute("aria-controls", `rack-${id}`);
    t.setAttribute("aria-selected", String(id === order[0]));
    strip.append(t);
    const p = make("section", "hb-rack-pane");
    p.id = `rack-${id}`;
    p.setAttribute("role", "tabpanel");
    p.setAttribute("aria-labelledby", t.id);
    p.hidden = id !== order[0];
    rack.append(p);
    panes[id] = p;
  }
  (panes.how as HTMLElement).append(...folds);
  body.append(stage, rack);
  root.append(bar, body);
  document.body.replaceChildren(root);
  stageRack(root);
  return { subject, verbs, inset, brain: panes.brain as HTMLElement, train: panes.train as HTMLElement };
}

function verb(host: HTMLElement, label: string, go: boolean, fn: () => void): HTMLButtonElement {
  const b = make("button", go ? "hb-btn hb-btn-go" : "hb-btn", label);
  b.type = "button";
  b.addEventListener("click", fn);
  host.append(b);
  return b;
}

const mat = (c: number) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 });

export async function yard(o: YardPage): Promise<void> {
  const r = result(o.page);
  const ui = shell(o);
  await load();

  // the brain
  const rng = seededRng(7);
  const drives = new Drives<K>({ hunger: 1, fatigue: 0.9, play: 0.8, social: 0.9, curiosity: 0.6 });
  drives.set({ hunger: 0.35, fatigue: 0.2, play: 0.45, social: 0.3, curiosity: 0.5 });
  const chooser = new Chooser<B>({ rng, options: BEH, start: "idle" });
  let learner = new CueLearner<A>({ rng: seededRng(11), actions: ACTS });
  const priors = () => {
    learner.prior("sit", "sit", 0.55);
    learner.prior("down", "down", 0.3);
    learner.prior("come", "come", 0.45);
  };
  priors();

  // the yard, built in code
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  ui.subject.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xeef2ef);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb0aca0, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(3, 6, 2);
  scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), mat(0xdfe8d8));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground, new THREE.GridHelper(16, 16, 0xb8c4b0, 0xcfd8c8));
  const kennel = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 1), mat(0xfffdf7));
  kennel.position.set(4, 0.45, -3.5);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.95, 0.6, 4), mat(0x1a1a1a));
  roof.position.set(4, 1.2, -3.5);
  roof.rotation.y = Math.PI / 4;
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.12, 20), mat(0x1a1a1a));
  bowl.position.set(3.5, 0.06, 3);
  const food = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.04, 20), mat(0xb5733a));
  food.position.set(3.5, 0.12, 3);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 12), mat(0xfe0386));
  ball.position.set(-2.4, 0.11, -1.6);
  scene.add(kennel, roof, bowl, food, ball);
  // a fence round the yard and two trees, so each eye has something to see
  for (const [x, z, sx, sz] of [[0, -8, 16, 0.08], [0, 8, 16, 0.08], [-8, 0, 0.08, 16], [8, 0, 0.08, 16]] as const) {
    const fence = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.7, sz), mat(0xc8b48e));
    fence.position.set(x, 0.35, z);
    scene.add(fence);
  }
  for (const [x, z] of [[-5, 5], [5.5, 6]] as const) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 1.2), mat(0x6b4f35));
    trunk.position.set(x, 0.6, z);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2, 10), mat(0x4f7a45));
    crown.position.set(x, 2.1, z);
    scene.add(trunk, crown);
  }
  // the dog faces +Z at yaw 0; the head is its own node so the eye can hide it
  const dog = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.5, 6, 16), mat(0xc9a27a));
  torso.rotation.x = Math.PI / 2;
  torso.position.y = 0.42;
  const head = new THREE.Group();
  head.position.set(0, 0.58, 0.38);
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.26), mat(0xb48a62));
  head.add(skull);
  for (const [x, z] of [[-0.1, 0.22], [0.1, 0.22], [-0.1, -0.22], [0.1, -0.22]] as const) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.34), mat(0x8c6a4a));
    leg.position.set(x, 0.17, z);
    dog.add(leg);
  }
  dog.add(torso, head);
  scene.add(dog);
  const person = new THREE.Group();
  const coat = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 1.05, 6, 16), mat(0x1a1a1a));
  coat.position.y = 0.75;
  const pHead = new THREE.Group();
  pHead.position.y = 1.62;
  pHead.add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 12), mat(0xd9b99b)));
  person.add(coat, pHead);
  person.position.set(-3, 0, -2);
  scene.add(person);
  const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.05, 80);
  camera.position.set(0, 7.5, 9.5);
  camera.lookAt(0, 0, 0);

  // the world state the scenario and the verbs act on
  const w = {
    t: 0,
    pos: new THREE.Vector2(0, 0),
    yaw: 0,
    ball: { state: "rest" as "rest" | "free" | "held", at: new THREE.Vector2(-2.4, -1.6), thrownAt: -1 },
    bowlFull: true,
    since: 0,
    cmd: null as { action: A; cue: string; until: number } | null,
    cueHeard: null as string | null,
    wander: new THREE.Vector2(1, 1),
    phase: 0,
    decision: null as Decision<B> | null,
    last: null as { cue: string; action: string } | null,
    trial: "",
    rows: [] as unknown[][],
  };
  const personAt = () => new THREE.Vector2(person.position.x, person.position.z);
  const api = {
    throwBall() {
      const a = rng() * Math.PI * 2;
      w.ball.at.set(Math.cos(a) * 4.5, Math.sin(a) * 3.5);
      w.ball.state = "free";
      w.ball.thrownAt = w.t;
    },
    fillBowl() {
      w.bowlFull = true;
    },
    say(cue: string) {
      w.cueHeard = cue;
      const res = learner.respond(cue, w.t, { watched: true });
      if (res.kind === "act") w.cmd = { action: res.action, cue, until: w.t + 2.5 + res.latency };
      w.trial = res.kind === "act" ? `"${cue}": it does ${res.action}${res.offered ? ", offered" : ""}` : `"${cue}": ${res.kind === "ignored" ? "ignored" : "nothing yet"}`;
    },
    goodDog(amount = 1) {
      const got = learner.reward(amount, w.t, 0.5);
      drives.set({ social: Math.max(0, drives.values.social - 0.1) });
      if (got) {
        w.last = got.cue ? { cue: got.cue, action: got.action } : null;
        w.trial = `${got.cue ?? "no cue"} then ${got.action}, credit ${got.credit.toFixed(2)}`;
      }
    },
    treat() {
      drives.set({ hunger: Math.max(0, drives.values.hunger - 0.08) });
      api.goodDog(1.2);
    },
    reset() {
      learner.free();
      learner = new CueLearner<A>({ rng: seededRng(11), actions: ACTS });
      priors();
      w.last = null;
      w.trial = "every word forgotten";
    },
  };

  function target(b: B): THREE.Vector2 | null {
    if (b === "fetch") return w.ball.state === "free" ? w.ball.at : personAt().add(new THREE.Vector2(0.7, 0.5));
    if (b === "eat") return new THREE.Vector2(3.5, 2.6);
    if (b === "rest") return new THREE.Vector2(4, -2.7);
    if (b === "greet") return personAt().add(new THREE.Vector2(0.8, 0.4));
    if (b === "explore") return w.wander;
    return null;
  }

  function tick(dt: number) {
    w.t += dt;
    const act = chooser.current;
    const rates: Partial<Record<K, number>> = { ...GROW };
    for (const [k, v] of Object.entries(EFFECT[act]) as [K, number][]) rates[k] = (rates[k] ?? 0) + v;
    drives.grow(dt, rates);
    const v = drives.values;
    drives.set(Object.fromEntries((Object.keys(v) as K[]).map((k) => [k, Math.min(1, Math.max(0, v[k]))])) as Record<K, number>);
    learner.decay(dt);
    if (w.cmd && w.t > w.cmd.until) {
      learner.markDone(w.cmd.action, w.t);
      w.cmd = null;
      chooser.markDone();
    }
    // move toward the act's target
    const goal = target(act);
    let arrived = false;
    if (goal) {
      const d = goal.clone().sub(w.pos);
      const dist = d.length();
      const speed = act === "fetch" ? 3 : 1.4;
      if (dist > 0.08) {
        w.yaw = Math.atan2(d.x, d.y);
        w.pos.add(d.multiplyScalar(Math.min(1, (speed * dt) / dist)));
      } else arrived = true;
    }
    const inAct = w.t - w.since;
    if (act === "fetch" && arrived) {
      if (w.ball.state === "free") w.ball.state = "held";
      else if (w.ball.state === "held") {
        w.ball.state = "rest";
        w.ball.at.copy(personAt().add(new THREE.Vector2(0.5, 0.4)));
        chooser.markDone();
      }
    }
    if (act === "eat" && arrived && inAct > 4) {
      w.bowlFull = false;
      chooser.markDone();
    }
    if (act === "rest" && arrived && inAct > 9) chooser.markDone();
    if (act === "greet" && arrived && inAct > 3) chooser.markDone();
    if (act === "explore" && arrived) {
      w.wander.set((rng() - 0.5) * 9, (rng() - 0.5) * 7);
      chooser.markDone();
    }
    if (act === "idle" && inAct > 3) chooser.markDone();
    const U: Partial<Record<B, number>> = {
      idle: 0.08,
      explore: drives.rewardOf({ curiosity: -0.4 }),
      fetch: w.ball.state !== "rest" ? drives.rewardOf({ play: -0.5 }) + 0.35 : 0,
      eat: w.bowlFull ? drives.rewardOf({ hunger: -0.6 }) : 0,
      rest: drives.rewardOf({ fatigue: -0.5 }),
      greet: drives.rewardOf({ social: -0.4 }, 0.5),
      obey: w.cmd ? 2 : 0,
    };
    const reactive: B[] = w.ball.state === "free" && w.t - w.ball.thrownAt < 1 ? ["fetch"] : [];
    const d = chooser.update(w.t, U, reactive, w.cmd ? "obey" : undefined);
    if (d.switched) w.since = w.t;
    w.decision = d;
    if (Math.floor(w.t) !== Math.floor(w.t - dt)) w.rows.push([Math.round(w.t), d.current, ...Object.values(drives.values).map((x) => +x.toFixed(3))]);
  }

  // the scripted day: the scenario steps the sim at its own pace, here held to the wall clock
  let wall0 = performance.now();
  let simStart = 0;
  const sim: Sim = {
    async step(n: number) {
      for (let i = 0; i < n; i++) tick(1 / SPS);
      const lead = w.t - simStart - (performance.now() - wall0) / 1000;
      if (lead > 0) await new Promise((res) => setTimeout(res, lead * 1000));
    },
    trace: () => ({ rows: w.rows, cols: ["t", "act", "hunger", "fatigue", "play", "social", "curiosity"] }),
  };
  const day: Scenario = {
    name: "a day in the yard",
    seed: 7,
    seconds: 64,
    actions: [
      { at: 2, js: (h: typeof api) => h.throwBall() },
      { at: 12, js: (h: typeof api) => h.say("sit") },
      { at: 13.5, js: (h: typeof api) => h.goodDog() },
      { at: 20, js: (h: typeof api) => h.fillBowl() },
      { at: 26, js: (h: typeof api) => h.say("paw") },
      { at: 27.5, js: (h: typeof api) => h.goodDog() },
      { at: 34, js: (h: typeof api) => h.throwBall() },
      { at: 44, js: (h: typeof api) => h.say("come") },
      { at: 45.5, js: (h: typeof api) => h.treat() },
      { at: 52, js: (h: typeof api) => h.say("paw") },
      { at: 53.5, js: (h: typeof api) => h.goodDog() },
      { at: 58, js: (h: typeof api) => h.fillBowl() },
    ],
  };
  void (async () => {
    for (;;) {
      wall0 = performance.now();
      simStart = w.t;
      await runScenario(sim, day, { handle: api, stepsPerSecond: SPS, chunk: 3 });
    }
  })();

  // the views
  const bars = drivesBars(ui.brain);
  const assoc = associationsTable(ui.train, { onReset: () => api.reset() });
  verb(ui.verbs, "throw ball", true, () => api.throwBall());
  verb(ui.verbs, "treat", false, () => api.treat());
  verb(ui.verbs, "good dog", false, () => api.goodDog());
  verb(ui.verbs, "say sit", false, () => api.say("sit"));

  // the eye card: a renderer of its own draws each eye, then the 2D card takes the frame
  let eye: ReturnType<typeof eyeInset> | null = null;
  const dogCam = new THREE.PerspectiveCamera(90, 2, 0.05, 60);
  const hisCam = new THREE.PerspectiveCamera(60, 2, 0.05, 60);
  const dogEye = new FirstPerson(dogCam, head, 0.14, 0.02);
  const hisEye = new FirstPerson(hisCam, pHead, 0.1, 0.02);
  if (ui.inset) {
    const glCanvas = document.createElement("canvas");
    const eyeGl = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, preserveDrawingBuffer: true });
    eyeGl.setSize(320, 160, false);
    const who: EyeWho[] = [
      { id: "dog", label: "dog eye", title: "what the dog sees", eye: dogEye },
      { id: "his", label: "his eyes", title: "what he sees", eye: hisEye },
    ];
    eye = eyeInset(ui.inset, {
      who,
      draw(canvas, wh) {
        eyeGl.render(scene, wh.id === "dog" ? dogCam : hisCam);
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return "no 2d canvas";
        if (wh.id !== "dog") {
          ctx.drawImage(glCanvas, 0, 0, canvas.width, canvas.height);
          return "human colour";
        }
        // the dog: blurred to about 20/75 and folded to two cones, yellow and blue
        ctx.filter = "blur(1.2px)";
        ctx.drawImage(glCanvas, 0, 0, canvas.width, canvas.height);
        ctx.filter = "none";
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const p = img.data;
        for (let i = 0; i < p.length; i += 4) {
          const R = p[i] as number;
          const G = p[i + 1] as number;
          const Bl = p[i + 2] as number;
          p[i] = 0.367 * R + 0.861 * G - 0.228 * Bl;
          p[i + 1] = 0.28 * R + 0.673 * G + 0.047 * Bl;
          p[i + 2] = -0.012 * R + 0.043 * G + 0.969 * Bl;
        }
        ctx.putImageData(img, 0, 0);
        return "dichromat 20/75";
      },
    });
  }

  const fit = () => {
    const wd = ui.subject.clientWidth;
    const ht = ui.subject.clientHeight;
    renderer.setSize(wd, ht, false);
    camera.aspect = wd / Math.max(1, ht);
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(fit).observe(ui.subject);
  fit();

  let lastUi = -1;
  let frames = 0;
  const firstDrives = { ...drives.values };
  const frame = () => {
    frames++;
    dog.position.set(w.pos.x, 0, w.pos.y);
    dog.rotation.y = w.yaw;
    const held = w.ball.state === "held";
    if (held) ball.position.set(w.pos.x + Math.sin(w.yaw) * 0.5, 0.5, w.pos.y + Math.cos(w.yaw) * 0.5);
    else ball.position.set(w.ball.at.x, 0.11, w.ball.at.y);
    food.visible = w.bowlFull;
    const toDog = Math.atan2(w.pos.x - person.position.x, w.pos.y - person.position.z);
    person.rotation.y = toDog;
    renderer.render(scene, camera);
    if (eye) {
      dog.updateMatrixWorld(true);
      person.updateMatrixWorld(true);
      const hp = head.getWorldPosition(new THREE.Vector3());
      dogEye.place(hp, w.yaw, -0.05);
      const pp = pHead.getWorldPosition(new THREE.Vector3());
      hisEye.place(pp, toDog, -0.3);
      eye.frame();
    }
    if (w.decision && performance.now() - lastUi > 100) {
      lastUi = performance.now();
      const cur = w.decision.current;
      const name = cur === "obey" && w.cmd ? `obey / ${w.cmd.action}` : cur === "fetch" ? `fetch / ${w.ball.state === "free" ? "chase" : "bring back"}` : cur;
      bars.update(drivesBarsState(w.decision, drives, { now: w.t, seconds: w.t - w.since, behavior: name, why: WHY[cur], pink: ["play"] }));
      assoc.update(associationsState(learner, { last: w.last, trial: w.trial }));
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  if (auto) {
    await new Promise((res) => setTimeout(res, 6000));
    const moved = (Object.keys(firstDrives) as K[]).some((k) => Math.abs(drives.values[k] - firstDrives[k]) > 0.005);
    check(r, "bars", ui.brain.querySelectorAll(".hb-gauge").length >= 12 && moved ? "pass" : "fail", "utility and drive rows drawn, the drives moved");
    check(r, "table", ui.train.querySelectorAll("tbody tr").length >= 3 ? "pass" : "fail", "a row per cue");
    if (eye) check(r, "eye", eye.root.querySelector(".hb-hd-aux")?.textContent ? "pass" : "fail", "the eye drew a frame and set its mode line");
    r.numbers["frames in 6 s (measured)"] = frames;
    r.numbers["sim seconds (measured)"] = +w.t.toFixed(1);
    finish(r, Object.values(r.checks).every((c) => c.status === "pass") ? "pass" : "fail");
  }
}
