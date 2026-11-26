import { load, OdourField, Sniffer, Tracker, seededRng } from "@hackbuild/senses";

// the inlined wasm; load(url) or load(bytes) also work
await load();
const rng = seededRng(7);
// wind heading is measured from +x, so -pi/2 blows from the bowl toward the dog
const field = new OdourField({ rng, windHeading: -Math.PI / 2 });
const sniffer = new Sniffer({ rng });
const tracker = new Tracker({ rng });

const bowl = { id: 0, x: 0, z: 6, strength: 1 };
const dog = { x: 0, z: 0, heading: 0 };
let arrived = false;
for (let t = 0; t < 30; t += 1 / 30) {
  field.step(1 / 30, [bowl]);
  sniffer.tick(field, 1 / 30, t, true, { x: dog.x, z: dog.z + 0.3 }, { x: 0.03, z: 0 });
  const s = tracker.step(field, sniffer, 1 / 30, t, dog, dog.heading, arrived);
  // walk toward the waypoint at the speed the tracker asks for
  const to = s.waypoint ?? dog;
  const d = Math.hypot(to.x - dog.x, to.z - dog.z);
  arrived = d <= s.stopDist;
  if (!arrived) [dog.x, dog.z, dog.heading] = [dog.x + ((to.x - dog.x) / d) * s.speed / 30, dog.z + ((to.z - dog.z) / d) * s.speed / 30, Math.atan2(to.x - dog.x, to.z - dog.z)];
}
console.log(`dog at ${dog.x.toFixed(2)}, ${dog.z.toFixed(2)}; the bowl is at 0, 6`);
