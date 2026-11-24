// A DOM free seeded sim with the lockstep contract, for the browser entry
// tests: one agent turns toward random waypoints at a fixed 1/60 s step.
// Only + - * / and sqrt, which IEEE 754 fixes to the bit: Math.atan2 gave
// a different last digit in Node 22.18 and Chrome 150 (measured), so a sim
// that wants one trace hash on every engine keeps transcendentals out of
// its state.
export function createSim(seed) {
  let s = seed >>> 0;
  const rng = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s) >>> 0;
    t = ((t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const agent = { x: 0, z: 0, hx: 0, hz: 1, v: 0, gx: 0, gz: 0, state: "idle", has: false };
  const rows = [];
  let n = 0;
  const dt = 1 / 60;
  const tick = () => {
    let dx = agent.gx - agent.x;
    let dz = agent.gz - agent.z;
    if (!agent.has || dx * dx + dz * dz < 0.04) {
      agent.gx = rng() * 8 - 4;
      agent.gz = rng() * 8 - 4;
      agent.has = true;
      agent.state = agent.state === "walk" ? "look" : "walk";
      dx = agent.gx - agent.x;
      dz = agent.gz - agent.z;
    }
    const dist = Math.sqrt(dx * dx + dz * dz);
    agent.hx += (dx / dist - agent.hx) * 0.05;
    agent.hz += (dz / dist - agent.hz) * 0.05;
    const hl = Math.sqrt(agent.hx * agent.hx + agent.hz * agent.hz) || 1;
    agent.hx /= hl;
    agent.hz /= hl;
    agent.v += (1.2 - agent.v) * 0.1;
    agent.x += agent.hx * agent.v * dt;
    agent.z += agent.hz * agent.v * dt;
    n++;
    if (n % 15 === 0) rows.push([n, agent.x, agent.z, agent.hx, agent.hz, agent.state]);
  };
  return {
    agent,
    step(k) {
      for (let i = 0; i < k; i++) tick();
    },
    trace() {
      return { cols: ["step", "x", "z", "hx", "hz", "state"], rows: rows.map((r) => r.slice()) };
    },
  };
}
