// ---------- you: throwing ----------
let foodAmt = 0.6;
function throwBall(to) {
  if (!ball || !HUM.ready) return;
  if (ball.held) { toast('the dog has the ball; it brings it back on its own'); return; }
  if (to) { to = to.clone(); }
  humanHold(true);
  startTask('throw', { to, user: true }, 'you asked him to throw');
}
function tossTreat(noReward) {
  if (!noReward) brain.reward(ON('L.learn') ? 0.5 : 1, 'treat');
  const near = dist2(dog.pos, YOU) < 1.6;
  if (near && !noReward) { brain.d.hunger = clamp(brain.d.hunger - 0.08, 0, 1); brain.say('crunch, thank you', 1.6); return; }
  const from = handPos(V3()), to = dog.pos.clone().add(V3(rnd(-0.5, 0.5), 0, rnd(-0.5, 0.5))); to.y = H(to.x, to.z);
  const T = 0.7; const v = to.clone().sub(from).divideScalar(T); v.y = (to.y - from.y + 0.5 * 9.81 * T * T) / T;
  spawnTreat(from, { x: v.x, y: v.y, z: v.z });
  if (HUM.ready) haAct('interact');
}

