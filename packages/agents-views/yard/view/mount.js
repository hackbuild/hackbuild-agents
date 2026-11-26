// ---------- mount: what the host gets back, and what dispose undoes ----------
// The host's handle reads the scope through ENV.expose; dispose stops the frame loop, the
// workers, the voice, the microphone and the renderer. Listeners, timers and observers the scope
// made are removed by the wrapper (ENV.on, ENV.setTimeout, ENV.setInterval, ENV.ResizeObserver).
ENV.dispose(() => {
  renderer.setAnimationLoop(null);
  try { if (vlm.worker) vlm.worker.terminate(); } catch (e) {}
  vlm.worker = null;
  try { if (Voice.worker) Voice.worker.terminate(); } catch (e) {}
  try { if ('speechSynthesis' in window) speechSynthesis.cancel(); } catch (e) {}
  try { if (typeof rec !== 'undefined' && rec) rec.abort(); } catch (e) {}
  try { if (actx) actx.close(); } catch (e) {}
  try { controls.dispose(); renderer.dispose(); } catch (e) {}
  if (window.__hackle && window.__hackle.dog === dog) delete window.__hackle;
});
