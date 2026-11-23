# @hackbuild/tunables

A parameter registry with layer switches for A/B work on agent behaviour.
Every number that shapes behaviour is defined once with its range, step,
note and source; layers gate whole features behind one master switch, so
each feature keeps a fallback path that can be compared live. Written for
this library from the `TUNE` registry (`tdef`, `TV`, `ON`, `tuneUI`) of
the earlier dog simulator whose code is public in
[dog-simulator/legacy](https://github.com/hackbuild/dog-simulator/tree/main/legacy), called the legacy registry below.

What is in it:

- `createRegistry({ master, storage, storageKey, version, renames })`
  with `define`, `defineLayer`, `get`, `set` (clamped to the range),
  `layer` (master and layer both on), `reset`, `groups`, `snapshot`.
- a `unit` and a `source` per number (`measured`, `computed`, `vendor`,
  `inferred`, `unknown`) with an optional `cite`, shown beside the value.
- a default and a range per number; `set` clamps into the range and
  ignores NaN and the infinities.
- presets: `definePreset`, `applyPreset`, `presets`.
- sharing: `toUrlHash` writes only values that differ from their defaults
  as one `tune=` field, so it sits beside other hash fields
  (`#test&seed=3&tune=2|L.plume:0`); `fromUrlHash` reads it back.
- saves hold only the values that differ from their defaults, as
  `{ ver, d }`, so a new build's defaults reach saved sessions (the legacy
  bug where a first run snapshot of every value pinned old defaults).
  `toJSON`, `fromJSON`, `restore` from storage. A save of another version
  goes through an explicit `migrate[ver]` that returns what is safe to
  keep; with no migration for that version nothing is kept. Version 0 is
  the bare legacy export. Unknown keys are skipped and returned.
- `renames` map old keys to new ones. A key never changes meaning: a new
  meaning (wag rate in Hz becoming a multiplier) gets a new key.
- `abPair(layer)`: two snapshots that differ in that one layer.
- `@hackbuild/tunables/dom`: `bindPanel(host, registry, opts)` builds the
  panel with DOM calls only (labels are text, never markup), a reset per
  row, reset all, export and import, follows the registry both ways and
  can keep the URL hash in sync.

The definitions themselves (the legacy registry has 71 parameters in 8 groups, vendor
count) stay in the app.

## Install

Not published yet. From a clone:

    npm ci && npm run build -w @hackbuild/tunables

## Use

```ts
import { createRegistry } from "@hackbuild/tunables";
import { bindPanel } from "@hackbuild/tunables/dom";

const tune = createRegistry({ master: "L.organic", storage: localStorage, version: 1 });
tune.defineLayer("L.organic", "organic (off is the canned build)");
tune.defineLayer("L.plume", "sniffing in a turbulent plume");
tune.define({ key: "Se.fix", group: "senses", label: "fixation median", unit: "s", def: 0.83, min: 0.2, max: 2, step: 0.01, source: "measured", cite: "Barber 2016" });
tune.restore();
tune.fromUrlHash(location.hash);
// the hash is written with history.replaceState: no history entry per slider step
bindPanel(document.querySelector("#tune")!, tune, { syncHash: true });

if (tune.layer("L.plume")) plumeTick(dt);
```

`dist/tunables.iife.js` is the single file build: a classic script that
defines `HackbuildTunables` for pages opened from file://.

## Develop

    source ~/.nvm/nvm.sh && nvm use 22.18.0
    npx -y npm@11.21.0 install
    npm run build -w @hackbuild/tunables
    npx vitest run packages/tunables

## What is verified, and what is not

### Verified on this machine

- 2026-11-22: `npx vitest run packages/tunables` passed 15 of 15 tests
  (counted), one of them a property test over fast-check (hash round trip
  of arbitrary in range values).
- 2026-11-22: the panel test builds, updates and disposes the panel in
  happy-dom 21.0.4, including the hash sync, a row reset, export and a
  label holding markup.
- 2026-11-22: tests for the save rules: diffs only in `{ ver, d }`, a new
  default reaching an old save, the version 0 migration keeping only the
  personality, and an unmigrated version keeping nothing.

### Not verified by anything

- The panel in a real browser: nobody has looked at it, and it ships no
  stylesheet.
- The IIFE bundle on a page opened from file:// in a browser. It loads in
  a Node vm context and writes a hash (checked by hand, 2026-11-22).
- Import through the file input: only the export button is tested.
- Storage quota errors are swallowed and the values stay live; no test
  forces one.

## Size budget

| file | raw | gzip |
|---|---|---|
| `tunables.iife.js` | 11,598 bytes | 3,913 bytes |

Measured 2026-11-23 by tools/check-sizes.mjs (gzip level 9). Budget: under 16 KB raw.

## Licence

Code MIT (`LICENSE`, a copy of the repository root one). This README is CC-BY-4.0, its
code samples also MIT.
