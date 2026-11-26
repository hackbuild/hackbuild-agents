# @hackbuild/mover

## Classes

### Steerer

Steering for one agent among others: a held passing side per neighbour, contact constraints, timed yields and a stall detector.

#### Constructors

##### Constructor

```ts
new Steerer(id, o?): Steerer;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `id` | `string` |
| `o?` | [`SteerOptions`](#steeroptions) |

###### Returns

[`Steerer`](#steerer)

#### Properties

| Property | Modifier | Type | Default value |
| ------ | ------ | ------ | ------ |
| <a id="property-id"></a> `id` | `readonly` | `string` | `undefined` |
| <a id="property-o"></a> `o` | `readonly` | `Required`\<`Omit`\<[`SteerOptions`](#steeroptions), `"follow"`\>\> & `object` | `undefined` |
| <a id="property-stalls"></a> `stalls` | `public` | `number` | `0` |

#### Accessors

##### hasGoal

###### Get Signature

```ts
get hasGoal(): boolean;
```

###### Returns

`boolean`

##### target

###### Get Signature

```ts
get target(): 
  | {
  x: number;
  z: number;
}
  | null;
```

###### Returns

  \| \{
  `x`: `number`;
  `z`: `number`;
\}
  \| `null`

##### unreachable

###### Get Signature

```ts
get unreachable(): boolean;
```

True once the current goal has stalled `maxStalls` times; a new goal resets it.

###### Returns

`boolean`

##### waypointsLeft

###### Get Signature

```ts
get waypointsLeft(): number;
```

Waypoints left before the goal (a stall side waypoint included).

###### Returns

`number`

#### Methods

##### clearGoal()

```ts
clearGoal(): void;
```

###### Returns

`void`

##### setGoal()

```ts
setGoal(x, z): void;
```

A new goal: waypoints and the stall history reset (no stale completion).

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `x` | `number` |
| `z` | `number` |

###### Returns

`void`

##### setPath()

```ts
setPath(points): void;
```

A goal reached through waypoints, as `planPath` gives them: the last
point is the goal, the others are walked in order first. The stall
history resets as with `setGoal`.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `points` | readonly `object`[] |

###### Returns

`void`

##### sideFor()

```ts
sideFor(other, now): number;
```

The held passing side for a neighbour: +1 right of the heading, -1 left, 0 none.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `other` | `string` |
| `now` | `number` |

###### Returns

`number`

##### update()

```ts
update(
   now, 
   self, 
   others, 
   obstacles?, 
   ignore?
): SteerOut;
```

###### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `now` | `number` | `undefined` |
| `self` | [`AgentState`](#agentstate) | `undefined` |
| `others` | readonly [`AgentState`](#agentstate)[] | `undefined` |
| `obstacles?` | readonly [`Footprint`](#footprint)[] | `[]` |
| `ignore?` | `ReadonlySet`\<`string`\> | `...` |

###### Returns

[`SteerOut`](#steerout)

***

### World

Moves capsule actors against box and cylinder colliders with step up, ceilings, wall sliding and platform carry.

#### Constructors

##### Constructor

```ts
new World(colliders, o?): World;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `colliders` | [`Collider`](#collider)[] |
| `o?` | [`WorldOptions`](#worldoptions) |

###### Returns

[`World`](#world)

#### Properties

| Property | Modifier | Type |
| ------ | ------ | ------ |
| <a id="property-colliders"></a> `colliders` | `public` | [`Collider`](#collider)[] |
| <a id="property-maxsubsteps"></a> `maxSubsteps` | `readonly` | `number` |
| <a id="property-stepup"></a> `stepUp` | `readonly` | `number` |
| <a id="property-substeplength"></a> `substepLength` | `readonly` | `number` |

#### Methods

##### endFrame()

```ts
endFrame(): void;
```

Clears the per frame motion of every collider; call once per frame after stepping actors.

###### Returns

`void`

##### ground()

```ts
ground(
   x, 
   z, 
   maxY?, 
   r?
): 
  | {
  c: Collider;
  y: number;
}
  | null;
```

The highest walkable top under (x, z) not above maxY.

###### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `x` | `number` | `undefined` |
| `z` | `number` | `undefined` |
| `maxY?` | `number` | `Infinity` |
| `r?` | `number` | `0` |

###### Returns

  \| \{
  `c`: [`Collider`](#collider);
  `y`: `number`;
\}
  \| `null`

##### step()

```ts
step(a, dt): void;
```

Moves an actor one step: carry from the platform under it, then substeps.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `a` | [`Actor`](#actor) |
| `dt` | `number` |

###### Returns

`void`

## Interfaces

### Actor

A capsule the world moves: feet position, velocity, radius and height, with ground and contact flags it writes back.

#### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-groundc"></a> `groundC?` | [`Collider`](#collider) \| `null` | - |
| <a id="property-grounded"></a> `grounded?` | `boolean` | - |
| <a id="property-height"></a> `height` | `number` | - |
| <a id="property-hitwall"></a> `hitWall?` | `boolean` | - |
| <a id="property-landed"></a> `landed?` | `number` | impact speed of the last landing, 0 when none this step |
| <a id="property-pos"></a> `pos` | [`Vec3Like`](#vec3like) | feet position |
| <a id="property-radius"></a> `radius` | `number` | - |
| <a id="property-vel"></a> `vel` | [`Vec3Like`](#vec3like) | - |

***

### AgentState

The flat state of one agent that every steerer reads: position, velocity, radius and priority.

#### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-id-1"></a> `id` | `string` | - |
| <a id="property-moving"></a> `moving?` | `boolean` | true when the agent is walking to a goal |
| <a id="property-priority"></a> `priority?` | `number` | higher goes first; equal priorities break by id |
| <a id="property-radius-1"></a> `radius` | `number` | - |
| <a id="property-vx"></a> `vx` | `number` | - |
| <a id="property-vz"></a> `vz` | `number` | - |
| <a id="property-x"></a> `x` | `number` | - |
| <a id="property-z"></a> `z` | `number` | - |

***

### BoxCollider

An axis aligned box collider, made by `box` or `wallBox`.

#### Extends

- `Base`

#### Properties

| Property | Type | Description | Inherited from |
| ------ | ------ | ------ | ------ |
| <a id="property-dx"></a> `dx` | `number` | motion of the collider this frame, carried to actors standing on it | `Base.dx` |
| <a id="property-dy"></a> `dy` | `number` | - | `Base.dy` |
| <a id="property-dz"></a> `dz` | `number` | - | `Base.dz` |
| <a id="property-enabled"></a> `enabled` | `boolean` | - | `Base.enabled` |
| <a id="property-id-2"></a> `id?` | `string` | - | `Base.id` |
| <a id="property-kind"></a> `kind` | `"box"` | - | - |
| <a id="property-maxx"></a> `maxX` | `number` | - | - |
| <a id="property-maxy"></a> `maxY` | `number` | - | `Base.maxY` |
| <a id="property-maxz"></a> `maxZ` | `number` | - | - |
| <a id="property-minx"></a> `minX` | `number` | - | - |
| <a id="property-miny"></a> `minY` | `number` | - | `Base.minY` |
| <a id="property-minz"></a> `minZ` | `number` | - | - |
| <a id="property-wall"></a> `wall?` | `boolean` | pushes sideways only, never stood on (props, tall walls) | `Base.wall` |

***

### Capsule

A capsule part of a footprint: a segment from a to b grown by radius `r`.

#### Properties

| Property | Type |
| ------ | ------ |
| <a id="property-ax"></a> `ax` | `number` |
| <a id="property-az"></a> `az` | `number` |
| <a id="property-bx"></a> `bx` | `number` |
| <a id="property-bz"></a> `bz` | `number` |
| <a id="property-r"></a> `r` | `number` |

***

### Circle

A circle part of a footprint, centre and radius in metres.

#### Properties

| Property | Type |
| ------ | ------ |
| <a id="property-r-1"></a> `r` | `number` |
| <a id="property-x-1"></a> `x` | `number` |
| <a id="property-z-1"></a> `z` | `number` |

***

### CylCollider

A vertical cylinder collider, made by `cyl` or `wallCyl`.

#### Extends

- `Base`

#### Properties

| Property | Type | Description | Inherited from |
| ------ | ------ | ------ | ------ |
| <a id="property-dx-1"></a> `dx` | `number` | motion of the collider this frame, carried to actors standing on it | `Base.dx` |
| <a id="property-dy-1"></a> `dy` | `number` | - | `Base.dy` |
| <a id="property-dz-1"></a> `dz` | `number` | - | `Base.dz` |
| <a id="property-enabled-1"></a> `enabled` | `boolean` | - | `Base.enabled` |
| <a id="property-id-3"></a> `id?` | `string` | - | `Base.id` |
| <a id="property-kind-1"></a> `kind` | `"cyl"` | - | - |
| <a id="property-maxy-1"></a> `maxY` | `number` | - | `Base.maxY` |
| <a id="property-miny-1"></a> `minY` | `number` | - | `Base.minY` |
| <a id="property-r-2"></a> `r` | `number` | - | - |
| <a id="property-wall-1"></a> `wall?` | `boolean` | pushes sideways only, never stood on (props, tall walls) | `Base.wall` |
| <a id="property-x-2"></a> `x` | `number` | - | - |
| <a id="property-z-2"></a> `z` | `number` | - | - |

***

### Footprint

An obstacle on the ground as circles and capsules, such as a bench with two ends.

#### Properties

| Property | Type |
| ------ | ------ |
| <a id="property-id-4"></a> `id` | `string` |
| <a id="property-parts"></a> `parts` | ([`Circle`](#circle) \| [`Capsule`](#capsule))[] |

***

### PlanOptions

Grid, actor size and search area for `planPath`.

#### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-bounds"></a> `bounds?` | `object` | search area; default the box round every enabled collider and both ends |
| `bounds.maxX` | `number` | - |
| `bounds.maxZ` | `number` | - |
| `bounds.minX` | `number` | - |
| `bounds.minZ` | `number` | - |
| <a id="property-cell"></a> `cell?` | `number` | grid cell, metres (0.2) |
| <a id="property-height-1"></a> `height?` | `number` | actor height; colliders wholly above `y + height` do not block (1.7) |
| <a id="property-margin"></a> `margin?` | `number` | extra clearance kept from colliders, metres (0.12) |
| <a id="property-maxcells"></a> `maxCells?` | `number` | cells at most; a larger grid fails with reason `too-large` (250000) |
| <a id="property-radius-2"></a> `radius?` | `number` | actor radius, metres (0.3) |
| <a id="property-stepup-1"></a> `stepUp?` | `number` | tops up to `y + stepUp` are walked over (the world's stepUp, else 0.36) |
| <a id="property-y"></a> `y?` | `number` | feet height the actor walks at, metres (0) |

***

### Spot

A point on the ground plane.

#### Properties

| Property | Type |
| ------ | ------ |
| <a id="property-x-3"></a> `x` | `number` |
| <a id="property-z-3"></a> `z` | `number` |

***

### SteerOptions

Speed, clearance, passing side, stall and yield settings of a `Steerer`.

#### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-clearance"></a> `clearance?` | `number` | extra clearance kept from neighbours and obstacles (m) |
| <a id="property-exemptradius"></a> `exemptRadius?` | `number` | see `follow` (m) |
| <a id="property-follow"></a> `follow?` | `string` | id of a leader whose bend is switched off while the target is within `exemptRadius` of it |
| <a id="property-holdside"></a> `holdSide?` | `number` | seconds a chosen passing side is kept (the plan: at least 1) |
| <a id="property-lookahead"></a> `lookahead?` | `number` | neighbours closer than this bend the path (m, surface to surface) |
| <a id="property-maxstalls"></a> `maxStalls?` | `number` | stalls on one goal before `unreachable` turns true |
| <a id="property-sidestep"></a> `sideStep?` | `number` | side waypoint offset when a stall fires (m) |
| <a id="property-speed"></a> `speed?` | `number` | cruise speed m/s |
| <a id="property-stalldist"></a> `stallDist?` | `number` | stall: under `stallDist` m in `stallWindow` s with a goal |
| <a id="property-stallwindow"></a> `stallWindow?` | `number` | - |
| <a id="property-stopdist"></a> `stopDist?` | `number` | - |
| <a id="property-yieldcooldown"></a> `yieldCooldown?` | `number` | after a timed out yield, no new yield for this long (s) |
| <a id="property-yieldtimeout"></a> `yieldTimeout?` | `number` | a yield lasts at most this long (s), then the agent goes regardless |

***

### SteerOut

One steering step: the velocity to apply, the mode, a stall side waypoint if one was set, and why.

#### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-mode"></a> `mode` | `"arrived"` \| `"go"` \| `"pass"` \| `"yield"` | - |
| <a id="property-sidewaypoint"></a> `sideWaypoint` | \| \{ `x`: `number`; `z`: `number`; \} \| `null` | set on the step a stall inserted a side waypoint |
| <a id="property-vx-1"></a> `vx` | `number` | - |
| <a id="property-vz-1"></a> `vz` | `number` | - |
| <a id="property-why"></a> `why` | `string` | - |

***

### Vec3Like

A point or velocity with x, y and z, such as a three Vector3.

#### Properties

| Property | Type |
| ------ | ------ |
| <a id="property-x-4"></a> `x` | `number` |
| <a id="property-y-1"></a> `y` | `number` |
| <a id="property-z-4"></a> `z` | `number` |

***

### WorldOptions

Step height and substep limits of a `World`.

#### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="property-maxsubsteps-1"></a> `maxSubsteps?` | `number` | - |
| <a id="property-stepup-2"></a> `stepUp?` | `number` | - |
| <a id="property-substeplength-1"></a> `substepLength?` | `number` | metres per substep at most (default 0.3) |

## Type Aliases

### Collider

```ts
type Collider = BoxCollider | CylCollider;
```

A box or cylinder the world moves actors against.

***

### PlanResult

```ts
type PlanResult = 
  | {
  cells: number;
  ok: true;
  waypoints: Spot[];
  why: string;
}
  | {
  cells: number;
  ok: false;
  reason: "goal-blocked" | "no-way" | "too-large";
  waypoints: [];
  why: string;
};
```

The waypoints of a plan, or why there is none: `goal-blocked`, `no-way` or `too-large`.

## Variables

### STEP\_UP

```ts
const STEP_UP: 0.36 = 0.36;
```

Default step height in metres: tops up to this far above the feet are walked onto.

## Functions

### blockers()

```ts
function blockers(
   colliders, 
   y?, 
   height?, 
   stepUp?
): Collider[];
```

Colliders that block an actor at feet height `y` (walls, tops above the step, not overhead ones).

#### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `colliders` | readonly [`Collider`](#collider)[] | `undefined` |
| `y?` | `number` | `0` |
| `height?` | `number` | `1.7` |
| `stepUp?` | `number` | `0.36` |

#### Returns

[`Collider`](#collider)[]

***

### box()

```ts
function box(
   cx, 
   topY, 
   cz, 
   w, 
   d, 
   thick?
): BoxCollider;
```

A box with its top at `topY`, `w` wide on x and `d` deep on z.

#### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `cx` | `number` | `undefined` |
| `topY` | `number` | `undefined` |
| `cz` | `number` | `undefined` |
| `w` | `number` | `undefined` |
| `d` | `number` | `undefined` |
| `thick?` | `number` | `3` |

#### Returns

[`BoxCollider`](#boxcollider)

***

### clearAt()

```ts
function clearAt(
   block, 
   x, 
   z, 
   pad
): boolean;
```

True when an actor of the planner's radius plus margin fits at (x, z).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `block` | readonly [`Collider`](#collider)[] |
| `x` | `number` |
| `z` | `number` |
| `pad` | `number` |

#### Returns

`boolean`

***

### cyl()

```ts
function cyl(
   x, 
   topY, 
   z, 
   r, 
   thick?
): CylCollider;
```

A cylinder with its top at `topY` and radius `r`, `thick` metres tall.

#### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `x` | `number` | `undefined` |
| `topY` | `number` | `undefined` |
| `z` | `number` | `undefined` |
| `r` | `number` | `undefined` |
| `thick?` | `number` | `3` |

#### Returns

[`CylCollider`](#cylcollider)

***

### moveCollider()

```ts
function moveCollider(
   c, 
   dx, 
   dy, 
   dz
): void;
```

Moves a collider and records the motion for carry.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `c` | [`Collider`](#collider) |
| `dx` | `number` |
| `dy` | `number` |
| `dz` | `number` |

#### Returns

`void`

***

### nearest()

```ts
function nearest(
   fp, 
   x, 
   z
): object;
```

Surface distance from (x, z) to a footprint and the outward normal there.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `fp` | [`Footprint`](#footprint) |
| `x` | `number` |
| `z` | `number` |

#### Returns

`object`

| Name | Type |
| ------ | ------ |
| `dist` | `number` |
| `nx` | `number` |
| `nz` | `number` |

***

### planPath()

```ts
function planPath(
   world, 
   from, 
   to, 
   o?
): PlanResult;
```

A path from `from` to `to` round the colliders of `world` (a `World` or a
collider list), as waypoints after `from` ending exactly at `to`. On
failure `ok` is false and `reason` says why: the goal stands inside a
collider grown by the pad, no way exists on the grid, or the grid would
exceed `maxCells`.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `world` | readonly [`Collider`](#collider)[] \| [`World`](#world) |
| `from` | [`Spot`](#spot) |
| `to` | [`Spot`](#spot) |
| `o?` | [`PlanOptions`](#planoptions) |

#### Returns

[`PlanResult`](#planresult)

***

### wallBox()

```ts
function wallBox(
   cx, 
   cz, 
   w, 
   d, 
   y0, 
   y1?
): BoxCollider;
```

A box from `y0` to `y1` that only pushes sideways and is never stood on.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `cx` | `number` |
| `cz` | `number` |
| `w` | `number` |
| `d` | `number` |
| `y0` | `number` |
| `y1?` | `number` |

#### Returns

[`BoxCollider`](#boxcollider)

***

### wallCyl()

```ts
function wallCyl(
   x, 
   z, 
   r, 
   y0, 
   y1?
): CylCollider;
```

A cylinder from `y0` to `y1` that only pushes sideways and is never stood on.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `x` | `number` |
| `z` | `number` |
| `r` | `number` |
| `y0` | `number` |
| `y1?` | `number` |

#### Returns

[`CylCollider`](#cylcollider)
