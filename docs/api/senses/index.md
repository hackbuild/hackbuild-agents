# index

## Classes

### Looming

Looming detector keyed by small integer ids; `observe` returns the tau of a startle or null.

#### Constructors

##### Constructor

```ts
new Looming(o?): Looming;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `o?` | [`LoomOptions`](#loomoptions) |

###### Returns

[`Looming`](#looming)

#### Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="property-inner"></a> `inner` | `readonly` | `Loom` |

#### Methods

##### forget()

```ts
forget(id): void;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `id` | `number` |

###### Returns

`void`

##### free()

```ts
free(): void;
```

Frees the wasm memory now, before the garbage collector would; the object is unusable after.

###### Returns

`void`

##### observe()

```ts
observe(
   id, 
   size, 
   dist, 
   now
): number | null;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `id` | `number` |
| `size` | `number` |
| `dist` | `number` |
| `now` | `number` |

###### Returns

`number` \| `null`

***

### OccupancyGrid

Occupancy grid from eye depth renders, with A* paths and frontiers.

#### Constructors

##### Constructor

```ts
new OccupancyGrid(o?): OccupancyGrid;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `o?` | [`GridOptions`](#gridoptions) |

###### Returns

[`OccupancyGrid`](#occupancygrid)

#### Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="property-inner-1"></a> `inner` | `readonly` | `OccupancyGrid` |

#### Accessors

##### revision

###### Get Signature

```ts
get revision(): number;
```

###### Returns

`number`

#### Methods

##### at()

```ts
at(x, z): number;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `x` | `number` |
| `z` | `number` |

###### Returns

`number`

##### bump()

```ts
bump(x, z): void;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `x` | `number` |
| `z` | `number` |

###### Returns

`void`

##### canStand()

```ts
canStand(x, z): boolean;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `x` | `number` |
| `z` | `number` |

###### Returns

`boolean`

##### cells()

```ts
cells(): Uint8Array;
```

###### Returns

`Uint8Array`

##### free()

```ts
free(): void;
```

Frees the wasm memory now, before the garbage collector would; the object is unusable after.

###### Returns

`void`

##### freeAround()

```ts
freeAround(x, z): void;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `x` | `number` |
| `z` | `number` |

###### Returns

`void`

##### frontiers()

```ts
frontiers(p): Frontier[];
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `p` | \{ `x`: `number`; `z`: `number`; \} |
| `p.x` | `number` |
| `p.z` | `number` |

###### Returns

[`Frontier`](#frontier)[]

##### integrate()

```ts
integrate(
   camera, 
   depth, 
   width, 
   height, 
   far, 
   agent
): void;
```

Depth in metres along the view ray, row 0 at the top.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `camera` | [`CameraArray`](#cameraarray) |
| `depth` | `Float32Array` |
| `width` | `number` |
| `height` | `number` |
| `far` | `number` |
| `agent` | [`Vec3`](#vec3) |

###### Returns

`void`

##### known()

```ts
known(): object;
```

###### Returns

`object`

| Name | Type |
| ------ | ------ |
| `free` | `number` |
| `occupied` | `number` |

##### mark()

```ts
mark(
   x, 
   z, 
   obstacle
): void;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `x` | `number` |
| `z` | `number` |
| `obstacle` | `boolean` |

###### Returns

`void`

##### markDead()

```ts
markDead(x, z): void;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `x` | `number` |
| `z` | `number` |

###### Returns

`void`

##### path()

```ts
path(a, b): object[] | null;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `a` | \{ `x`: `number`; `z`: `number`; \} |
| `a.x` | `number` |
| `a.z` | `number` |
| `b` | \{ `x`: `number`; `z`: `number`; \} |
| `b.x` | `number` |
| `b.z` | `number` |

###### Returns

`object`[] \| `null`

***

### OdourField

Puff plume in a meandering wind plus a ground trail grid.

#### Constructors

##### Constructor

```ts
new OdourField(o): OdourField;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `o` | [`OdourOptions`](#odouroptions) |

###### Returns

[`OdourField`](#odourfield)

#### Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="property-inner-2"></a> `inner` | `readonly` | `OdourField` |

#### Accessors

##### puffCount

###### Get Signature

```ts
get puffCount(): number;
```

###### Returns

`number`

#### Methods

##### clearPuffs()

```ts
clearPuffs(): void;
```

###### Returns

`void`

##### concentration()

```ts
concentration(x, z): number;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `x` | `number` |
| `z` | `number` |

###### Returns

`number`

##### decayTrail()

```ts
decayTrail(elapsed, halflife): void;
```

Fades the trail by `elapsed / halflife` halvings.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `elapsed` | `number` |
| `halflife` | `number` |

###### Returns

`void`

##### deposit()

```ts
deposit(
   x, 
   z, 
   amount, 
   now
): void;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `x` | `number` |
| `z` | `number` |
| `amount` | `number` |
| `now` | `number` |

###### Returns

`void`

##### free()

```ts
free(): void;
```

###### Returns

`void`

##### groundConcentration()

```ts
groundConcentration(x, z): number;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `x` | `number` |
| `z` | `number` |

###### Returns

`number`

##### puffConcentration()

```ts
puffConcentration(x, z): number;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `x` | `number` |
| `z` | `number` |

###### Returns

`number`

##### puffs()

```ts
puffs(): Float64Array;
```

x, z, age, mass per puff

###### Returns

`Float64Array`

##### setPuffRate()

```ts
setPuffRate(rate): void;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `rate` | `number` |

###### Returns

`void`

##### setWind()

```ts
setWind(speed, meander): void;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `speed` | `number` |
| `meander` | `number` |

###### Returns

`void`

##### step()

```ts
step(dt, sources): void;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `dt` | `number` |
| `sources` | [`OdourSource`](#odoursource)[] |

###### Returns

`void`

##### trail()

```ts
trail(): Float32Array;
```

###### Returns

`Float32Array`

##### trailDirection()

```ts
trailDirection(
   x, 
   z, 
   prev?
): 
  | {
  x: number;
  z: number;
}
  | null;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `x` | `number` |
| `z` | `number` |
| `prev?` | \{ `x`: `number`; `z`: `number`; \} |
| `prev.x` | `number` |
| `prev.z` | `number` |

###### Returns

  \| \{
  `x`: `number`;
  `z`: `number`;
\}
  \| `null`

##### wind()

```ts
wind(): object;
```

###### Returns

`object`

| Name | Type |
| ------ | ------ |
| `x` | `number` |
| `z` | `number` |

***

### PerceptMemory

Geometric vision with percept memory that drifts with sqrt(age) (Fiset 2003).

#### Constructors

##### Constructor

```ts
new PerceptMemory(o): PerceptMemory;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `o` | [`VisionOptions`](#visionoptions) |

###### Returns

[`PerceptMemory`](#perceptmemory)

#### Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="property-inner-3"></a> `inner` | `readonly` | `PerceptMemory` |

#### Methods

##### free()

```ts
free(): void;
```

Frees the wasm memory now, before the garbage collector would; the object is unusable after.

###### Returns

`void`

##### recall()

```ts
recall(id, now): 
  | {
  confidence: number;
  pos: Vec3;
}
  | null;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `id` | `number` |
| `now` | `number` |

###### Returns

  \| \{
  `confidence`: `number`;
  `pos`: [`Vec3`](#vec3);
\}
  \| `null`

##### sense()

```ts
sense(
   id, 
   eye, 
   facingYaw, 
   s, 
   light, 
   t
): Percept;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `id` | `number` |
| `eye` | [`Vec3`](#vec3) |
| `facingYaw` | `number` |
| `s` | [`Sighting`](#sighting) |
| `light` | `number` |
| `t` | `number` |

###### Returns

[`Percept`](#percept)

***

### Saliency

Itti Koch saliency with top down bias and world space inhibition of return.

#### Constructors

##### Constructor

```ts
new Saliency(o): Saliency;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `o` | [`SaliencyOptions`](#saliencyoptions) |

###### Returns

[`Saliency`](#saliency)

#### Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="property-inner-4"></a> `inner` | `readonly` | `Saliency` |

#### Accessors

##### inhibited

###### Get Signature

```ts
get inhibited(): number;
```

###### Returns

`number`

##### mapHeight

###### Get Signature

```ts
get mapHeight(): number;
```

###### Returns

`number`

##### mapWidth

###### Get Signature

```ts
get mapWidth(): number;
```

###### Returns

`number`

#### Methods

##### biasPoint()

```ts
biasPoint(p, weight): void;
```

Top down bias for the next update: `weight * exp(-d^2 / 6)` around the point's projection.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `p` | [`Vec3`](#vec3) |
| `weight` | `number` |

###### Returns

`void`

##### biasUv()

```ts
biasUv(
   u, 
   v, 
   weight
): void;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `u` | `number` |
| `v` | `number` |
| `weight` | `number` |

###### Returns

`void`

##### free()

```ts
free(): void;
```

###### Returns

`void`

##### inhibit()

```ts
inhibit(dir, until): void;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `dir` | [`Vec3`](#vec3) |
| `until` | `number` |

###### Returns

`void`

##### map()

```ts
map(): Float32Array;
```

###### Returns

`Float32Array`

##### ready()

```ts
ready(now): boolean;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `now` | `number` |

###### Returns

`boolean`

##### shift()

```ts
shift(
   now, 
   camera, 
   objects, 
   arousal
): Fixation | null;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `now` | `number` |
| `camera` | [`CameraArray`](#cameraarray) |
| `objects` | [`Vec3`](#vec3)[] |
| `arousal` | `number` |

###### Returns

[`Fixation`](#fixation) \| `null`

##### update()

```ts
update(
   frame, 
   width, 
   height, 
   now, 
   camera
): Float32Array;
```

RGBA frame, row 0 at the top. Returns the map (mapWidth by mapHeight).

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `frame` | \| `Uint8Array`\<`ArrayBufferLike`\> \| `Uint8ClampedArray`\<`ArrayBufferLike`\> |
| `width` | `number` |
| `height` | `number` |
| `now` | `number` |
| `camera` | [`CameraArray`](#cameraarray) |

###### Returns

`Float32Array`

##### winner()

```ts
winner(): 
  | {
  index: number;
  value: number;
}
  | null;
```

###### Returns

  \| \{
  `index`: `number`;
  `value`: `number`;
\}
  \| `null`

***

### Sniffer

Two nostril sniffing in bouts (Craven 2010; Thesen 1993: 6 Hz while tracking).

#### Constructors

##### Constructor

```ts
new Sniffer(o): Sniffer;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `o` | \{ `boutHz?`: `number`; `rng`: [`Rng`](#rng); `sniffHz?`: `number`; \} |
| `o.boutHz?` | `number` |
| `o.rng` | [`Rng`](#rng) |
| `o.sniffHz?` | `number` |

###### Returns

[`Sniffer`](#sniffer)

#### Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="property-inner-5"></a> `inner` | `readonly` | `Sniffer` |

#### Methods

##### free()

```ts
free(): void;
```

Frees the wasm memory now, before the garbage collector would; the object is unusable after.

###### Returns

`void`

##### state()

```ts
state(): object;
```

###### Returns

`object`

| Name | Type |
| ------ | ------ |
| `conc` | `number` |
| `left` | `number` |
| `mean` | `number` |
| `right` | `number` |
| `whiffT` | `number` |

##### tick()

```ts
tick(
   field, 
   dt, 
   now, 
   active, 
   nose, 
   side
): boolean;
```

Returns true when a sniff was taken. `side` is the offset to the left nostril.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `field` | [`OdourField`](#odourfield) |
| `dt` | `number` |
| `now` | `number` |
| `active` | `boolean` |
| `nose` | \{ `x`: `number`; `z`: `number`; \} |
| `nose.x` | `number` |
| `nose.z` | `number` |
| `side` | \{ `x`: `number`; `z`: `number`; \} |
| `side.x` | `number` |
| `side.z` | `number` |

###### Returns

`boolean`

##### whiff()

```ts
whiff(now, window?): boolean;
```

###### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `now` | `number` | `undefined` |
| `window?` | `number` | `0.9` |

###### Returns

`boolean`

***

### Tracker

Scent tracking: decide over a ground trail, follow it, surge upwind on whiffs, cast crosswind on a loss.

#### Constructors

##### Constructor

```ts
new Tracker(o): Tracker;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `o` | \{ `rng`: [`Rng`](#rng); \} |
| `o.rng` | [`Rng`](#rng) |

###### Returns

[`Tracker`](#tracker)

#### Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="property-inner-6"></a> `inner` | `readonly` | `Tracker` |

#### Methods

##### free()

```ts
free(): void;
```

Frees the wasm memory now, before the garbage collector would; the object is unusable after.

###### Returns

`void`

##### setWaypoint()

```ts
setWaypoint(x, z): void;
```

Replaces the waypoint, for a caller that keeps it out of obstacles.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `x` | `number` |
| `z` | `number` |

###### Returns

`void`

##### step()

```ts
step(
   field, 
   sniffer, 
   dt, 
   now, 
   pos, 
   heading, 
   arrived
): TrackStep;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `field` | [`OdourField`](#odourfield) |
| `sniffer` | [`Sniffer`](#sniffer) |
| `dt` | `number` |
| `now` | `number` |
| `pos` | \{ `x`: `number`; `z`: `number`; \} |
| `pos.x` | `number` |
| `pos.z` | `number` |
| `heading` | `number` |
| `arrived` | `boolean` |

###### Returns

[`TrackStep`](#trackstep)

## Interfaces

### Fixation

Where the eye goes next: the winning map cell, its world point and the object it snapped to.

#### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-object"></a> `object` | `number` | index into the objects passed to shift, or -1 for the ground |
| <a id="property-point"></a> `point` | [`Vec3`](#vec3) | - |
| <a id="property-value"></a> `value` | `number` | - |
| <a id="property-x"></a> `x` | `number` | cell in the saliency map |
| <a id="property-y"></a> `y` | `number` | - |

***

### Frontier

A frontier between free and unknown cells: its centre, distance and size in cells.

#### Properties

| Property | Type |
| ------ | ------ |
| <a id="property-dist"></a> `dist` | `number` |
| <a id="property-size"></a> `size` | `number` |
| <a id="property-x-1"></a> `x` | `number` |
| <a id="property-z"></a> `z` | `number` |

***

### GridOptions

Options of [OccupancyGrid](#occupancygrid); every field has a default.

#### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-bucket"></a> `bucket?` | `number` | - |
| <a id="property-cell"></a> `cell?` | `number` | cell size in metres (default 0.1) |
| <a id="property-cells"></a> `cells?` | `number` | cells per side (default 220) |
| <a id="property-center"></a> `center?` | `object` | - |
| `center.x` | `number` | - |
| `center.z` | `number` | - |
| <a id="property-floory"></a> `floorY?` | `number` | - |
| <a id="property-heady"></a> `headY?` | `number` | - |
| <a id="property-hitstomark"></a> `hitsToMark?` | `number` | - |
| <a id="property-maxrange"></a> `maxRange?` | `number` | - |
| <a id="property-radius"></a> `radius?` | `number` | obstacle inflation and free footprint in cells (default 2) |

***

### LoomOptions

Options of [Looming](#looming); every field has a default.

#### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-maxgap"></a> `maxGap?` | `number` | - |
| <a id="property-minangle"></a> `minAngle?` | `number` | - |
| <a id="property-refractory"></a> `refractory?` | `number` | - |
| <a id="property-tau"></a> `tau?` | `number` | startle under this tau in seconds (default 0.6) |

***

### OdourOptions

Options of [OdourField](#odourfield); only `rng` is required.

#### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-bounds"></a> `bounds?` | `number` | - |
| <a id="property-cells-1"></a> `cells?` | `number` | trail cells per side (default 64) |
| <a id="property-maxpuffs"></a> `maxPuffs?` | `number` | - |
| <a id="property-meander"></a> `meander?` | `number` | - |
| <a id="property-pufflife"></a> `puffLife?` | `number` | - |
| <a id="property-puffrate"></a> `puffRate?` | `number` | puffs per second per source at strength 1 (default 5) |
| <a id="property-rng"></a> `rng` | [`Rng`](#rng) | - |
| <a id="property-size-1"></a> `size?` | `number` | side of the square world in metres, centred on the origin (default 34) |
| <a id="property-wind"></a> `wind?` | `number` | - |
| <a id="property-windheading"></a> `windHeading?` | `number` | - |

***

### OdourSource

One odour source for a step of [OdourField](#odourfield).

#### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-id"></a> `id` | `number` | a small integer per source |
| <a id="property-strength"></a> `strength` | `number` | - |
| <a id="property-x-2"></a> `x` | `number` | - |
| <a id="property-z-1"></a> `z` | `number` | - |

***

### Percept

What [PerceptMemory.sense](#sense) returns for one object.

#### Properties

| Property | Type |
| ------ | ------ |
| <a id="property-confidence"></a> `confidence` | `number` |
| <a id="property-dist-1"></a> `dist` | `number` |
| <a id="property-salience"></a> `salience` | `number` |
| <a id="property-seen"></a> `seen` | `number` \| `null` |
| <a id="property-speed"></a> `speed` | `number` |
| <a id="property-visible"></a> `visible` | `boolean` |

***

### SaliencyOptions

Options of [Saliency](#saliency); only `rng` is required.

#### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-channels"></a> `channels?` | `object` | channel weights (default 1, 0.7, 0.6, 1.7) |
| `channels.blueYellow?` | `number` | - |
| `channels.edges?` | `number` | - |
| `channels.intensity?` | `number` | - |
| `channels.motion?` | `number` | - |
| <a id="property-fixationmedian"></a> `fixationMedian?` | `number` | fixation dwell median in seconds (default 0.83, Barber 2016) |
| <a id="property-gain"></a> `gain?` | `number` | - |
| <a id="property-groundy"></a> `groundY?` | `number` | - |
| <a id="property-height"></a> `height?` | `number` | - |
| <a id="property-iorseconds"></a> `iorSeconds?` | `number` | inhibition of return in seconds (default 0.7) |
| <a id="property-rng-1"></a> `rng` | [`Rng`](#rng) | - |
| <a id="property-snapangle"></a> `snapAngle?` | `number` | an object within this angle of the winner ray takes the fixation (default 0.25 rad) |
| <a id="property-threshold"></a> `threshold?` | `number` | the winner must beat this to become a fixation (default 0.35) |
| <a id="property-width"></a> `width?` | `number` | feature grid the frame is sampled to (default 80 by 40) |

***

### Sighting

What the caller knows of one object this frame; occlusion is answered by the caller.

#### Properties

| Property | Type |
| ------ | ------ |
| <a id="property-fixed"></a> `fixed?` | `boolean` |
| <a id="property-hidden"></a> `hidden?` | `boolean` |
| <a id="property-occluded"></a> `occluded?` | `boolean` |
| <a id="property-pos"></a> `pos` | [`Vec3`](#vec3) |
| <a id="property-size-2"></a> `size` | `number` |
| <a id="property-vel"></a> `vel?` | [`Vec3`](#vec3) |

***

### TrackStep

One tracker step: the mode, the waypoint to walk to, its speed and stop distance.

#### Properties

| Property | Type |
| ------ | ------ |
| <a id="property-changed"></a> `changed` | `boolean` |
| <a id="property-done"></a> `done` | `boolean` |
| <a id="property-mode"></a> `mode` | [`TrackMode`](#trackmode) |
| <a id="property-speed-1"></a> `speed` | `number` |
| <a id="property-stopdist"></a> `stopDist` | `number` |
| <a id="property-waypoint"></a> `waypoint` | \| \{ `x`: `number`; `z`: `number`; \} \| `null` |

***

### VisionOptions

Options of [PerceptMemory](#perceptmemory); only `rng` is required.

#### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-drift"></a> `drift?` | `number` | - |
| <a id="property-forgetafter"></a> `forgetAfter?` | `number` | - |
| <a id="property-halffov"></a> `halfFov?` | `number` | half the horizontal field of view in rad (default 2.09, a 240 degree field) |
| <a id="property-motiongain"></a> `motionGain?` | `number` | - |
| <a id="property-motionspeed"></a> `motionSpeed?` | `number` | - |
| <a id="property-nightfloor"></a> `nightFloor?` | `number` | - |
| <a id="property-rangepersize"></a> `rangePerSize?` | `number` | - |
| <a id="property-rng-2"></a> `rng` | [`Rng`](#rng) | - |

## Type Aliases

### CameraArray

```ts
type CameraArray = Float64Array;
```

A camera as 16 numbers: position, right, up, back (the columns of
three's matrixWorld), vertical fov in degrees, aspect, near, far.
`cameraFromThree` in `/three` builds one from a PerspectiveCamera.

***

### Rng

```ts
type Rng = () => number;
```

Uniform numbers in [0, 1). The family contract: injected, never Math.random.

#### Returns

`number`

***

### TrackMode

```ts
type TrackMode = "decide" | "trail" | "surge" | "cast";
```

The mode of a [Tracker](#tracker): decide over a trail, follow it, surge upwind or cast crosswind.

***

### Vec3

```ts
type Vec3 = object;
```

A point or velocity in metres, y up.

#### Properties

##### x

```ts
x: number;
```

##### y

```ts
y: number;
```

##### z

```ts
z: number;
```

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

Where the wasm comes from: a URL, a Response, bytes or a compiled module.

## Variables

### FREE

```ts
const FREE: 1 = 1;
```

Grid cell seen free.

***

### OCCUPIED

```ts
const OCCUPIED: 2 = 2;
```

Grid cell marked occupied.

***

### UNKNOWN

```ts
const UNKNOWN: 0 = 0;
```

Grid cell never observed.

## Functions

### angularSize()

```ts
function angularSize(size, dist): number;
```

Angular size in radians of an object of `size` metres at `dist` metres.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `size` | `number` |
| `dist` | `number` |

#### Returns

`number`

***

### cameraLook()

```ts
function cameraLook(
   pos, 
   yaw, 
   pitch, 
   fov, 
   aspect, 
   near?, 
   far?
): CameraArray;
```

A camera at a point looking along yaw (0 is +Z) and pitch (up positive).

#### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `pos` | [`Vec3`](#vec3) | `undefined` |
| `yaw` | `number` | `undefined` |
| `pitch` | `number` | `undefined` |
| `fov` | `number` | `undefined` |
| `aspect` | `number` | `undefined` |
| `near?` | `number` | `0.05` |
| `far?` | `number` | `100` |

#### Returns

[`CameraArray`](#cameraarray)

***

### gauss()

```ts
function gauss(rng): number;
```

Standard normal by Box Muller, u then v, as the crate draws them.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `rng` | [`Rng`](#rng) |

#### Returns

`number`

***

### goldenTrace()

```ts
function goldenTrace(seed): Float64Array;
```

The golden scenario run in wasm, for the native and wasm agreement test.

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

Loads the wasm. With no argument the inlined copy is used (works from file://).

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

Loads the wasm synchronously from bytes or a compiled module.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `source` | `ArrayBuffer` \| `Module` \| `ArrayBufferView`\<`ArrayBufferLike`\> |

#### Returns

`void`

***

### localizeSound()

```ts
function localizeSound(
   trueAzimuth, 
   yaw, 
   sdDeg, 
   facing, 
   rng
): number;
```

Heard azimuth (radians, 0 is +Z) for a source at `trueAzimuth`. Facing
the source narrows the error to 0.35 of `sdDeg`; otherwise 6 percent of
sounds mirror front to back about the body `yaw` (Guerineau 2022: dogs
1.3 to 13.2 degrees, mean 7.6).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `trueAzimuth` | `number` |
| `yaw` | `number` |
| `sdDeg` | `number` |
| `facing` | `boolean` |
| `rng` | [`Rng`](#rng) |

#### Returns

`number`

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

A 32 bit seed drawn from an injected Rng; how a wasm object is seeded.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `rng` | [`Rng`](#rng) |

#### Returns

`number`

***

### timeToContact()

```ts
function timeToContact(
   prevAngle, 
   angle, 
   dt
): number;
```

Time to contact tau = theta / (d theta / dt); Infinity when not growing.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `prevAngle` | `number` |
| `angle` | `number` |
| `dt` | `number` |

#### Returns

`number`
