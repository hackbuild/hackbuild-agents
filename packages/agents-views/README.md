# @hackbuild/agents-views

Views that bind the agents packages to the hackbuild-ui class layer, ported
from the brain tab, the train tab and the eye card of the dog yard. Each
view is a vanilla function over a host element, a custom element and a Vue
component, and draws the same markup in all three forms. The views write
hackbuild-ui classes only; load its `hackbuild.css` for the look.

What is in it:

- `drivesBars(host)`: the behavior block (the name in Permanent Marker, the
  why under it, seconds in it), a utility row per act with the current
  choice in pink, and a drive row per need from 0 to 1. Rows rebuild only
  when the keys change, so the bars move in place. `drivesBarsState(decision,
  drives, { now, seconds })` builds the state from a `Chooser` decision and
  a `Drives` object of `@hackbuild/drives`.
- `associationsTable(host, { onReset })`: cues by acts, each cell the net
  strength (excitation minus inhibition) from 0 to 99 in pink, the attn
  column (associability), the last rewarded cell marked aria-current, a line on the
  last trial, the explanation and reset learning. `associationsState(learner)`
  reads a `CueLearner`.
- `eyeInset(host, { who, draw })`: makes `host` the eye card, an inset
  marked `data-ux="inset"`: a canvas, a who switch and a mode line. `frame()`
  calls `draw` inside the who's `FirstPerson` eye of `@hackbuild/cameras`, so
  its own head is hidden for that render; a returned string sets the mode
  line. Pass `canvas` when a renderer owns one already.
- `defineViews()` registers `hb-drives-bars`, `hb-associations-table` and
  `hb-eye-inset` (set `.state`, or `.options` and call `frame()`); the single
  file build registers them when its script tag runs.
- `@hackbuild/agents-views/vue`: `DrivesBars`, `AssociationsTable` (emits
  `reset`) and `EyeInset` (v-model:selected, an exposed `frame()`).

The views read the drives and cameras objects by their shape, so the package
has no runtime dependency; the tests bind them to the real packages.

## Install

    npm install @hackbuild/agents-views @virgilvox/hackbuild-ui

`vue` is an optional peer, needed only for the `./vue` entry.

## Use

```ts
import { drivesBars, drivesBarsState, eyeInset } from "@hackbuild/agents-views";

const bars = drivesBars(document.querySelector("#brain"));
const d = chooser.update(now, utilities);
bars.update(drivesBarsState(d, drives, { now, seconds: now - since }));

const eye = eyeInset(document.querySelector("#eye"), {
  who: [{ id: "dog", label: "dog eye", eye: new FirstPerson(dogCam, dogHead) }],
  draw: (canvas) => { /* render the eye camera onto canvas */ return "dichromat"; },
});
eye.frame(); // each frame
```

Plain HTML:

```html
<script src="agents-views.iife.js"></script>
<hb-drives-bars id="brain"></hb-drives-bars>
<script>document.getElementById("brain").state = { behavior: "idle", utilities: { idle: 0.1 }, drives: { hunger: 0.4 } };</script>
```

## Develop

    npm run build -w @hackbuild/agents-views
    npx vitest run packages/agents-views
    node tools/build-pages.mjs && node tools/smoke-views.mjs

The demo pages `drives-bars`, `associations-table` and `eye-inset` run one
yard built in code (`examples/shared/yard.ts`) through a scripted day from
`@hackbuild/scenario`: the ball is thrown, the bowl filled and three words
taught, so the bars move with nobody at the keys. No model or weight file
is loaded.

## What is verified, and what is not

### Verified on this machine

- 2026-11-25: `npx vitest run packages/agents-views` passed 8 of 8 tests
  (counted) in happy-dom: the utility rows with one current row from a real
  `Chooser` decision, drive bars that move in place, the pending switch line,
  the table from a real `CueLearner` with the attn column and reset, the eye
  card drawing inside a real `FirstPerson` (head at 0.001 during the draw,
  restored after), the custom elements, and the Vue components following
  their props.
- 2026-11-25: `node tools/smoke-views.mjs` passed its three smokes in
  headless Chrome on the built pages (drive bars moved within 3 s, reset
  left the three prior cues, the eye canvas brightness spread 212 of 255,
  measured). The screen gate of the suite passed the three pages at 1440 by
  900 and 390 by 844.

### Not verified by anything

- Any view at real frame rate in a headful browser: nobody has looked.
- The dichromat matrix and the 1.2 px blur of the demo stand for dog
  vision by eye only (inferred); the views draw whatever `draw` paints.

## Size budget

| file | gzip (measured) | ceiling |
|---|---|---|
| `dist/index.js` (main entry, imports external) | 4,350 bytes | 4,567 bytes |
| `dist/agents-views.iife.js` (single file build) | 4,484 bytes | 4,708 bytes |

Measured 2026-11-25 by `node tools/lint-packages.mjs` (gzip level 9) from the packed
tarball. Generated from `tools/size-budget.json`; CI fails when a file moves more than
5 percent from its row.

## Licence

Code MIT (`LICENSE`, a copy of the repository root one). This README is CC-BY-4.0, its
code samples also MIT.
