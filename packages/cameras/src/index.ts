// @hackbuild/cameras: gameplay cameras that share damping, shake and
// occlusion handling. They drive any camera with `position.set`, `lookAt`,
// `fov` and `aspect` (a three PerspectiveCamera fits) and import nothing at
// runtime. Group framing is written for this library from the crownfall
// camera (MIT, same author); the first person eye follows the HACKLE
// lesson of hiding the agent's own head for that render.

export type Rng = () => number;

export interface V3 {
  x: number;
  y: number;
  z: number;
}

export interface CameraLike {
  position: { set(x: number, y: number, z: number): unknown; x: number; y: number; z: number };
  lookAt(x: number, y: number, z: number): void;
  fov: number;
  aspect: number;
}

/** Frame rate independent exponential damping toward `to` at `rate` per second. */
export const damp = (from: number, to: number, rate: number, dt: number): number => to + (from - to) * Math.exp(-rate * dt);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Shake: seeded value noise on three axes, amplitude decaying at `decay` per second. */
export class Shake {
  private amp = 0;
  private t = 0;
  private knots: number[][] = [];
  constructor(
    private rng: Rng,
    readonly frequency = 18,
    readonly decay = 6,
  ) {}
  /** Adds trauma; amplitudes add and are capped at `max`. */
  kick(amplitude: number, max = 1): void {
    this.amp = Math.min(max, this.amp + amplitude);
  }
  get amplitude(): number {
    return this.amp;
  }
  /** The offset for this frame. */
  step(dt: number): V3 {
    this.t += dt * this.frequency;
    while (this.knots.length < Math.floor(this.t) + 2) this.knots.push([this.rng() * 2 - 1, this.rng() * 2 - 1, this.rng() * 2 - 1]);
    const i = Math.floor(this.t);
    const f = this.t - i;
    const s = f * f * (3 - 2 * f);
    const a = this.knots[i] as number[];
    const b = this.knots[i + 1] as number[];
    const v = (k: number) => ((a[k] as number) + ((b[k] as number) - (a[k] as number)) * s) * this.amp;
    const out = { x: v(0), y: v(1), z: v(2) };
    this.amp *= Math.exp(-this.decay * dt);
    if (this.amp < 1e-4) this.amp = 0;
    return out;
  }
}

/** Places a camera on an orbit around a target: yaw 0 behind +Z, pitch up from the ground. */
export function orbitPosition(target: V3, yaw: number, pitch: number, dist: number): V3 {
  const cp = Math.cos(pitch);
  return { x: target.x - Math.sin(yaw) * cp * dist, y: target.y + Math.sin(pitch) * dist, z: target.z - Math.cos(yaw) * cp * dist };
}

export interface FollowOptions {
  distance?: number;
  minDistance?: number;
  pitch?: number;
  /** height of the look target above the followed point */
  lookHeight?: number;
  /** damping rates per second for the target and the yaw */
  smoothing?: number;
  yawSmoothing?: number;
  /** metres kept in front of an occluder */
  backoff?: number;
  /**
   * The free distance from the look target toward the camera along a unit
   * direction, up to `max` (a raycast against the world); omit for no
   * occlusion handling.
   */
  clear?: (from: V3, dir: V3, max: number) => number;
}

/** Third person follow behind a moving target, pulled in when something blocks the view. */
export class Follow {
  readonly o: Required<Omit<FollowOptions, "clear">> & Pick<FollowOptions, "clear">;
  private target: V3 | null = null;
  private yaw = 0;
  dist: number;
  constructor(
    readonly camera: CameraLike,
    o: FollowOptions = {},
  ) {
    this.o = { distance: 4, minDistance: 0.6, pitch: 0.35, lookHeight: 1.2, smoothing: 8, yawSmoothing: 4, backoff: 0.3, ...o };
    this.dist = this.o.distance;
  }
  /** `heading` is the target's yaw (0 faces +Z). */
  update(p: V3, heading: number, dt: number, snap = false): void {
    const look = { x: p.x, y: p.y + this.o.lookHeight, z: p.z };
    if (!this.target || snap) {
      this.target = { ...look };
      this.yaw = heading;
    } else {
      this.target.x = damp(this.target.x, look.x, this.o.smoothing, dt);
      this.target.y = damp(this.target.y, look.y, this.o.smoothing, dt);
      this.target.z = damp(this.target.z, look.z, this.o.smoothing, dt);
      const d = Math.atan2(Math.sin(heading - this.yaw), Math.cos(heading - this.yaw));
      this.yaw += d * (1 - Math.exp(-this.o.yawSmoothing * dt));
    }
    let want = this.o.distance;
    if (this.o.clear) {
      const ideal = orbitPosition(this.target, this.yaw, this.o.pitch, 1);
      const dir = { x: ideal.x - this.target.x, y: ideal.y - this.target.y, z: ideal.z - this.target.z };
      const free = this.o.clear(this.target, dir, this.o.distance);
      if (free < this.o.distance) want = Math.max(this.o.minDistance, free - this.o.backoff);
    }
    // pull in at once when blocked, ease back out when clear
    this.dist = want < this.dist || snap ? want : damp(this.dist, want, 2, dt);
    const c = orbitPosition(this.target, this.yaw, this.o.pitch, this.dist);
    this.camera.position.set(c.x, c.y, c.z);
    this.camera.lookAt(this.target.x, this.target.y, this.target.z);
  }
}

export interface GroupOptions {
  center?: V3;
  pitch?: number;
  yaw?: number;
  /** padding around the group (m; crownfall 5.5) */
  pad?: number;
  minDistance?: number;
  maxDistance?: number;
  /** usable share of the screen height (crownfall 0.64, the rest is HUD) */
  band?: number;
  /** pull of the framing centre toward `center` */
  centerPull?: number;
}

/** Keeps every point in view: the crownfall shared camera. */
export class Group {
  readonly o: Required<GroupOptions>;
  target: V3;
  dist: number;
  constructor(
    readonly camera: CameraLike,
    o: GroupOptions = {},
  ) {
    this.o = { center: { x: 0, y: 0, z: 0 }, pitch: 0.92, yaw: 0, pad: 1.2, minDistance: 3, maxDistance: 60, band: 1, centerPull: 0.1, ...o };
    this.target = { ...this.o.center };
    this.dist = this.o.maxDistance;
  }
  /** The distance and centre that frame the points (no damping). */
  solve(points: readonly V3[]): { target: V3; dist: number } {
    const pts = points.length ? points : [this.o.center];
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const p of pts) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    }
    const { pad, pitch, band, centerPull: k, center } = this.o;
    // the centre pull comes first, so the distance below frames the pulled centre
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    const target = { x: cx + (center.x - cx) * k, y: (minY + maxY) / 2, z: cz + (center.z - cz) * k };
    // camera basis for the orbit at this yaw and pitch: b from the target to
    // the camera, f the view direction, r and u the screen axes
    const yaw = this.o.yaw + Math.PI;
    const cp = Math.cos(pitch);
    const fx = Math.sin(yaw) * cp;
    const fy = -Math.sin(pitch);
    const fz = Math.cos(yaw) * cp;
    const rl = Math.hypot(fz, fx) || 1;
    const rx = -fz / rl;
    const rz = fx / rl;
    const ux = -rz * fy;
    const uy = rz * fx - rx * fz;
    const uz = rx * fy;
    const th = Math.tan((this.camera.fov * Math.PI) / 360) * band;
    const tw = Math.tan((this.camera.fov * Math.PI) / 360) * this.camera.aspect;
    // every corner of the padded box (pad in x and z, 1 m above and below)
    // must project inside the screen; depth grows one to one with the
    // distance while the screen offsets stay fixed, so each corner gives a
    // least distance in closed form
    let need = 0;
    for (const x of [minX - pad, maxX + pad])
      for (const y of [minY - 1, maxY + 1])
        for (const z of [minZ - pad, maxZ + pad]) {
          const qx = x - target.x;
          const qy = y - target.y;
          const qz = z - target.z;
          const sx = Math.abs(qx * rx + qz * rz);
          const sy = Math.abs(qx * ux + qy * uy + qz * uz);
          need = Math.max(need, Math.max(sx / tw, sy / th) - (qx * fx + qy * fy + qz * fz));
        }
    return { target, dist: clamp(need, this.o.minDistance, this.o.maxDistance) };
  }
  update(points: readonly V3[], dt: number, snap = false, shake?: V3): void {
    const s = this.solve(points);
    if (snap) {
      this.target = s.target;
      this.dist = s.dist;
    } else {
      this.target.x = damp(this.target.x, s.target.x, 3.2, dt);
      this.target.y = damp(this.target.y, s.target.y, 3.2, dt);
      this.target.z = damp(this.target.z, s.target.z, 3.2, dt);
      this.dist = damp(this.dist, s.dist, 2.4, dt);
    }
    const c = orbitPosition(this.target, this.o.yaw + Math.PI, this.o.pitch, this.dist);
    this.camera.position.set(c.x + (shake?.x ?? 0), c.y + (shake?.y ?? 0), c.z + (shake?.z ?? 0));
    this.camera.lookAt(this.target.x, this.target.y, this.target.z);
  }
}

/** A free orbit camera driven by deltas (drag, wheel, keys); input binding stays with the app. */
export class Orbit {
  target: V3;
  constructor(
    readonly camera: CameraLike,
    public yaw = 0,
    public pitch = 0.5,
    public dist = 6,
    target: V3 = { x: 0, y: 0.5, z: 0 },
    readonly limits = { minPitch: 0.05, maxPitch: 1.45, minDist: 1, maxDist: 60 },
  ) {
    this.target = { ...target };
  }
  rotate(dYaw: number, dPitch: number): void {
    this.yaw += dYaw;
    this.pitch = clamp(this.pitch + dPitch, this.limits.minPitch, this.limits.maxPitch);
  }
  zoom(factor: number): void {
    this.dist = clamp(this.dist * factor, this.limits.minDist, this.limits.maxDist);
  }
  /** Moves the target in the ground plane, relative to the view. */
  pan(right: number, forward: number): void {
    // with y up and yaw 0 along +z, the right of the view (sin yaw, cos yaw) is (-cos yaw, sin yaw)
    this.target.x += -Math.cos(this.yaw) * right + Math.sin(this.yaw) * forward;
    this.target.z += Math.sin(this.yaw) * right + Math.cos(this.yaw) * forward;
  }
  apply(): void {
    const c = orbitPosition(this.target, this.yaw, this.pitch, this.dist);
    this.camera.position.set(c.x, c.y, c.z);
    this.camera.lookAt(this.target.x, this.target.y, this.target.z);
  }
}

export interface Scalable {
  scale: { x: number; y: number; z: number; set(x: number, y: number, z: number): unknown };
}

/**
 * A first person eye on an agent's head. `render` hides the head (scaled
 * to 0.001, the HACKLE lesson: visible false would hide the whole subtree)
 * for this render only, then restores it.
 */
export class FirstPerson {
  constructor(
    readonly camera: CameraLike,
    readonly head: Scalable | null = null,
    readonly forward = 0.11,
    readonly up = 0.07,
  ) {}
  /** Head position, yaw (0 faces +Z) and pitch (up positive). */
  place(head: V3, yaw: number, pitch: number): void {
    const d = { x: Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: Math.cos(yaw) * Math.cos(pitch) };
    const p = { x: head.x + d.x * this.forward, y: head.y + this.up + d.y * this.forward, z: head.z + d.z * this.forward };
    this.camera.position.set(p.x, p.y, p.z);
    this.camera.lookAt(p.x + d.x, p.y + d.y, p.z + d.z);
  }
  render(draw: () => void): void {
    if (!this.head) return draw();
    const s = { x: this.head.scale.x, y: this.head.scale.y, z: this.head.scale.z };
    this.head.scale.set(0.001, 0.001, 0.001);
    try {
      draw();
    } finally {
      this.head.scale.set(s.x, s.y, s.z);
    }
  }
}

/** Viewports for 1 to 4 split views in pixels, top left origin; three wants bottom left, so `y` is flipped for it. */
export function splitViewports(n: number, width: number, height: number): { x: number; y: number; w: number; h: number; yGl: number }[] {
  const out: { x: number; y: number; w: number; h: number; yGl: number }[] = [];
  const cols = n <= 1 ? 1 : 2;
  const rows = n <= 2 ? 1 : 2;
  const w = Math.floor(width / cols);
  const h = Math.floor(height / rows);
  for (let i = 0; i < Math.min(n, 4); i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    // three views: the third spans the bottom row
    const vw = n === 3 && i === 2 ? width : w;
    out.push({ x: c * w, y: r * h, w: vw, h, yGl: height - (r + 1) * h });
  }
  return out;
}
