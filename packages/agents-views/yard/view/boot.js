// ---------- boot ----------
tuneLoad(); CLOCK.h = TV('W.hour');
tuneUI.build($('pTuneBody'));
if (!store.get('tune', null)) seedPersonality(store.get('name', 'Pixel'));
TUNE.onChange = k => { if (k === 'L.neural' && TV(k) && !NG.ready) nnLoadUI(); if (k === 'W.hour') CLOCK.h = TV('W.hour'); if (k.startsWith('L.')) gaitUI(); };
// the neural gait loads and turns on in one action, from the body tab or the capability panel
const nnLoad = { state: 'off', err: '' };
function nnLoadUI() {
  if (nnLoad.state === 'loading') return; nnLoad.state = 'loading'; nnLoad.err = ''; capsRefresh();
  NG.load(st => { $('nnSt').textContent = st; capsRefresh(true); }).then(() => {
    nnLoad.state = NG.ready ? 'on' : 'failed'; if (!NG.ready) nnLoad.err = 'the neural gait did not load: ' + String($('nnSt').textContent).slice(0, 80) + '.';
    gaitUI(); capsRefresh();
  });
}
$('showSal').onchange = e => { attention.show = e.target.checked; };
(async () => {
  try {
    await renderer.init();
    const gpu = renderer.backend.isWebGPUBackend; $('chipGpu').textContent = gpu ? 'webgpu' : 'webgl2'; $('chipGpu').classList.add(gpu ? 'is-ok' : 'is-warn'); $('chipGpu').title = gpu ? 'the yard draws on webgpu' : 'no webgpu adapter. the yard draws on webgl2; the cortex cannot run here.';
    resize();
    $('loadNote').textContent = 'starting physics';
    await initPhysics(); initProps();
    $('loadNote').textContent = 'loading the dog';
    const glbBuf = await ENV.dog();
    const gltf = await new GLTFLoader().parseAsync(glbBuf, '');
    setupDog(gltf, 'dog.glb');
    try {
      $('loadNote').textContent = 'waking moheeb';
      const hb = await ENV.human();
      const hg = hb ? await new GLTFLoader().parseAsync(hb, '') : { scene: placeholderHuman() };
      setupHuman(hg, await ENV.anims());
      renderHumTrain();
    } catch (e) { console.warn('human failed', e); toast('the human model failed to load. the placeholder stands in.'); }
    brain.init();
    $('load').hidden = true;
    if (TEST) {
      // lockstep: no detector (its timing is wall clock), the gait network loaded before step 0
      $('netOn').checked = false;
      for (const k of TEST.on) TUNE.v[k] = 1;
      for (const k of TEST.off) TUNE.v[k] = 0;
      if (ON('L.neural')) await NG.load(st => { $('nnSt').textContent = st; });
      installSim();
    } else {
      if (SEEDED) {
        // the speed check: no detector (wall clock cadence), layers as asked, simSpeed from the hash
        $('netOn').checked = false;
        for (const k of SEEDED.on) TUNE.v[k] = 1;
        for (const k of SEEDED.off) TUNE.v[k] = 0;
        window.__simSpeed = SEEDED.speed;
        if (ON('L.neural')) await NG.load(st => { $('nnSt').textContent = st; });
      }
      last = performance.now();
      renderer.setAnimationLoop(frame);
      uiStart();
      setTimeout(() => { if ($('netOn').checked) loadNet(); }, 1500);
      setTimeout(() => { if (ON('L.neural')) nnLoadUI(); }, 2600);
    }
    window.__hackle = { HUM, startTask, humThink, humSnap, Voice, vlm, vlmLoad, think, dog, brain, motor, percepts, net, throwBall, ball: () => ball, tossTreat, camera, controls, setCam: m => setCamMode(m), setEyeWho, V3, squirrel, spawnSquirrel, NG, NR, TUNE, CLOCK, attention, ORG, sniff, puffs, wind, applyPreset, startShake, humPoint, trail, time: () => now };
    ENV.ready(window.__hackle);
  } catch (e) { console.error(e); $('load').classList.add('is-err'); $('loadNote').textContent = 'the yard failed to start: ' + String(e.message).toLowerCase(); ENV.fail(e); }
})();
