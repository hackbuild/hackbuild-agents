# concepts

The ideas every package in this repository shares. Read them once; each package README then only covers what is its own.

## randomness is injected

Anything random takes an `Rng = () => number` option, so the same seed gives the same run in tests, in Node and in the browser. Library code never calls `Math.random`. `seededRng(seed)` from @hackbuild/drives gives a Mulberry32 stream; a class with a wasm core draws one 32 bit seed from your `Rng` and runs the same stream inside the core. Give camera shake a stream of its own, so turning shake off does not change what the animal does.

## the wasm cores load once

@hackbuild/senses and @hackbuild/drives run on Rust crates built for wasm32 with SIMD128 and no threads, so no page needs cross origin isolation. Call `await load()` once before you construct anything; with no argument it decodes the copy inlined in the package, which also works from a page opened from disk. Pass a URL, bytes or a compiled module to load it from elsewhere. A class used before the load throws `wasm not loaded. call load() first.`

## you own the step loop

No package starts a timer or a render loop. You call `update`, `step` or `grow` with the time and the time step, so a sim can run faster than real time, in lockstep under @hackbuild/scenario, or paused. Times are seconds unless a name says otherwise.

## the scene stays yours

The packages take plain objects in place of engine types. @hackbuild/cameras writes `position.set`, `lookAt`, `fov` and `aspect` on the camera you pass and imports nothing at runtime, so a three `PerspectiveCamera` fits; occlusion is a `clear` callback, your own raycast. @hackbuild/mover moves plain actors against box and cylinder colliders. Only the `@hackbuild/senses/three` entry imports three, to render the eye views.

## every choice says why

A `Chooser` decision carries the reason, the sampling probability, every utility and a `why` sentence, and @hackbuild/agents-views draws them. Log the why when a run surprises you; it is the first thing to read.

## builds that run from file://

Each package has a classic script build, such as `dist/drives.iife.js`, that sets a `Hackbuild<Pkg>` global with any wasm inlined. Chrome refuses module scripts and dynamic imports of file URLs on a page opened from disk, so a page saved to disk uses that script.

## numbers carry a label

Every number in these docs says where it came from: measured on a named machine, computed from other numbers, vendor, inferred, or unknown. Tables carry the label in a cell or a column.
