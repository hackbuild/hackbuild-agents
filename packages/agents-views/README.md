# @hackbuild/agents-views

The brain bars, the associations table and the eye card of a simulated animal, as views you mount on any page with the hackbuild-ui look.

[![npm](https://img.shields.io/npm/v/@hackbuild/agents-views)](https://www.npmjs.com/package/@hackbuild/agents-views) [![licence MIT](https://img.shields.io/badge/licence-MIT-blue)](../../LICENSE) ![gzip 4.3 kB measured](https://img.shields.io/badge/gzip-4.3%20kB-blue) ![types included](https://img.shields.io/badge/types-included-blue)

## What it does

- Draws what the animal is doing and why, what each act is worth now with the chosen one in pink, and how much it needs each thing.
- Draws what it has learned: cues by acts, each cell the net strength from 0 to 99, with how much it still pays attention to each cue.
- Makes an element the eye card: a canvas drawn from inside the animal's own eye, a switch for whose eyes, and a mode line.
- Ships each view three ways that draw the same markup: a plain function over a host element, a custom element and a Vue component.
- Reads @hackbuild/drives and @hackbuild/cameras objects by their shape, so it has no runtime dependency on either.

## Install

```sh
npm install @hackbuild/agents-views @hackbuild/drives @virgilvox/hackbuild-ui
```

`@virgilvox/hackbuild-ui` (0.10 or 0.11) is a peer: the views write its classes and never style themselves, so load its `hackbuild.css` on the page. `vue` (3.5 or later) is an optional peer, needed only for the `@hackbuild/agents-views/vue` entry. @hackbuild/drives is what the quick start feeds the views; @hackbuild/cameras gives the eye card its `FirstPerson` eye. Neither is a dependency of this package.

## Quick start

```ts
import { associationsState, associationsTable, drivesBars, drivesBarsState } from "@hackbuild/agents-views";
import { Chooser, CueLearner, Drives, load, seededRng } from "@hackbuild/drives";

// the brain: two drives, three acts and a learner, all seeded
await load();
const rng = seededRng(7);
const drives = new Drives({ hunger: 1, play: 0.8 });
const chooser = new Chooser({ rng, options: ["idle", "eat", "fetch"] as const });
const learner = new CueLearner({ rng, actions: ["sit", "paw"] as const });

// the views: mount once, update each tick
const bars = drivesBars(document.body.appendChild(document.createElement("div")));
const table = associationsTable(document.body.appendChild(document.createElement("div")), { onReset: () => location.reload() });
let now = 0;
setInterval(() => {
  now += 0.5;
  drives.grow(0.5, { hunger: 0.02, play: 0.03 });
  const d = chooser.update(now, { idle: 0.1, eat: drives.rewardOf({ hunger: -0.5 }), fetch: drives.rewardOf({ play: -0.4 }) });
  bars.update(drivesBarsState(d, drives, { now }));
  table.update(associationsState(learner));
}, 500);
```

## Live example

Three demo pages run one yard built in code through a scripted day, so the views move with nobody at the keys: [drive bars](https://hackbuild.github.io/hackbuild-agents/drives-bars/), [associations table](https://hackbuild.github.io/hackbuild-agents/associations-table/) and [eye card](https://hackbuild.github.io/hackbuild-agents/eye-inset/). The suite's [creature with drives](https://hackbuild.github.io/hackbuild-suite/#/examples/think/drives) puts the bars beside a running animal.

## Concepts

### a view is a function over a host

`drivesBars(host)`, `associationsTable(host, options)` and `eyeInset(host, options)` take an element you own, replace its children with the view and return a handle. Call `update(state)` each tick; `dispose()` empties the host. The drive and utility rows are rebuilt only when their keys change, so the bars move in place and a screen reader is not flooded.

### state is plain data

Each view draws a plain object you can build by hand: `DrivesBarsState` (behaviour, why, utilities, drives, an optional pending switch) and `AssociationsState` (actions, cue rows, the last rewarded cell, a line on the last trial). `drivesBarsState(decision, drives, { now, seconds })` builds the first from a `Chooser` decision and a `Drives` object; `associationsState(learner)` builds the second from a `CueLearner`, with net strength as excitation minus inhibition.

```ts
import { drivesBars } from "@hackbuild/agents-views";

const bars = drivesBars(document.querySelector("#brain") as HTMLElement);
bars.update({ behavior: "fetch", why: "play is high", utilities: { idle: 0.1, fetch: 0.6 }, drives: { play: 0.8, hunger: 0.3 } });
```

### the eye card draws inside the eye

`eyeInset(host, { who, draw })` takes a list of who entries, each with an optional `eye`. `frame()` calls your `draw(canvas, who)` inside `who.eye.render`, so a `FirstPerson` from @hackbuild/cameras hides the animal's own head for that render only. A string returned from `draw` becomes the mode line, such as "dichromat". Pass `canvas` when a renderer owns one already. The card is a hackbuild-ui inset marked `data-ux="inset"`.

### custom elements and Vue

`defineViews()` registers `hb-drives-bars`, `hb-associations-table` (fires `reset`) and `hb-eye-inset` (set `.options`, call `frame()`, fires `who`); it is safe to call again. The single file build `dist/agents-views.iife.js` registers them when its script tag runs, so a page opened from file:// needs no bundler. `@hackbuild/agents-views/vue` has `DrivesBars`, `AssociationsTable` (emits `reset`) and `EyeInset` (v-model:selected and an exposed `frame()`).

```html
<script src="agents-views.iife.js"></script>
<hb-drives-bars id="brain"></hb-drives-bars>
<script>document.getElementById("brain").state = { behavior: "idle", utilities: { idle: 0.1 }, drives: { hunger: 0.4 } };</script>
```

## API overview

| export | what it does |
|---|---|
| [`drivesBars`](../../docs/api/agents-views/index.md#drivesbars) | the behaviour, utility and drive panels in a host |
| [`drivesBarsState`](../../docs/api/agents-views/index.md#drivesbarsstate) | the bars' state from a `Chooser` decision and the drives |
| [`associationsTable`](../../docs/api/agents-views/index.md#associationstable) | the cues by acts table with attention and reset |
| [`associationsState`](../../docs/api/agents-views/index.md#associationsstate) | the table's state from a `CueLearner` |
| [`eyeInset`](../../docs/api/agents-views/index.md#eyeinset) | the eye card: canvas, who switch and mode line |
| [`defineViews`](../../docs/api/agents-views/index.md#defineviews) | registers the three custom elements |
| [`ELEMENT_NAMES`](../../docs/api/agents-views/index.md#element_names) | the tag names |
| [`DrivesBars`](../../docs/api/agents-views/vue.md#drivesbars) | the bars as a Vue component |
| [`AssociationsTable`](../../docs/api/agents-views/vue.md#associationstable) | the table as a Vue component |
| [`EyeInset`](../../docs/api/agents-views/vue.md#eyeinset) | the eye card as a Vue component |

The full reference is in [docs/api/agents-views](../../docs/api/agents-views/README.md).

## Browser support

| feature | needs | Chrome | Safari | Firefox | phone |
|---|---|---|---|---|---|
| the three views | DOM and CSS custom properties | yes | yes (inferred) | yes (inferred) | yes (inferred) |
| custom elements | `customElements` | yes | yes (inferred) | yes (inferred) | yes (inferred) |
| eye card canvas | whatever your `draw` uses: 2D canvas or WebGL | yes | as your renderer | as your renderer | as your renderer |
| single file build from file:// | a classic script | yes | yes (inferred) | yes (inferred) | unknown |

The views draw no frames of their own: they cost what `update` and your `draw` cost.

## Errors and troubleshooting

| message | cause | what to do |
|---|---|---|
| `@hackbuild/agents-views: eyeInset needs at least one who` | `eyeInset` got an empty `who` list | pass at least one who entry |

A view with no hackbuild-ui stylesheet on the page draws unstyled bars: load `hackbuild.css` from @virgilvox/hackbuild-ui. A custom element whose `.state` is never set stays empty.

## Works with

- [@hackbuild/drives](../drives/README.md) gives the `Chooser`, `Drives` and `CueLearner` the bars and the table read.
- [@hackbuild/cameras](../cameras/README.md) gives the `FirstPerson` eye the card draws inside.
- [@hackbuild/scenario](../scenario/README.md) runs the scripted day of the demo pages.

## Changelog and licences

Changes are in the repository [CHANGELOG](../../CHANGELOG.md). Code is MIT ([LICENSE](../../LICENSE)); this README is CC-BY-4.0 with its code samples also MIT.

## What is verified, and what is not

### Verified on this machine

| date | check | result |
|---|---|---|
| 2026-11-25 | `npx vitest run packages/agents-views` in happy-dom: utility rows with one current row from a real `Chooser` decision, drive bars that move in place, the pending switch line, the table from a real `CueLearner` with the attn column and reset, the eye card drawing inside a real `FirstPerson` (head at 0.001 during the draw, restored after), the custom elements, the Vue components following their props | 8 of 8 tests pass (counted) |
| 2026-11-25 | `node tools/smoke-views.mjs` in headless Chrome on the built pages | drive bars moved within 3 s, reset left the three prior cues, eye canvas brightness spread 212 of 255 (measured) |
| 2026-11-25 | the suite's screen gate on the three pages | passed at 1440 by 900 and 390 by 844 |

### Not verified by anything

- Any view at real frame rate in a headful browser: nobody has looked.
- The dichromat matrix and the 1.2 px blur of the demo stand for dog vision by eye only; the views draw whatever `draw` paints.

## Size budget

| file | gzip (measured) | ceiling |
|---|---|---|
| `dist/index.js` (main entry, imports external) | 4,350 bytes | 4,567 bytes |
| `dist/agents-views.iife.js` (single file build) | 4,484 bytes | 4,708 bytes |

Measured 2026-11-25 by `node tools/lint-packages.mjs` (gzip level 9) from the packed
tarball. Generated from `tools/size-budget.json`; CI fails when a file moves more than
5 percent from its row.
