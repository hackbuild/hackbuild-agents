import { Follow, Shake } from "@hackbuild/cameras";
import { PerspectiveCamera } from "three";

const camera = new PerspectiveCamera(50, 16 / 9, 0.1, 200);
// your raycast: here a wall 2 m behind the look target, along -z
const clear = (from: { z: number }, dir: { z: number }, max: number) => (dir.z < 0 ? Math.min(max, 2 / -dir.z) : max);
const follow = new Follow(camera, { distance: 4, clear });

// shake takes a seeded stream of its own, never the sim's
let seed = 7;
const shake = new Shake(() => ((seed = (seed * 16807) % 2147483647) / 2147483647));
shake.kick(0.4);

const dog = { x: 0, y: 0, z: 0, yaw: 0 };
for (let frame = 0; frame < 60; frame++) {
  dog.z += 0.02;
  follow.update(dog, dog.yaw, 1 / 60);
  camera.position.add(shake.step(1 / 60));
}
console.log(camera.position.toArray(), follow.dist);
