# index

## Interfaces

### Action

Something a scenario does to the sim, at a sim time or once a page condition holds.

#### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-at"></a> `at?` | `number` | sim seconds; or `when`, a page condition checked every `whenEvery` steps, fired once |
| <a id="property-js"></a> `js` | [`Code`](#code) | - |
| <a id="property-when"></a> `when?` | [`Code`](#code) | - |

***

### Check

One check of a run: what was measured, the legal range, the constraint that sets it and the fix.

#### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-constraint"></a> `constraint` | `string` | what sets the bound: "set by the stall detector, 0.2 m in 2 s" |
| <a id="property-fix"></a> `fix?` | `string` | - |
| <a id="property-kind"></a> `kind?` | `"measured"` \| `"computed"` \| `"inferred"` | where the number comes from (RULES: measured, computed, inferred) |
| <a id="property-legal"></a> `legal` | `object` | the legal range, either bound may be open |
| `legal.max?` | `number` | - |
| `legal.min?` | `number` | - |
| <a id="property-measured"></a> `measured` | `number` \| `null` | the measured value, or null when the check did not run |
| <a id="property-optional"></a> `optional?` | `boolean` | a check that may not run without failing the report (it still prints as not run) |
| <a id="property-unit"></a> `unit?` | `string` | - |
| <a id="property-what"></a> `what` | `string` | what was checked, lowercase: "foot slide", "stall" |

***

### Driver

The side of a run that touches the sim.

#### Methods

##### act()

```ts
act(code): unknown;
```

runs an action body

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `code` | [`Code`](#code) |

###### Returns

`unknown`

##### read()

```ts
read(code): unknown;
```

evaluates an expression or function and returns its value

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `code` | [`Code`](#code) |

###### Returns

`unknown`

##### shot()?

```ts
shot?(path): unknown;
```

renders and records a shot after its optional code ran

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `path` | `string` |

###### Returns

`unknown`

##### step()

```ts
step(n): unknown;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `n` | `number` |

###### Returns

`unknown`

##### trace()

```ts
trace(): SimTrace | Promise<SimTrace>;
```

###### Returns

[`SimTrace`](#simtrace) \| `Promise`\<[`SimTrace`](#simtrace)\>

***

### LockEntry

One pinned URL of an assets lock: the URL, the local file and its SHA-256.

#### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-file"></a> `file` | `string` | the local file, relative to the lock file's root |
| <a id="property-sha256"></a> `sha256` | `string` | - |
| <a id="property-url"></a> `url` | `string` | the remote URL the page asks for |

***

### LockstepOptions

Options of a lockstep run: steps per second, chunk size, the page API, `when` checks and progress callbacks.

#### Extended by

- [`SuiteOptions`](#suiteoptions)

#### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-api"></a> `api?` | `string` | the page API expression (default `window.__sim`) |
| <a id="property-chunk"></a> `chunk?` | `number` | steps per call into the page (default 30) |
| <a id="property-handle"></a> `handle?` | `string` | what `h` is bound to in actions and probes (default the api) |
| <a id="property-onevent"></a> `onEvent?` | (`e`) => `void` | - |
| <a id="property-onprogress"></a> `onProgress?` | (`simSeconds`, `wallSeconds`) => `void` | - |
| <a id="property-stepspersecond"></a> `stepsPerSecond?` | `number` | - |
| <a id="property-whenevery"></a> `whenEvery?` | `number` | steps between checks of `when` actions (default 15) |

***

### Opened

What `open` returns: the browser, the page and the log of errors, warnings, blocked and served requests.

#### Properties

| Property | Type |
| ------ | ------ |
| <a id="property-browser"></a> `browser` | `Browser` |
| <a id="property-log"></a> `log` | [`PageLog`](#pagelog) |
| <a id="property-page"></a> `page` | `Page` |

#### Methods

##### close()

```ts
close(): Promise<void>;
```

###### Returns

`Promise`\<`void`\>

***

### OpenOptions

Options of `open`: the page, routes, offline mode, viewport, Chrome path, GPU flags and a hook before navigation.

#### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-args"></a> `args?` | `string`[] | - |
| <a id="property-beforegoto"></a> `beforeGoto?` | (`page`) => `Promise`\<`void`\> | runs before the page loads (install samplers, expose bindings) |
| <a id="property-chrome"></a> `chrome?` | `string` | - |
| <a id="property-gpu"></a> `gpu?` | `"swiftshader"` \| `"default"` | "swiftshader" (default) for lockstep runs, "default" for real frame rate |
| <a id="property-hash"></a> `hash?` | `string` | - |
| <a id="property-headless"></a> `headless?` | `boolean` | - |
| <a id="property-height"></a> `height?` | `number` | - |
| <a id="property-offline"></a> `offline?` | `boolean` | refuse every request that is not file:, data: or blob: (the self contained build check) |
| <a id="property-routes"></a> `routes?` | [`Route`](#route)[] | - |
| <a id="property-timeoutms"></a> `timeoutMs?` | `number` | - |
| <a id="property-url-1"></a> `url` | `string` | a file path or URL |
| <a id="property-width"></a> `width?` | `number` | learned in earlier builds: 420 by 280 reaches about 20 fps under swiftshader |

***

### PageLog

Errors, warnings, blocked and served requests a page made, and the Chrome version.

#### Properties

| Property | Type |
| ------ | ------ |
| <a id="property-blocked"></a> `blocked` | `string`[] |
| <a id="property-errors"></a> `errors` | `string`[] |
| <a id="property-served"></a> `served` | `string`[] |
| <a id="property-version"></a> `version` | `string` |
| <a id="property-warnings"></a> `warnings` | `string`[] |

***

### Probe

An expression read from the sim every `every` sim seconds and kept in the trace.

#### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-every"></a> `every` | `number` | - |
| <a id="property-js-1"></a> `js` | [`Code`](#code) | an expression returning JSON |

***

### RafReading

What `readRaf` returns: frame intervals in ms, the per frame samples and their stats.

#### Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| <a id="type-parameter-t"></a> `T` | `unknown` |

#### Properties

| Property | Type |
| ------ | ------ |
| <a id="property-error"></a> `error?` | `string` |
| <a id="property-frames"></a> `frames` | `number`[] |
| <a id="property-samples"></a> `samples` | `T`[] |
| <a id="property-stats"></a> `stats` | [`Stats`](metrics.md#stats) |

***

### Report

A suite report: the date, the Chrome version and a result per scenario.

#### Properties

| Property | Type |
| ------ | ------ |
| <a id="property-chrome-1"></a> `chrome` | `string` |
| <a id="property-date"></a> `date` | `string` |
| <a id="property-results"></a> `results` | [`ScenarioResult`](#scenarioresult)[] |

***

### RouteHit

How a routed request is answered: a local file with an optional SHA-256 pin, or a fixed body.

#### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-body"></a> `body?` | `string` \| `Uint8Array`\<`ArrayBufferLike`\> | or a body to serve |
| <a id="property-contenttype"></a> `contentType?` | `string` | - |
| <a id="property-file-1"></a> `file?` | `string` | a local file to serve |
| <a id="property-sha256-1"></a> `sha256?` | `string` | checked before the file is served; a mismatch fails the request and is recorded |

***

### RowDifference

One differing row of two traces, with the first differing column.

#### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-a"></a> `a` | `unknown` | - |
| <a id="property-b"></a> `b` | `unknown` | - |
| <a id="property-col"></a> `col` | `number` | the first differing column, or -1 when a row is missing |
| <a id="property-row"></a> `row` | `number` | - |

***

### Scenario

One scenario: a name, a seed, a length in sim seconds, actions, probes, shots and checks.

#### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-actions"></a> `actions?` | [`Action`](#action)[] | - |
| <a id="property-checks"></a> `checks?` | (`t`) => [`Check`](#check)[] | - |
| <a id="property-hash-1"></a> `hash?` | `string` | extra hash fields after `#test&seed=N`, such as `off=L.neural` |
| <a id="property-name"></a> `name` | `string` | - |
| <a id="property-probes"></a> `probes?` | [`Probe`](#probe)[] | - |
| <a id="property-seconds"></a> `seconds` | `number` | - |
| <a id="property-seed"></a> `seed` | `number` | - |
| <a id="property-shots"></a> `shots?` | [`Shot`](#shot-1)[] | - |

***

### ScenarioResult

The result of one scenario: its checks, the golden comparison, errors and blocked requests.

#### Properties

| Property | Type |
| ------ | ------ |
| <a id="property-blocked-1"></a> `blocked` | `string`[] |
| <a id="property-checks-1"></a> `checks` | [`Check`](#check)[] |
| <a id="property-errors-1"></a> `errors` | `string`[] |
| <a id="property-firstdifference"></a> `firstDifference?` | `unknown` |
| <a id="property-golden"></a> `golden?` | `"identical"` \| `"differs"` \| `"missing"` \| `"recorded"` |
| <a id="property-name-1"></a> `name` | `string` |
| <a id="property-seed-1"></a> `seed` | `number` |

***

### Shot

A screenshot at a sim time, written to `path`, after optional code ran.

#### Properties

| Property | Type |
| ------ | ------ |
| <a id="property-at-1"></a> `at` | `number` |
| <a id="property-js-2"></a> `js?` | [`Code`](#code) |
| <a id="property-path"></a> `path` | `string` |

***

### SimTrace

What `trace()` on the sim returns.

#### Properties

| Property | Type |
| ------ | ------ |
| <a id="property-cols"></a> `cols?` | `string`[] |
| <a id="property-hash-2"></a> `hash?` | `string` |
| <a id="property-rows"></a> `rows` | `unknown`[][] |

***

### SuiteOptions

Options of `runSuite`: the page file, the scenarios, the mode, goldens, routes, viewport and parallel browsers.

#### Extends

- [`LockstepOptions`](#lockstepoptions)

#### Properties

| Property | Type | Description | Inherited from |
| ------ | ------ | ------ | ------ |
| <a id="property-api-1"></a> `api?` | `string` | the page API expression (default `window.__sim`) | [`LockstepOptions`](#lockstepoptions).[`api`](#property-api) |
| <a id="property-chrome-2"></a> `chrome?` | `string` | - | - |
| <a id="property-chunk-1"></a> `chunk?` | `number` | steps per call into the page (default 30) | [`LockstepOptions`](#lockstepoptions).[`chunk`](#property-chunk) |
| <a id="property-date-1"></a> `date?` | `string` | - | - |
| <a id="property-file-2"></a> `file` | `string` | the built page | - |
| <a id="property-goldendir"></a> `goldenDir?` | `string` | golden traces go to \<goldenDir\>/\<name\>.json | - |
| <a id="property-handle-1"></a> `handle?` | `string` | what `h` is bound to in actions and probes (default the api) | [`LockstepOptions`](#lockstepoptions).[`handle`](#property-handle) |
| <a id="property-height-1"></a> `height?` | `number` | - | - |
| <a id="property-jobs"></a> `jobs?` | `number` | parallel browsers (default 2) | - |
| <a id="property-mode"></a> `mode` | `"record"` \| `"compare"` \| `"check"` | - | - |
| <a id="property-offline-1"></a> `offline?` | `boolean` | - | - |
| <a id="property-onevent-1"></a> `onEvent?` | (`e`) => `void` | - | [`LockstepOptions`](#lockstepoptions).[`onEvent`](#property-onevent) |
| <a id="property-onprogress-1"></a> `onProgress?` | (`simSeconds`, `wallSeconds`) => `void` | - | [`LockstepOptions`](#lockstepoptions).[`onProgress`](#property-onprogress) |
| <a id="property-readyms"></a> `readyMs?` | `number` | wait this long for the page API (default 240 s) | - |
| <a id="property-routes-1"></a> `routes?` | [`Route`](#route)[] | - | - |
| <a id="property-scenarios"></a> `scenarios` | [`Scenario`](#scenario)[] | - | - |
| <a id="property-stepspersecond-1"></a> `stepsPerSecond?` | `number` | - | [`LockstepOptions`](#lockstepoptions).[`stepsPerSecond`](#property-stepspersecond) |
| <a id="property-whenevery-1"></a> `whenEvery?` | `number` | steps between checks of `when` actions (default 15) | [`LockstepOptions`](#lockstepoptions).[`whenEvery`](#property-whenevery) |
| <a id="property-width-1"></a> `width?` | `number` | - | - |

***

### Trace

What a run recorded: the sim rows, probes, fired conditions and the wall time.

#### Properties

| Property | Type |
| ------ | ------ |
| <a id="property-cols-1"></a> `cols?` | `string`[] |
| <a id="property-fired"></a> `fired` | \[`number`, `string`\][] |
| <a id="property-hash-3"></a> `hash?` | `string` |
| <a id="property-probes-1"></a> `probes` | \[`number`, `unknown`\][] |
| <a id="property-rows-1"></a> `rows` | `unknown`[][] |
| <a id="property-wallseconds"></a> `wallSeconds` | `number` |

## Type Aliases

### Code

```ts
type Code = string | ((h) => unknown);
```

Page code with `h` bound to the sim handle: a string (a statement body
for actions, an expression for `when` and probes) or a function of `h`.
In Node a function is sent to the page by its source, so it must not
close over anything.

***

### Route

```ts
type Route = (url) => RouteHit | null;
```

A request router: returns how to answer a URL, or null to pass it to the next route.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `url` | `URL` |

#### Returns

[`RouteHit`](#routehit) \| `null`

***

### ScenarioEvent

```ts
type ScenarioEvent = 
  | {
  simSeconds: number;
  step: number;
  total: number;
  type: "step";
}
  | {
  step: number;
  type: "action";
}
  | {
  step: number;
  type: "fired";
  when: string;
}
  | {
  step: number;
  type: "probe";
  value: unknown;
}
  | {
  path: string;
  step: number;
  type: "shot";
};
```

One event per thing the runner did, in order, for a live view.

***

### TraceLike

```ts
type TraceLike = object;
```

The part of a trace two traces are compared on: rows and an optional hash.

#### Properties

##### hash?

```ts
hash?: string | null;
```

##### rows

```ts
rows: unknown[][];
```

***

### Verdict

```ts
type Verdict = "pass" | "fail" | "not run";
```

The verdict of a check: pass, fail, or not run when nothing was measured.

## Variables

### CHROME\_MAC

```ts
const CHROME_MAC: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
```

Where Chrome lives on macOS.

***

### DEFAULT\_ARGS

```ts
const DEFAULT_ARGS: string[];
```

The Chrome flags every run gets: autoplay without a gesture, muted audio, file access from files.

***

### SWIFTSHADER\_ARGS

```ts
const SWIFTSHADER_ARGS: string[];
```

Software GL, the same on every machine; for lockstep runs. Under these
flags headless Chrome 150 on macOS 12 ran 0 to 1 animation frames per
second (measured 2026-11-22), so real frame rate runs use `gpu: "default"`.

## Functions

### checkMessage()

```ts
function checkMessage(c): string;
```

One line: "stall 4.75 s, legal at most 1 s, set by the passing rule. fix: ..."

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `c` | [`Check`](#check) |

#### Returns

`string`

***

### codeText()

```ts
function codeText(c): string;
```

The source text of page code, a string as it is or a function by its source.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `c` | [`Code`](#code) |

#### Returns

`string`

***

### contentTypeOf()

```ts
function contentTypeOf(path): string;
```

The content type for a file path by its extension.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `path` | `string` |

#### Returns

`string`

***

### diffMessage()

```ts
function diffMessage(a, b): string;
```

"trace differs at row 88: heading 0.41, expected 0.39", or "traces match". `b` is the expected trace.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `a` | [`TraceLike`](#tracelike) & `object` |
| `b` | [`TraceLike`](#tracelike) |

#### Returns

`string`

***

### diffRows()

```ts
function diffRows(
   a, 
   b, 
   limit?
): object;
```

Every differing row up to `limit`, with the first differing column, for a diff view.

#### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `a` | [`TraceLike`](#tracelike) | `undefined` |
| `b` | [`TraceLike`](#tracelike) | `undefined` |
| `limit?` | `number` | `200` |

#### Returns

`object`

| Name | Type |
| ------ | ------ |
| `compared` | `number` |
| `differing` | `number` |
| `rows` | [`RowDifference`](#rowdifference)[] |

***

### diffTraces()

```ts
function diffTraces(a, b): 
  | {
  a: unknown;
  b: unknown;
  row: number;
}
  | null;
```

First differing row between two traces, or null when identical. NaN, Infinity and null all differ.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `a` | [`TraceLike`](#tracelike) |
| `b` | [`TraceLike`](#tracelike) |

#### Returns

  \| \{
  `a`: `unknown`;
  `b`: `unknown`;
  `row`: `number`;
\}
  \| `null`

***

### drive()

```ts
function drive(
   d, 
   sc, 
   o?
): Promise<Trace>;
```

Steps a scenario through a driver; the scheduler both entries share.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `d` | [`Driver`](#driver) |
| `sc` | [`Scenario`](#scenario) |
| `o?` | [`LockstepOptions`](#lockstepoptions) |

#### Returns

`Promise`\<[`Trace`](#trace-1)\>

***

### exact()

```ts
function exact(v): string;
```

JSON with NaN and the infinities kept apart from null.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `v` | `unknown` |

#### Returns

`string`

***

### findChrome()

```ts
function findChrome(): string | null;
```

The first Chrome found, or null. `HB_CHROME` overrides.

#### Returns

`string` \| `null`

***

### fixedBody()

```ts
function fixedBody(
   match, 
   body, 
   contentType
): Route;
```

Google Fonts stylesheet requests answered with a fixed body (fonts then go through other routes).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `match` | (`u`) => `boolean` |
| `body` | `string` |
| `contentType` | `string` |

#### Returns

[`Route`](#route)

***

### formatReport()

```ts
function formatReport(r): string;
```

Text report: a line per scenario, then a check message per check. Fails first.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `r` | [`Report`](#report) |

#### Returns

`string`

***

### installRafSampler()

```ts
function installRafSampler(page): Promise<void>;
```

Installs the sampler on every new document of the page. Call before goto.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `page` | `Page` |

#### Returns

`Promise`\<`void`\>

***

### npmCdn()

```ts
function npmCdn(nodeModules): Route;
```

npm CDN URLs (cdn.jsdelivr.net/npm, unpkg.com) served from a local
node_modules, only when the installed version equals the requested one.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `nodeModules` | `string` |

#### Returns

[`Route`](#route)

***

### open()

```ts
function open(o): Promise<Opened>;
```

Launches the system Chrome with routing and opens a page; throws when no Chrome is found.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `o` | [`OpenOptions`](#openoptions) |

#### Returns

`Promise`\<[`Opened`](#opened)\>

***

### pageDriver()

```ts
function pageDriver(page, o?): Driver;
```

A driver over a puppeteer page whose test API is ready.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `page` | `Page` |
| `o?` | [`LockstepOptions`](#lockstepoptions) |

#### Returns

[`Driver`](#driver)

***

### pinned()

```ts
function pinned(entries, root?): Route;
```

Exact URLs pinned to local files with hashes, as in an assets lock.

#### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `entries` | readonly [`LockEntry`](#lockentry)[] | `undefined` |
| `root?` | `string` | `"."` |

#### Returns

[`Route`](#route)

***

### readRaf()

```ts
function readRaf<T>(page): Promise<RafReading<T>>;
```

Reads and clears what the sampler has recorded.

#### Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| <a id="type-parameter-t-1"></a> `T` | `unknown` |

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `page` | `Page` |

#### Returns

`Promise`\<[`RafReading`](#rafreading)\<`T`\>\>

***

### reportPasses()

```ts
function reportPasses(r): boolean;
```

True when nothing failed, every check that is not `optional` ran, no
page error, no blocked request, and every golden matched. A check that
did not run is never a pass.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `r` | [`Report`](#report) |

#### Returns

`boolean`

***

### runLockstep()

```ts
function runLockstep(
   page, 
   sc, 
   o?
): Promise<Trace>;
```

Runs one scenario on an open page whose test API is ready.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `page` | `Page` |
| `sc` | [`Scenario`](#scenario) |
| `o?` | [`LockstepOptions`](#lockstepoptions) |

#### Returns

`Promise`\<[`Trace`](#trace-1)\>

***

### runSuite()

```ts
function runSuite(o): Promise<Report & object>;
```

Runs a scenario list, records or compares goldens, returns a report.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `o` | [`SuiteOptions`](#suiteoptions) |

#### Returns

`Promise`\<[`Report`](#report) & `object`\>

***

### serve()

```ts
function serve(hit): object;
```

Resolves a hit to bytes, checking the pin. Throws on a missing file or a hash mismatch.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `hit` | [`RouteHit`](#routehit) |

#### Returns

`object`

| Name | Type |
| ------ | ------ |
| `body` | `string` \| `Uint8Array`\<`ArrayBufferLike`\> |
| `contentType` | `string` |

***

### sha256File()

```ts
function sha256File(path): string;
```

The SHA-256 of a file in hex, cached per path.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `path` | `string` |

#### Returns

`string`

***

### traceHash()

```ts
function traceHash(t): string;
```

FNV-1a 32 bit over the exact JSON of rows, probes and fired: the same in Node and every browser.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `t` | \{ `fired?`: `unknown`[]; `probes?`: `unknown`[]; `rows`: `unknown`[][]; \} |
| `t.fired?` | `unknown`[] |
| `t.probes?` | `unknown`[] |
| `t.rows` | `unknown`[][] |

#### Returns

`string`

***

### verdict()

```ts
function verdict(c): Verdict;
```

Pass, fail or not run for one check.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `c` | [`Check`](#check) |

#### Returns

[`Verdict`](#verdict)

***

### waitFor()

```ts
function waitFor<T>(
   page, 
   expr, 
   timeoutMs, 
   everyMs?
): Promise<T | null>;
```

Polls a page condition until it is truthy or the time runs out (null).

#### Type Parameters

| Type Parameter |
| ------ |
| <a id="type-parameter-t-2"></a> `T` |

#### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `page` | `Page` | `undefined` |
| `expr` | `string` | `undefined` |
| `timeoutMs` | `number` | `undefined` |
| `everyMs?` | `number` | `250` |

#### Returns

`Promise`\<`T` \| `null`\>

## References

### createProfiler

Re-exports [createProfiler](profiler.md#createprofiler)

***

### frameStats

Re-exports [frameStats](metrics.md#framestats)

***

### jerk

Re-exports [jerk](metrics.md#jerk)

***

### percentile

Re-exports [percentile](metrics.md#percentile)

***

### Point

Re-exports [Point](metrics.md#point)

***

### ProfileEntry

Re-exports [ProfileEntry](profiler.md#profileentry)

***

### Profiler

Re-exports [Profiler](profiler.md#profiler)

***

### SlideResult

Re-exports [SlideResult](metrics.md#slideresult)

***

### sliding

Re-exports [sliding](metrics.md#sliding)

***

### stallSeconds

Re-exports [stallSeconds](metrics.md#stallseconds)

***

### stats

Re-exports [stats](metrics.md#stats-1)

***

### Stats

Re-exports [Stats](metrics.md#stats)

***

### togglesPerSecond

Re-exports [togglesPerSecond](metrics.md#togglespersecond)
