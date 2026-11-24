# Changelog

Versions follow semver per package. Nothing is published to npm yet.

## 0.1.0 (unreleased)

### hackbuild-ui pin, 2026-11-23

- examples: hackbuild-ui 0.4.3 to 0.5.0 at commit 5211c3a, pinned by
  hackbuild-ui `tools/pin-ui.mjs`; `tools/vendor/hackbuild-ui.pin` records
  version, commit and sha-256, and `npm run ui:check` (run in CI before
  `npm ci`) checks the tarball, SHA256SUMS, package.json and the lockfile
  against it. The tunables panel buttons turn pink on hover only with a
  mouse, as the 0.5.0 class layer does.

### Release readiness, 2026-11-23

- ci: `packages` job packs every package and runs the files allowlist,
  manifest, peer, publint, attw and gzip size budget checks
  (`tools/lint-packages.mjs`, `tools/size-budget.json`); README size
  tables are generated from the budget. `browser` job loads each single
  file build from file:// in headless Chrome. The `unit` job summary
  names every skipped test. lint-authors now requires authors in every
  Cargo.toml.
- Changesets for versions and package changelogs; `release.yml` runs on
  manual dispatch only, packs and uploads the tarballs, and publishes
  nothing.
- Verified: publint and attw clean on all six tarballs, all five single
  file builds that need no page global load in Chrome 150 headless on
  macOS 12 (`senses-three.iife.js` needs `THREE`, not run). Not verified
  until the push: the same on the Linux runner.

### Audit fixes, 2026-11-23

- senses: the eye depth pass applies instancing, batching, skinning and
  morph targets; the core IIFE no longer needs `THREE`, the eye moved to
  `senses-three.iife.js`; colour frames reuse one target; non finite
  projections are skipped; grids under 8 by 8 throw a JsError.
- mover: passing sides held relative to the neighbour and dropped once
  the closest approach is behind; contact and footprints constrain every
  heading, the yield included; only a `follow` leader is exempt; one
  stall waypoint at a time and an `unreachable` flag.
- cameras: group distance solved from projected corners; shake draws only
  while shaking and holds two knots.
- scenario: npm CDN routes stay inside the package; `open` closes Chrome
  on failure; reports fail on checks that did not run; compare needs a
  golden directory; closing screenshots fire; NaN and null differ.
- drives: `bodyClockJs`; untouched deficits stay unclamped in
  `rewardOf`; a completed goal begun again restarts; `free()` on every
  wasm class. tunables: non finite values ignored, hash written with
  `history.replaceState`.
- Every package ships LICENSE; senses and drives ship third party
  notices for the compiled libm and wasm-bindgen code.
- Verified: cargo, vitest (93 tests, the Chrome ones headless) and node
  tests on an M1 with Rust 1.95; the example pages headful in Chrome 150
  (docs/browser-checks.md). Not verified: Safari, Firefox, and a person
  looking at any page.

- repository scaffold: rules, hooks, voice and commit linters, CI.
- `@hackbuild/tunables`: parameter registry with units and sources per
  number, layer switches under a master, presets, URL hash sharing, saves
  of differences only as `{ ver, d }` with explicit migrations, renames,
  A/B pairs, and a DOM panel binding under `/dom` with reset, import and
  export.
- `@hackbuild/senses` and `crates/senses`: Itti Koch saliency with world
  space inhibition of return, looming, odour plume and trail grid with a
  decide, trail, surge and cast tracker, sound localisation error, field
  of view vision with percept memory, an occupancy grid with A* and
  frontiers, and a three.js eye (ID and depth renders) under `/three`.
- `crates/rng`: the shared seeded Mulberry32 and samplers.
- `@hackbuild/drives` and `crates/drives`: drive reduction reward, a
  chooser with reactive latencies, softmax with commitment and a why per
  decision, a cue learner with associability, eligibility traces and
  decaying inhibition, sleep pressure, body clock and stages, a memory
  stream, a goal boost, and from lessons of earlier builds completion flags
  bound to their goal, settle checks with a timeout, a blocking layer
  gate and an inference scheduler.
- `@hackbuild/scenario`: lockstep scenario runner on puppeteer-core and the
  system Chrome with routed pinned requests and an offline mode, golden
  traces, motion metrics (jerk, sliding, toggles, stalls, frame
  percentiles), a rAF sampler, a per system profiler, reports in the check
  message form, and the `hb-scenario` command.
- `@hackbuild/mover`: kinematic capsule mover with step up and platform
  carry, and steering with a passing side held for a second, tangential
  bends, timed yields by priority, multi part footprints with per agent
  filters, and a stall detector that inserts a side waypoint.
- `crates/senses`: wasm surface written without `chunks_exact`, which the
  newer clippy on CI rejects.
- `@hackbuild/cameras`: follow with occlusion pull in, group framing from
  the crownfall camera (https://github.com/virgilvox/crownfall), free
  orbit, a first person eye that hides the
  head for its render, seeded shake and split viewports.
- examples on the hack.build design system: the pages load the hackbuild-ui 0.4.3 class layer and its inlined fonts from the vendored tarball (`tools/vendor`, sha-256 checked in CI) in place of their own theme, mobile first from a 360 px phone; the drive plot draws in the lit set on the void, the why log is a console, the senses canvases are feeds, the tunables panel is styled by the page, and the cameras orbit takes a drag, a pinch and the wheel.
