# @hackbuild/scenario

Lockstep scenario runs of a built browser sim in the system Chrome, for
Node. Generalized from the dog-simulator runner: puppeteer-core drives the
installed Chrome (no bundled browser, no Playwright), every network
request is answered from a pinned local file or refused, the page advances
whole fixed steps on command, and traces are recorded or compared with
golden files. Reports use the check message form of the house rules.

What is in it:

- `open`: launches Chrome with routing (`npmCdn` for jsdelivr and unpkg
  from a local node_modules at the exact version, `pinned` for exact URLs
  with SHA-256, `fixedBody`), an `offline` mode that refuses everything
  but file:, data: and blob:, a small viewport (420 by 280 by default),
  `gpu: "swiftshader"` for lockstep or `"default"` for real frame rate,
  and a `beforeGoto` hook. Page errors, console errors and blocked
  requests are collected; any of them fails a run.
- `runLockstep` and `runSuite`: actions at sim times or on page
  conditions, probes, screenshots, golden record and compare with the
  first differing row, parallel browsers.
- Page contract: `window.__sim` with `step(n)`, `trace()` returning
  `{ rows, cols?, hash? }`, and optional `render()`. The page opened with
  `#test&seed=N` must not run its own loop.
- Motion metrics from lessons of earlier builds: `jerk` (third difference of
  positions), `sliding` (heading against direction of motion over 0.6
  rad), `togglesPerSecond`, `stallSeconds` (under 0.2 m in 2 s with a
  goal), `frameStats` (p50, p95, max).
- `installRafSampler` and `readRaf`: frame intervals and a per frame
  `window.__rafSample()` value at real frame rate.
- `createProfiler` (also `@hackbuild/scenario/profiler`, no Node imports):
  per system average and worst ms per frame, for a page or a sim.
- `checkMessage`, `formatReport`, `reportPasses`: "stall 4.75 s
  (measured), legal at most 1 s, set by the stall detector, 0.2 m in 2 s.
  fix: insert a side waypoint". A check with no measurement is reported as
  not run, and `reportPasses` (so the `hb-scenario` exit code) fails on
  it unless the check sets `optional: true`. `runSuite` refuses `compare`
  and `record` without a `goldenDir`.
- `hb-scenario record|compare|check --file F --list L`: the same from the
  command line; the list module exports `scenarios`, `routes` and
  `options`.

## Install

Not published yet. From a clone:

    npm ci && npm run build -w @hackbuild/scenario

Chrome is found at `/Applications/Google Chrome.app` or the usual Linux
paths; `HB_CHROME` overrides.

## Use

```ts
import { npmCdn, runSuite, sliding, formatReport } from "@hackbuild/scenario";

const report = await runSuite({
  file: "dist/app.html",
  mode: "compare",
  goldenDir: "scenarios/golden",
  routes: [npmCdn("node_modules")],
  scenarios: [{
    name: "fetch", seed: 1, seconds: 45,
    actions: [{ at: 2, js: "h.throwBall()" }],
    checks: (t) => [{ what: "slide share", measured: sliding(xz(t), yaw(t), 0.25).share, legal: { max: 0.1 }, constraint: "set by the gait" }],
  }],
});
console.log(formatReport(report));
```

`dist/scenario.bundle.mjs` is the single file build: one ES module with
puppeteer-core and node builtins external.

## Develop

    source ~/.nvm/nvm.sh && nvm use 22.18.0
    npx -y npm@11.21.0 install
    npm run build -w @hackbuild/scenario
    npx vitest run packages/scenario

## What is verified, and what is not

### Verified on this machine

- 2026-11-22: `npx vitest run packages/scenario` passed 11 of 11 tests
  (counted). Three run in Chrome 150.0.7871.125 headless against
  `test/fixtures/sim.html`, a seeded sim that loads three from the CDN:
  goldens recorded then compared identical for two seeds with routed
  requests; an unrouted request and offline mode both fail the run; the
  rAF sampler read 48 frames at p50 33.3 ms, p95 33.9 ms, max 34.1 ms
  (measured, headless, default GPU flags).
- 2026-11-22: the CLI recorded and then compared a golden for the fixture
  (run by hand, exit 0).
- 2026-11-22: with the swiftshader flags, headless Chrome on macOS 12 ran
  0 to 1 animation frames per second on a blank page against 31 without
  them (measured), which is why real frame rate runs take
  `gpu: "default"`.

### Not verified by anything

- dog-simulator still runs its own copy of the runner; nobody has moved
  its scenarios onto this package yet.
- WebGPU in headless Chrome: not probed by this package.
- Screenshots are written but the suite claims nothing visual.
- CI on Ubuntu has no Chrome at the macOS path; the Chrome tests look for
  `/usr/bin/google-chrome` and skip when none is found. Whether the
  ubuntu-24.04 runner image has one was not checked.

## Size budget

| file | raw | gzip |
|---|---|---|
| `scenario.bundle.mjs` | 20,062 bytes | 7,583 bytes |

Measured 2026-11-23 by tools/check-sizes.mjs (gzip level 9).

## Licence

Code MIT (`LICENSE`, a copy of the repository root one). This README is CC-BY-4.0, its
code samples also MIT.
