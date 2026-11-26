# yard

## Interfaces

### YardHandle

What `mountYard` returns.

#### Properties

| Property | Modifier | Type | Description |
| ------ | ------ | ------ | ------ |
| <a id="property-ready"></a> `ready` | `readonly` | `Promise`\<`unknown`\> | resolves with the scope's test handle once the dog and his person stand in the yard |
| <a id="property-root"></a> `root` | `readonly` | `HTMLElement` | the yard root inside the host |

#### Methods

##### dispose()

```ts
dispose(): void;
```

stops the loop, the workers, the voice and the microphone, and empties the host

###### Returns

`void`

***

### YardOptions

Options of `mountYard`.

#### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-anims"></a> `anims` | `object` \| [`YardAsset`](#yardasset) | The person's clip pack (JSON with roles, fps and clips), as an object or an asset. |
| <a id="property-bar"></a> `bar?` | `HTMLElement` \| `null` | Where the readout chips, the setup button and the command button go, such as the host's header. Left out, the two buttons join the verb row and the chips are not shown. |
| <a id="property-dog"></a> `dog` | [`YardAsset`](#yardasset) | The dog model, a binary glTF with the rig the yard expects. |
| <a id="property-hub"></a> `hub?` | `string` | A model hub base URL for the cortex models in place of https://huggingface.co/. |
| <a id="property-human"></a> `human?` | [`YardAsset`](#yardasset) \| `null` | The person model, a binary glTF; null or left out draws a placeholder of capsules. |
| <a id="property-params"></a> `params?` | `string` | The yard's switches as a query string: `test&seed=N` for lockstep, `seed=N&speed=S`, `cortex=stub`, `stubloads`. Default: the page hash, when `reseed` is also left out. |
| <a id="property-physics"></a> `physics` | () => `Promise`\<`unknown`\> | Returns the `@dimforge/rapier3d-compat` module (or its default export). The yard calls `init()` on it. It is a function so a host can load the 1.6 MB gzip (measured) core lazily, from its own bundle or from a plain file. |
| <a id="property-reseed"></a> `reseed?` | (`params`) => `void` | Runs a new seed (the tune tab's seed row). Left out with `params`, the row only reads. |
| <a id="property-setup"></a> `setup?` | `boolean` | Opens the setup panel on a first visit (default true); the setup button opens it anyway. |
| <a id="property-suiteurl"></a> `suiteUrl?` | `string` | The suite's base URL; links into it show only when it is set. |
| <a id="property-voice"></a> `voice?` | [`YardAsset`](#yardasset) \| `null` | His voice reference, a wav for the cloned voice; left out, he speaks in a browser voice. |

## Type Aliases

### YardAsset

```ts
type YardAsset = 
  | string
  | URL
  | ArrayBuffer
  | Uint8Array
  | Blob
  | (() => Promise<string | URL | ArrayBuffer | Uint8Array | Blob>);
```

Where a yard asset comes from: a URL (fetched), the bytes, a Blob, or a function that returns
any of those. A string that starts with `data:` is read as a data URL.

## Functions

### mountYard()

```ts
function mountYard(host, o): Promise<YardHandle>;
```

Mounts the yard in `host`. The yard keeps one instance per page: its parts find each other by
id. Its stylesheet goes into the document head once. Load hackbuild-ui's `hackbuild.css` on the
page for the look.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `host` | `HTMLElement` |
| `o` | [`YardOptions`](#yardoptions) |

#### Returns

`Promise`\<[`YardHandle`](#yardhandle)\>
