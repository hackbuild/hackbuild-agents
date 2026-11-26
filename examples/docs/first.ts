import { Chooser, Drives, load, seededRng } from "@hackbuild/drives";
import { Steerer, World, box } from "@hackbuild/mover";

await load();
const drives = new Drives({ hunger: 1, play: 0.8 });
const chooser = new Chooser({ rng: seededRng(7), options: ["eat", "play"] as const });
const goals = { eat: { x: 4, z: 0 }, play: { x: -4, z: 3 } };

// a flat yard, and a dog that steers to wherever its chosen act happens
const world = new World([box(0, 0, 0, 20, 20)]);
const steer = new Steerer("dog");
const dog = { pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, radius: 0.3, height: 0.6, grounded: true };

for (let t = 0; t < 30; t += 1 / 30) {
  drives.grow(1 / 30, { hunger: 0.02, play: 0.03 });
  const d = chooser.update(t, { eat: drives.rewardOf({ hunger: -0.5 }), play: drives.rewardOf({ play: -0.5 }) });
  if (d.switched) steer.setGoal(goals[d.current].x, goals[d.current].z);
  const me = { id: "dog", x: dog.pos.x, z: dog.pos.z, vx: dog.vel.x, vz: dog.vel.z, radius: dog.radius };
  const out = steer.update(t, me, [me]);
  dog.vel.x = out.vx;
  dog.vel.z = out.vz;
  world.step(dog, 1 / 30);
  if (d.switched) console.log(t.toFixed(1), d.why);
}
console.log("dog at", dog.pos.x.toFixed(2), dog.pos.z.toFixed(2));
