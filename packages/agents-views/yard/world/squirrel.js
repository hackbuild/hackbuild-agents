// ---------- squirrel ----------
const squirrel = { state: 'gone', t: 0, next: 25, from: null, to: null, vel: V3(), climbT: 0 };
function spawnSquirrel() {
  const a = pick(TREES), b = pick(TREES.filter(t => t !== a));
  squirrel.from = a; squirrel.to = b; squirrel.state = 'run'; squirrel.t = 0; squirrel.pause = rnd(0.8, 2);
  sq.position.set(a.x + 0.45, H(a.x, a.z), a.z); sq.visible = true;
  scentSrc.push({ x: a.x, z: a.z, s: 0.6, t: now }); if (scentSrc.length > 30) scentSrc.shift();
}
function squirrelTick(dt) {
  if (squirrel.state === 'gone') { squirrel.next -= dt; if (squirrel.next < 0) { spawnSquirrel(); squirrel.next = rnd(60, 120); } return; }
  const target = squirrel.state === 'flee' ? squirrel.to : squirrel.to;
  const tx = target.x + 0.38, tz = target.z;
  if (squirrel.state === 'run' || squirrel.state === 'flee') {
    const dogClose = dist2(dog.pos, sq.position) < 3.2;
    if (dogClose && squirrel.state === 'run') { let best = null, bd = 1e9; for (const t of TREES) { const dd = Math.hypot(t.x - sq.position.x, t.z - sq.position.z) - Math.hypot(t.x - dog.pos.x, t.z - dog.pos.z) * 0.5; if (dd < bd) { bd = dd; best = t; } } squirrel.to = best; squirrel.state = 'flee'; }
    if (squirrel.pause > 0 && squirrel.state === 'run') { squirrel.pause -= dt; squirrel.vel.set(0, 0, 0); sq.position.y = H(sq.position.x, sq.position.z); return; }
    const dx = tx - sq.position.x, dz = tz - sq.position.z, d = Math.hypot(dx, dz);
    const sp = squirrel.state === 'flee' ? 5.6 : 2.4;
    if (d < 0.15) { squirrel.state = 'tree'; squirrel.climbT = 0; squirrel.vel.set(0, 1.5, 0); return; }
    squirrel.vel.set(dx / d * sp, 0, dz / d * sp);
    sq.position.x += squirrel.vel.x * dt; sq.position.z += squirrel.vel.z * dt;
    sq.position.y = H(sq.position.x, sq.position.z) + Math.abs(Math.sin(now * 14)) * 0.06;
    sq.rotation.set(0, Math.atan2(dx, dz), 0);
    if (RNG() < dt * 3) { scentSrc.push({ x: sq.position.x, z: sq.position.z, s: 0.5, t: now }); if (scentSrc.length > 30) scentSrc.shift(); }
    if (RNG() < dt * 0.4 && squirrel.state === 'run') squirrel.pause = rnd(0.5, 1.8);
  } else if (squirrel.state === 'tree') {
    squirrel.climbT += dt; sq.position.y = Math.min(H(sq.position.x, sq.position.z) + squirrel.climbT * 1.4, H(sq.position.x, sq.position.z) + 2.3); sq.rotation.set(-Math.PI / 2, 0, 0);
    squirrel.vel.set(0, squirrel.climbT < 1.6 ? 1.4 : 0, 0);
    if (squirrel.climbT > 7) { sq.visible = false; squirrel.state = 'gone'; }
  }
}

