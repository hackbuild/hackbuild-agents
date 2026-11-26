import { associationsState, associationsTable, drivesBars, drivesBarsState } from "@hackbuild/agents-views";
import { Chooser, CueLearner, Drives, load, seededRng } from "@hackbuild/drives";

// the brain: two drives, three acts and a learner, all seeded
await load();
const rng = seededRng(7);
const drives = new Drives({ hunger: 1, play: 0.8 });
const chooser = new Chooser({ rng, options: ["idle", "eat", "fetch"] as const });
const learner = new CueLearner({ rng, actions: ["sit", "paw"] as const });

// the views: mount once, update each tick
const bars = drivesBars(document.body.appendChild(document.createElement("div")));
const table = associationsTable(document.body.appendChild(document.createElement("div")), { onReset: () => location.reload() });
let now = 0;
setInterval(() => {
  now += 0.5;
  drives.grow(0.5, { hunger: 0.02, play: 0.03 });
  const d = chooser.update(now, { idle: 0.1, eat: drives.rewardOf({ hunger: -0.5 }), fetch: drives.rewardOf({ play: -0.4 }) });
  bars.update(drivesBarsState(d, drives, { now }));
  table.update(associationsState(learner));
}, 500);
