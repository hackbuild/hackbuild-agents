// A three.js stage for the agents examples: renderer in #stage, camera,
// orbit controls, lights and a ground grid. Every shape is built in code.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { $ } from "./ui.js";

export interface Stage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
}

export function stage(target: [number, number, number] = [0, 0.4, 0], distance = 2): Stage {
  const host = $("#stage");
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  host.append(renderer.domElement);
  // the scene orbits with a finger: OrbitControls reads pointer events, the canvas takes touch-action none
  host.classList.add("is-orbit");
  const scene = new THREE.Scene();
  // the light scene the checks were measured on; the dark branch went with the dark palette
  scene.background = new THREE.Color(0xffffff);
  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.01, 200);
  camera.position.set(target[0] + distance * 0.8, target[1] + distance * 0.45, target[2] + distance);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(...target);
  controls.update();
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb0aca0, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(2, 4, 3);
  scene.add(sun);
  const grid = new THREE.GridHelper(40, 80, 0xb8b5ac, 0xdedbd2);
  scene.add(grid);
  const fit = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(fit).observe(host);
  fit();
  return { renderer, scene, camera, controls };
}

/** A seeded stream for the examples; library code takes it injected. */
export const lcg = (seed: number) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);


/** A standing capsule of radius r and height h, feet at y = 0. */
export function capsule(r: number, h: number, color: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.01, h - 2 * r), 6, 16), new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
  m.geometry.translate(0, h / 2, 0);
  return m;
}

export function boxMesh(w: number, h: number, d: number, color: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
  m.geometry.translate(0, h / 2, 0);
  return m;
}
