// how this works: the fold of the package page and of the suite tool. Plain data, no imports;
// checked by tsconfig.how.json, shipped in the tarball, never imported by the runtime entry.
const how: HowDoc = {
  what: "a parameter registry with layer switches, presets, url hash sharing and a panel binding, for a/b work on agent behaviour.",
  how: [
    "every number that shapes behaviour is defined once with a default, a range, a step, a unit and a source word. `set` clamps into the range and ignores NaN.",
    "layers gate whole features behind one master switch, so each feature keeps a fallback path you can compare live. `abPair(layer)` gives two snapshots that differ in that one layer.",
    "saves and the url hash hold only values that differ from their defaults, so a new build's defaults reach old sessions. a save of another version goes through an explicit migration or is dropped.",
    "`@hackbuild/tunables/dom` binds a panel with dom calls only: a reset per row, reset all, export, import, and the url hash kept in sync.",
  ],
  packages: ["@hackbuild/tunables"],
  install: "npm install @hackbuild/tunables",
  today: `git clone https://github.com/hackbuild/hackbuild-agents
cd hackbuild-agents && npm ci && npm run build -w @hackbuild/tunables`,
  lang: "ts",
  code: `import { createRegistry } from "@hackbuild/tunables";
import { bindPanel } from "@hackbuild/tunables/dom";

const tune = createRegistry({ master: "L.organic", storage: localStorage, version: 1 });
tune.defineLayer("L.organic", "organic (off is the canned build)");
tune.defineLayer("L.plume", "sniffing in a turbulent plume");
tune.define({ key: "Se.fix", group: "senses", label: "fixation median", unit: "s", def: 0.83, min: 0.2, max: 2, step: 0.01, source: "measured", cite: "Barber 2016" });
tune.restore();
tune.fromUrlHash(location.hash);
// the hash is written with history.replaceState: no history entry per slider step
bindPanel(document.querySelector("#tune")!, tune, { syncHash: true });

if (tune.layer("L.plume")) plumeTick(dt);`,
  links: { page: "https://hackbuild.github.io/hackbuild-agents/tunables/", source: "https://github.com/hackbuild/hackbuild-agents/tree/main/packages/tunables" },
};
export default how;
