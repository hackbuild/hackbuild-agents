// how this works: the fold of the package page and of the suite tool. Plain data, no imports;
// checked by tsconfig.how.json, shipped in the tarball, never imported by the runtime entry.
const how: HowDoc = {
  what: "lockstep scenario runs of a built browser sim in the system chrome, with traces, golden files, motion metrics and reports.",
  how: [
    "`open` launches the installed chrome through puppeteer-core, with no bundled browser. every network request is answered from a pinned local file or refused, and page errors, console errors and blocked requests fail the run.",
    "the page exposes `window.__sim` with `step(n)` and `trace()`. `runLockstep` advances whole fixed steps on command, fires actions at sim times or on page conditions, takes probes and screenshots, and records or compares traces against golden files, naming the first row that differs.",
    "motion metrics come from lessons of earlier builds: jerk, sliding, toggles per second, stall seconds and frame stats. reports use the check message form, and a check with no measurement is reported as not run.",
    "`@hackbuild/scenario/browser` runs the same lockstep core against a sim in the page, with no node built ins. `hb-scenario` does the same from the command line.",
  ],
  packages: ["@hackbuild/scenario"],
  install: "npm install @hackbuild/scenario",
  today: `git clone https://github.com/hackbuild/hackbuild-agents
cd hackbuild-agents && npm ci && npm run build -w @hackbuild/scenario`,
  lang: "ts",
  code: `import { npmCdn, runSuite, sliding, formatReport } from "@hackbuild/scenario";

const report = await runSuite({
  file: "dist/app.html",
  mode: "compare",
  goldenDir: "scenarios/golden",
  routes: [npmCdn("node_modules")],
  scenarios: [{
      actions: [{ at: 2, js: "h.throwBall()" }],
    checks: (t) => [{ what: "slide share", measured: sliding(xz(t), yaw(t), 0.25).share, legal: { max: 0.1 }, constraint: "set by the gait" }],
  }],
});
console.log(formatReport(report));`,
  links: { page: "https://hackbuild.github.io/hackbuild-agents/scenario/", source: "https://github.com/hackbuild/hackbuild-agents/tree/main/packages/scenario" },
};
export default how;
