// three.js adapter: cameras as the 16 number layout the wasm takes, and an
// agent eye that renders an object ID buffer and a depth buffer from the
// agent's head, so perception reads only what the eye can see. Written for
// this library from an earlier unpublished perception prototype by the
// same author and the eye render of the earlier dog simulator
// (https://github.com/hackbuild/dog-simulator/tree/main/legacy).
// Readback is synchronous by default; `passAsync` uses
// readRenderTargetPixelsAsync and refuses a second pass while one is in
// flight (learned in earlier builds: a busy flag, never a queue).
import * as THREE from "three";
import type { CameraArray } from "./index.js";

/** The camera layout the wasm takes, from a three PerspectiveCamera. */
export function cameraFromThree(cam: THREE.PerspectiveCamera, out: CameraArray = new Float64Array(16)): CameraArray {
  cam.updateMatrixWorld();
  const e = cam.matrixWorld.elements;
  const right = new THREE.Vector3(e[0], e[1], e[2]).normalize();
  const up = new THREE.Vector3(e[4], e[5], e[6]).normalize();
  const back = new THREE.Vector3(e[8], e[9], e[10]).normalize();
  out.set([e[12] as number, e[13] as number, e[14] as number, right.x, right.y, right.z, up.x, up.y, up.z, back.x, back.y, back.z, cam.fov, cam.aspect, cam.near, cam.far]);
  return out;
}

/** Options of {@link Eye}; every field has a default. */
export interface EyeOptions {
  /** vertical field of view in degrees (default 74) */
  fov?: number;
  /** ID buffer size (default 192 by 108) */
  width?: number;
  height?: number;
  /** depth buffer size (default 96 by 54) */
  depthWidth?: number;
  depthHeight?: number;
  /** depth range in metres (default 12) */
  far?: number;
  near?: number;
}

/** An object the eye counts pixels for, with its label. */
export interface Tracked {
  object: THREE.Object3D;
  label: string;
  /** pixels needed to count as seen (default 2; about 60 suits furniture) */
  minPixels?: number;
}

/** A tracked object the eye saw: pixels, centroid and distance. */
export interface Seen {
  label: string;
  pixels: number;
  /** centroid in the ID buffer, 0 to 1, v down */
  u: number;
  v: number;
  /** metres from the eye at the centroid, from the depth buffer */
  dist: number;
}

/** The result of one eye pass: what was seen and the depth buffer in metres. */
export interface EyePass {
  visible: Seen[];
  /** metres along the view ray, row 0 at the top */
  depth: Float32Array<ArrayBuffer>;
  depthWidth: number;
  depthHeight: number;
  camera: CameraArray;
}

// Built from three's own chunks so instanced, batched, skinned and morphed
// meshes land where the ID pass draws them.
const DEPTH_VERT = [
  "#include <common>",
  "#include <batching_pars_vertex>",
  "#include <morphtarget_pars_vertex>",
  "#include <skinning_pars_vertex>",
  "varying vec3 vP;",
  "void main() {",
  "#include <batching_vertex>",
  "#include <skinbase_vertex>",
  "#include <morphinstance_vertex>",
  "#include <begin_vertex>",
  "#include <morphtarget_vertex>",
  "#include <skinning_vertex>",
  "#include <project_vertex>",
  "vP = mvPosition.xyz;",
  "}",
].join("\n");
const DEPTH_FRAG = "uniform float far; varying vec3 vP; void main() { float v = clamp(length(vP) / far, 0.0, 0.9999) * 255.0; gl_FragColor = vec4(floor(v) / 255.0, fract(v), 0.0, 1.0); }";

/** Decodes the RG packed depth of a bottom up readback into metres, row 0 at the top. */
export function decodeDepth(px: Uint8Array, w: number, h: number, far: number, out: Float32Array<ArrayBuffer> = new Float32Array(w * h)): Float32Array<ArrayBuffer> {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const l = ((h - 1 - y) * w + x) * 4;
      out[y * w + x] = (((px[l] as number) + (px[l + 1] as number) / 255) / 255) * far;
    }
  }
  return out;
}

/** Counts ID pixels per tracked index in a bottom up readback; ids are `index + 1` in red plus 256 times green. */
export function countIds(px: Uint8Array, w: number, h: number, n: number): { count: Uint32Array; sx: Float64Array; sy: Float64Array } {
  const count = new Uint32Array(n);
  const sx = new Float64Array(n);
  const sy = new Float64Array(n);
  for (let i = 0; i < w * h; i++) {
    const id = (px[i * 4] as number) + 256 * (px[i * 4 + 1] as number) - 1;
    if (id < 0 || id >= n) continue;
    count[id] = (count[id] as number) + 1;
    sx[id] = (sx[id] as number) + (i % w);
    sy[id] = (sy[id] as number) + (h - 1 - Math.floor(i / w));
  }
  return { count, sx, sy };
}

/** An eye on an agent's head that renders an object ID buffer and a depth buffer and reads them back. */
export class Eye {
  readonly camera: THREE.PerspectiveCamera;
  readonly opts: Required<EyeOptions>;
  private idTarget: THREE.WebGLRenderTarget;
  private depthTarget: THREE.WebGLRenderTarget;
  private idPx: Uint8Array;
  private depthPx: Uint8Array;
  private depth: Float32Array<ArrayBuffer>;
  private black = new THREE.MeshBasicMaterial({ color: 0x000000 });
  private idMats: THREE.MeshBasicMaterial[] = [];
  private depthMat: THREE.ShaderMaterial;
  private colorTarget: THREE.WebGLRenderTarget | null = null;
  private colorTmp = new Uint8Array(0);
  private busy = false;

  constructor(
    private renderer: THREE.WebGLRenderer,
    private scene: THREE.Scene,
    opts: EyeOptions = {},
  ) {
    this.opts = { fov: 74, width: 192, height: 108, depthWidth: 96, depthHeight: 54, far: 12, near: 0.03, ...opts };
    const o = this.opts;
    this.camera = new THREE.PerspectiveCamera(o.fov, o.width / o.height, o.near, o.far * 1.5);
    const rt = (w: number, h: number) => new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
    this.idTarget = rt(o.width, o.height);
    this.depthTarget = rt(o.depthWidth, o.depthHeight);
    this.idPx = new Uint8Array(o.width * o.height * 4);
    this.depthPx = new Uint8Array(o.depthWidth * o.depthHeight * 4);
    this.depth = new Float32Array(o.depthWidth * o.depthHeight);
    this.depthMat = new THREE.ShaderMaterial({ uniforms: { far: { value: o.far } }, vertexShader: DEPTH_VERT, fragmentShader: DEPTH_FRAG });
  }

  /** Puts the eye at a point looking along yaw (0 is +Z) and pitch. */
  place(pos: THREE.Vector3, yaw: number, pitch: number): void {
    const d = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    this.camera.position.copy(pos);
    this.camera.lookAt(pos.clone().add(d));
    this.camera.updateMatrixWorld(true);
  }

  get pending(): boolean {
    return this.busy;
  }

  private idMat(i: number): THREE.MeshBasicMaterial {
    let m = this.idMats[i];
    if (!m) {
      const id = i + 1;
      m = new THREE.MeshBasicMaterial();
      m.color.setRGB((id % 256) / 255, Math.floor(id / 256) / 255, 0, THREE.LinearSRGBColorSpace);
      this.idMats[i] = m;
    }
    return m;
  }

  private renderBoth(tracked: Tracked[], hide: THREE.Object3D[]): () => void {
    const { renderer: r, scene } = this;
    const byMesh = new Map<THREE.Object3D, number>();
    tracked.forEach((t, i) => t.object.traverse((o) => byMesh.set(o, i)));
    const saved: [THREE.Mesh | THREE.Object3D, THREE.Material | THREE.Material[] | null, boolean][] = [];
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if ((o as THREE.Points).isPoints || (o as THREE.Line).isLine || (o as THREE.Sprite).isSprite) {
        saved.push([o, null, o.visible]);
        o.visible = false;
      } else if (m.isMesh) {
        saved.push([m, m.material, m.visible]);
        const i = byMesh.get(m);
        m.material = i === undefined ? this.black : this.idMat(i);
      }
    });
    const hid = hide.map((h) => [h, h.visible] as const);
    for (const h of hide) h.visible = false;
    const bg = scene.background;
    const fog = scene.fog;
    scene.background = null;
    scene.fog = null;
    const prevTarget = r.getRenderTarget();
    const prevClear = r.getClearColor(new THREE.Color());
    const prevAlpha = r.getClearAlpha();
    const restore = () => {
      scene.overrideMaterial = null;
      r.setRenderTarget(prevTarget);
      r.setClearColor(prevClear, prevAlpha);
      for (const [o, mat, vis] of saved) {
        if (mat) (o as THREE.Mesh).material = mat;
        o.visible = vis;
      }
      for (const [h, v] of hid) h.visible = v;
      scene.background = bg;
      scene.fog = fog;
    };
    // a throw mid render must not leave the scene in ID materials
    try {
      r.setRenderTarget(this.idTarget);
      r.setClearColor(0x000000, 1);
      r.clear();
      r.render(scene, this.camera);
      scene.overrideMaterial = this.depthMat;
      r.setRenderTarget(this.depthTarget);
      r.setClearColor(0xffffff, 1);
      r.clear();
      r.render(scene, this.camera);
      scene.overrideMaterial = null;
    } catch (e) {
      restore();
      throw e;
    }
    return restore;
  }

  private finish(tracked: Tracked[]): EyePass {
    const o = this.opts;
    decodeDepth(this.depthPx, o.depthWidth, o.depthHeight, o.far, this.depth);
    const { count, sx, sy } = countIds(this.idPx, o.width, o.height, tracked.length);
    const visible: Seen[] = [];
    tracked.forEach((t, i) => {
      const n = count[i] as number;
      if (n < (t.minPixels ?? 2)) return;
      const u = (sx[i] as number) / n / o.width;
      const v = (sy[i] as number) / n / o.height;
      const dx = Math.min(o.depthWidth - 1, Math.round(u * o.depthWidth));
      const dy = Math.min(o.depthHeight - 1, Math.round(v * o.depthHeight));
      visible.push({ label: t.label, pixels: n, u, v, dist: this.depth[dy * o.depthWidth + dx] as number });
    });
    return { visible, depth: this.depth, depthWidth: o.depthWidth, depthHeight: o.depthHeight, camera: cameraFromThree(this.camera) };
  }

  /** Renders the ID and depth buffers and reads them back synchronously. */
  pass(tracked: Tracked[], hide: THREE.Object3D[] = []): EyePass {
    const restore = this.renderBoth(tracked, hide);
    const o = this.opts;
    this.renderer.readRenderTargetPixels(this.idTarget, 0, 0, o.width, o.height, this.idPx);
    this.renderer.readRenderTargetPixels(this.depthTarget, 0, 0, o.depthWidth, o.depthHeight, this.depthPx);
    restore();
    return this.finish(tracked);
  }

  /** The same pass with async readback; null while a previous pass is in flight. */
  async passAsync(tracked: Tracked[], hide: THREE.Object3D[] = []): Promise<EyePass | null> {
    if (this.busy) return null;
    this.busy = true;
    try {
      const restore = this.renderBoth(tracked, hide);
      restore();
      const o = this.opts;
      await this.renderer.readRenderTargetPixelsAsync(this.idTarget, 0, 0, o.width, o.height, this.idPx);
      await this.renderer.readRenderTargetPixelsAsync(this.depthTarget, 0, 0, o.depthWidth, o.depthHeight, this.depthPx);
      return this.finish(tracked);
    } finally {
      this.busy = false;
    }
  }

  /**
   * A colour frame for saliency (RGBA, row 0 at the top) of `w` by `h`.
   * Without `target` the eye keeps one render target and one readback
   * buffer for the size and reuses them; `dispose` frees them.
   */
  colorFrame(w: number, h: number, target?: THREE.WebGLRenderTarget, out = new Uint8Array(w * h * 4)): Uint8Array {
    let rt = target;
    if (!rt) {
      const c = this.colorTarget;
      if (!c || c.width !== w || c.height !== h) {
        c?.dispose();
        this.colorTarget = new THREE.WebGLRenderTarget(w, h);
      }
      rt = this.colorTarget as THREE.WebGLRenderTarget;
    }
    if (this.colorTmp.length !== w * h * 4) this.colorTmp = new Uint8Array(w * h * 4);
    const tmp = this.colorTmp;
    const prev = this.renderer.getRenderTarget();
    try {
      this.renderer.setRenderTarget(rt);
      this.renderer.render(this.scene, this.camera);
      this.renderer.readRenderTargetPixels(rt, 0, 0, w, h, tmp);
    } finally {
      this.renderer.setRenderTarget(prev);
    }
    for (let y = 0; y < h; y++) out.set(tmp.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
    return out;
  }

  dispose(): void {
    this.idTarget.dispose();
    this.depthTarget.dispose();
    this.colorTarget?.dispose();
    this.colorTarget = null;
    this.depthMat.dispose();
    this.black.dispose();
    for (const m of this.idMats) m.dispose();
  }
}
