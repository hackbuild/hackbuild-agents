// ---------- placeholder human ----------
// A neutral humanoid made of capsules, used when the owner asset pack (assets-local/moheeb.glb)
// is absent. The skeleton follows the auto rig convention the clip pack was baked for: the same
// bone names, an armature turned -90 degrees about x, centimetre units, and rest rotations
// rounded to two decimals; segment lengths are generic adult proportions. Clips play on it the
// way they play on the full model; proportions and hands are approximate.
function placeholderHuman() {
  const mat = new THREE.MeshStandardMaterial({ color: '#8d8a84', roughness: 0.85, metalness: 0 });
  const dark = new THREE.MeshStandardMaterial({ color: '#4a4844', roughness: 0.9, metalness: 0 });
  // name, parent, translation (cm), rest rotation (x, y, z, w), capsule radius (cm) or 0
  const B = [
    ['Hips', null, [0, 0, 96], [0.75, 0, -0.01, 0.67], 0],
    ['LeftUpLeg', 'Hips', [8.3, -9, 1], [0.99, 0.05, -0.05, 0.06], 7],
    ['LeftLeg', 'LeftUpLeg', [0, 36.5, 0], [0.09, 0, 0, 1], 5.5],
    ['LeftFoot', 'LeftLeg', [0, 36.3, 0], [-0.48, -0.05, 0, 0.88], 4],
    ['LeftToeBase', 'LeftFoot', [0, 16, 0], [-0.36, -0.04, -0.02, 0.93], 0],
    ['RightUpLeg', 'Hips', [-8.3, -9, 1], [0.99, -0.05, 0.05, 0.06], 7],
    ['RightLeg', 'RightUpLeg', [0, 36.5, 0], [0.09, 0, 0, 1], 5.5],
    ['RightFoot', 'RightLeg', [0, 36.3, 0], [-0.48, 0.05, 0, 0.88], 4],
    ['RightToeBase', 'RightFoot', [0, 16, 0], [-0.36, 0.04, 0.02, 0.93], 0],
    ['Spine02', 'Hips', [0, 12.3, -2.2], [-0.09, 0, 0.01, 1], 13],
    ['Spine01', 'Spine02', [0, 12.5, 0], [0, 0, 0, 1], 14],
    ['Spine', 'Spine01', [0, 12.5, 0], [-0.04, 0, 0, 1], 14],
    ['LeftShoulder', 'Spine', [4, 6, -0.4], [0.51, 0.56, -0.48, 0.44], 4],
    ['LeftArm', 'LeftShoulder', [0, 16.3, 0], [0.12, 0.13, -0.03, 0.98], 4.5],
    ['LeftForeArm', 'LeftArm', [0, 22, 0], [-0.13, -0.13, 0.09, 0.98], 3.8],
    ['LeftHand', 'LeftForeArm', [0, 24, 0], [-0.07, -0.07, 0.04, 0.99], 0],
    ['RightShoulder', 'Spine', [-4, 6, -0.4], [-0.51, 0.56, -0.48, -0.44], 4],
    ['RightArm', 'RightShoulder', [0, 16.3, 0], [0.12, -0.13, 0.03, 0.98], 4.5],
    ['RightForeArm', 'RightArm', [0, 22, 0], [-0.13, 0.13, -0.09, 0.98], 3.8],
    ['RightHand', 'RightForeArm', [0, 24, 0], [-0.07, 0.07, -0.04, 0.99], 0],
    ['neck', 'Spine', [0, 9, 0.8], [0.04, 0, 0, 1], 5],
    ['Head', 'neck', [0, 7, 0], [0.26, 0, 0, 0.97], 0],
    ['headfront', 'Head', [0, 4.8, 9.3], [0.52, 0, -0.01, 0.85], 0]
  ];
  const root = new THREE.Group(), arm = new THREE.Group(); arm.name = 'Armature'; arm.quaternion.set(-Math.SQRT1_2, 0, 0, Math.SQRT1_2); root.add(arm);
  const bones = {};
  for (const [name, parent, t, q] of B) {
    const b = new THREE.Bone(); b.name = name; b.position.set(t[0], t[1], t[2]); b.quaternion.set(q[0], q[1], q[2], q[3]).normalize();
    (parent ? bones[parent] : arm).add(b); bones[name] = b;
  }
  // each segment is a capsule from a bone to its child along the child's offset
  for (const [name, parent, t, , r] of B) {
    if (!parent) continue;
    const pr = B.find(x => x[0] === parent)[4]; if (!pr) continue;
    const len = Math.hypot(t[0], t[1], t[2]); if (len < 1) continue;
    const g = new THREE.CapsuleGeometry(pr, Math.max(len - pr, 0.5), 4, 10), m = new THREE.Mesh(g, parent.includes('Leg') || parent.includes('Foot') ? dark : mat);
    m.position.set(t[0] / 2, t[1] / 2, t[2] / 2); m.quaternion.setFromUnitVectors(V3(0, 1, 0), V3(t[0], t[1], t[2]).normalize());
    bones[parent].add(m);
  }
  const pelvis = new THREE.Mesh(new THREE.SphereGeometry(12, 14, 10), dark); pelvis.scale.set(1.25, 0.8, 0.9); bones.Hips.add(pelvis);
  const head = new THREE.Mesh(new THREE.SphereGeometry(10, 16, 12), mat); head.scale.set(0.85, 1.05, 0.95); head.position.set(0, 9, 2); bones.Head.add(head);
  for (const s of ['Left', 'Right']) {
    const hand = new THREE.Mesh(new THREE.BoxGeometry(8, 16, 3), mat); hand.position.set(0, 7, 0); bones[s + 'Hand'].add(hand);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(9, 20, 6), dark); foot.position.set(0, 6, -2); bones[s + 'Foot'].add(foot);
  }
  return root;
}
