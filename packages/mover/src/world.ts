// Kinematic capsule mover against axis aligned boxes and vertical
// cylinders, with step up, ceilings, wall sliding, substeps and moving
// platform carry. Written for this library from the character physics of
// crownfall (https://github.com/virgilvox/crownfall, MIT, same author).

export const STEP_UP = 0.36;

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

interface Base {
  enabled: boolean;
  /** pushes sideways only, never stood on (props, tall walls) */
  wall?: boolean;
  /** motion of the collider this frame, carried to actors standing on it */
  dx: number;
  dy: number;
  dz: number;
  minY: number;
  maxY: number;
  id?: string;
}
export interface BoxCollider extends Base {
  kind: "box";
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}
export interface CylCollider extends Base {
  kind: "cyl";
  x: number;
  z: number;
  r: number;
}
export type Collider = BoxCollider | CylCollider;

/** A box with its top at `topY`, `w` wide on x and `d` deep on z. */
export function box(cx: number, topY: number, cz: number, w: number, d: number, thick = 3): BoxCollider {
  return { kind: "box", enabled: true, minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, minY: topY - thick, maxY: topY, dx: 0, dy: 0, dz: 0 };
}
export function cyl(x: number, topY: number, z: number, r: number, thick = 3): CylCollider {
  return { kind: "cyl", enabled: true, x, z, r, minY: topY - thick, maxY: topY, dx: 0, dy: 0, dz: 0 };
}
export function wallBox(cx: number, cz: number, w: number, d: number, y0: number, y1 = y0 + 40): BoxCollider {
  const c = box(cx, y1, cz, w, d, y1 - y0);
  c.wall = true;
  return c;
}
export function wallCyl(x: number, z: number, r: number, y0: number, y1 = y0 + 40): CylCollider {
  const c = cyl(x, y1, z, r, y1 - y0);
  c.wall = true;
  return c;
}
/** Moves a collider and records the motion for carry. */
export function moveCollider(c: Collider, dx: number, dy: number, dz: number): void {
  if (c.kind === "box") {
    c.minX += dx;
    c.maxX += dx;
    c.minZ += dz;
    c.maxZ += dz;
  } else {
    c.x += dx;
    c.z += dz;
  }
  c.minY += dy;
  c.maxY += dy;
  c.dx = dx;
  c.dy = dy;
  c.dz = dz;
}

function overlaps(c: Collider, x: number, z: number, r: number): boolean {
  if (c.kind === "box") {
    const nx = Math.max(c.minX, Math.min(x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - nx;
    const dz = z - nz;
    return dx * dx + dz * dz < r * r;
  }
  const dx = x - c.x;
  const dz = z - c.z;
  const rr = c.r + r;
  return dx * dx + dz * dz < rr * rr;
}
function contains(c: Collider, x: number, z: number): boolean {
  if (c.kind === "box") return x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ;
  const dx = x - c.x;
  const dz = z - c.z;
  return dx * dx + dz * dz <= c.r * c.r;
}

export interface Actor {
  /** feet position */
  pos: Vec3Like;
  vel: Vec3Like;
  radius: number;
  height: number;
  grounded?: boolean;
  groundC?: Collider | null;
  /** impact speed of the last landing, 0 when none this step */
  landed?: number;
  hitWall?: boolean;
}

export interface WorldOptions {
  stepUp?: number;
  maxSubsteps?: number;
  /** metres per substep at most (crownfall 0.3) */
  substepLength?: number;
}

export class World {
  readonly stepUp: number;
  readonly maxSubsteps: number;
  readonly substepLength: number;
  constructor(
    public colliders: Collider[],
    o: WorldOptions = {},
  ) {
    this.stepUp = o.stepUp ?? STEP_UP;
    this.maxSubsteps = o.maxSubsteps ?? 6;
    this.substepLength = o.substepLength ?? 0.3;
  }

  /** The highest walkable top under (x, z) not above maxY. */
  ground(x: number, z: number, maxY = Infinity, r = 0): { y: number; c: Collider } | null {
    let best: { y: number; c: Collider } | null = null;
    for (const c of this.colliders) {
      if (!c.enabled || c.wall || c.maxY > maxY) continue;
      if (best && c.maxY <= best.y) continue;
      if (r > 0 ? overlaps(c, x, z, r) : contains(c, x, z)) best = { y: c.maxY, c };
    }
    return best;
  }

  /** Moves an actor one step: carry from the platform under it, then substeps. */
  step(a: Actor, dt: number): void {
    const g = a.grounded ? a.groundC : null;
    if (g && (g.dx || g.dy || g.dz)) {
      a.pos.x += g.dx;
      a.pos.y += g.dy;
      a.pos.z += g.dz;
    }
    const sp = Math.max(Math.abs(a.vel.x), Math.abs(a.vel.z), Math.abs(a.vel.y)) * dt;
    const n = Math.max(1, Math.min(this.maxSubsteps, Math.ceil(sp / this.substepLength)));
    a.landed = 0;
    a.hitWall = false;
    for (let i = 0; i < n; i++) this.sub(a, dt / n);
  }

  /** Clears the per frame motion of every collider; call once per frame after stepping actors. */
  endFrame(): void {
    for (const c of this.colliders) c.dx = c.dy = c.dz = 0;
  }

  private sub(a: Actor, dt: number): void {
    const p = a.pos;
    const r = a.radius;
    const H = a.height;
    const prevY = p.y;
    p.x += a.vel.x * dt;
    p.z += a.vel.z * dt;
    p.y += a.vel.y * dt;
    for (const c of this.colliders) {
      if (!c.enabled) continue;
      if (p.y >= c.maxY - this.stepUp || p.y + H <= c.minY) continue;
      if (c.kind === "box") {
        const nx = Math.max(c.minX, Math.min(p.x, c.maxX));
        const nz = Math.max(c.minZ, Math.min(p.z, c.maxZ));
        const dx = p.x - nx;
        const dz = p.z - nz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          p.x += (dx / d) * (r - d);
          p.z += (dz / d) * (r - d);
          this.wall(a, dx / d, dz / d);
        } else {
          const l = p.x - c.minX;
          const rt = c.maxX - p.x;
          const f = p.z - c.minZ;
          const b = c.maxZ - p.z;
          const m = Math.min(l, rt, f, b);
          if (m === l) {
            p.x = c.minX - r;
            this.wall(a, -1, 0);
          } else if (m === rt) {
            p.x = c.maxX + r;
            this.wall(a, 1, 0);
          } else if (m === f) {
            p.z = c.minZ - r;
            this.wall(a, 0, -1);
          } else {
            p.z = c.maxZ + r;
            this.wall(a, 0, 1);
          }
        }
      } else {
        const dx = p.x - c.x;
        const dz = p.z - c.z;
        const rr = c.r + r;
        const d2 = dx * dx + dz * dz;
        if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2) || 1e-4;
        p.x = c.x + (dx / d) * rr;
        p.z = c.z + (dz / d) * rr;
        this.wall(a, dx / d, dz / d);
      }
    }
    if (a.vel.y > 0) {
      for (const c of this.colliders) {
        if (!c.enabled || c.wall) continue;
        if (prevY + H <= c.minY + 0.01 && p.y + H > c.minY && overlaps(c, p.x, p.z, r * 0.8)) {
          p.y = c.minY - H;
          a.vel.y = 0;
          break;
        }
      }
    }
    a.grounded = false;
    a.groundC = null;
    if (a.vel.y <= 0) {
      let best: Collider | null = null;
      for (const c of this.colliders) {
        if (!c.enabled || c.wall) continue;
        const top = c.maxY;
        if (top > prevY + this.stepUp + 0.001 || p.y > top + 0.0001) continue;
        if (best && top <= best.maxY) continue;
        if (overlaps(c, p.x, p.z, r * 0.75)) best = c;
      }
      if (best) {
        if (a.vel.y < -1) a.landed = Math.max(a.landed ?? 0, -a.vel.y);
        p.y = best.maxY;
        a.vel.y = 0;
        a.grounded = true;
        a.groundC = best;
      }
    }
  }

  private wall(a: Actor, nx: number, nz: number): void {
    a.hitWall = true;
    const vn = a.vel.x * nx + a.vel.z * nz;
    if (vn < 0) {
      a.vel.x -= vn * nx;
      a.vel.z -= vn * nz;
    }
  }
}
