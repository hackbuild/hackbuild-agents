import { Chooser, Drives, load, seededRng } from "@hackbuild/drives";

// the wasm core is inlined; load it once before any class
await load();
const drives = new Drives({ hunger: 1, fatigue: 1, play: 0.8 });
const chooser = new Chooser({ rng: seededRng(42), options: ["idle", "eat", "fetch", "rest"] as const });

// a minute of a sim at 10 Hz: needs grow, each act is scored by how much it would reduce them
for (let t = 0; t <= 60; t += 0.1) {
  drives.grow(0.1, { hunger: 0.02, fatigue: 0.01, play: 0.03 });
  const d = chooser.update(t, {
    idle: 0.05,
    eat: drives.rewardOf({ hunger: -0.5 }),
    fetch: drives.rewardOf({ play: -0.4, fatigue: 0.05 }),
    rest: drives.rewardOf({ fatigue: -0.25 }),
  });
  if (d.switched) console.log(t.toFixed(1), d.current, d.why);
}
