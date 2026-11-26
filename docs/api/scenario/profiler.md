# profiler

## Interfaces

### ProfileEntry

Total ms, worst ms and count for one profiled label.

#### Properties

| Property | Type |
| ------ | ------ |
| <a id="property-max"></a> `max` | `number` |
| <a id="property-n"></a> `n` | `number` |
| <a id="property-total"></a> `total` | `number` |

***

### Profiler

Per system frame timing: begin, mark a label, report average and worst ms.

#### Properties

| Property | Type |
| ------ | ------ |
| <a id="property-entries"></a> `entries` | `Record`\<`string`, [`ProfileEntry`](#profileentry)\> |

#### Methods

##### begin()

```ts
begin(): void;
```

starts timing the next system

###### Returns

`void`

##### mark()

```ts
mark(label): void;
```

charges the time since the last begin or mark to `label`

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `label` | `string` |

###### Returns

`void`

##### report()

```ts
report(): object[];
```

average and worst ms per label, worst first

###### Returns

`object`[]

##### reset()

```ts
reset(): void;
```

###### Returns

`void`

## Functions

### createProfiler()

```ts
function createProfiler(clock): Profiler;
```

A profiler over a clock in ms, such as `performance.now`.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `clock` | () => `number` |

#### Returns

[`Profiler`](#profiler)
