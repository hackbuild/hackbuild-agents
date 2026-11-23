//! wasm-bindgen surface. Decisions and responses come back as small
//! number arrays; the TypeScript package names their fields.

use crate::chooser::{Chooser as Ch, ChooserConfig, Reason};
use crate::drives::Drives as Dr;
use crate::golden;
use crate::learn::{CueLearner as Cl, LearnConfig, Response};
use crate::memory::MemoryStream as Ms;
use crate::sleep::{Sleep as Sl, SleepConfig, body_clock};
use wasm_bindgen::prelude::*;

fn o(opts: &[f64], i: usize, v: f64) -> f64 {
    opts.get(i).copied().filter(|x| x.is_finite()).unwrap_or(v)
}

#[wasm_bindgen(js_name = goldenTrace)]
pub fn golden_trace(seed: u32) -> Vec<f64> {
    golden::trace(seed)
}

#[wasm_bindgen(js_name = bodyClock)]
pub fn body_clock_js(h: f64) -> f64 {
    body_clock(h)
}

#[wasm_bindgen]
pub struct Drives(Dr);

#[wasm_bindgen]
impl Drives {
    #[wasm_bindgen(constructor)]
    pub fn new(weights: Vec<f64>, n: f64, m: f64, gain: f64) -> Drives {
        Drives(Dr::new(weights, n, m, gain))
    }
    pub fn values(&self) -> Vec<f64> {
        self.0.values.clone()
    }
    #[wasm_bindgen(js_name = setValues)]
    pub fn set_values(&mut self, v: &[f64]) {
        for (a, b) in self.0.values.iter_mut().zip(v) {
            *a = b.clamp(0.0, 1.0);
        }
    }
    pub fn distance(&self, h: &[f64]) -> f64 {
        self.0.distance(h)
    }
    #[wasm_bindgen(js_name = rewardOf)]
    pub fn reward_of(&self, effect: &[f64], scale: f64) -> f64 {
        self.0.reward_of(effect, scale)
    }
    pub fn grow(&mut self, dt: f64, rates: &[f64]) {
        self.0.grow(dt, rates);
    }
    #[wasm_bindgen(js_name = setShape)]
    pub fn set_shape(&mut self, n: f64, m: f64, gain: f64) {
        self.0.n = n;
        self.0.m = m;
        self.0.gain = gain;
    }
}

fn reason_index(r: Reason) -> f64 {
    match r {
        Reason::Hold => 0.0,
        Reason::Top => 1.0,
        Reason::Sampled => 2.0,
        Reason::Reactive => 3.0,
        Reason::Forced => 4.0,
        Reason::Argmax => 5.0,
        Reason::Fired => 6.0,
    }
}

#[wasm_bindgen]
pub struct Chooser {
    inner: Ch,
    why: String,
}

#[wasm_bindgen]
impl Chooser {
    /// `opts`: temperature, commitment, dwell mu, dwell tail, react mu, react tail, react margin, sample (0 or 1), noise (0 or 1).
    #[wasm_bindgen(constructor)]
    pub fn new(
        names: Vec<String>,
        opts: &[f64],
        seed: u32,
        start: usize,
    ) -> Result<Chooser, JsError> {
        if start >= names.len() {
            return Err(JsError::new("start option out of range"));
        }
        let d = ChooserConfig::default();
        let cfg = ChooserConfig {
            temperature: o(opts, 0, d.temperature),
            commitment: o(opts, 1, d.commitment),
            dwell_mu: o(opts, 2, d.dwell_mu),
            dwell_tau: o(opts, 3, d.dwell_tau),
            react_mu: o(opts, 4, d.react_mu),
            react_tau: o(opts, 5, d.react_tau),
            react_margin: o(opts, 6, d.react_margin),
            sample: o(opts, 7, 1.0) != 0.0,
            noise: o(opts, 8, 1.0) != 0.0,
        };
        Ok(Chooser {
            inner: Ch::new(names, cfg, seed, start),
            why: String::new(),
        })
    }
    /// `[current, switched, pending option or -1, pending at, reason,
    /// option, utility, best, best utility, probability, latency]`;
    /// reasons 0 hold, 1 top, 2 sampled, 3 reactive, 4 forced, 5 argmax, 6 fired.
    pub fn update(
        &mut self,
        now: f64,
        utilities: &[f64],
        reactive: &[u8],
        forced: i32,
    ) -> Result<Vec<f64>, JsError> {
        if utilities.len() != reactive.len() {
            return Err(JsError::new("one reactive flag per utility"));
        }
        let r: Vec<bool> = reactive.iter().map(|&x| x != 0).collect();
        let f = if forced >= 0 {
            Some(forced as usize)
        } else {
            None
        };
        let d = self.inner.update(now, utilities, &r, f);
        self.why = d.why.clone();
        let (po, pa, pl) = d.pending.map_or((-1.0, f64::NAN, f64::NAN), |p| {
            (p.option as f64, p.at, p.latency)
        });
        Ok(vec![
            d.current as f64,
            f64::from(u8::from(d.switched)),
            po,
            pa,
            reason_index(d.reason),
            d.option as f64,
            d.utility,
            d.best as f64,
            d.best_utility,
            d.probability,
            pl,
        ])
    }
    #[wasm_bindgen(getter)]
    pub fn why(&self) -> String {
        self.why.clone()
    }
    #[wasm_bindgen(getter)]
    pub fn current(&self) -> usize {
        self.inner.current()
    }
    #[wasm_bindgen(js_name = markDone)]
    pub fn mark_done(&mut self) {
        self.inner.mark_done();
    }
    #[wasm_bindgen(getter, js_name = isDone)]
    pub fn is_done(&self) -> bool {
        self.inner.is_done()
    }
    pub fn set(&mut self, option: usize, now: f64) {
        self.inner.set(option, now);
    }
    #[wasm_bindgen(getter, js_name = dwellUntil)]
    pub fn dwell_until(&self) -> f64 {
        self.inner.dwell_until()
    }
    #[wasm_bindgen(js_name = setTemperature)]
    pub fn set_temperature(&mut self, t: f64, commitment: f64) {
        self.inner.cfg.temperature = t;
        self.inner.cfg.commitment = commitment;
    }
}

#[wasm_bindgen]
pub struct CueLearner(Cl);

#[wasm_bindgen]
impl CueLearner {
    /// `opts`: alpha, theta, trace seconds, inhibition decay, offer rate, ignore, cue mu, cue tail, noise (0 or 1).
    #[wasm_bindgen(constructor)]
    pub fn new(actions: usize, opts: &[f64], seed: u32) -> CueLearner {
        let d = LearnConfig::default();
        let cfg = LearnConfig {
            alpha: o(opts, 0, d.alpha),
            theta: o(opts, 1, d.theta),
            trace_seconds: o(opts, 2, d.trace_seconds),
            inhibition_decay: o(opts, 3, d.inhibition_decay),
            offer_rate: o(opts, 4, d.offer_rate),
            ignore: o(opts, 5, d.ignore),
            cue_mu: o(opts, 6, d.cue_mu),
            cue_tau: o(opts, 7, d.cue_tau),
            noise: o(opts, 8, 1.0) != 0.0,
        };
        CueLearner(Cl::new(actions, cfg, seed))
    }
    pub fn ensure(&mut self, cue: &str) -> usize {
        self.0.ensure(cue)
    }
    #[wasm_bindgen(js_name = cueIndex)]
    pub fn cue_index(&self, cue: &str) -> i32 {
        self.0.cue_index(cue).map_or(-1, |i| i as i32)
    }
    pub fn cues(&self) -> Vec<String> {
        self.0.cues().to_vec()
    }
    /// `[kind, action, offered, latency]`; kind 0 ignored, 1 none, 2 act.
    pub fn respond(
        &mut self,
        cue: &str,
        now: f64,
        distraction: f64,
        trainability: f64,
        watched: bool,
        offerable: &[u8],
    ) -> Vec<f64> {
        let off: Vec<bool> = offerable.iter().map(|&x| x != 0).collect();
        let (r, lat) = self
            .0
            .respond(cue, now, distraction, trainability, watched, &off);
        match r {
            Response::Ignored => vec![0.0, -1.0, 0.0, lat],
            Response::None => vec![1.0, -1.0, 0.0, lat],
            Response::Act { action, offered } => {
                vec![2.0, action as f64, f64::from(u8::from(offered)), lat]
            }
        }
    }
    #[wasm_bindgen(js_name = markDone)]
    pub fn mark_done(&mut self, action: usize, now: f64) {
        self.0.mark_done(action, now);
    }
    #[wasm_bindgen(js_name = offerTrick)]
    pub fn offer_trick(&mut self, action: usize, now: f64) {
        self.0.offer_trick(action, now);
    }
    /// `[cue or -1, action, value, credit]` or empty when nothing was eligible.
    pub fn reward(&mut self, r: f64, now: f64, trainability: f64) -> Vec<f64> {
        self.0.reward(r, now, trainability).map_or(Vec::new(), |c| {
            vec![
                c.cue.map_or(-1.0, |x| x as f64),
                c.action as f64,
                c.value,
                c.credit,
            ]
        })
    }
    pub fn decay(&mut self, dt: f64) {
        self.0.decay(dt);
    }
    pub fn value(&self, cue: usize, action: usize) -> f64 {
        self.0.value(cue, action)
    }
    pub fn excitation(&self, cue: usize, action: usize) -> f64 {
        self.0.excitation(cue, action)
    }
    pub fn inhibition(&self, cue: usize, action: usize) -> f64 {
        self.0.inhibition(cue, action)
    }
    pub fn associability(&self, cue: usize) -> f64 {
        self.0.associability(cue)
    }
    pub fn offer(&self, action: usize) -> f64 {
        self.0.offer(action)
    }
    #[wasm_bindgen(js_name = setWeight)]
    pub fn set_weight(&mut self, cue: usize, action: usize, w: f64, n: f64) {
        self.0.set_weight(cue, action, w, n);
    }
    #[wasm_bindgen(js_name = setAssociability)]
    pub fn set_associability(&mut self, cue: usize, a: f64) {
        self.0.set_associability(cue, a);
    }
    #[wasm_bindgen(js_name = setOffer)]
    pub fn set_offer(&mut self, action: usize, v: f64) {
        self.0.set_offer(action, v);
    }
}

#[wasm_bindgen]
pub struct Sleep(Sl);

#[wasm_bindgen]
impl Sleep {
    /// `opts`: up, down, nrem, rem, wake chance, enough.
    #[wasm_bindgen(constructor)]
    pub fn new(opts: &[f64], pressure: f64, seed: u32) -> Sleep {
        let d = SleepConfig::default();
        Sleep(Sl::new(
            SleepConfig {
                up: o(opts, 0, d.up),
                down: o(opts, 1, d.down),
                nrem: o(opts, 2, d.nrem),
                rem: o(opts, 3, d.rem),
                wake: o(opts, 4, d.wake),
                enough: o(opts, 5, d.enough),
            },
            pressure,
            seed,
        ))
    }
    #[wasm_bindgen(getter)]
    pub fn pressure(&self) -> f64 {
        self.0.pressure
    }
    #[wasm_bindgen(setter)]
    pub fn set_pressure(&mut self, p: f64) {
        self.0.pressure = p.clamp(0.0, 1.0);
    }
    /// 0 awake, 1 onset, 2 nrem, 3 rem, 4 wake
    #[wasm_bindgen(getter)]
    pub fn stage(&self) -> u8 {
        self.0.stage().index()
    }
    #[wasm_bindgen(js_name = pressureStep)]
    pub fn pressure_step(&mut self, game_hours: f64, activity: f64) {
        self.0.pressure_step(game_hours, activity);
    }
    pub fn sleepiness(&self, hour: f64) -> f64 {
        self.0.sleepiness(hour)
    }
    pub fn fatigue(&self, hour: f64, running: bool) -> f64 {
        self.0.fatigue(hour, running)
    }
    #[wasm_bindgen(js_name = lieDown)]
    pub fn lie_down(&mut self, negative: bool) {
        self.0.lie_down(negative);
    }
    #[wasm_bindgen(js_name = wakeUp)]
    pub fn wake_up(&mut self) {
        self.0.wake_up();
    }
    pub fn step(&mut self, game_minutes: f64, hour: f64, negative: bool) -> bool {
        self.0.step(game_minutes, hour, negative)
    }
    pub fn sample(&mut self) {
        self.0.sample();
    }
    pub fn hypnogram(&self) -> Vec<u8> {
        self.0.hypnogram().iter().map(|s| s.index()).collect()
    }
    #[wasm_bindgen(js_name = wakeThreshold)]
    pub fn wake_threshold(&self) -> f64 {
        self.0.wake_threshold()
    }
}

#[wasm_bindgen]
pub struct MemoryStream(Ms);

#[wasm_bindgen]
impl MemoryStream {
    #[wasm_bindgen(constructor)]
    pub fn new(capacity: usize, decay: f64) -> MemoryStream {
        let mut m = Ms::new(capacity);
        if decay.is_finite() {
            m.decay = decay;
        }
        MemoryStream(m)
    }
    pub fn add(&mut self, text: &str, importance: f64, hour: f64) {
        self.0.add(text, importance, hour);
    }
    /// Indices into `texts()` of the best `k`, highest score first.
    pub fn retrieve(&self, hour: f64, cues: Vec<String>, k: usize) -> Vec<u32> {
        let c: Vec<&str> = cues.iter().map(String::as_str).collect();
        let items = self.0.items();
        self.0
            .retrieve(hour, &c, k)
            .into_iter()
            .map(|m| items.iter().position(|x| std::ptr::eq(x, m)).unwrap_or(0) as u32)
            .collect()
    }
    pub fn texts(&self) -> Vec<String> {
        self.0.items().iter().map(|m| m.text.clone()).collect()
    }
    /// `importance, hour` per memory, newest first.
    pub fn meta(&self) -> Vec<f64> {
        self.0
            .items()
            .iter()
            .flat_map(|m| [m.importance, m.hour])
            .collect()
    }
    #[wasm_bindgen(getter, js_name = pendingImportance)]
    pub fn pending_importance(&self) -> f64 {
        self.0.pending_importance
    }
    #[wasm_bindgen(js_name = shouldReflect)]
    pub fn should_reflect(&mut self, budget: f64) -> bool {
        self.0.should_reflect(budget)
    }
    #[wasm_bindgen(getter)]
    pub fn length(&self) -> usize {
        self.0.len()
    }
}
