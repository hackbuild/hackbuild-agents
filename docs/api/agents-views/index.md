# index

## Interfaces

### AssociationsHandle

What `associationsTable` returns: the host, an update and a dispose.

#### Properties

| Property | Modifier | Type | Description |
| ------ | ------ | ------ | ------ |
| <a id="property-root"></a> `root` | `readonly` | `HTMLElement` | the host element |

#### Methods

##### dispose()

```ts
dispose(): void;
```

empties the host

###### Returns

`void`

##### update()

```ts
update(state): void;
```

draws a new state

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `state` | [`AssociationsState`](#associationsstate) |

###### Returns

`void`

***

### AssociationsOptions

Options of `associationsTable`.

#### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-limit"></a> `limit?` | `number` | rows shown, newest last (default 16) |
| <a id="property-note"></a> `note?` | `string` | the explanation under the table; `ASSOCIATIONS_NOTE` by default |
| <a id="property-onreset"></a> `onReset?` | () => `void` | reset learning was pressed |

***

### AssociationsRow

One cue row of the table.

#### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-attention"></a> `attention` | `number` | how much it still pays attention to the cue, 0 to 1 |
| <a id="property-cue"></a> `cue` | `string` | the cue, as a word or `gesture:name` |
| <a id="property-values"></a> `values` | `number`[] | net strength per action, 0 to 1, in the order of `actions` |

***

### AssociationsState

What the table draws. Built from a CueLearner with `associationsState`, or by hand.

#### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-actions"></a> `actions` | `string`[] | the act columns |
| <a id="property-cues"></a> `cues` | [`AssociationsRow`](#associationsrow)[] | newest last; the table shows the last 16 |
| <a id="property-last"></a> `last?` | \| \{ `action`: `string`; `cue`: `string`; \} \| `null` | the cell of the last reward, outlined |
| <a id="property-trial"></a> `trial?` | `string` | one line on the last trial |

***

### AssociationsTableElement

`<hb-associations-table>`: set `.state`; fires `reset` when reset learning is pressed.

#### Extends

- `HTMLElement`

#### Properties

| Property | Type |
| ------ | ------ |
| <a id="property-state"></a> `state` | [`AssociationsState`](#associationsstate) \| `null` |

***

### DecisionLike

The parts of a @hackbuild/drives Chooser decision the view reads.

#### Properties

| Property | Type |
| ------ | ------ |
| <a id="property-current"></a> `current` | `string` |
| <a id="property-pending"></a> `pending` | \| \{ `at`: `number`; `id`: `string`; `latency`: `number`; \} \| `null` |
| <a id="property-reason"></a> `reason` | `string` |
| <a id="property-utilities"></a> `utilities` | `Record`\<`string`, `number`\> |
| <a id="property-why"></a> `why` | `string` |

***

### DrivesBarsElement

`<hb-drives-bars>`: set `.state` to a DrivesBarsState.

#### Extends

- `HTMLElement`

#### Properties

| Property | Type |
| ------ | ------ |
| <a id="property-state-1"></a> `state` | [`DrivesBarsState`](#drivesbarsstate) \| `null` |

***

### DrivesBarsFrom

Options of `drivesBarsState`: the clock, the seconds in the act and names of your own.

#### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-behavior"></a> `behavior?` | `string` | a longer name than the act id, as "fetch / chase" |
| <a id="property-now"></a> `now?` | `number` | sim seconds now, for the pending switch |
| <a id="property-pink"></a> `pink?` | readonly `string`[] | drive rows drawn pink |
| <a id="property-sampled"></a> `sampled?` | `boolean` | false when the chooser runs argmax |
| <a id="property-seconds"></a> `seconds?` | `number` | seconds in the current act |
| <a id="property-why-1"></a> `why?` | `string` | a why of your own in place of the decision's |

***

### DrivesBarsHandle

What `drivesBars` returns: the host, an update and a dispose.

#### Properties

| Property | Modifier | Type | Description |
| ------ | ------ | ------ | ------ |
| <a id="property-root-1"></a> `root` | `readonly` | `HTMLElement` | the host element |

#### Methods

##### dispose()

```ts
dispose(): void;
```

empties the host

###### Returns

`void`

##### update()

```ts
update(state): void;
```

draws a new state; rows rebuild only when the keys change

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `state` | [`DrivesBarsState`](#drivesbarsstate) |

###### Returns

`void`

***

### DrivesBarsOptions

Options of `drivesBars`.

#### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-note-1"></a> `note?` | `string` | the note under the utility rows while no switch is pending |

***

### DrivesBarsState

What the view draws. Built from @hackbuild/drives with `drivesBarsState`, or by hand.

#### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-behavior-1"></a> `behavior` | `string` | what it is doing now |
| <a id="property-current-1"></a> `current?` | `string` | the act drawn pink; defaults to `behavior` |
| <a id="property-drives"></a> `drives` | `Record`\<`string`, `number`\> | need per drive, 0 to 1 |
| <a id="property-mode"></a> `mode?` | `string` | how it chooses, the utility head's right end: sampled or argmax |
| <a id="property-pending-1"></a> `pending?` | \| \{ `id`: `string`; `inMs`: `number`; \} \| `null` | a switch that is on its way |
| <a id="property-pink-1"></a> `pink?` | readonly `string`[] | drive rows drawn pink, such as prey and bond |
| <a id="property-seconds-1"></a> `seconds?` | `number` | seconds in it |
| <a id="property-utilities-1"></a> `utilities` | `Record`\<`string`, `number`\> | what each act is worth now; any scale, drawn against the largest (at least 1) |
| <a id="property-why-2"></a> `why?` | `string` | why it is doing it, one line |

***

### EyeInsetElement

`<hb-eye-inset>`: set `.options` (who and draw), then call `frame()` each frame; fires `who` with the id in `detail`.

#### Extends

- `HTMLElement`

#### Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="property-options"></a> `options` | `public` | [`EyeInsetOptions`](#eyeinsetoptions) \| `null` |
| <a id="property-view"></a> `view` | `readonly` | [`EyeInsetHandle`](#eyeinsethandle) \| `null` |

#### Methods

##### frame()

```ts
frame(): void;
```

###### Returns

`void`

##### mode()

```ts
mode(text): void;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `text` | `string` |

###### Returns

`void`

***

### EyeInsetHandle

What `eyeInset` returns: the canvas, the selected who and the frame call.

#### Properties

| Property | Modifier | Type | Description |
| ------ | ------ | ------ | ------ |
| <a id="property-canvas"></a> `canvas` | `readonly` | `HTMLCanvasElement` | the canvas `draw` paints |
| <a id="property-root-2"></a> `root` | `readonly` | `HTMLElement` | the host element, now the card |
| <a id="property-who"></a> `who` | `readonly` | [`EyeWho`](#eyewho) | the selected who |

#### Methods

##### dispose()

```ts
dispose(): void;
```

empties the host and removes the card classes

###### Returns

`void`

##### frame()

```ts
frame(): void;
```

draws one frame of the selected eye

###### Returns

`void`

##### mode()

```ts
mode(text): void;
```

sets the mode line

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `text` | `string` |

###### Returns

`void`

##### select()

```ts
select(id): void;
```

selects a who without calling `onWho`

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `id` | `string` |

###### Returns

`void`

***

### EyeInsetOptions

Options of `eyeInset`.

#### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-canvas-1"></a> `canvas?` | `HTMLCanvasElement` | the canvas, when a renderer owns it already (a three WebGLRenderer's) |
| <a id="property-draw"></a> `draw` | (`canvas`, `who`) => `string` \| `void` | Draws one frame of `who` on the canvas, inside `who.eye.render` when there is an eye. A returned string becomes the mode line. |
| <a id="property-height"></a> `height?` | `number` | canvas height in pixels (default 160) |
| <a id="property-onwho"></a> `onWho?` | (`id`) => `void` | the user picked another who |
| <a id="property-selected"></a> `selected?` | `string` | the selected id; the first by default |
| <a id="property-who-1"></a> `who` | readonly [`EyeWho`](#eyewho)[] | the who switch, at least one |
| <a id="property-width"></a> `width?` | `number` | canvas width in pixels (default 320) |

***

### EyeLike

A @hackbuild/cameras FirstPerson, or anything that hides a head round a draw.

#### Methods

##### render()

```ts
render(draw): void;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `draw` | () => `void` |

###### Returns

`void`

***

### EyeWho

One choice of the who switch: whose eyes the card draws.

#### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-eye"></a> `eye?` | [`EyeLike`](#eyelike) | the eye whose render wraps the draw, so its own head is hidden |
| <a id="property-id"></a> `id` | `string` | the id `select` and `onWho` use |
| <a id="property-label"></a> `label` | `string` | the switch label, as "dog eye" |
| <a id="property-title"></a> `title?` | `string` | a longer name for assistive tech, as "what the dog sees" |

***

### LearnerLike

A @hackbuild/drives CueLearner, or anything with its actions and toJSON.

#### Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="property-actions-1"></a> `actions` | `readonly` | readonly `string`[] |

#### Methods

##### toJSON()

```ts
toJSON(): LearnerStateLike;
```

###### Returns

[`LearnerStateLike`](#learnerstatelike)

***

### LearnerStateLike

The @hackbuild/drives LearnerState shape (CueLearner.toJSON()).

#### Properties

| Property | Type |
| ------ | ------ |
| <a id="property-cues-1"></a> `cues` | `Record`\<`string`, \{ `associability`: `number`; `n`: `Record`\<`string`, `number`\>; `w`: `Record`\<`string`, `number`\>; \}\> |

## Type Aliases

### DrivesLike

```ts
type DrivesLike = 
  | Record<string, number>
  | {
  values: Record<string, number>;
};
```

Drives values, or a @hackbuild/drives Drives object.

## Variables

### ASSOCIATIONS\_NOTE

```ts
const ASSOCIATIONS_NOTE: "rows are cues, columns are acts. cells show net strength, excitation minus a separate inhibition that fades faster, so an extinguished cue partly comes back after a break. the attn column is each cue's associability: it rises after surprises and falls as the outcome becomes predictable. credit fades with delay, so a slow treat can reward whatever it is doing when it lands. if nothing is strong it offers tricks it was rewarded for before; teach a new word by praising whatever it does." = "rows are cues, columns are acts. cells show net strength, excitation minus a separate inhibition that fades faster, so an extinguished cue partly comes back after a break. the attn column is each cue's associability: it rises after surprises and falls as the outcome becomes predictable. credit fades with delay, so a slow treat can reward whatever it is doing when it lands. if nothing is strong it offers tricks it was rewarded for before; teach a new word by praising whatever it does.";
```

The explanation under the table: how net strength, attention and delayed credit work.

***

### DRIVES\_NOTE

```ts
const DRIVES_NOTE: "each act scores by how much it would ease what it needs. it usually picks the best one and sticks with what it is doing." = "each act scores by how much it would ease what it needs. it usually picks the best one and sticks with what it is doing.";
```

The note under the utility rows while no switch is pending.

***

### ELEMENT\_NAMES

```ts
const ELEMENT_NAMES: object;
```

The tag names `defineViews` registers.

#### Type Declaration

| Name | Type | Default value |
| ------ | ------ | ------ |
| <a id="property-associationstable"></a> `associationsTable` | `"hb-associations-table"` | `"hb-associations-table"` |
| <a id="property-drivesbars"></a> `drivesBars` | `"hb-drives-bars"` | `"hb-drives-bars"` |
| <a id="property-eyeinset"></a> `eyeInset` | `"hb-eye-inset"` | `"hb-eye-inset"` |

## Functions

### associationsState()

```ts
function associationsState(learner, o?): AssociationsState;
```

Builds the table from a CueLearner: net strength is excitation minus inhibition.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `learner` | [`LearnerLike`](#learnerlike) |
| `o?` | \{ `last?`: \| \{ `action`: `string`; `cue`: `string`; \} \| `null`; `trial?`: `string`; \} |
| `o.last?` | \| \{ `action`: `string`; `cue`: `string`; \} \| `null` |
| `o.trial?` | `string` |

#### Returns

[`AssociationsState`](#associationsstate)

***

### associationsTable()

```ts
function associationsTable(host, o?): AssociationsHandle;
```

Renders the associations panel into `host`.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `host` | `HTMLElement` |
| `o?` | [`AssociationsOptions`](#associationsoptions) |

#### Returns

[`AssociationsHandle`](#associationshandle)

***

### defineViews()

```ts
function defineViews(registry?): void;
```

Defines the three elements once; safe to call again.

#### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `registry?` | `CustomElementRegistry` | `customElements` |

#### Returns

`void`

***

### drivesBars()

```ts
function drivesBars(host, o?): DrivesBarsHandle;
```

Renders the behavior, utility and drives panels into `host`.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `host` | `HTMLElement` |
| `o?` | [`DrivesBarsOptions`](#drivesbarsoptions) |

#### Returns

[`DrivesBarsHandle`](#drivesbarshandle)

***

### drivesBarsState()

```ts
function drivesBarsState(
   d, 
   drives, 
   o?
): DrivesBarsState;
```

Builds the view state from a Chooser decision and the drives.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `d` | [`DecisionLike`](#decisionlike) |
| `drives` | [`DrivesLike`](#driveslike) |
| `o?` | [`DrivesBarsFrom`](#drivesbarsfrom) |

#### Returns

[`DrivesBarsState`](#drivesbarsstate)

***

### eyeInset()

```ts
function eyeInset(host, o): EyeInsetHandle;
```

Makes `host` the eye card: head with the mode line, the who switch, the canvas.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `host` | `HTMLElement` |
| `o` | [`EyeInsetOptions`](#eyeinsetoptions) |

#### Returns

[`EyeInsetHandle`](#eyeinsethandle)
