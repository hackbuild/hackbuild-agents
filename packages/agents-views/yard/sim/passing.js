// ---------- passing between the dog and the human (HACKLE lesson 7, handoff issue 3) ----------
// The two agents used to steer around each other with independent potential fields. Head on, the
// side term flips sign as the bearing crosses zero, and both stop (2 of 7 cpg runs stalled 4 s or
// more). Shared rules:
// - passing each other, a side is picked from the other's position a half second ahead and held
//   for at least 1 s; it is dropped when the agents are apart again. Static obstacles keep the old
//   per step side, so walks that meet no agent keep their traces
// - a task change releases a held kneel into its stand up (human.js startTask, lesson 4)
// - the dog yields: standing in his path (within 0.6 m of his line, ahead of him, his goal away
//   from the dog), it steps aside; the yield times out after 2.5 s and waits 3 s before another
// - a stall detector inserts a side waypoint when he has a goal, is not turning, and moved under
//   0.2 m in 2 s
// - the dog is two circles along its body for him, not one at its centre

/** held passing side per obstacle key: the sign the field would give, kept for at least 1 s */
function passSide(map, key, sd, t) {
  const e = map.get(key);
  if (e && (e.s === sd || t - e.t < 1)) return e.s;
  map.set(key, { s: sd, t });
  return sd;
}
const PASS = { hum: new Map(), dog: new Map() };

/** the dog as two circles along its body, 0.22 m ahead of and behind its centre */
function dogCircles(out = []) {
  const fx = Math.sin(dog.yaw) * 0.22, fz = Math.cos(dog.yaw) * 0.22;
  out.length = 0;
  out.push({ x: dog.pos.x + fx, z: dog.pos.z + fz, r: 0.3, kind: 'dog', key: 'dogF' }, { x: dog.pos.x - fx, z: dog.pos.z - fz, r: 0.3, kind: 'dog', key: 'dogB' });
  return out;
}

/** dog side step: returns the point to step to while a yield runs, else null */
const YIELD = { to: null, t0: 0, until: 0, next: 0 };
function dogYield(postureBusy) {
  const m = HUM.motor;
  if (YIELD.to) {
    const passed = HUM.pos && ((dog.pos.x - HUM.pos.x) * Math.sin(HUM.yaw) + (dog.pos.z - HUM.pos.z) * Math.cos(HUM.yaw)) < -0.3;
    if (now > YIELD.until || Math.hypot(YIELD.to.x - dog.pos.x, YIELD.to.z - dog.pos.z) < 0.2 || passed || m.mode !== 'goto' || HUM.away) { YIELD.to = null; YIELD.next = now + 3; return null; }
    return YIELD.to;
  }
  if (now < YIELD.next || postureBusy || HUM.away || !HUM.pos || m.mode !== 'goto' || m.done || (HUM.v || 0) < 0.3) return null;
  if (dog.v > 0.15 || (motor.mode === 'goto' && !motor.done)) return null;
  const tx = m.target.x - HUM.pos.x, tz = m.target.z - HUM.pos.z, tl = Math.hypot(tx, tz);
  if (tl < 0.5 || Math.hypot(m.target.x - dog.pos.x, m.target.z - dog.pos.z) < 1.3) return null;
  const ux = tx / tl, uz = tz / tl, rx = dog.pos.x - HUM.pos.x, rz = dog.pos.z - HUM.pos.z;
  const along = rx * ux + rz * uz, lat = ux * rz - uz * rx;
  if (along < 0.2 || along > Math.min(2.5, tl) || Math.abs(lat) > 0.6) return null;
  // step to the side the dog already leans to, 1 m off his line
  const s = Math.sign(lat) || 1, off = 1.0 - Math.abs(lat);
  const to = V3(dog.pos.x - uz * s * off + ux * 0.2, 0, dog.pos.z + ux * s * off + uz * 0.2); pushOut(to, 0.4);
  YIELD.to = to; YIELD.t0 = now; YIELD.until = now + 2.5;
  return to;
}

/** stall detector for the human: a side waypoint when he has a goal and has not moved */
const HSTALL = { x: 0, z: 0, t: 0, wp: null, until: 0 };
function humStallWaypoint(blocked) {
  const m = HUM.motor;
  if (HSTALL.wp) {
    if (now > HSTALL.until || Math.hypot(HSTALL.wp.x - HUM.pos.x, HSTALL.wp.z - HUM.pos.z) < 0.3 || m.mode !== 'goto' || m.done) { HSTALL.wp = null; HSTALL.x = HUM.pos.x; HSTALL.z = HUM.pos.z; HSTALL.t = now; }
    return HSTALL.wp;
  }
  // a turn in place is not a stall: the anchor follows him while he turns faster than 0.6 rad/s
  if (m.mode !== 'goto' || m.done || blocked || Math.abs(HUM.w) > 0.6 || Math.hypot(HUM.pos.x - HSTALL.x, HUM.pos.z - HSTALL.z) > 0.2) { HSTALL.x = HUM.pos.x; HSTALL.z = HUM.pos.z; HSTALL.t = now; return null; }
  if (now - HSTALL.t < 2) return null;
  // the nearest obstacle ahead decides the side: pass it on the side he is already off its centre
  const tx = m.target.x - HUM.pos.x, tz = m.target.z - HUM.pos.z, tl = Math.hypot(tx, tz) || 1, ux = tx / tl, uz = tz / tl;
  let best = null, bd = 1e9;
  for (const o of OBST.filter(o => o.kind !== 'you').concat(dogCircles())) {
    const rx = o.x - HUM.pos.x, rz = o.z - HUM.pos.z, d = Math.hypot(rx, rz) - o.r;
    if (rx * ux + rz * uz > -0.2 && d < bd) { bd = d; best = o; }
  }
  let s = 1;
  if (best) { const rx = best.x - HUM.pos.x, rz = best.z - HUM.pos.z, lat = ux * rz - uz * rx; s = -(Math.sign(lat) || 1); }
  const wp = V3(HUM.pos.x - uz * s * 1.1 + ux * 0.5, 0, HUM.pos.z + ux * s * 1.1 + uz * 0.5);
  HSTALL.wp = wp; HSTALL.until = now + 3; HSTALL.n = (HSTALL.n || 0) + 1;
  return wp;
}
