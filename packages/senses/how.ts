// how this works: the fold of the package page and of the suite tool. Plain data, no imports;
// checked by tsconfig.how.json, shipped in the tarball, never imported by the runtime entry.
const how: HowDoc = {
  what: "perception for simulated animals: saliency, looming, an odour plume and trail tracker, hearing error, field of view vision and an occupancy grid. rust core in wasm.",
  how: [
    "the core is the rust crate `crates/senses` compiled to wasm32 with simd128. `load()` reads the inlined wasm, a url or bytes, and every class takes an injected rng.",
    "`Saliency` runs itti koch saliency on an rgba eye frame, takes a top down bias at a world point, picks a winner and stores inhibition of return as world directions, so it survives head turns. `Looming` reads time to contact from angular size growth.",
    "`OdourField` steps a puff plume in a meandering wind plus a ground trail grid that decays. `Sniffer` and `Tracker` turn it into decide, trail, surge and cast modes that return a waypoint, a speed and a stop distance.",
    "`PerceptMemory` sees by field of view and range and remembers positions whose error grows with age. `OccupancyGrid` integrates eye depth and plans a* paths. `@hackbuild/senses/three` adds an `Eye` that renders id and depth buffers from the agent's head.",
  ],
  packages: ["@hackbuild/senses"],
  install: "npm install @hackbuild/senses",
  today: `git clone https://github.com/hackbuild/hackbuild-agents
cd hackbuild-agents && npm ci && npm run build -w @hackbuild/senses`,
  lang: "ts",
  code: `import { load, OdourField, Saliency, Sniffer, Tracker, seededRng } from "@hackbuild/senses";
import { Eye, cameraFromThree } from "@hackbuild/senses/three";

await load(); // inlined wasm; or load(url) or load(bytes)
const rng = seededRng(7);
const sal = new Saliency({ rng });
const eye = new Eye(renderer, scene);
eye.place(head, yaw, pitch);
const cam = cameraFromThree(eye.camera);
sal.biasPoint(ball.position, 0.6 * wantBall);
sal.update(eye.colorFrame(320, 160), 320, 160, now, cam);
if (sal.ready(now)) look(sal.shift(now, cam, objects, arousal));

const field = new OdourField({ rng });
field.step(dt, [{ id: 0, x: bowl.x, z: bowl.z, strength: 1 }]);`,
  links: { page: "https://hackbuild.github.io/hackbuild-agents/senses/", source: "https://github.com/hackbuild/hackbuild-agents/tree/main/packages/senses" },
};
export default how;
