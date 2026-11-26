# three

## Classes

### Eye

An eye on an agent's head that renders an object ID buffer and a depth buffer and reads them back.

#### Constructors

##### Constructor

```ts
new Eye(
   renderer, 
   scene, 
   opts?
): Eye;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `renderer` | `WebGLRenderer` |
| `scene` | `Scene` |
| `opts?` | [`EyeOptions`](#eyeoptions) |

###### Returns

[`Eye`](#eye)

#### Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="property-camera"></a> `camera` | `readonly` | `PerspectiveCamera` |
| <a id="property-opts"></a> `opts` | `readonly` | `Required`\<[`EyeOptions`](#eyeoptions)\> |

#### Accessors

##### pending

###### Get Signature

```ts
get pending(): boolean;
```

###### Returns

`boolean`

#### Methods

##### colorFrame()

```ts
colorFrame(
   w, 
   h, 
   target?, 
   out?
): Uint8Array;
```

A colour frame for saliency (RGBA, row 0 at the top) of `w` by `h`.
Without `target` the eye keeps one render target and one readback
buffer for the size and reuses them; `dispose` frees them.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `w` | `number` |
| `h` | `number` |
| `target?` | `WebGLRenderTarget`\<`Texture`\<`unknown`, `TextureEventMap`\>\> |
| `out?` | `Uint8Array`\<`ArrayBuffer`\> |

###### Returns

`Uint8Array`

##### dispose()

```ts
dispose(): void;
```

###### Returns

`void`

##### pass()

```ts
pass(tracked, hide?): EyePass;
```

Renders the ID and depth buffers and reads them back synchronously.

###### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `tracked` | [`Tracked`](#tracked)[] | `undefined` |
| `hide?` | `Object3D`\<`Object3DEventMap`\>[] | `[]` |

###### Returns

[`EyePass`](#eyepass-1)

##### passAsync()

```ts
passAsync(tracked, hide?): Promise<EyePass | null>;
```

The same pass with async readback; null while a previous pass is in flight.

###### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `tracked` | [`Tracked`](#tracked)[] | `undefined` |
| `hide?` | `Object3D`\<`Object3DEventMap`\>[] | `[]` |

###### Returns

`Promise`\<[`EyePass`](#eyepass-1) \| `null`\>

##### place()

```ts
place(
   pos, 
   yaw, 
   pitch
): void;
```

Puts the eye at a point looking along yaw (0 is +Z) and pitch.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `pos` | `Vector3` |
| `yaw` | `number` |
| `pitch` | `number` |

###### Returns

`void`

## Interfaces

### EyeOptions

Options of [Eye](#eye); every field has a default.

#### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-depthheight"></a> `depthHeight?` | `number` | - |
| <a id="property-depthwidth"></a> `depthWidth?` | `number` | depth buffer size (default 96 by 54) |
| <a id="property-far"></a> `far?` | `number` | depth range in metres (default 12) |
| <a id="property-fov"></a> `fov?` | `number` | vertical field of view in degrees (default 74) |
| <a id="property-height"></a> `height?` | `number` | - |
| <a id="property-near"></a> `near?` | `number` | - |
| <a id="property-width"></a> `width?` | `number` | ID buffer size (default 192 by 108) |

***

### EyePass

The result of one eye pass: what was seen and the depth buffer in metres.

#### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-camera-1"></a> `camera` | [`CameraArray`](index.md#cameraarray) | - |
| <a id="property-depth"></a> `depth` | `Float32Array`\<`ArrayBuffer`\> | metres along the view ray, row 0 at the top |
| <a id="property-depthheight-1"></a> `depthHeight` | `number` | - |
| <a id="property-depthwidth-1"></a> `depthWidth` | `number` | - |
| <a id="property-visible"></a> `visible` | [`Seen`](#seen)[] | - |

***

### Seen

A tracked object the eye saw: pixels, centroid and distance.

#### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-dist"></a> `dist` | `number` | metres from the eye at the centroid, from the depth buffer |
| <a id="property-label"></a> `label` | `string` | - |
| <a id="property-pixels"></a> `pixels` | `number` | - |
| <a id="property-u"></a> `u` | `number` | centroid in the ID buffer, 0 to 1, v down |
| <a id="property-v"></a> `v` | `number` | - |

***

### Tracked

An object the eye counts pixels for, with its label.

#### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-label-1"></a> `label` | `string` | - |
| <a id="property-minpixels"></a> `minPixels?` | `number` | pixels needed to count as seen (default 2; about 60 suits furniture) |
| <a id="property-object"></a> `object` | `Object3D` | - |

## Functions

### cameraFromThree()

```ts
function cameraFromThree(cam, out?): CameraArray;
```

The camera layout the wasm takes, from a three PerspectiveCamera.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `cam` | `PerspectiveCamera` |
| `out?` | [`CameraArray`](index.md#cameraarray) |

#### Returns

[`CameraArray`](index.md#cameraarray)

***

### countIds()

```ts
function countIds(
   px, 
   w, 
   h, 
   n
): object;
```

Counts ID pixels per tracked index in a bottom up readback; ids are `index + 1` in red plus 256 times green.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `px` | `Uint8Array` |
| `w` | `number` |
| `h` | `number` |
| `n` | `number` |

#### Returns

`object`

| Name | Type |
| ------ | ------ |
| `count` | `Uint32Array` |
| `sx` | `Float64Array` |
| `sy` | `Float64Array` |

***

### decodeDepth()

```ts
function decodeDepth(
   px, 
   w, 
   h, 
   far, 
   out?
): Float32Array<ArrayBuffer>;
```

Decodes the RG packed depth of a bottom up readback into metres, row 0 at the top.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `px` | `Uint8Array` |
| `w` | `number` |
| `h` | `number` |
| `far` | `number` |
| `out?` | `Float32Array`\<`ArrayBuffer`\> |

#### Returns

`Float32Array`\<`ArrayBuffer`\>
