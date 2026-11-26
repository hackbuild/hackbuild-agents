// body of the cortex runner: run inside a module worker, or on the main thread if workers fail; post() sends results back
const TJS = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2/dist/transformers.min.js';
let T = null, proc = null, model = null, kind = null, cid = 0;
const pend = new Map();
const files = {};
function prog(p) {
  if (p.status !== 'progress' || !p.total) return;
  files[p.file] = [p.loaded, p.total];
  let a = 0, b = 0; for (const k in files) { a += files[k][0]; b += files[k][1]; }
  post({ t: 'progress', loaded: a, total: b });
}
return async m => {
  try {
    if (m.t === 'cache') { const r = pend.get(m.cid); pend.delete(m.cid); if (r) r(m.blob ? new Response(m.blob) : undefined); return; }
    if (m.t === 'load') {
      T = await import(TJS); kind = m.kind;
      // a model hub in place of hugging face, when the host names one
      if (m.hub) T.env.remoteHost = m.hub;
      // files are looked up in and saved to the page's shared weight store, so a model fetched
      // by another hack.build page on this origin is not fetched again
      T.env.useBrowserCache = false; T.env.useCustomCache = true;
      T.env.customCache = {
        match: r => new Promise(res => { const id = ++cid; pend.set(id, res); post({ t: 'cache-match', cid: id, url: String(r && r.url || r) }); }),
        put: async (r, resp) => { post({ t: 'cache-put', url: String(r && r.url || r), blob: await resp.blob() }); }
      };
      const Cls = kind === 'gemma' ? T.Gemma4ForConditionalGeneration : T.Lfm2VlForConditionalGeneration;
      proc = await T.AutoProcessor.from_pretrained(m.id, { revision: m.rev, progress_callback: prog });
      model = await Cls.from_pretrained(m.id, { revision: m.rev, dtype: 'q4f16', device: 'webgpu', progress_callback: prog });
      post({ t: 'ready' });
    } else if (m.t === 'ask') {
      const img = new T.RawImage(new Uint8ClampedArray(m.rgba), m.w, m.h, 4).rgb();
      const messages = [{ role: 'user', content: [{ type: 'image' }, { type: 'text', text: m.prompt }] }];
      const prompt = proc.apply_chat_template(messages, { add_generation_prompt: true, enable_thinking: false });
      const inputs = kind === 'gemma' ? await proc(prompt, img, null, { add_special_tokens: false }) : await proc(img, prompt, { add_special_tokens: false });
      const t0 = performance.now();
      const out = await model.generate({ ...inputs, max_new_tokens: m.max || 80, do_sample: false });
      const n = inputs.input_ids.dims.at(-1);
      const text = proc.batch_decode(out.slice(null, [n, null]), { skip_special_tokens: true })[0];
      post({ t: 'answer', id: m.id, text, ms: performance.now() - t0, tokens: out.dims.at(-1) - n, inTokens: n });
    }
  } catch (err) { post({ t: 'error', id: m.t === 'load' ? null : m.id, msg: String((err && err.message) || err) }); }
};
