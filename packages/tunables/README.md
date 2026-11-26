# @hackbuild/tunables

A parameter registry with layer switches, presets and URL hash sharing for A/B work on agent behaviour.

[![npm](https://img.shields.io/npm/v/@hackbuild/tunables)](https://www.npmjs.com/package/@hackbuild/tunables) [![licence MIT](https://img.shields.io/badge/licence-MIT-blue)](../../LICENSE) ![gzip 2.4 kB measured](https://img.shields.io/badge/gzip-2.4%20kB-blue) ![types included](https://img.shields.io/badge/types-included-blue)

## What it does

- Defines every number that shapes behaviour once, with its range, step, unit, note and where the default comes from.
- Gates whole features behind layer switches under one master switch, so each feature keeps a fallback you can compare live.
- Saves only the values that differ from their defaults, so new defaults reach old sessions, with explicit migrations between versions.
- Shares a setup as one `tune=` field in the URL hash, beside the other hash fields of your page.
- Builds a panel for the registry with DOM calls only, styled by the hackbuild-ui `hb-tunables` class.

## Install

```sh
npm install @hackbuild/tunables
```

No dependencies and no peers. The panel in `@hackbuild/tunables/dom` ships no styles: install @virgilvox/hackbuild-ui and load its hackbuild.css for the `hb-tunables` look. `dist/tunables.iife.js` is the single file build, a classic script that defines `HackbuildTunables` with the panel included, for pages opened from file://.

## Quick start

```ts
import { createRegistry } from "@hackbuild/tunables";
import { bindPanel } from "@hackbuild/tunables/dom";

// one master layer, one feature layer and one number with its range and source
const tune = createRegistry({ master: "L.organic", storage: localStorage, version: 1 });
tune.defineLayer("L.organic", "organic (off is the canned build)");
tune.defineLayer("L.plume", "sniffing in a turbulent plume");
tune.define({ key: "Se.fix", group: "senses", label: "fixation median", unit: "s", def: 0.83, min: 0.2, max: 2, step: 0.01, source: "measured" });
tune.restore();
tune.fromUrlHash(location.hash);

// a panel in a host with the hackbuild-ui hb-tunables class; the URL hash follows every change
const host = document.body.appendChild(document.createElement("div"));
host.className = "hb-tunables";
bindPanel(host, tune, { syncHash: true });

tune.onChange((key, value) => console.log(key, value, "layer on:", tune.layer("L.plume")));
tune.set("Se.fix", 5); // clamped to 2
```

## Live example

The [tunables page](https://hackbuild.github.io/hackbuild-agents/tunables/) shows how the registry works with its install line and code. The [dog simulator](https://hackbuild.github.io/dog-simulator/) keeps every number that shapes its dog in a registry from this package, with its organic layers as layer switches.

## Concepts

### parameters with a source

`define` takes a `ParamDef`: `key`, `group`, `label`, `def`, `min`, `max`, `step`, and optionally `unit`, `note`, `source` and `cite`. The source is one of `measured`, `computed`, `vendor`, `inferred` or `unknown`, shown beside the value with the citation. `set` clamps into the range and ignores NaN and the infinities; a key that was never defined throws.

### layers and the master switch

`defineLayer(key, label)` adds a switch of 1 or 0 in the `layers` group. `layer(key)` answers true only when both the master layer named in `createRegistry` and that layer are on, so the master turns every feature back to its fallback at once. `abPair(layer)` gives two snapshots that differ in that one layer.

### saves keep only differences

`toJSON()` writes `{ ver, d }` with only the values that differ from their defaults, and `restore()` reads them from `storage`, so a new default reaches a saved session. A save of another version goes through `migrate[ver]`, which returns what is safe to keep; with no migration for that version nothing is kept. Version 0 is a bare values object with no `ver`. Unknown keys are skipped and returned.

### keys never change meaning

`renames` maps old keys to new ones when loading saves, hashes and JSON. When a number gets a new meaning, such as a rate in Hz becoming a multiplier, give it a new key and rename or drop the old one.

### sharing through the URL hash

`toUrlHash()` writes only changed values as one `tune=` field, such as `#test&seed=3&tune=2|L.plume:0`, so it sits beside other fields; `fromUrlHash` reads it back and returns what it skipped. Presets come from `definePreset` and `applyPreset`.

### the panel

`bindPanel(host, registry, options)` builds groups of rows with a reset per row, reset all, export and import, using DOM calls only, so labels and notes are text and never markup. It follows the registry both ways. With `syncHash: true` it writes the hash through `history.replaceState`, so a slider drag adds no history entries. Call `dispose()` to remove it.

## API overview

| export | what it does |
|---|---|
| [`createRegistry`](../../docs/api/tunables/index.md#createregistry) | an empty registry with master, storage, version, migrations and renames |
| [`Registry`](../../docs/api/tunables/index.md#registry) | define, get, set, layer, presets, saves, URL hash and change events |
| [`ParamDef`](../../docs/api/tunables/index.md#paramdef) | one parameter with its range and source |
| [`Source`](../../docs/api/tunables/index.md#source) | where a default comes from |
| [`formatValue`](../../docs/api/tunables/index.md#formatvalue), [`decimalsFor`](../../docs/api/tunables/index.md#decimalsfor) | a value as text with the decimals its step calls for |
| [`bindPanel`](../../docs/api/tunables/dom.md#bindpanel) | the tune panel, from `@hackbuild/tunables/dom` |
| [`Panel`](../../docs/api/tunables/dom.md#panel), [`PanelOptions`](../../docs/api/tunables/dom.md#paneloptions) | the built panel and its options |

The full reference is in [docs/api/tunables](../../docs/api/tunables/README.md).

## Browser support

| feature | needs | Chrome | Safari | Firefox | phone |
|---|---|---|---|---|---|
| registry, saves, URL hash | ES2022, plain TypeScript | yes | yes | yes | yes |
| `bindPanel` | DOM, `history.replaceState` | yes | yes | yes | yes |
| saves | `localStorage` or any `getItem` and `setItem` store | yes | yes, not in some private windows | yes | yes |
| `dist/tunables.iife.js` from file:// | a classic script | yes | yes | yes | yes |

Storage errors are swallowed: when storage is blocked the values stay live and are not saved.

## Errors and troubleshooting

| message | cause | what to do |
|---|---|---|
| `tunables: no parameter named <key>` | `get`, `set`, `def`, a preset or `abPair` named a key that was never defined | define it first, or check the key |
| `tunables: <key> is defined twice` | `define` or `defineLayer` called twice with one key | define each key once |
| `tunables: <key> default <def> is outside <min> to <max>` | the default is out of its range | fix the range or the default |
| `tunables: <key> step must be above 0` | a step of 0 or less | pass a positive step |
| `tunables: saved settings must be an object` | `fromJSON` got something other than an object | pass the parsed output of `toJSON` |
| `tunables: no preset named <name>` | `applyPreset` with an unknown name | define it with `definePreset` |

The panel's import passes a read or parse error to `onImport` instead of throwing.

## Works with

- [@hackbuild/drives](../drives/README.md) and [@hackbuild/senses](../senses/README.md) take the numbers a registry holds as their options.
- [@hackbuild/scenario](../scenario/README.md) runs a scenario twice, once per snapshot of an `abPair`, when you pass the values to your sim.
- [@hackbuild/agents-views](../agents-views/README.md) shows the brain the numbers shape, on the same hackbuild-ui class layer.

## Changelog and licences

Changes are in the repository [CHANGELOG](../../CHANGELOG.md). Code is MIT ([LICENSE](../../LICENSE)). This README is CC-BY-4.0 with its code samples also MIT.

## What is verified, and what is not

### Verified on this machine

| date | check | result |
|---|---|---|
| 2026-11-22 | `npx vitest run packages/tunables`, with a fast-check property test of the hash round trip over in range values | 15 of 15 tests pass (counted) |
| 2026-11-22 | the panel in happy-dom 21.0.4: build, update, dispose, hash sync, a row reset, export, a label holding markup | passes |
| 2026-11-22 | save rules: differences only in `{ ver, d }`, a new default reaching an old save, the version 0 migration, an unmigrated version keeping nothing | passes |
| 2026-11-22 | the iife bundle in a Node vm context writing a hash | checked by hand |

### Not verified by anything

- The panel in a real browser: nobody has looked at it.
- The iife bundle on a page opened from file:// in a browser.
- Import through the file input: only the export button is tested.
- A storage quota error: none is forced in a test.

## Size budget

| file | gzip (measured) | ceiling |
|---|---|---|
| `dist/index.js` (main entry, imports external) | 2,402 bytes | 2,522 bytes |
| `dist/tunables.iife.js` (single file build) | 4,031 bytes | 4,232 bytes |

Measured 2026-11-26 by `node tools/lint-packages.mjs` (gzip level 9) from the packed
tarball. Generated from `tools/size-budget.json`; CI fails when a file moves more than
5 percent from its row.
