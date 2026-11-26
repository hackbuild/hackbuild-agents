# dom

## Interfaces

### Panel

A built panel: its root element, `refresh` to read the registry again and `dispose` to remove it.

#### Properties

| Property | Type |
| ------ | ------ |
| <a id="property-root"></a> `root` | `HTMLElement` |

#### Methods

##### dispose()

```ts
dispose(): void;
```

###### Returns

`void`

##### refresh()

```ts
refresh(): void;
```

###### Returns

`void`

***

### PanelOptions

Group labels, open groups, class prefix, hash sync and export and import hooks of a panel.

#### Properties

| Property | Modifier | Type | Description |
| ------ | ------ | ------ | ------ |
| <a id="property-document"></a> `document?` | `public` | `Document` | the document to build in, for tests or iframes |
| <a id="property-filename"></a> `fileName?` | `public` | `string` | - |
| <a id="property-grouplabels"></a> `groupLabels?` | `public` | `Record`\<`string`, `string`\> | display names per group; groups without one show their key |
| <a id="property-history"></a> `history?` | `public` | `object` | history used to write the hash without a new entry per slider step, default `globalThis.history` when `location` is the page's own; without one the hash is assigned |
| `history.state` | `readonly` | `unknown` | - |
| `history.replaceState` | `public` | (`data`, `unused`, `url?`) => `void` | - |
| <a id="property-location"></a> `location?` | `public` | `object` | the location to sync, default `globalThis.location` |
| `location.hash` | `public` | `string` | - |
| <a id="property-onexport"></a> `onExport?` | `public` | (`json`) => `void` | receives the export text; without it the panel downloads `fileName` |
| <a id="property-onimport"></a> `onImport?` | `public` | (`skipped`, `error`) => `void` | called after an import with the skipped keys, or the read error |
| <a id="property-open"></a> `open?` | `public` | `string`[] | groups shown open; the layers group is open by default |
| <a id="property-prefix"></a> `prefix?` | `public` | `string` | a class prefix for styling, default "tn" |
| <a id="property-synchash"></a> `syncHash?` | `public` | `boolean` | writes the URL hash after each change (default false) |

## Functions

### bindPanel()

```ts
function bindPanel(
   host, 
   reg, 
   opts?
): Panel;
```

Builds a tune panel for a registry inside `host` with DOM calls only and keeps both in step.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `host` | `HTMLElement` |
| `reg` | [`Registry`](index.md#registry) |
| `opts?` | [`PanelOptions`](#paneloptions) |

#### Returns

[`Panel`](#panel)
