# Changelog

Versions follow semver per package. Nothing is published to npm yet.

## 0.1.0 (unreleased)

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
