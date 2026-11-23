//! Cue learning: excitatory weights W and separate inhibitory weights N per
//! cue and action, Pearce Kaye Hall associability per cue, eligibility
//! traces so a late reward credits the most recent eligible act with less
//! weight, massed practice damping, inhibition that decays faster than
//! excitation (so extinguished cues partly come back), free operant offers,
//! and everyday non compliance. Written for this library from the legacy
//! `brain.cue`, `learnTrace`, `sampleOffer` and `offerTrick`, keeping the
//! draw order. The always true condition the legacy simulator carried in
//! its ignore test is dropped, which removes one draw.

use agent_rng::{Mulberry32, Rng, ex_gaussian};

#[derive(Clone, Copy, Debug)]
pub struct LearnConfig {
    /// learning rate (legacy 0.35)
    pub alpha: f64,
    /// associability rate (legacy 0.3)
    pub theta: f64,
    /// eligibility trace time constant in seconds (legacy 1.2)
    pub trace_seconds: f64,
    /// inhibition decay per minute (legacy 0.06)
    pub inhibition_decay: f64,
    /// free operant offer rate (legacy 0.5)
    pub offer_rate: f64,
    /// base non compliance (legacy 0.25; Browne: 44 percent of everyday sit and down ignored)
    pub ignore: f64,
    /// cue latency ex-Gaussian mu and tail (legacy 0.45 and 0.45, sigma 0.08)
    pub cue_mu: f64,
    pub cue_tau: f64,
    /// false: no non compliance, no latency (the canned path)
    pub noise: bool,
}

impl Default for LearnConfig {
    fn default() -> Self {
        LearnConfig {
            alpha: 0.35,
            theta: 0.3,
            trace_seconds: 1.2,
            inhibition_decay: 0.06,
            offer_rate: 0.5,
            ignore: 0.25,
            cue_mu: 0.45,
            cue_tau: 0.45,
            noise: true,
        }
    }
}

/// What the animal did with a cue.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Response {
    /// ignored it (non compliance)
    Ignored,
    /// nothing came to mind
    None,
    /// performs an action; `offered` when it came from the offer history, not the cue
    Act { action: usize, offered: bool },
}

#[derive(Clone, Debug)]
struct Entry {
    cue: Option<usize>,
    action: Option<usize>,
    t: f64,
    done: Option<f64>,
    credited: bool,
}

#[derive(Clone, Copy, Debug)]
pub struct Credit {
    pub cue: Option<usize>,
    pub action: usize,
    /// net value V = W - N after the update
    pub value: f64,
    /// eligibility weight of the credited act, 0 to 1
    pub credit: f64,
}

pub struct CueLearner {
    pub cfg: LearnConfig,
    actions: usize,
    cues: Vec<String>,
    w: Vec<Vec<f64>>,
    n: Vec<Vec<f64>>,
    al: Vec<f64>,
    offer: Vec<f64>,
    trace: Vec<Entry>,
    rng: Mulberry32,
}

impl CueLearner {
    pub fn new(actions: usize, cfg: LearnConfig, seed: u32) -> CueLearner {
        CueLearner {
            cfg,
            actions,
            cues: Vec::new(),
            w: Vec::new(),
            n: Vec::new(),
            al: Vec::new(),
            offer: vec![0.15; actions],
            trace: Vec::new(),
            rng: Mulberry32::new(seed),
        }
    }
    pub fn actions(&self) -> usize {
        self.actions
    }
    pub fn cues(&self) -> &[String] {
        &self.cues
    }
    pub fn cue_index(&self, cue: &str) -> Option<usize> {
        self.cues.iter().position(|c| c == cue)
    }
    /// The index of a cue, adding it with small random weights when new.
    pub fn ensure(&mut self, cue: &str) -> usize {
        if let Some(i) = self.cue_index(cue) {
            return i;
        }
        let row: Vec<f64> = (0..self.actions)
            .map(|_| 0.02 + self.rng.next_f64() * 0.03)
            .collect();
        self.cues.push(cue.to_string());
        self.w.push(row);
        self.n.push(vec![0.0; self.actions]);
        self.al.push(0.6);
        self.cues.len() - 1
    }
    /// Sets a weight directly (priors, loading a save).
    pub fn set_weight(&mut self, cue: usize, action: usize, w: f64, n: f64) {
        self.w[cue][action] = w;
        self.n[cue][action] = n;
    }
    pub fn set_associability(&mut self, cue: usize, a: f64) {
        self.al[cue] = a;
    }
    pub fn set_offer(&mut self, action: usize, v: f64) {
        self.offer[action] = v;
    }
    pub fn offer(&self, action: usize) -> f64 {
        self.offer[action]
    }
    pub fn associability(&self, cue: usize) -> f64 {
        self.al[cue]
    }
    pub fn excitation(&self, cue: usize, action: usize) -> f64 {
        self.w[cue][action]
    }
    pub fn inhibition(&self, cue: usize, action: usize) -> f64 {
        self.n[cue][action]
    }
    /// Net associative value V = W - N.
    pub fn value(&self, cue: usize, action: usize) -> f64 {
        self.w[cue][action] - self.n[cue][action]
    }

    fn push(&mut self, e: Entry) {
        self.trace.insert(0, e);
        self.trace.truncate(8);
    }

    /// Samples an action from the offer history (free operant), among `allowed`.
    pub fn sample_offer(&mut self, allowed: &[bool]) -> Option<usize> {
        let e: Vec<(usize, f64)> = (0..self.actions)
            .filter(|&a| allowed.get(a).copied().unwrap_or(true))
            .map(|a| (a, libm::exp(self.offer[a] * 2.0)))
            .collect();
        let tot: f64 = e.iter().map(|x| x.1).sum();
        let mut r = self.rng.next_f64() * tot;
        for &(a, w) in &e {
            r -= w;
            if r <= 0.0 {
                return Some(a);
            }
        }
        e.first().map(|x| x.0)
    }

    /// Answers a cue. `distraction` raises non compliance and the bar an
    /// action must clear; `trainability` is a z score; `watched` is the
    /// handler looking. `offerable` limits offered actions. Returns the
    /// response and its latency in seconds.
    pub fn respond(
        &mut self,
        cue: &str,
        now: f64,
        distraction: f64,
        trainability: f64,
        watched: bool,
        offerable: &[bool],
    ) -> (Response, f64) {
        let c = self.ensure(cue);
        let tr = trainability;
        if self.cfg.noise {
            let p = (self.cfg.ignore - 0.08 * tr
                + 0.4 * distraction
                + if watched { 0.0 } else { 0.15 })
            .clamp(0.03, 0.85);
            if self.rng.next_f64() < p {
                self.push(Entry {
                    cue: Some(c),
                    action: None,
                    t: now,
                    done: Some(now),
                    credited: true,
                });
                return (Response::Ignored, 0.0);
            }
        }
        let mut best = None;
        let mut bs = 0.75 + distraction;
        for a in 0..self.actions {
            let u = self.rng.next_f64();
            let g = -libm::log(-libm::log(u + 1e-9) + 1e-9) * 0.55;
            let s = self.value(c, a) * 4.0 * (1.0 + 0.1 * tr) + g;
            if s > bs {
                bs = s;
                best = Some(a);
            }
        }
        let mut offered = false;
        if best.is_none() && self.rng.next_f64() < 0.5 && distraction < 0.8 {
            best = self.sample_offer(offerable);
            offered = best.is_some();
        }
        let lat = if self.cfg.noise {
            ex_gaussian(
                self.cfg.cue_mu * (1.0 - 0.15 * tr),
                0.08,
                self.cfg.cue_tau * (1.0 - 0.2 * tr),
                &mut self.rng,
            )
        } else {
            0.0
        };
        self.push(Entry {
            cue: Some(c),
            action: best,
            t: now,
            done: None,
            credited: false,
        });
        (
            best.map_or(Response::None, |action| Response::Act { action, offered }),
            lat,
        )
    }

    /// The act for the latest open trial of `action` finished at `now`.
    pub fn mark_done(&mut self, action: usize, now: f64) {
        if let Some(e) = self
            .trace
            .iter_mut()
            .find(|e| e.action == Some(action) && e.done.is_none())
        {
            e.done = Some(now);
        }
    }

    /// An act done with no cue (free operant); reward can later attach it.
    pub fn offer_trick(&mut self, action: usize, now: f64) {
        self.push(Entry {
            cue: None,
            action: Some(action),
            t: now,
            done: Some(now),
            credited: false,
        });
    }

    /// Reward (positive) or punishment (negative) at `now`. The most
    /// recent eligible act takes the credit, weighted by exp(-age / trace).
    pub fn reward(&mut self, r: f64, now: f64, trainability: f64) -> Option<Credit> {
        let recent = self.trace.iter().filter(|e| now - e.t < 120.0).count() as f64;
        let lam = if r > 0.0 { 1.0 } else { 0.0 };
        let base = self.cfg.alpha * (1.0 + 0.15 * trainability) / (1.0 + 0.12 * recent);
        let th = self.cfg.theta;
        for k in 0..self.trace.len() {
            let e = self.trace[k].clone();
            if e.credited {
                continue;
            }
            let age = now - e.done.unwrap_or(e.t);
            let wgt = libm::exp(-age / self.cfg.trace_seconds);
            if wgt < 0.05 {
                continue;
            }
            let Some(a) = e.action else { continue };
            if let Some(c) = e.cue {
                let v = self.value(c, a);
                let al = self.al[c];
                let kk = base * al * wgt * r.abs();
                if lam > v {
                    self.w[c][a] = (self.w[c][a] + kk * (lam - v)).clamp(0.0, 1.2);
                    for b in 0..self.actions {
                        if b != a {
                            self.w[c][b] *= 1.0 - kk * 0.15;
                        }
                    }
                } else {
                    self.n[c][a] = (self.n[c][a] + kk * (v - lam)).clamp(0.0, 1.2);
                }
                self.al[c] = ((1.0 - th) * al + th * (lam - v).abs()).clamp(0.05, 1.0);
            }
            let step = if r > 0.0 { 0.25 } else { -0.15 };
            self.offer[a] = (self.offer[a] + step * wgt * self.cfg.offer_rate).clamp(0.0, 3.0);
            self.trace[k].credited = true;
            let value = e.cue.map_or(0.0, |c| self.value(c, a));
            return Some(Credit {
                cue: e.cue,
                action: a,
                value,
                credit: wgt,
            });
        }
        None
    }

    /// Inhibition decays per minute, faster than excitation (which does not decay).
    pub fn decay(&mut self, dt: f64) {
        let k = libm::exp(-self.cfg.inhibition_decay * dt / 60.0);
        for row in self.n.iter_mut() {
            for v in row.iter_mut() {
                *v *= k;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn learner() -> CueLearner {
        CueLearner::new(
            4,
            LearnConfig {
                noise: false,
                ..Default::default()
            },
            3,
        )
    }

    /// A trial: the cue, the act done 0.5 s later, the reward `delay` after that.
    fn trial(l: &mut CueLearner, t: &mut f64, action: usize, r: f64, delay: f64) {
        let c = l.ensure("sit");
        l.push(Entry {
            cue: Some(c),
            action: Some(action),
            t: *t,
            done: None,
            credited: false,
        });
        l.mark_done(action, *t + 0.5);
        l.reward(r, *t + 0.5 + delay, 0.0);
        *t += 200.0;
    }

    #[test]
    fn acquisition_extinction_and_spontaneous_recovery() {
        let mut l = learner();
        let mut t = 0.0;
        let c = l.ensure("sit");
        let v0 = l.value(c, 0);
        for _ in 0..12 {
            trial(&mut l, &mut t, 0, 1.0, 0.2);
        }
        let acquired = l.value(c, 0);
        assert!(acquired > 0.8 && acquired > v0 + 0.7, "acquired {acquired}");
        for _ in 0..12 {
            trial(&mut l, &mut t, 0, -1.0, 0.2);
        }
        let extinct = l.value(c, 0);
        assert!(extinct < 0.4 * acquired, "extinct {extinct}");
        // an hour of rest: inhibition decays, excitation does not
        l.decay(3600.0);
        let recovered = l.value(c, 0);
        assert!(
            recovered > extinct + 0.2,
            "recovered {recovered} from {extinct}"
        );
    }

    #[test]
    fn delay_of_reinforcement_cuts_learning() {
        let mut fast = learner();
        let mut slow = learner();
        let (mut a, mut b) = (0.0, 0.0);
        for _ in 0..4 {
            trial(&mut fast, &mut a, 1, 1.0, 0.1);
            trial(&mut slow, &mut b, 1, 1.0, 2.5);
        }
        let c = fast.cue_index("sit").unwrap();
        // 2.5 s delay keeps exp(-2.5 / 1.2) = 12 percent of the credit (computed)
        assert!(
            fast.value(c, 1) > 2.0 * slow.value(c, 1),
            "{} {}",
            fast.value(c, 1),
            slow.value(c, 1)
        );
    }

    #[test]
    fn non_compliance_rate_follows_distraction() {
        let mut l = CueLearner::new(4, LearnConfig::default(), 5);
        let (mut calm, mut busy) = (0, 0);
        for k in 0..4000 {
            if l.respond("sit", k as f64 * 300.0, 0.0, 0.0, true, &[true; 4])
                .0
                == Response::Ignored
            {
                calm += 1;
            }
            if l.respond("sit", k as f64 * 300.0 + 1.0, 1.0, 0.0, true, &[true; 4])
                .0
                == Response::Ignored
            {
                busy += 1;
            }
        }
        // base 0.25 when calm, 0.65 at distraction 1 (computed)
        assert!((calm as f64 / 4000.0 - 0.25).abs() < 0.03, "{calm}");
        assert!((busy as f64 / 4000.0 - 0.65).abs() < 0.03, "{busy}");
    }

    #[test]
    fn reward_credits_an_offered_trick() {
        let mut l = learner();
        l.offer_trick(2, 0.0);
        let before = l.offer(2);
        let c = l.reward(1.0, 0.3, 0.0).expect("credit");
        assert_eq!(c.action, 2);
        assert!(c.cue.is_none());
        assert!(l.offer(2) > before);
    }
}
