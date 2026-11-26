# metrics

## Interfaces

### SlideResult

What `sliding` returns: seconds and share of moving samples that slide.

#### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-moving"></a> `moving` | `number` | moving samples |
| <a id="property-seconds"></a> `seconds` | `number` | seconds where the body heading and the direction of motion differ by more than the threshold |
| <a id="property-share"></a> `share` | `number` | share of moving samples that slide |

***

### Stats

Count, mean, p50, p95 and max of a list of numbers.

#### Properties

| Property | Type |
| ------ | ------ |
| <a id="property-max"></a> `max` | `number` |
| <a id="property-mean"></a> `mean` | `number` |
| <a id="property-n"></a> `n` | `number` |
| <a id="property-p50"></a> `p50` | `number` |
| <a id="property-p95"></a> `p95` | `number` |

## Type Aliases

### Point

```ts
type Point = readonly number[];
```

A 2D or 3D position as numbers.

## Functions

### frameStats()

```ts
function frameStats(ms): Stats;
```

Frame time p50, p95 and max in ms from frame durations.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `ms` | readonly `number`[] |

#### Returns

[`Stats`](#stats)

***

### jerk()

```ts
function jerk(points, dt): number[];
```

Jerk magnitudes (m/s^3) from positions sampled every `dt` seconds: the
third difference of position over dt^3. Points may be 2D or 3D.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `points` | readonly [`Point`](#point)[] |
| `dt` | `number` |

#### Returns

`number`[]

***

### percentile()

```ts
function percentile(xs, p): number;
```

Percentile by nearest rank on a sorted copy.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `xs` | readonly `number`[] |
| `p` | `number` |

#### Returns

`number`

***

### sliding()

```ts
function sliding(
   points, 
   yaw, 
   dt, 
   threshold?, 
   minSpeed?
): SlideResult;
```

Sliding: the body faces one way and moves another. `yaw` 0 is +Z,
positions are (x, z). Samples below `minSpeed` m/s do not count.

#### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `points` | readonly [`Point`](#point)[] | `undefined` |
| `yaw` | readonly `number`[] | `undefined` |
| `dt` | `number` | `undefined` |
| `threshold?` | `number` | `0.6` |
| `minSpeed?` | `number` | `0.15` |

#### Returns

[`SlideResult`](#slideresult)

***

### stallSeconds()

```ts
function stallSeconds(
   points, 
   hasGoal, 
   dt, 
   window?, 
   dist?
): number;
```

Seconds where an agent with a goal moved under `dist` m over the
previous `window` s (the stall detector of earlier builds, 0.2 m in 2 s).

#### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `points` | readonly [`Point`](#point)[] | `undefined` |
| `hasGoal` | readonly `boolean`[] | `undefined` |
| `dt` | `number` | `undefined` |
| `window?` | `number` | `2` |
| `dist?` | `number` | `0.2` |

#### Returns

`number`

***

### stats()

```ts
function stats(xs): Stats;
```

Count, mean, p50, p95 and max of a list; NaN for an empty list.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `xs` | readonly `number`[] |

#### Returns

[`Stats`](#stats)

***

### togglesPerSecond()

```ts
function togglesPerSecond(states, dt): number;
```

State changes per second over a sampled label series.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `states` | readonly `unknown`[] |
| `dt` | `number` |

#### Returns

`number`
