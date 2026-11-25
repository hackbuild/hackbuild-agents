// how this works: the fold of the package page and of the suite tool. Plain data, no imports;
// checked by tsconfig.how.json, shipped in the tarball, never imported by the runtime entry.
const how: HowDoc = {
  what: "the brain bars, the associations table and the eye card of the dog yard, as views you mount on any page. each is a vue component and a custom element drawn with hackbuild-ui classes.",
  how: [
    "`drivesBars` draws what it is doing in big letters with the why under it, a bar per act for what that act is worth now with the chosen one in pink, and a bar per drive. `drivesBarsState` builds its state from a drives `Chooser` decision and the `Drives` values.",
    "`associationsTable` draws cues by acts: each cell is the net strength, excitation minus inhibition, from 0 to 99 in pink, and the attn column is how much it still pays attention to the cue. `associationsState` reads a `CueLearner`; reset learning calls your `onReset`.",
    "`eyeInset` makes an element the eye card: a canvas, a who switch and a mode line. each frame it calls your draw inside the who's first person eye from @hackbuild/cameras, so its own head is hidden for that render. a draw that returns a string sets the mode line.",
    "`defineViews()` registers `hb-drives-bars`, `hb-associations-table` and `hb-eye-inset`; the vue forms live in `@hackbuild/agents-views/vue`. load hackbuild-ui's hackbuild.css for the look.",
  ],
  packages: ["@hackbuild/agents-views", "@hackbuild/drives", "@hackbuild/cameras"],
  install: "npm install @hackbuild/agents-views @hackbuild/drives @hackbuild/cameras @virgilvox/hackbuild-ui",
  today: `git clone https://github.com/hackbuild/hackbuild-agents
cd hackbuild-agents && npm ci && npm run build -w @hackbuild/agents-views`,
  lang: "ts",
  code: `import { drivesBars, drivesBarsState } from "@hackbuild/agents-views";

const bars = drivesBars(document.querySelector("#brain"));
// each tick, after the chooser decided
const d = chooser.update(now, utilities);
bars.update(drivesBarsState(d, drives, { now, seconds: now - since }));`,
  links: { page: "https://hackbuild.github.io/hackbuild-agents/drives-bars/", source: "https://github.com/hackbuild/hackbuild-agents/tree/main/packages/agents-views" },
};
export default how;
