# @hackbuild/drives

## Classes

### Chooser

Softmax with commitment and reactive latencies; every decision has a why.

#### Type Parameters

| Type Parameter |
| ------ |
| <a id="type-parameter-b"></a> `B` *extends* `string` |

#### Constructors

##### Constructor

```ts
new Chooser<B>(o): Chooser<B>;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `o` | [`ChooserOptions`](#chooseroptions)\<`B`\> |

###### Returns

[`Chooser`](#chooser)\<`B`\>

#### Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="property-inner"></a> `inner` | `readonly` | `Chooser` |
| <a id="property-options"></a> `options` | `readonly` | readonly `B`[] |

#### Accessors

##### current

###### Get Signature

```ts
get current(): B;
```

###### Returns

`B`

##### done

###### Get Signature

```ts
get done(): boolean;
```

###### Returns

`boolean`

##### dwellUntil

###### Get Signature

```ts
get dwellUntil(): number;
```

###### Returns

`number`

#### Methods

##### free()

```ts
free(): void;
```

Frees the wasm memory now, before the garbage collector would; the object is unusable after.

###### Returns

`void`

##### markDone()

```ts
markDone(): void;
```

The executor reports the current act finished.

###### Returns

`void`

##### set()

```ts
set(id, now): void;
```

Switches now (a cue, a command); the done flag resets and a new dwell is drawn.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `id` | `B` |
| `now` | `number` |

###### Returns

`void`

##### setTemperature()

```ts
setTemperature(t, commitment): void;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `t` | `number` |
| `commitment` | `number` |

###### Returns

`void`

##### update()

```ts
update(
   now, 
   utilities, 
   reactive?, 
   forced?
): Decision<B>;
```

One update. Options missing from `utilities` score 0.

###### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `now` | `number` | `undefined` |
| `utilities` | `Partial`\<`Record`\<`B`, `number`\>\> | `undefined` |
| `reactive?` | `Iterable`\<`B`\> | `[]` |
| `forced?` | `B` | `undefined` |

###### Returns

[`Decision`](#decision)\<`B`\>

***

### Completion

A completion flag bound to the goal it was raised for.

#### Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| <a id="type-parameter-g"></a> `G` | `string` |

#### Constructors

##### Constructor

```ts
new Completion<G>(): Completion<G>;
```

###### Returns

[`Completion`](#completion)\<`G`\>

#### Accessors

##### current

###### Get Signature

```ts
get current(): G | null;
```

###### Returns

`G` \| `null`

#### Methods

##### begin()

```ts
begin(goal, now): boolean;
```

A new goal: the flag resets. The same goal again while it is in
progress changes nothing; the same goal after it was done starts it
anew (walking to the bench a second time). Returns true when a task
started.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `goal` | `G` |
| `now` | `number` |

###### Returns

`boolean`

##### elapsed()

```ts
elapsed(now): number;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `now` | `number` |

###### Returns

`number`

##### isDone()

```ts
isDone(goal): boolean;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `goal` | `G` |

###### Returns

`boolean`

##### report()

```ts
report(goal): boolean;
```

Marks done only for the goal that is current; a late report for an old goal is dropped.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `goal` | `G` |

###### Returns

`boolean`

***

### CueLearner

Cue learning with associability, eligibility traces and decaying inhibition.

#### Type Parameters

| Type Parameter |
| ------ |
| <a id="type-parameter-a"></a> `A` *extends* `string` |

#### Constructors

##### Constructor

```ts
new CueLearner<A>(o): CueLearner<A>;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `o` | [`LearnerOptions`](#learneroptions)\<`A`\> |

###### Returns

[`CueLearner`](#cuelearner)\<`A`\>

#### Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="property-actions"></a> `actions` | `readonly` | readonly `A`[] |
| <a id="property-inner-1"></a> `inner` | `readonly` | `CueLearner` |

#### Methods

##### decay()

```ts
decay(dt): void;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `dt` | `number` |

###### Returns

`void`

##### free()

```ts
free(): void;
```

Frees the wasm memory now, before the garbage collector would; the object is unusable after.

###### Returns

`void`

##### load()

```ts
load(s): void;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `s` | [`LearnerState`](#learnerstate)\<`A`\> |

###### Returns

`void`

##### markDone()

```ts
markDone(action, now): void;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `action` | `A` |
| `now` | `number` |

###### Returns

`void`

##### offerTrick()

```ts
offerTrick(action, now): void;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `action` | `A` |
| `now` | `number` |

###### Returns

`void`

##### prior()

```ts
prior(
   cue, 
   action, 
   wgt
): void;
```

Sets a prior: excitation `w` for a cue and action.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `cue` | `string` |
| `action` | `A` |
| `wgt` | `number` |

###### Returns

`void`

##### respond()

```ts
respond(
   cue, 
   now, 
   o?
): CueResponse<A>;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `cue` | `string` |
| `now` | `number` |
| `o?` | \{ `distraction?`: `number`; `offerable?`: `A`[]; `trainability?`: `number`; `watched?`: `boolean`; \} |
| `o.distraction?` | `number` |
| `o.offerable?` | `A`[] |
| `o.trainability?` | `number` |
| `o.watched?` | `boolean` |

###### Returns

[`CueResponse`](#cueresponse)\<`A`\>

##### reward()

```ts
reward(
   r, 
   now, 
   trainability?
): 
  | {
  action: A;
  credit: number;
  cue: string | null;
  value: number;
}
  | null;
```

###### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `r` | `number` | `undefined` |
| `now` | `number` | `undefined` |
| `trainability?` | `number` | `0` |

###### Returns

  \| \{
  `action`: `A`;
  `credit`: `number`;
  `cue`: `string` \| `null`;
  `value`: `number`;
\}
  \| `null`

##### setOffer()

```ts
setOffer(action, v): void;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `action` | `A` |
| `v` | `number` |

###### Returns

`void`

##### toJSON()

```ts
toJSON(): LearnerState<A>;
```

###### Returns

[`LearnerState`](#learnerstate)\<`A`\>

##### value()

```ts
value(cue, action): number;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `cue` | `string` |
| `action` | `A` |

###### Returns

`number`

***

### Drives

Drive reduction reward over named deficits (Keramati and Gutkin 2011).

#### Type Parameters

| Type Parameter |
| ------ |
| <a id="type-parameter-k"></a> `K` *extends* `string` |

#### Constructors

##### Constructor

```ts
new Drives<K>(weights, opts?): Drives<K>;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `weights` | `Record`\<`K`, `number`\> |
| `opts?` | \{ `gain?`: `number`; `m?`: `number`; `n?`: `number`; \} |
| `opts.gain?` | `number` |
| `opts.m?` | `number` |
| `opts.n?` | `number` |

###### Returns

[`Drives`](#drives)\<`K`\>

#### Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="property-inner-2"></a> `inner` | `readonly` | `Drives` |
| <a id="property-keys"></a> `keys` | `readonly` | `K`[] |

#### Accessors

##### values

###### Get Signature

```ts
get values(): Record<K, number>;
```

###### Returns

`Record`\<`K`, `number`\>

#### Methods

##### distance()

```ts
distance(state?): number;
```

The drive of a state, or of the current one.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `state?` | `Partial`\<`Record`\<`K`, `number`\>\> |

###### Returns

`number`

##### free()

```ts
free(): void;
```

Frees the wasm memory now, before the garbage collector would; the object is unusable after.

###### Returns

`void`

##### grow()

```ts
grow(dt, rates): void;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `dt` | `number` |
| `rates` | `Partial`\<`Record`\<`K`, `number`\>\> |

###### Returns

`void`

##### rewardOf()

```ts
rewardOf(effect, scale?): number;
```

Reward of an act with this expected effect; reductions scaled by `scale`.

###### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `effect` | `Partial`\<`Record`\<`K`, `number`\>\> | `undefined` |
| `scale?` | `number` | `1` |

###### Returns

`number`

##### set()

```ts
set(values): void;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `values` | `Partial`\<`Record`\<`K`, `number`\>\> |

###### Returns

`void`

##### setShape()

```ts
setShape(
   n, 
   m, 
   gain
): void;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `n` | `number` |
| `m` | `number` |
| `gain` | `number` |

###### Returns

`void`

***

### GoalBoost

A goal set by a slow deliberation (a language model, a planner): adds a
bonus to one option's utility until it expires. Model agnostic.

#### Type Parameters

| Type Parameter |
| ------ |
| <a id="type-parameter-b-1"></a> `B` *extends* `string` |

#### Constructors

##### Constructor

```ts
new GoalBoost<B>(bonus?): GoalBoost<B>;
```

###### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `bonus?` | `number` | `0.35` |

###### Returns

[`GoalBoost`](#goalboost)\<`B`\>

#### Properties

| Property | Modifier | Type | Default value |
| ------ | ------ | ------ | ------ |
| <a id="property-bonus"></a> `bonus` | `readonly` | `number` | `0.35` |

#### Methods

##### apply()

```ts
apply(now, u): Partial<Record<B, number>>;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `now` | `number` |
| `u` | `Partial`\<`Record`\<`B`, `number`\>\> |

###### Returns

`Partial`\<`Record`\<`B`, `number`\>\>

##### current()

```ts
current(now): 
  | {
  id: B;
  why: string;
}
  | null;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `now` | `number` |

###### Returns

  \| \{
  `id`: `B`;
  `why`: `string`;
\}
  \| `null`

##### set()

```ts
set(
   id, 
   now, 
   seconds, 
   why
): void;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `id` | `B` |
| `now` | `number` |
| `seconds` | `number` |
| `why` | `string` |

###### Returns

`void`

***

### InferenceScheduler

Starts a heavy model call only after a minimum interval, optionally only while idle and inside a frame budget, one at a time.

#### Constructors

##### Constructor

```ts
new InferenceScheduler(opts): InferenceScheduler;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `opts` | [`ScheduleOptions`](#scheduleoptions) |

###### Returns

[`InferenceScheduler`](#inferencescheduler)

#### Properties

| Property | Modifier | Type | Default value |
| ------ | ------ | ------ | ------ |
| <a id="property-calls"></a> `calls` | `public` | `number` | `0` |
| <a id="property-lastms"></a> `lastMs` | `public` | `number` | `0` |
| <a id="property-opts"></a> `opts` | `readonly` | [`ScheduleOptions`](#scheduleoptions) | `undefined` |
| <a id="property-skipped"></a> `skipped` | `public` | `number` | `0` |

#### Accessors

##### busy

###### Get Signature

```ts
get busy(): boolean;
```

###### Returns

`boolean`

##### smoothedFrameMs

###### Get Signature

```ts
get smoothedFrameMs(): number;
```

###### Returns

`number`

#### Methods

##### frame()

```ts
frame(ms): void;
```

Feeds one frame time in ms.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `ms` | `number` |

###### Returns

`void`

##### run()

```ts
run<T>(
   now, 
   idle, 
   fn, 
   clock?
): Promise<T | null>;
```

Runs `fn` when the state is ready; otherwise returns null without
calling it. `clock` measures the call in ms (inject performance.now).

###### Type Parameters

| Type Parameter |
| ------ |
| <a id="type-parameter-t"></a> `T` |

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `now` | `number` |
| `idle` | `boolean` |
| `fn` | () => `Promise`\<`T`\> |
| `clock?` | () => `number` |

###### Returns

`Promise`\<`T` \| `null`\>

##### state()

```ts
state(now, idle?): ScheduleState;
```

###### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `now` | `number` | `undefined` |
| `idle?` | `boolean` | `true` |

###### Returns

[`ScheduleState`](#schedulestate)

***

### LayerGate

Blocking layers (seated, crouched, holding). A task declares the layers
it needs; starting it releases every held layer it does not need, and
reports which, so the body can stand up or put things down first.

#### Type Parameters

| Type Parameter |
| ------ |
| <a id="type-parameter-l"></a> `L` *extends* `string` |

#### Constructors

##### Constructor

```ts
new LayerGate<L>(): LayerGate<L>;
```

###### Returns

[`LayerGate`](#layergate)\<`L`\>

#### Accessors

##### currentTask

###### Get Signature

```ts
get currentTask(): string | null;
```

###### Returns

`string` \| `null`

##### layers

###### Get Signature

```ts
get layers(): L[];
```

###### Returns

`L`[]

#### Methods

##### hold()

```ts
hold(layer): void;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `layer` | `L` |

###### Returns

`void`

##### holding()

```ts
holding(layer): boolean;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `layer` | `L` |

###### Returns

`boolean`

##### missing()

```ts
missing(): L[];
```

Layers the current task needs and does not hold yet.

###### Returns

`L`[]

##### release()

```ts
release(layer): void;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `layer` | `L` |

###### Returns

`void`

##### startTask()

```ts
startTask(name, needs?): L[];
```

Starts a task; returns the layers released, in the order they were held.

###### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `name` | `string` | `undefined` |
| `needs?` | readonly `L`[] | `[]` |

###### Returns

`L`[]

***

### MemoryStream

Memories ranked by recency, importance and relevance (Park et al. 2023).

#### Constructors

##### Constructor

```ts
new MemoryStream(o?): MemoryStream;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `o?` | \{ `capacity?`: `number`; `decay?`: `number`; \} |
| `o.capacity?` | `number` |
| `o.decay?` | `number` |

###### Returns

[`MemoryStream`](#memorystream)

#### Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="property-inner-3"></a> `inner` | `readonly` | `MemoryStream` |

#### Accessors

##### length

###### Get Signature

```ts
get length(): number;
```

###### Returns

`number`

##### pendingImportance

###### Get Signature

```ts
get pendingImportance(): number;
```

###### Returns

`number`

#### Methods

##### add()

```ts
add(
   text, 
   importance, 
   hour
): void;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `text` | `string` |
| `importance` | `number` |
| `hour` | `number` |

###### Returns

`void`

##### free()

```ts
free(): void;
```

Frees the wasm memory now, before the garbage collector would; the object is unusable after.

###### Returns

`void`

##### retrieve()

```ts
retrieve(
   hour, 
   cues, 
   k
): string[];
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `hour` | `number` |
| `cues` | `string`[] |
| `k` | `number` |

###### Returns

`string`[]

##### shouldReflect()

```ts
shouldReflect(budget): boolean;
```

True once summed importance reaches the budget; resets the sum.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `budget` | `number` |

###### Returns

`boolean`

***

### Sleep

Sleep pressure, body clock and the stage machine of one sleep.

#### Constructors

##### Constructor

```ts
new Sleep(o): Sleep;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `o` | \{ `down?`: `number`; `enough?`: `number`; `nrem?`: `number`; `pressure?`: `number`; `rem?`: `number`; `rng`: [`Rng`](#rng); `up?`: `number`; `wake?`: `number`; \} |
| `o.down?` | `number` |
| `o.enough?` | `number` |
| `o.nrem?` | `number` |
| `o.pressure?` | `number` |
| `o.rem?` | `number` |
| `o.rng` | [`Rng`](#rng) |
| `o.up?` | `number` |
| `o.wake?` | `number` |

###### Returns

[`Sleep`](#sleep)

#### Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="property-inner-4"></a> `inner` | `readonly` | `Sleep` |

#### Accessors

##### pressure

###### Get Signature

```ts
get pressure(): number;
```

###### Returns

`number`

###### Set Signature

```ts
set pressure(p): void;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `p` | `number` |

###### Returns

`void`

##### stage

###### Get Signature

```ts
get stage(): SleepStage;
```

###### Returns

[`SleepStage`](#sleepstage-1)

#### Methods

##### fatigue()

```ts
fatigue(hour, running?): number;
```

###### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `hour` | `number` | `undefined` |
| `running?` | `boolean` | `false` |

###### Returns

`number`

##### free()

```ts
free(): void;
```

Frees the wasm memory now, before the garbage collector would; the object is unusable after.

###### Returns

`void`

##### hypnogram()

```ts
hypnogram(): SleepStage[];
```

###### Returns

[`SleepStage`](#sleepstage-1)[]

##### lieDown()

```ts
lieDown(negative?): void;
```

###### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `negative?` | `boolean` | `false` |

###### Returns

`void`

##### pressureStep()

```ts
pressureStep(gameHours, activity?): void;
```

###### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `gameHours` | `number` | `undefined` |
| `activity?` | `number` | `1` |

###### Returns

`void`

##### sample()

```ts
sample(): void;
```

###### Returns

`void`

##### sleepiness()

```ts
sleepiness(hour): number;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `hour` | `number` |

###### Returns

`number`

##### step()

```ts
step(
   gameMinutes, 
   hour, 
   negative?
): boolean;
```

Returns true when the sleep ended on its own.

###### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `gameMinutes` | `number` | `undefined` |
| `hour` | `number` | `undefined` |
| `negative?` | `boolean` | `false` |

###### Returns

`boolean`

##### wakeThreshold()

```ts
wakeThreshold(): number;
```

###### Returns

`number`

##### wakeUp()

```ts
wakeUp(): void;
```

###### Returns

`void`

## Interfaces

### ChooserOptions

Options of a `Chooser`: the injected rng, the option names, and the softmax, commitment and latency settings.

#### Type Parameters

| Type Parameter |
| ------ |
| <a id="type-parameter-b-2"></a> `B` *extends* `string` |

#### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-commitment"></a> `commitment?` | `number` | bonus on the current act while not done (default 0.12) |
| <a id="property-dwellmu"></a> `dwellMu?` | `number` | - |
| <a id="property-dwelltau"></a> `dwellTau?` | `number` | - |
| <a id="property-noise"></a> `noise?` | `boolean` | false removes latencies and draws a fixed dwell (the canned path) |
| <a id="property-options-1"></a> `options` | readonly `B`[] | - |
| <a id="property-reactmargin"></a> `reactMargin?` | `number` | - |
| <a id="property-reactmu"></a> `reactMu?` | `number` | - |
| <a id="property-reacttau"></a> `reactTau?` | `number` | - |
| <a id="property-rng"></a> `rng` | [`Rng`](#rng) | - |
| <a id="property-sample"></a> `sample?` | `boolean` | false gives argmax with hysteresis (the canned path) |
| <a id="property-start"></a> `start?` | `B` | - |
| <a id="property-temperature"></a> `temperature?` | `number` | softmax temperature (default 0.06) |

***

### Decision

The result of one `Chooser.update`: the current act, any pending switch, the reason and a why sentence.

#### Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| <a id="type-parameter-b-3"></a> `B` *extends* `string` | `string` |

#### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-best"></a> `best` | `B` | - |
| <a id="property-bestutility"></a> `bestUtility` | `number` | - |
| <a id="property-current"></a> `current` | `B` | - |
| <a id="property-id"></a> `id` | `B` | the option the reason is about |
| <a id="property-pending"></a> `pending` | \| \{ `at`: `number`; `id`: `B`; `latency`: `number`; \} \| `null` | - |
| <a id="property-probability"></a> `probability` | `number` | sampling probability of `id` when a sample was drawn, else NaN |
| <a id="property-reason"></a> `reason` | [`Reason`](#reason) | - |
| <a id="property-switched"></a> `switched` | `boolean` | - |
| <a id="property-utilities"></a> `utilities` | `Record`\<`B`, `number`\> | every option's utility at this update, for logging |
| <a id="property-utility"></a> `utility` | `number` | - |
| <a id="property-why"></a> `why` | `string` | - |

***

### LearnerOptions

Options of a `CueLearner`: the injected rng, the action names, learning rates and the non compliance settings.

#### Type Parameters

| Type Parameter |
| ------ |
| <a id="type-parameter-a-1"></a> `A` *extends* `string` |

#### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-actions-1"></a> `actions` | readonly `A`[] | - |
| <a id="property-alpha"></a> `alpha?` | `number` | - |
| <a id="property-cuemu"></a> `cueMu?` | `number` | - |
| <a id="property-cuetau"></a> `cueTau?` | `number` | - |
| <a id="property-ignore"></a> `ignore?` | `number` | base non compliance (default 0.25) |
| <a id="property-inhibitiondecay"></a> `inhibitionDecay?` | `number` | inhibition decay per minute (default 0.06) |
| <a id="property-noise-1"></a> `noise?` | `boolean` | - |
| <a id="property-offerrate"></a> `offerRate?` | `number` | - |
| <a id="property-rng-1"></a> `rng` | [`Rng`](#rng) | - |
| <a id="property-theta"></a> `theta?` | `number` | - |
| <a id="property-traceseconds"></a> `traceSeconds?` | `number` | - |

***

### LearnerState

The versioned learner state that `CueLearner.toJSON` writes and `CueLearner.load` reads.

#### Type Parameters

| Type Parameter |
| ------ |
| <a id="type-parameter-a-2"></a> `A` *extends* `string` |

#### Properties

| Property | Type |
| ------ | ------ |
| <a id="property-cues"></a> `cues` | `Record`\<`string`, \{ `associability`: `number`; `n`: `Record`\<`A`, `number`\>; `w`: `Record`\<`A`, `number`\>; \}\> |
| <a id="property-offer"></a> `offer` | `Record`\<`A`, `number`\> |
| <a id="property-ver"></a> `ver` | `1` |

***

### Option

One option with its utility, for callers that keep options as a list.

#### Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| <a id="type-parameter-b-4"></a> `B` *extends* `string` | `string` |

#### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-id-1"></a> `id` | `B` | - |
| <a id="property-reactive"></a> `reactive?` | `boolean` | cannot wait for the dwell: switches after a short latency |
| <a id="property-utility-1"></a> `utility` | `number` | - |

***

### ScheduleOptions

Options of an `InferenceScheduler`.

#### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-framebudgetms"></a> `frameBudgetMs?` | `number` | skip while the smoothed frame time is above this (ms) |
| <a id="property-idleonly"></a> `idleOnly?` | `boolean` | only start while the caller says the agent is idle |
| <a id="property-mininterval"></a> `minInterval` | `number` | seconds between the starts of two calls (the dog simulator uses 25) |
| <a id="property-smoothing"></a> `smoothing?` | `number` | smoothing of the frame time, 0 to 1 per frame (default 0.1) |

***

### SettleCheck

The input of `settled`: the remaining error, the current rate and the elapsed time of a step.

#### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-elapsed"></a> `elapsed` | `number` | seconds since the step began |
| <a id="property-error"></a> `error` | `number` | remaining error, for a turn the heading error in rad |
| <a id="property-maxerror"></a> `maxError?` | `number` | largest error that counts as settled (default 0.12 rad) |
| <a id="property-maxrate"></a> `maxRate?` | `number` | largest rate that counts as settled (default 0.4 rad/s) |
| <a id="property-rate"></a> `rate` | `number` | current rate, for a turn the angular speed in rad/s |
| <a id="property-timeout"></a> `timeout?` | `number` | give up after this many seconds (default 3) |

## Type Aliases

### CueResponse

```ts
type CueResponse<A> = 
  | {
  kind: "ignored";
  latency: number;
}
  | {
  kind: "none";
  latency: number;
}
  | {
  action: A;
  kind: "act";
  latency: number;
  offered: boolean;
};
```

What a `CueLearner` did on a cue: ignored it, did nothing it knows, or did an act (offered or cued) after a latency.

#### Type Parameters

| Type Parameter |
| ------ |
| <a id="type-parameter-a-3"></a> `A` *extends* `string` |

***

### Reason

```ts
type Reason = "hold" | "top" | "sampled" | "reactive" | "forced" | "argmax" | "fired";
```

Why a decision went the way it did: held the current act, took the top score, sampled, switched reactively, forced, argmax, or a pending switch fired.

***

### Rng

```ts
type Rng = () => number;
```

Uniform numbers in [0, 1). The family contract: injected, never Math.random.

#### Returns

`number`

***

### ScheduleState

```ts
type ScheduleState = 
  | "busy"
  | "cooling down"
  | "waiting for idle"
  | "over frame budget"
  | "ready";
```

Why a call may not start now, or ready.

***

### SleepStage

```ts
type SleepStage = "awake" | "onset" | "nrem" | "rem" | "wake";
```

The stage of the sleep machine.

***

### WasmSource

```ts
type WasmSource = 
  | URL
  | string
  | Response
  | ArrayBuffer
  | ArrayBufferView
  | WebAssembly.Module;
```

Where the wasm comes from: a URL or Response to fetch, bytes, or a compiled module.

## Functions

### bodyClock()

```ts
function bodyClock(hour): number;
```

Sleepiness from the body clock at an hour 0 to 24 (peaks of activity near 7 and 19).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `hour` | `number` |

#### Returns

`number`

***

### bodyClockJs()

```ts
function bodyClockJs(hour): number;
```

Sleepiness from the body clock at an hour 0 to 24, with Math.exp (see the wasm `bodyClock`).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `hour` | `number` |

#### Returns

`number`

***

### goldenTrace()

```ts
function goldenTrace(seed): Float64Array;
```

A fixed trace of 175 core values for one seed, used to check that two builds of the core agree bit for bit.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `seed` | `number` |

#### Returns

`Float64Array`

***

### load()

```ts
function load(source?): Promise<void>;
```

Loads the wasm core once; call and await it before any class. Pass a URL, a Response, bytes or a compiled module, or nothing to decode the inlined copy.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `source?` | [`WasmSource`](#wasmsource) |

#### Returns

`Promise`\<`void`\>

***

### loadSync()

```ts
function loadSync(source): void;
```

Loads the wasm core synchronously from bytes or a compiled module.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `source` | `ArrayBuffer` \| `Module` \| `ArrayBufferView`\<`ArrayBufferLike`\> |

#### Returns

`void`

***

### seededRng()

```ts
function seededRng(seed): Rng;
```

Mulberry32, the same stream as the Rust `Mulberry32`.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `seed` | `number` |

#### Returns

[`Rng`](#rng)

***

### seedFrom()

```ts
function seedFrom(rng): number;
```

A 32 bit seed for a wasm stream, drawn from an injected `Rng`.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `rng` | [`Rng`](#rng) |

#### Returns

`number`

***

### settled()

```ts
function settled(c): object;
```

Checks the real condition with a timeout, in place of a flag.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `c` | [`SettleCheck`](#settlecheck) |

#### Returns

`object`

| Name | Type |
| ------ | ------ |
| `done` | `boolean` |
| `timedOut` | `boolean` |
