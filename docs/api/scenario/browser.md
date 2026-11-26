# browser

## Interfaces

### BrowserRunOptions

Options of a run in the page: the lockstep options, the handle actions see, yielding between chunks and a shot callback.

#### Extends

- `Omit`\<[`LockstepOptions`](index.md#lockstepoptions), `"api"` \| `"handle"`\>

#### Extended by

- [`BrowserSuiteOptions`](#browsersuiteoptions)

#### Properties

| Property | Type | Description | Inherited from |
| ------ | ------ | ------ | ------ |
| <a id="property-chunk"></a> `chunk?` | `number` | steps per call into the page (default 30) | [`LockstepOptions`](index.md#lockstepoptions).[`chunk`](index.md#property-chunk) |
| <a id="property-handle"></a> `handle?` | `unknown` | what `h` is bound to in actions and probes (default the sim) | - |
| <a id="property-onevent"></a> `onEvent?` | (`e`) => `void` | - | [`LockstepOptions`](index.md#lockstepoptions).[`onEvent`](index.md#property-onevent) |
| <a id="property-onprogress"></a> `onProgress?` | (`simSeconds`, `wallSeconds`) => `void` | - | [`LockstepOptions`](index.md#lockstepoptions).[`onProgress`](index.md#property-onprogress) |
| <a id="property-onshot"></a> `onShot?` | (`path`) => `unknown` | called after `render()` for each shot; capture the canvas here | - |
| <a id="property-stepspersecond"></a> `stepsPerSecond?` | `number` | - | [`LockstepOptions`](index.md#lockstepoptions).[`stepsPerSecond`](index.md#property-stepspersecond) |
| <a id="property-whenevery"></a> `whenEvery?` | `number` | steps between checks of `when` actions (default 15) | [`LockstepOptions`](index.md#lockstepoptions).[`whenEvery`](index.md#property-whenevery) |
| <a id="property-yield"></a> `yield?` | `boolean` | give the event loop a turn after each chunk so the page stays live (default true) | - |

***

### BrowserSuiteOptions

Options of `runScenarios`: the scenarios, a sim maker per seed, goldens to compare and a result callback.

#### Extends

- [`BrowserRunOptions`](#browserrunoptions)

#### Properties

| Property | Type | Description | Inherited from |
| ------ | ------ | ------ | ------ |
| <a id="property-browser"></a> `browser?` | `string` | the report's browser line (default the user agent) | - |
| <a id="property-chunk-1"></a> `chunk?` | `number` | steps per call into the page (default 30) | [`LockstepOptions`](index.md#lockstepoptions).[`chunk`](index.md#property-chunk) |
| <a id="property-date"></a> `date?` | `string` | - | - |
| <a id="property-goldens"></a> `goldens?` | `Record`\<`string`, \{ `hash?`: `string` \| `null`; `rows`: `unknown`[][]; \}\> | golden traces by scenario name; with them each result says identical, differs or missing | - |
| <a id="property-handle-1"></a> `handle?` | `unknown` | what `h` is bound to in actions and probes (default the sim) | [`BrowserRunOptions`](#browserrunoptions).[`handle`](#property-handle) |
| <a id="property-makesim"></a> `makeSim` | (`seed`, `sc`) => [`Sim`](#sim) \| `Promise`\<[`Sim`](#sim)\> | a fresh sim seeded for the scenario | - |
| <a id="property-onevent-1"></a> `onEvent?` | (`e`) => `void` | - | [`LockstepOptions`](index.md#lockstepoptions).[`onEvent`](index.md#property-onevent) |
| <a id="property-onprogress-1"></a> `onProgress?` | (`simSeconds`, `wallSeconds`) => `void` | - | [`LockstepOptions`](index.md#lockstepoptions).[`onProgress`](index.md#property-onprogress) |
| <a id="property-onresult"></a> `onResult?` | (`r`, `t`) => `void` | called as each scenario finishes | - |
| <a id="property-onshot-1"></a> `onShot?` | (`path`) => `unknown` | called after `render()` for each shot; capture the canvas here | [`BrowserRunOptions`](#browserrunoptions).[`onShot`](#property-onshot) |
| <a id="property-scenarios"></a> `scenarios` | [`Scenario`](index.md#scenario)[] | - | - |
| <a id="property-stepspersecond-1"></a> `stepsPerSecond?` | `number` | - | [`LockstepOptions`](index.md#lockstepoptions).[`stepsPerSecond`](index.md#property-stepspersecond) |
| <a id="property-whenevery-1"></a> `whenEvery?` | `number` | steps between checks of `when` actions (default 15) | [`LockstepOptions`](index.md#lockstepoptions).[`whenEvery`](index.md#property-whenevery) |
| <a id="property-yield-1"></a> `yield?` | `boolean` | give the event loop a turn after each chunk so the page stays live (default true) | [`BrowserRunOptions`](#browserrunoptions).[`yield`](#property-yield) |

***

### CheckSpec

A check in a scenario file: `js` is an expression of `t` (the trace) and `m` (the metrics) giving a number.

#### Extends

- `Omit`\<[`Check`](index.md#check), `"measured"`\>

#### Properties

| Property | Type | Description | Inherited from |
| ------ | ------ | ------ | ------ |
| <a id="property-constraint"></a> `constraint` | `string` | what sets the bound: "set by the stall detector, 0.2 m in 2 s" | [`Check`](index.md#check).[`constraint`](index.md#property-constraint) |
| <a id="property-fix"></a> `fix?` | `string` | - | [`Check`](index.md#check).[`fix`](index.md#property-fix) |
| <a id="property-js"></a> `js` | `string` | - | - |
| <a id="property-kind"></a> `kind?` | `"measured"` \| `"computed"` \| `"inferred"` | where the number comes from (RULES: measured, computed, inferred) | [`Check`](index.md#check).[`kind`](index.md#property-kind) |
| <a id="property-legal"></a> `legal` | `object` | the legal range, either bound may be open | [`Check`](index.md#check).[`legal`](index.md#property-legal) |
| `legal.max?` | `number` | - | - |
| `legal.min?` | `number` | - | - |
| <a id="property-optional"></a> `optional?` | `boolean` | a check that may not run without failing the report (it still prints as not run) | [`Check`](index.md#check).[`optional`](index.md#property-optional) |
| <a id="property-unit"></a> `unit?` | `string` | - | [`Check`](index.md#check).[`unit`](index.md#property-unit) |
| <a id="property-what"></a> `what` | `string` | what was checked, lowercase: "foot slide", "stall" | [`Check`](index.md#check).[`what`](index.md#property-what) |

***

### Sim

The sim contract: the same as `window.__sim` for the Node runner.

#### Methods

##### render()?

```ts
render?(): unknown;
```

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
trace(): 
  | SimTrace
| Promise<SimTrace>;
```

###### Returns

  \| [`SimTrace`](index.md#simtrace)
  \| `Promise`\<[`SimTrace`](index.md#simtrace)\>

## Functions

### measureCheck()

```ts
function measureCheck(spec, t): Check;
```

Measures a check spec against a trace; a throw or a non number reads as not run.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `spec` | [`CheckSpec`](#checkspec) |
| `t` | [`Trace`](index.md#trace-1) |

#### Returns

[`Check`](index.md#check)

***

### parseScenario()

```ts
function parseScenario(input): Scenario;
```

A scenario from JSON text or a parsed object: name, seed, seconds,
actions, probes, shots and check specs. Code fields are strings run with
`new Function`, so load only files you trust in this page.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `input` | `unknown` |

#### Returns

[`Scenario`](index.md#scenario)

***

### parseTrace()

```ts
function parseTrace(input): Trace;
```

A trace or golden file from JSON text or an object: rows, and cols, hash, probes, fired when present.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `input` | `unknown` |

#### Returns

[`Trace`](index.md#trace-1)

***

### runScenario()

```ts
function runScenario(
   sim, 
   sc, 
   o?
): Promise<Trace>;
```

Runs one scenario against a sim made with the scenario's seed.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `sim` | [`Sim`](#sim) |
| `sc` | [`Scenario`](index.md#scenario) |
| `o?` | [`BrowserRunOptions`](#browserrunoptions) |

#### Returns

`Promise`\<[`Trace`](index.md#trace-1)\>

***

### runScenarios()

```ts
function runScenarios(o): Promise<Report & object>;
```

Runs scenarios one after another in this page and returns a report with the traces.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `o` | [`BrowserSuiteOptions`](#browsersuiteoptions) |

#### Returns

`Promise`\<[`Report`](index.md#report) & `object`\>

***

### simDriver()

```ts
function simDriver(sim, o?): Driver;
```

A driver over a sim object in this page.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `sim` | [`Sim`](#sim) |
| `o?` | [`BrowserRunOptions`](#browserrunoptions) |

#### Returns

[`Driver`](index.md#driver)

## References

### Action

Re-exports [Action](index.md#action)

***

### Check

Re-exports [Check](index.md#check)

***

### checkMessage

Re-exports [checkMessage](index.md#checkmessage)

***

### Code

Re-exports [Code](index.md#code)

***

### codeText

Re-exports [codeText](index.md#codetext)

***

### createProfiler

Re-exports [createProfiler](profiler.md#createprofiler)

***

### diffMessage

Re-exports [diffMessage](index.md#diffmessage)

***

### diffRows

Re-exports [diffRows](index.md#diffrows)

***

### diffTraces

Re-exports [diffTraces](index.md#difftraces)

***

### drive

Re-exports [drive](index.md#drive)

***

### Driver

Re-exports [Driver](index.md#driver)

***

### exact

Re-exports [exact](index.md#exact)

***

### formatReport

Re-exports [formatReport](index.md#formatreport)

***

### frameStats

Re-exports [frameStats](metrics.md#framestats)

***

### jerk

Re-exports [jerk](metrics.md#jerk)

***

### LockstepOptions

Re-exports [LockstepOptions](index.md#lockstepoptions)

***

### percentile

Re-exports [percentile](metrics.md#percentile)

***

### Point

Re-exports [Point](metrics.md#point)

***

### Probe

Re-exports [Probe](index.md#probe)

***

### ProfileEntry

Re-exports [ProfileEntry](profiler.md#profileentry)

***

### Profiler

Re-exports [Profiler](profiler.md#profiler)

***

### Report

Re-exports [Report](index.md#report)

***

### reportPasses

Re-exports [reportPasses](index.md#reportpasses)

***

### RowDifference

Re-exports [RowDifference](index.md#rowdifference)

***

### Scenario

Re-exports [Scenario](index.md#scenario)

***

### ScenarioEvent

Re-exports [ScenarioEvent](index.md#scenarioevent)

***

### ScenarioResult

Re-exports [ScenarioResult](index.md#scenarioresult)

***

### Shot

Re-exports [Shot](index.md#shot-1)

***

### SimTrace

Re-exports [SimTrace](index.md#simtrace)

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

***

### Trace

Re-exports [Trace](index.md#trace-1)

***

### traceHash

Re-exports [traceHash](index.md#tracehash)

***

### TraceLike

Re-exports [TraceLike](index.md#tracelike)

***

### verdict

Re-exports [verdict](index.md#verdict-1)

***

### Verdict

Re-exports [Verdict](index.md#verdict)
