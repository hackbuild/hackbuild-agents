import { type Actor, Steerer, World, box } from "@hackbuild/mover";

// two walkers head on in a 20 m yard; each keeps right and both arrive
const world = new World([box(0, 0, 0, 20, 20)]);
const walkers = [-4, 4].map((z, i) => {
  const steer = new Steerer(`w${i}`);
  steer.setGoal(0, -z);
  const body: Actor = { pos: { x: 0, y: 0, z }, vel: { x: 0, y: 0, z: 0 }, radius: 0.3, height: 1.7, grounded: true };
  return { steer, body, state: { id: `w${i}`, x: 0, z, vx: 0, vz: 0, radius: 0.3 } };
});
for (let t = 0, dt = 1 / 60; t < 12; t += dt) {
  const states = walkers.map((w) => w.state);
  for (const { steer, body, state } of walkers) {
    const out = steer.update(t, state, states);
    Object.assign(body.vel, { x: out.vx, z: out.vz });
    world.step(body, dt);
    Object.assign(state, { x: body.pos.x, z: body.pos.z, vx: out.vx, vz: out.vz });
  }
}
console.log(walkers.map((w) => `${w.state.id} at ${w.state.x.toFixed(2)}, ${w.state.z.toFixed(2)}`).join("; "));
