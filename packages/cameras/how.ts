// how this works, @hackbuild/cameras: the fold on the package page and in the suite.
// Data only, kept out of the runtime entry; tsconfig.how.json checks it.
export default {
  name: "@hackbuild/cameras",
  what: "gameplay cameras with shared damping, seeded shake and occlusion pull in. they drive a three camera without importing three.",
  how: [
    "each camera writes position.set, lookAt, fov and aspect on the camera you pass, so a three PerspectiveCamera fits and the package imports nothing at runtime.",
    "follow sits behind a heading with a damped target and yaw. you pass a clear callback, your raycast; when something blocks the view the camera pulls in at once and eases back out.",
    "group keeps every point on screen at a fixed pitch and yaw: the centre is pulled toward the arena centre, then the distance is solved so every corner of the padded box round the points projects inside the screen band.",
    "orbit takes rotate, zoom and pan deltas and leaves input binding to the app. first person scales the agent's head to 0.001 for its own render only. shake draws seeded value noise with decaying trauma from an rng stream of its own. splitViewports gives one to four views.",
  ],
  packages: ["@hackbuild/cameras"],
  install: "npm install @hackbuild/cameras",
  today: "git clone https://github.com/hackbuild/hackbuild-agents && cd hackbuild-agents && npm ci && npm run build -w @hackbuild/cameras",
  published: false,
  lang: "ts",
  code: `import { Follow, Shake } from "@hackbuild/cameras";

const follow = new Follow(camera, { distance: 4, clear: (from, dir, max) => raycast(from, dir, max) });
const shake = new Shake(shakeRng); // a stream of its own, never the sim rng
follow.update(dog.position, dog.yaw, dt);
const s = shake.step(dt);
camera.position.x += s.x;`,
  links: {
    page: "https://hackbuild.github.io/hackbuild-agents/cameras/",
    source: "https://github.com/hackbuild/hackbuild-agents/tree/main/packages/cameras",
  },
};
