# @hackbuild/scenario

Run a built browser sim in the system Chrome in whole fixed steps, record or compare its trace against a golden file, and report motion checks with their legal ranges.

[![npm](https://img.shields.io/npm/v/@hackbuild/scenario)](https://www.npmjs.com/package/@hackbuild/scenario) [![licence MIT](https://img.shields.io/badge/licence-MIT-blue)](../../LICENSE) ![gzip 8.8 kB measured](https://img.shields.io/badge/gzip-8.8%20kB-blue) ![types included](https://img.shields.io/badge/types-included-blue)

## What it does

- Opens a page in the installed Chrome through puppeteer-core and answers every network request from a pinned local file, or refuses it; page errors, console errors and blocked requests fail the run.
- Steps the sim in lockstep through `window.__sim`, fires actions at sim times or on page conditions, reads probes and takes screenshots.
- Records traces as golden files and compares later runs row by row, naming the first row that differs.
- Measures motion from a trace (jerk, sliding, state toggles, stalls, frame times) and reports each check with what was measured, the legal range and the fix.
- Runs the same lockstep core against a sim object inside a page, with no Node built ins and no puppeteer, through `@hackbuild/scenario/browser`.

## Install

```sh
npm install @hackbuild/scenario puppeteer-core
```

`puppeteer-core` (25.18.1 up to 26) is a peer of the Node entry; no browser is downloaded. Chrome is found at `/Applications/Google Chrome.app` on macOS or `/usr/bin/google-chrome`, `google-chrome-stable`, `chromium` or `chromium-browser` on Linux, and `HB_CHROME` overrides the path. The `./browser`, `./profiler` and `./metrics` entries need neither puppeteer nor Chrome. The quick start uses Node built ins only besides the package.

## Quick start

```ts
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { formatReport, reportPasses, runSuite, stallSeconds } from "@hackbuild/scenario";

// a page with the lockstep contract: window.__sim steps whole frames and returns a trace
const file = join(tmpdir(), "walker.html");
writeFileSync(file, `<script>let x = 0, v = 0; const rows = [];
window.__sim = { step(n) { for (let i = 0; i < n; i++) { x += v / 60; rows.push([x, 0]); } }, trace: () => ({ rows }), go() { v = 1; } };</script>`);

// one seeded run of 4 sim seconds, offline, with a stall check on the trace
const report = await runSuite({
  file, mode: "check", offline: true,
  scenarios: [{
    name: "walks", seed: 1, seconds: 4, actions: [{ at: 0.5, js: "h.go()" }],
    checks: (t) => [{ what: "stall", unit: "s", measured: stallSeconds(t.rows as number[][], t.rows.map(() => true), 1 / 60), legal: { max: 1 }, constraint: "set by the walker" }],
  }],
});
console.log(formatReport(report));
process.exitCode = reportPasses(report) ? 0 : 1;
```

## Live example

The [scenario page](https://hackbuild.github.io/hackbuild-agents/scenario/) explains the runner with its install line and code. The [dog simulator](https://hackbuild.github.io/dog-simulator/) is the sim its scenarios drive: its runner opens the built app with `#test&seed=N`, steps it in lockstep and compares the traces with its goldens.

## Concepts

### the page contract

The page exposes `window.__sim` with `step(n)`, `trace()` returning `{ rows, cols?, hash? }`, and an optional `render()`. Opened with `#test&seed=N` (plus a scenario's `hash` fields), the page must not run its own animation loop: the runner calls `step` in chunks of 30 steps at 60 steps per second by default, so a run is the same at any wall speed. Pass `api` to use another object and `handle` to bind `h` in actions and probes to something else.

### routed and offline runs

`open` and `runSuite` take `routes`, a list of functions from a URL to a hit or null. `npmCdn(nodeModules)` answers jsdelivr and unpkg URLs from a local node_modules at the exact version, `pinned(entries)` answers exact URLs from files with a SHA-256 check, and `fixedBody` answers with a fixed text. A request no route answers is blocked and fails the run. `offline: true` refuses everything but file:, data: and blob:, which is the check for a self contained build. `gpu: "swiftshader"` (the default) gives a software GPU for lockstep; take `gpu: "default"` when you measure real frame rate, since headless Chrome with the swiftshader flags may run almost no animation frames.

### actions, probes and shots

An action runs page code at a sim time (`at`) or once a condition (`when`, checked every 15 steps) holds. A probe reads an expression every `every` sim seconds into the trace. A shot renders and writes a screenshot at a sim time. Page code is a string, or a function of `h` sent to the page by its source, so a function must not close over anything.

### goldens

`mode: "record"` writes `<goldenDir>/<name>.json` with the rows, hash, probes and fired conditions; `mode: "compare"` reads it and reports identical, differs (with the first differing row) or missing; `mode: "check"` runs the checks only. `runSuite` refuses record and compare without a `goldenDir`. A sim whose trace must match between Node and a browser keeps transcendental results such as `Math.atan2` out of its state or rounds them, since engines differ in the last digit.

### checks and reports

A check names what it measures, the measured number with its unit and label, the legal `min` or `max`, the constraint that sets the range and the fix. `checkMessage` writes one line: the check, the number with its unit and label, the legal range, the constraint and the fix. A check with no measurement is not run, and `reportPasses` (so the `hb-scenario` exit code) fails on it unless the check sets `optional: true`.

```ts
import { checkMessage, sliding } from "@hackbuild/scenario/browser";

const xz = [[0, 0], [0, 0.02], [0.02, 0.04]];
const slide = sliding(xz, [0, 0, 1.2], 1 / 60);
console.log(checkMessage({ what: "slide share", measured: slide.share, legal: { max: 0.1 }, constraint: "set by the gait" }));
```

### in the page

`@hackbuild/scenario/browser` runs the same scheduler against a sim object: `runScenario(sim, scenario, { onEvent })` streams step, action, fired, probe and shot events, and `runScenarios({ scenarios, makeSim, goldens })` returns a report. `parseScenario` reads a JSON scenario whose code fields are strings run with `new Function`, so load only files you trust. `parseTrace`, `diffRows`, `diffMessage` and `traceHash` compare two traces in a diff view.

### the command line

`hb-scenario record|compare|check --file dist/app.html --list scenarios/list.mjs [--golden dir] [--only a,b] [--jobs 2] [--report out.json] [--offline]` runs a list module that exports `scenarios` and optionally `routes` and `options`. It exits 1 when the report does not pass.

## API overview

| export | what it does |
|---|---|
| [`runSuite`](../../docs/api/scenario/index.md#runsuite) | run scenarios in Chrome, record or compare goldens, return a report |
| [`open`](../../docs/api/scenario/index.md#open) | launch Chrome with routing and open a page |
| [`runLockstep`](../../docs/api/scenario/index.md#runlockstep) | run one scenario on an open page |
| [`npmCdn`](../../docs/api/scenario/index.md#npmcdn) | answer CDN requests from node_modules |
| [`pinned`](../../docs/api/scenario/index.md#pinned) | answer exact URLs from pinned files |
| [`installRafSampler`](../../docs/api/scenario/index.md#installrafsampler) | record frame intervals at real frame rate, read with `readRaf` |
| [`formatReport`](../../docs/api/scenario/index.md#formatreport) | the text report, fails first |
| [`reportPasses`](../../docs/api/scenario/index.md#reportpasses) | whether every check and golden passed |
| [`checkMessage`](../../docs/api/scenario/index.md#checkmessage) | one line for one check |
| [`runScenarios`](../../docs/api/scenario/browser.md#runscenarios) | run scenarios against a sim in the page |
| [`parseScenario`](../../docs/api/scenario/browser.md#parsescenario) | a scenario from JSON |
| [`stallSeconds`](../../docs/api/scenario/metrics.md#stallseconds) | seconds with a goal and under 0.2 m moved in 2 s |
| [`sliding`](../../docs/api/scenario/metrics.md#sliding) | where the body faces one way and moves another |
| [`jerk`](../../docs/api/scenario/metrics.md#jerk) | jerk magnitudes from positions |
| [`createProfiler`](../../docs/api/scenario/profiler.md#createprofiler) | average and worst ms per system per frame |

The full reference is in [docs/api/scenario](../../docs/api/scenario/README.md).

## Browser support

| entry | runs in | needs |
|---|---|---|
| `@hackbuild/scenario` | Node 22.18 or 24.11 and later | puppeteer-core and an installed Chrome or Chromium |
| `@hackbuild/scenario/browser` | Chrome; Firefox and Safari not run | ES2022 and `new Function` for scenario files |
| `@hackbuild/scenario/profiler`, `/metrics` | Node or any browser | nothing |

WebGPU in headless Chrome is not probed by this package. Pages under test that need it should be run with `gpu: "default"` and checked by hand.

## Errors and troubleshooting

| message | cause | what to do |
|---|---|---|
| `no chrome found. set HB_CHROME to the browser binary.` | no Chrome at the known paths | install Chrome or set `HB_CHROME` |
| `compare needs goldenDir: without it nothing is compared` | `runSuite` in compare mode with no `goldenDir` | pass `goldenDir`; `record needs goldenDir` is the same for record |
| `runner: no window.__sim after 240 s` | the page never exposed its test API | check the page loads with `#test&seed=N`, or raise `readyMs` |
| `route: pinned file missing: <file>` | a pinned route names a file that is not there | restore the file or fix the lock |
| `route: pinned file does not match its sha256: <file>` | the local file changed | restore the pinned file or update the pin |
| `route: route hit has neither file nor body` | a route returned a hit with no answer | return `file` or `body` |
| `no raf sampler on the page. call installRafSampler before goto.` | `readRaf` on a page without the sampler | call `installRafSampler(page)` before navigation |
| `scenario is not json: <reason>` | `parseScenario` got broken text | fix the JSON |
| `<name>: seed must be a whole number` | a scenario seed with a fraction | use an integer seed |
| `<name>: seconds must be above 0` | a scenario of no length | give it a positive length |
| `<name>: check <what> needs legal with min or max` | a check spec with no legal range | add `legal` |
| `trace needs rows, a list of lists` | `parseTrace` got another shape | pass a trace or golden file |

Errors inside a run do not throw: they land in the scenario's `errors` as `pageerror: ...`, `console: ...`, `route: ...` or `runner: ...`, and fail the report. A blocked request lands in `blocked`.

## Works with

- [@hackbuild/mover](../mover/README.md) gives the steering whose stalls and passing `stallSeconds` and `togglesPerSecond` measure.
- [@hackbuild/drives](../drives/README.md) and [@hackbuild/senses](../senses/README.md) take an injected seeded `Rng`, so a scenario seed replays the same run.
- [@hackbuild/agents-views](../agents-views/README.md) demo pages run a scripted day through the browser entry.

## Changelog and licences

Changes are in the repository [CHANGELOG](../../CHANGELOG.md). Code is MIT ([LICENSE](../../LICENSE)); this README is CC-BY-4.0 with its code samples also MIT.

## What is verified, and what is not

### Verified on this machine

| date | check | result |
|---|---|---|
| 2026-11-22 | `npx vitest run packages/scenario`, three tests in headless Chrome 150 against a seeded fixture sim that loads three from the CDN | goldens recorded then compared identical for two seeds with routed requests; an unrouted request and offline mode both fail the run |
| 2026-11-22 | rAF sampler on the fixture, headless, default GPU flags | 48 frames, p50 33.3 ms, p95 33.9 ms, max 34.1 ms (measured) |
| 2026-11-22 | `hb-scenario` record then compare on the fixture, by hand | exit 0 |
| 2026-11-22 | swiftshader flags on headless Chrome, macOS 12, blank page | 0 to 1 animation frames per second against 31 without them (measured) |
| 2026-11-24 | `npx vitest run packages/scenario` | 22 of 22 tests pass (counted); one seed gives the same trace hash through the browser entry in Node, the browser entry bundled into a Chrome 150 page, and the Node runner on the same sim in that page; another seed differs |
| 2026-11-24 | `Math.atan2(0.3, 1.7)` | 0.17467219900823971 in Node 22.18, 0.1746721990082397 in Chrome 150 (measured) |

### Not verified by anything

- The browser entry under Firefox or Safari.
- WebGPU in headless Chrome.
- Anything visual: screenshots are written, and no check reads them.
- CI on Ubuntu: the Chrome tests look for `/usr/bin/google-chrome` and skip when none is found; whether the runner image has one was not checked.

## Size budget

| file | gzip (measured) | ceiling |
|---|---|---|
| `dist/index.js` (main entry, imports external) | 8,840 bytes | 9,282 bytes |

Measured 2026-11-26 by `node tools/lint-packages.mjs` (gzip level 9) from the packed
tarball. Generated from `tools/size-budget.json`; CI fails when a file moves more than
5 percent from its row.
