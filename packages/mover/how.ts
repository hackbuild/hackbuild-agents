// how this works: the fold of the package page and of the suite tool. Plain data, no imports;
// checked by tsconfig.how.json, shipped in the tarball, never imported by the runtime entry.
const how: HowDoc = {
  what: "a kinematic capsule mover and steering for agents that share space, with a grid path planner over the world colliders.",
  how: [
    "`World` moves capsules against axis aligned boxes and vertical cylinders with step up, ceilings, wall sliding and moving platform carry, in up to 6 substeps by distance.",
    "a `Steerer` per agent picks a passing side per neighbour from where the other will stand at closest approach and holds it at least 1 s, so two agents head on each keep right instead of turning away and standing still.",
    "inside the clearance of a neighbour the heading toward it is removed and an outward push added. an agent with no goal or a lower priority yields on a timer with a cool down. a stall detector inserts a side waypoint after under 0.2 m in 2 s.",
    "`planPath` runs a* on a grid over the colliders the actor cannot step onto, pulls the path straight and hands the waypoints to `setPath`. there are no random draws: the same inputs give the same steps.",
  ],
  packages: ["@hackbuild/mover"],
  install: "npm install @hackbuild/mover",
  today: `git clone https://github.com/hackbuild/hackbuild-agents
cd hackbuild-agents && npm ci && npm run build -w @hackbuild/mover`,
  lang: "ts",
  code: `import { Steerer, World, box } from "@hackbuild/mover";

const world = new World([box(0, 0, 0, 40, 40)]);
const steer = new Steerer("human");
steer.setGoal(0, 4);
// the steerer reads flat agent states; the world moves a capsule actor
const human = { id: "human", x: 0, z: -4, vx: 0, vz: 0, radius: 0.3, priority: 1 };
const body = { pos: { x: 0, y: 0, z: -4 }, vel: { x: 0, y: 0, z: 0 }, radius: 0.3, height: 1.7, grounded: true };
const out = steer.update(now, human, [human, dog], [benchFootprint], new Set(["ball"]));
body.vel.x = out.vx;
body.vel.z = out.vz;
world.step(body, dt);
Object.assign(human, { x: body.pos.x, z: body.pos.z, vx: body.vel.x, vz: body.vel.z });`,
  links: { page: "https://hackbuild.github.io/hackbuild-agents/mover/", source: "https://github.com/hackbuild/hackbuild-agents/tree/main/packages/mover" },
};
export default how;
