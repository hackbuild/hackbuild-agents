# index

## Interfaces

### ParamDef

One tunable number: key, group, label, default, range, step, unit and where the default comes from.

#### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-cite"></a> `cite?` | `string` | a citation for the default, shown beside the source |
| <a id="property-def"></a> `def` | `number` | - |
| <a id="property-group"></a> `group` | `string` | - |
| <a id="property-key"></a> `key` | `string` | - |
| <a id="property-label"></a> `label` | `string` | - |
| <a id="property-max"></a> `max` | `number` | - |
| <a id="property-min"></a> `min` | `number` | - |
| <a id="property-note"></a> `note?` | `string` | - |
| <a id="property-source"></a> `source?` | [`Source`](#source) | - |
| <a id="property-step"></a> `step` | `number` | - |
| <a id="property-unit"></a> `unit?` | `string` | unit shown beside the value: "s", "Hz", "m/s", "x" for a multiplier |

***

### Preset

A named set of values that `applyPreset` writes in one go.

#### Properties

| Property | Type |
| ------ | ------ |
| <a id="property-label-1"></a> `label` | `string` |
| <a id="property-values"></a> `values` | `Record`\<`string`, `number`\> |

***

### Registry

The parameters, layers and presets of one app, with clamped set, saves, URL hash sharing and change events.

#### Methods

##### abPair()

```ts
abPair(layer): object;
```

two snapshots of the current values, one with the layer on and one with it off

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `layer` | `string` |

###### Returns

`object`

| Name | Type |
| ------ | ------ |
| `off` | `Record`\<`string`, `number`\> |
| `on` | `Record`\<`string`, `number`\> |

##### applyPreset()

```ts
applyPreset(name): void;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `name` | `string` |

###### Returns

`void`

##### def()

```ts
def(key): ParamDef;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `key` | `string` |

###### Returns

[`ParamDef`](#paramdef)

##### define()

```ts
define(def): void;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `def` | [`ParamDef`](#paramdef) |

###### Returns

`void`

##### defineLayer()

```ts
defineLayer(
   key, 
   label, 
   opts?
): void;
```

a layer switch: 1 on, 0 off, in group `layers` unless another is named

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `key` | `string` |
| `label` | `string` |
| `opts?` | \{ `def?`: `0` \| `1`; `group?`: `string`; `note?`: `string`; \} |
| `opts.def?` | `0` \| `1` |
| `opts.group?` | `string` |
| `opts.note?` | `string` |

###### Returns

`void`

##### definePreset()

```ts
definePreset(name, preset): void;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `name` | `string` |
| `preset` | [`Preset`](#preset) |

###### Returns

`void`

##### fromJSON()

```ts
fromJSON(saved): string[];
```

`{ ver, d }`; another version goes through `migrate` or keeps nothing

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `saved` | `unknown` |

###### Returns

`string`[]

##### fromUrlHash()

```ts
fromUrlHash(hash): string[];
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `hash` | `string` |

###### Returns

`string`[]

##### get()

```ts
get(key): number;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `key` | `string` |

###### Returns

`number`

##### groups()

```ts
groups(): object[];
```

###### Returns

`object`[]

##### has()

```ts
has(key): boolean;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `key` | `string` |

###### Returns

`boolean`

##### keys()

```ts
keys(): string[];
```

###### Returns

`string`[]

##### layer()

```ts
layer(key): boolean;
```

master switch and layer switch both on

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `key` | `string` |

###### Returns

`boolean`

##### layers()

```ts
layers(): string[];
```

###### Returns

`string`[]

##### load()

```ts
load(values): string[];
```

current version values; unknown keys are skipped and returned

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `values` | `Record`\<`string`, `number`\> |

###### Returns

`string`[]

##### onChange()

```ts
onChange(fn): () => void;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `fn` | [`ChangeListener`](#changelistener) |

###### Returns

() => `void`

##### presets()

```ts
presets(): object[];
```

###### Returns

`object`[]

##### reset()

```ts
reset(key?): void;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `key?` | `string` |

###### Returns

`void`

##### restore()

```ts
restore(): string[];
```

reads the saved values from storage, if any

###### Returns

`string`[]

##### set()

```ts
set(key, value): void;
```

clamps into the defined range; unknown keys throw; NaN and the infinities are ignored

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `key` | `string` |
| `value` | `number` |

###### Returns

`void`

##### snapshot()

```ts
snapshot(): Record<string, number>;
```

###### Returns

`Record`\<`string`, `number`\>

##### toJSON()

```ts
toJSON(): Saved;
```

only values that differ from their defaults, so new defaults reach old sessions

###### Returns

[`Saved`](#saved)

##### toUrlHash()

```ts
toUrlHash(): string;
```

only the values that differ from their defaults

###### Returns

`string`

***

### RegistryOptions

Master layer, storage, schema version, migrations and key renames of a registry.

#### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-master"></a> `master?` | `string` | the master layer: when it is 0 every `layer()` answers false |
| <a id="property-migrate"></a> `migrate?` | `Record`\<`number`, (`values`) => `Record`\<`string`, `number`\>\> | Explicit migrations by the saved version. A save of another version with no migration keeps nothing: its values go back to the current defaults. Version 0 is a bare values object with no `ver` (the first export format). |
| <a id="property-renames"></a> `renames?` | `Record`\<`string`, `string`\> | Old key to new key, applied when loading saves, URL hashes and JSON. Never change what an existing key means; give the new meaning a new key and rename or drop the old one. |
| <a id="property-storage"></a> `storage?` | [`StorageLike`](#storagelike) | - |
| <a id="property-storagekey"></a> `storageKey?` | `string` | - |
| <a id="property-version"></a> `version?` | `number` | schema version written with saved values (`{ ver, d }`) |

***

### Saved

Saved form: the schema version and only the values that differ from their defaults.

#### Properties

| Property | Type |
| ------ | ------ |
| <a id="property-d"></a> `d` | `Record`\<`string`, `number`\> |
| <a id="property-ver"></a> `ver` | `number` |

***

### StorageLike

Minimal storage surface; `localStorage` fits, so does a Map wrapper in tests.

#### Methods

##### getItem()

```ts
getItem(key): string | null;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `key` | `string` |

###### Returns

`string` \| `null`

##### setItem()

```ts
setItem(key, value): void;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `key` | `string` |
| `value` | `string` |

###### Returns

`void`

## Type Aliases

### ChangeListener

```ts
type ChangeListener = (key, value) => void;
```

Called with the key and the new value after any change.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `key` | `string` |
| `value` | `number` |

#### Returns

`void`

***

### Source

```ts
type Source = "measured" | "computed" | "vendor" | "inferred" | "unknown";
```

Where a default value comes from (RULES.md: every number says which).

## Functions

### createRegistry()

```ts
function createRegistry(opts?): Registry;
```

Makes an empty registry; define parameters and layers on it, then `restore` and `fromUrlHash`.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `opts?` | [`RegistryOptions`](#registryoptions) |

#### Returns

[`Registry`](#registry)

***

### decimalsFor()

```ts
function decimalsFor(step): number;
```

Decimal places a value of this step shows: 0 for whole steps, else enough for the step.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `step` | `number` |

#### Returns

`number`

***

### formatValue()

```ts
function formatValue(def, v): string;
```

A value as text with the decimal places its step calls for.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `def` | [`ParamDef`](#paramdef) |
| `v` | `number` |

#### Returns

`string`
