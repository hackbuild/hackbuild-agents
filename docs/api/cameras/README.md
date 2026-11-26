# @hackbuild/cameras

## Classes

### FirstPerson

A first person eye on an agent's head. `render` hides the head (scaled
to 0.001, since visible false would hide the whole subtree)
for this render only, then restores it.

#### Constructors

##### Constructor

```ts
new FirstPerson(
   camera, 
   head?, 
   forward?, 
   up?
): FirstPerson;
```

###### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `camera` | [`CameraLike`](#cameralike) | `undefined` |
| `head?` | [`Scalable`](#scalable) \| `null` | `null` |
| `forward?` | `number` | `0.11` |
| `up?` | `number` | `0.07` |

###### Returns

[`FirstPerson`](#firstperson)

#### Properties

| Property | Modifier | Type | Default value |
| ------ | ------ | ------ | ------ |
| <a id="property-camera"></a> `camera` | `readonly` | [`CameraLike`](#cameralike) | `undefined` |
| <a id="property-forward"></a> `forward` | `readonly` | `number` | `0.11` |
| <a id="property-head"></a> `head` | `readonly` | [`Scalable`](#scalable) \| `null` | `null` |
| <a id="property-up"></a> `up` | `readonly` | `number` | `0.07` |

#### Methods

##### place()

```ts
place(
   head, 
   yaw, 
   pitch
): void;
```

Head position, yaw (0 faces +Z) and pitch (up positive).

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `head` | [`V3`](#v3) |
| `yaw` | `number` |
| `pitch` | `number` |

###### Returns

`void`

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

### Follow

Third person follow behind a moving target, pulled in when something blocks the view.

#### Constructors

##### Constructor

```ts
new Follow(camera, o?): Follow;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `camera` | [`CameraLike`](#cameralike) |
| `o?` | [`FollowOptions`](#followoptions) |

###### Returns

[`Follow`](#follow)

#### Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="property-camera-1"></a> `camera` | `readonly` | [`CameraLike`](#cameralike) |
| <a id="property-dist"></a> `dist` | `public` | `number` |
| <a id="property-o"></a> `o` | `readonly` | `Required`\<`Omit`\<[`FollowOptions`](#followoptions), `"clear"`\>\> & `Pick`\<[`FollowOptions`](#followoptions), `"clear"`\> |

#### Methods

##### update()

```ts
update(
   p, 
   heading, 
   dt, 
   snap?
): void;
```

`heading` is the target's yaw (0 faces +Z).

###### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `p` | [`V3`](#v3) | `undefined` |
| `heading` | `number` | `undefined` |
| `dt` | `number` | `undefined` |
| `snap?` | `boolean` | `false` |

###### Returns

`void`

***

### Group

Keeps every point in view: the crownfall shared camera.

#### Constructors

##### Constructor

```ts
new Group(camera, o?): Group;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `camera` | [`CameraLike`](#cameralike) |
| `o?` | [`GroupOptions`](#groupoptions) |

###### Returns

[`Group`](#group)

#### Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="property-camera-2"></a> `camera` | `readonly` | [`CameraLike`](#cameralike) |
| <a id="property-dist-1"></a> `dist` | `public` | `number` |
| <a id="property-o-1"></a> `o` | `readonly` | `Required`\<[`GroupOptions`](#groupoptions)\> |
| <a id="property-target"></a> `target` | `public` | [`V3`](#v3) |

#### Methods

##### solve()

```ts
solve(points): object;
```

The distance and centre that frame the points (no damping).

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `points` | readonly [`V3`](#v3)[] |

###### Returns

`object`

| Name | Type |
| ------ | ------ |
| `dist` | `number` |
| `target` | [`V3`](#v3) |

##### update()

```ts
update(
   points, 
   dt, 
   snap?, 
   shake?
): void;
```

###### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `points` | readonly [`V3`](#v3)[] | `undefined` |
| `dt` | `number` | `undefined` |
| `snap?` | `boolean` | `false` |
| `shake?` | [`V3`](#v3) | `undefined` |

###### Returns

`void`

***

### Orbit

A free orbit camera driven by deltas (drag, wheel, keys); input binding stays with the app.

#### Constructors

##### Constructor

```ts
new Orbit(
   camera, 
   yaw?, 
   pitch?, 
   dist?, 
   target?, 
   limits?
): Orbit;
```

###### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `camera` | [`CameraLike`](#cameralike) | `undefined` |
| `yaw?` | `number` | `0` |
| `pitch?` | `number` | `0.5` |
| `dist?` | `number` | `6` |
| `target?` | [`V3`](#v3) | `...` |
| `limits?` | \{ `maxDist`: `number`; `maxPitch`: `number`; `minDist`: `number`; `minPitch`: `number`; \} | `...` |
| `limits.maxDist?` | `number` | `60` |
| `limits.maxPitch?` | `number` | `1.45` |
| `limits.minDist?` | `number` | `1` |
| `limits.minPitch?` | `number` | `0.05` |

###### Returns

[`Orbit`](#orbit)

#### Properties

| Property | Modifier | Type | Default value |
| ------ | ------ | ------ | ------ |
| <a id="property-camera-3"></a> `camera` | `readonly` | [`CameraLike`](#cameralike) | `undefined` |
| <a id="property-dist-2"></a> `dist` | `public` | `number` | `6` |
| <a id="property-limits"></a> `limits` | `readonly` | `object` | `...` |
| `limits.maxDist` | `public` | `number` | `60` |
| `limits.maxPitch` | `public` | `number` | `1.45` |
| `limits.minDist` | `public` | `number` | `1` |
| `limits.minPitch` | `public` | `number` | `0.05` |
| <a id="property-pitch"></a> `pitch` | `public` | `number` | `0.5` |
| <a id="property-target-1"></a> `target` | `public` | [`V3`](#v3) | `undefined` |
| <a id="property-yaw"></a> `yaw` | `public` | `number` | `0` |

#### Methods

##### apply()

```ts
apply(): void;
```

###### Returns

`void`

##### pan()

```ts
pan(right, forward): void;
```

Moves the target in the ground plane, relative to the view.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `right` | `number` |
| `forward` | `number` |

###### Returns

`void`

##### rotate()

```ts
rotate(dYaw, dPitch): void;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `dYaw` | `number` |
| `dPitch` | `number` |

###### Returns

`void`

##### zoom()

```ts
zoom(factor): void;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `factor` | `number` |

###### Returns

`void`

***

### Shake

Shake: seeded value noise on three axes, amplitude decaying at `decay`
per second. It draws from its Rng only while shaking (three numbers per
knot, `frequency` knots a second) and holds two knots. Give it an Rng
stream of its own: how many draws fall before a given sim time depends
on the frame steps, so sharing the sim's stream would tie the sim to the
frame rate.

#### Constructors

##### Constructor

```ts
new Shake(
   rng, 
   frequency?, 
   decay?
): Shake;
```

###### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `rng` | [`Rng`](#rng) | `undefined` |
| `frequency?` | `number` | `18` |
| `decay?` | `number` | `6` |

###### Returns

[`Shake`](#shake)

#### Properties

| Property | Modifier | Type | Default value |
| ------ | ------ | ------ | ------ |
| <a id="property-decay"></a> `decay` | `readonly` | `number` | `6` |
| <a id="property-frequency"></a> `frequency` | `readonly` | `number` | `18` |

#### Accessors

##### amplitude

###### Get Signature

```ts
get amplitude(): number;
```

###### Returns

`number`

#### Methods

##### kick()

```ts
kick(amplitude, max?): void;
```

Adds trauma; amplitudes add and are capped at `max`.

###### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `amplitude` | `number` | `undefined` |
| `max?` | `number` | `1` |

###### Returns

`void`

##### step()

```ts
step(dt): V3;
```

The offset for this frame.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `dt` | `number` |

###### Returns

[`V3`](#v3)

## Interfaces

### CameraLike

The camera surface the rigs write: a three PerspectiveCamera fits, nothing is imported.

#### Properties

| Property | Type |
| ------ | ------ |
| <a id="property-aspect"></a> `aspect` | `number` |
| <a id="property-fov"></a> `fov` | `number` |
| <a id="property-position"></a> `position` | `object` |
| `position.x` | `number` |
| `position.y` | `number` |
| `position.z` | `number` |
| `position.set` | (`x`, `y`, `z`) => `unknown` |

#### Methods

##### lookAt()

```ts
lookAt(
   x, 
   y, 
   z
): void;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `x` | `number` |
| `y` | `number` |
| `z` | `number` |

###### Returns

`void`

***

### FollowOptions

Options of [Follow](#follow); every field has a default.

#### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-backoff"></a> `backoff?` | `number` | metres kept in front of an occluder |
| <a id="property-clear"></a> `clear?` | (`from`, `dir`, `max`) => `number` | The free distance from the look target toward the camera along a unit direction, up to `max` (a raycast against the world); omit for no occlusion handling. |
| <a id="property-distance"></a> `distance?` | `number` | - |
| <a id="property-lookheight"></a> `lookHeight?` | `number` | height of the look target above the followed point |
| <a id="property-mindistance"></a> `minDistance?` | `number` | - |
| <a id="property-pitch-1"></a> `pitch?` | `number` | - |
| <a id="property-smoothing"></a> `smoothing?` | `number` | damping rates per second for the target and the yaw |
| <a id="property-yawsmoothing"></a> `yawSmoothing?` | `number` | - |

***

### GroupOptions

Options of [Group](#group); every field has a default.

#### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-band"></a> `band?` | `number` | usable share of the screen height (crownfall 0.64, the rest is HUD) |
| <a id="property-center"></a> `center?` | [`V3`](#v3) | - |
| <a id="property-centerpull"></a> `centerPull?` | `number` | pull of the framing centre toward `center` |
| <a id="property-maxdistance"></a> `maxDistance?` | `number` | - |
| <a id="property-mindistance-1"></a> `minDistance?` | `number` | - |
| <a id="property-pad"></a> `pad?` | `number` | padding around the group (m; crownfall 5.5) |
| <a id="property-pitch-2"></a> `pitch?` | `number` | - |
| <a id="property-yaw-1"></a> `yaw?` | `number` | - |

***

### Scalable

An object with a scale, such as a three Object3D head bone.

#### Properties

| Property | Type |
| ------ | ------ |
| <a id="property-scale"></a> `scale` | `object` |
| `scale.x` | `number` |
| `scale.y` | `number` |
| `scale.z` | `number` |
| `scale.set` | (`x`, `y`, `z`) => `unknown` |

***

### V3

A point or offset in metres, y up.

#### Properties

| Property | Type |
| ------ | ------ |
| <a id="property-x"></a> `x` | `number` |
| <a id="property-y"></a> `y` | `number` |
| <a id="property-z"></a> `z` | `number` |

## Type Aliases

### Rng

```ts
type Rng = () => number;
```

Uniform numbers in [0, 1), injected so a seed replays the same shake.

#### Returns

`number`

## Functions

### damp()

```ts
function damp(
   from, 
   to, 
   rate, 
   dt
): number;
```

Frame rate independent exponential damping toward `to` at `rate` per second.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `from` | `number` |
| `to` | `number` |
| `rate` | `number` |
| `dt` | `number` |

#### Returns

`number`

***

### orbitPosition()

```ts
function orbitPosition(
   target, 
   yaw, 
   pitch, 
   dist
): V3;
```

Places a camera on an orbit around a target: yaw 0 behind +Z, pitch up from the ground.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `target` | [`V3`](#v3) |
| `yaw` | `number` |
| `pitch` | `number` |
| `dist` | `number` |

#### Returns

[`V3`](#v3)

***

### splitViewports()

```ts
function splitViewports(
   n, 
   width, 
   height
): object[];
```

Viewports for 1 to 4 split views in pixels, top left origin; three wants bottom left, so `y` is flipped for it.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `n` | `number` |
| `width` | `number` |
| `height` | `number` |

#### Returns

`object`[]
