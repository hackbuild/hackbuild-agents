//! Behaviour choice: reactive switches after a short heavy tailed latency
//! for options that cannot wait, otherwise softmax sampling only when the
//! current act is done or its dwell ran out, with a commitment bonus on the
//! current act. Every decision carries a why. Written for this library
//! from the HACKLE `brain.choose` and `brain.set`, keeping its random draw
//! order so a seeded run replays.

use agent_rng::{Mulberry32, Rng, ex_gaussian};

#[derive(Clone, Copy, Debug)]
pub struct ChooserConfig {
    /// softmax temperature (HACKLE 0.06)
    pub temperature: f64,
    /// bonus on the current act while it is not done (HACKLE 0.12)
    pub commitment: f64,
    /// dwell ex-Gaussian mu and tail in seconds (HACKLE 5 and 7, sigma 1)
    pub dwell_mu: f64,
    pub dwell_tau: f64,
    /// reaction latency ex-Gaussian mu and tail (HACKLE 0.3 and 0.3, sigma 0.06)
    pub react_mu: f64,
    pub react_tau: f64,
    /// a reactive option must beat the current act by this margin
    pub react_margin: f64,
    /// false: argmax with a fixed hysteresis (the canned path)
    pub sample: bool,
    /// false: no latencies, a fixed 6 s dwell (the canned path)
    pub noise: bool,
}

impl Default for ChooserConfig {
    fn default() -> Self {
        ChooserConfig {
            temperature: 0.06,
            commitment: 0.12,
            dwell_mu: 5.0,
            dwell_tau: 7.0,
            react_mu: 0.3,
            react_tau: 0.3,
            react_margin: 0.05,
            sample: true,
            noise: true,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Reason {
    /// the current act holds
    Hold,
    /// the top score won the sample
    Top,
    /// the sample picked an option below the top score
    Sampled,
    /// a reactive option beat the current act by the margin
    Reactive,
    /// a forced option (a stimulus) took over
    Forced,
    /// argmax with hysteresis, sampling off
    Argmax,
    /// a pending switch fired after its latency
    Fired,
}

impl Reason {
    pub fn name(self) -> &'static str {
        match self {
            Reason::Hold => "hold",
            Reason::Top => "top",
            Reason::Sampled => "sampled",
            Reason::Reactive => "reactive",
            Reason::Forced => "forced",
            Reason::Argmax => "argmax",
            Reason::Fired => "fired",
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub struct Pending {
    pub option: usize,
    pub at: f64,
    pub reason: Reason,
    pub probability: f64,
    /// seconds between the decision and the switch
    pub latency: f64,
}

/// One decision with its why.
#[derive(Clone, Debug)]
pub struct Decision {
    /// the act after this update
    pub current: usize,
    /// set when the act changed on this update
    pub switched: bool,
    /// a switch waiting for its latency; the head can already turn to it
    pub pending: Option<Pending>,
    pub reason: Reason,
    /// the option the reason is about (the new act, the pending one, or the current one)
    pub option: usize,
    pub utility: f64,
    pub best: usize,
    pub best_utility: f64,
    /// sampling probability of `option` when a sample was drawn, else NaN
    pub probability: f64,
    pub why: String,
}

pub struct Chooser {
    pub cfg: ChooserConfig,
    names: Vec<String>,
    rng: Mulberry32,
    current: usize,
    done: bool,
    dwell: f64,
    pending: Option<Pending>,
}

fn fmt2(x: f64) -> String {
    let r = libm::round(x * 100.0) / 100.0;
    let s = format!("{r:.2}");
    if s == "-0.00" { "0.00".into() } else { s }
}

impl Chooser {
    pub fn new(names: Vec<String>, cfg: ChooserConfig, seed: u32, start: usize) -> Chooser {
        assert!(start < names.len(), "start option out of range");
        Chooser {
            cfg,
            names,
            rng: Mulberry32::new(seed),
            current: start,
            done: false,
            dwell: 0.0,
            pending: None,
        }
    }
    pub fn current(&self) -> usize {
        self.current
    }
    pub fn pending(&self) -> Option<Pending> {
        self.pending
    }
    pub fn dwell_until(&self) -> f64 {
        self.dwell
    }
    pub fn name(&self, i: usize) -> &str {
        &self.names[i]
    }
    /// The executor reports the current act finished.
    pub fn mark_done(&mut self) {
        self.done = true;
    }
    pub fn is_done(&self) -> bool {
        self.done
    }
    fn exg(&mut self, mu: f64, sigma: f64, tau: f64) -> f64 {
        ex_gaussian(mu, sigma, tau, &mut self.rng)
    }
    fn latency(&mut self, mul: f64) -> f64 {
        if self.cfg.noise {
            let (mu, tau) = (self.cfg.react_mu * mul, self.cfg.react_tau * mul);
            self.exg(mu, 0.06, tau)
        } else {
            0.0
        }
    }
    /// Switches now, outside the chooser (a cue, a command); a new dwell is drawn.
    pub fn set(&mut self, option: usize, now: f64) {
        if option != self.current {
            self.current = option;
            self.done = false;
            self.dwell = if self.cfg.noise {
                now + self.exg(self.cfg.dwell_mu, 1.0, self.cfg.dwell_tau)
            } else {
                now + 6.0
            };
        }
        self.pending = None;
    }

    /// One update with the utilities of every option. `reactive[i]` marks
    /// options that cannot wait for the dwell; `forced` is an option a
    /// stimulus forces, treated as reactive.
    pub fn update(
        &mut self,
        now: f64,
        u: &[f64],
        reactive: &[bool],
        forced: Option<usize>,
    ) -> Decision {
        assert_eq!(u.len(), self.names.len(), "one utility per option");
        let mut best = 0;
        let mut bv = -1.0;
        for (b, &v) in u.iter().enumerate() {
            if v > bv {
                bv = v;
                best = b;
            }
        }
        let cur = self.current;
        let mk = |s: &Chooser,
                  reason: Reason,
                  option: usize,
                  utility: f64,
                  probability: f64,
                  switched: bool,
                  why: String| Decision {
            current: s.current,
            switched,
            pending: s.pending,
            reason,
            option,
            utility,
            best,
            best_utility: bv,
            probability,
            why,
        };
        if let Some(p) = self.pending {
            if now >= p.at {
                self.set(p.option, now);
                let why = format!(
                    "{}: {} switch after {} ms, utility now {}",
                    self.names[p.option],
                    p.reason.name(),
                    libm::round(p.latency * 1000.0) as i64,
                    fmt2(u[p.option])
                );
                return mk(
                    self,
                    Reason::Fired,
                    p.option,
                    u[p.option],
                    p.probability,
                    true,
                    why,
                );
            }
            let why = format!(
                "{}: waiting {} ms to switch from {}",
                self.names[p.option],
                libm::round((p.at - now) * 1000.0) as i64,
                self.names[cur]
            );
            return mk(
                self,
                Reason::Hold,
                p.option,
                u[p.option],
                p.probability,
                false,
                why,
            );
        }
        if !self.cfg.sample {
            let held = u[cur] + 0.12;
            let (pick, uv) = if held >= bv { (cur, held) } else { (best, bv) };
            if pick != cur {
                self.set(pick, now);
                let why = format!(
                    "{}: top score {}, over {} {} with hysteresis",
                    self.names[pick],
                    fmt2(uv),
                    self.names[cur],
                    fmt2(held)
                );
                return mk(self, Reason::Argmax, pick, uv, f64::NAN, true, why);
            }
            return mk(
                self,
                Reason::Hold,
                cur,
                held,
                f64::NAN,
                false,
                format!("{}: holds at {}", self.names[cur], fmt2(held)),
            );
        }
        let cur_u = u[cur] + if self.done { -1.0 } else { self.cfg.commitment };
        let is_forced = forced == Some(best);
        if best != cur
            && bv > cur_u + self.cfg.react_margin
            && (reactive.get(best).copied().unwrap_or(false) || is_forced)
        {
            let lat = self.latency(1.0);
            let reason = if is_forced {
                Reason::Forced
            } else {
                Reason::Reactive
            };
            self.pending = Some(Pending {
                option: best,
                at: now + lat,
                reason,
                probability: f64::NAN,
                latency: lat,
            });
            let why = format!(
                "{}: {} switch, {} over {} {}, latency {} ms",
                self.names[best],
                reason.name(),
                fmt2(bv),
                self.names[cur],
                fmt2(cur_u),
                libm::round(lat * 1000.0) as i64
            );
            return mk(self, reason, best, bv, f64::NAN, false, why);
        }
        if self.done || now > self.dwell {
            let t = self.cfg.temperature;
            let ex: Vec<f64> = (0..u.len())
                .map(|b| libm::exp(((if b == cur { cur_u } else { u[b] }) - bv) / t))
                .collect();
            let tot: f64 = ex.iter().sum();
            let mut r = self.rng.next_f64() * tot;
            let mut pick = best;
            for (b, &w) in ex.iter().enumerate() {
                r -= w;
                if r <= 0.0 {
                    pick = b;
                    break;
                }
            }
            let p = ex[pick] / tot;
            self.dwell = now + self.exg(self.cfg.dwell_mu, 1.0, self.cfg.dwell_tau);
            if pick != cur {
                let lat = self.latency(0.6);
                let reason = if pick == best {
                    Reason::Top
                } else {
                    Reason::Sampled
                };
                self.pending = Some(Pending {
                    option: pick,
                    at: now + lat,
                    reason,
                    probability: p,
                    latency: lat,
                });
                let why = if pick == best {
                    format!(
                        "{}: top score {} (p {}), latency {} ms",
                        self.names[pick],
                        fmt2(u[pick]),
                        fmt2(p),
                        libm::round(lat * 1000.0) as i64
                    )
                } else {
                    format!(
                        "{}: sampled {} (p {}), not the top score; {} had {}",
                        self.names[pick],
                        fmt2(u[pick]),
                        fmt2(p),
                        self.names[best],
                        fmt2(bv)
                    )
                };
                return mk(self, reason, pick, u[pick], p, false, why);
            }
            self.done = false;
            let why = format!(
                "{}: sampled again (p {}), dwell {} s",
                self.names[cur],
                fmt2(p),
                fmt2(self.dwell - now)
            );
            return mk(self, Reason::Hold, cur, cur_u, p, false, why);
        }
        let why = format!(
            "{}: committed, {} s of dwell left",
            self.names[cur],
            fmt2(self.dwell - now)
        );
        mk(self, Reason::Hold, cur, cur_u, f64::NAN, false, why)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn names(n: usize) -> Vec<String> {
        (0..n).map(|i| format!("b{i}")).collect()
    }

    #[test]
    fn samples_near_the_softmax_and_says_why() {
        let mut counts = [0usize; 3];
        let u = [0.5, 0.45, 0.2];
        for s in 0..4000 {
            let mut c = Chooser::new(names(3), ChooserConfig::default(), s, 2);
            c.mark_done();
            let d = c.update(0.0, &u, &[false; 3], None);
            let pick = d.pending.map_or(d.current, |p| p.option);
            counts[pick] += 1;
            assert!(!d.why.is_empty());
        }
        // current act done: its utility counts as 0.2 - 1, so options 0 and 1 share the mass by exp(0.05 / 0.06) (computed)
        let ratio = counts[0] as f64 / counts[1] as f64;
        assert!((ratio - (0.05f64 / 0.06).exp()).abs() < 0.25, "{counts:?}");
        assert!(counts[2] < 10);
    }

    #[test]
    fn reactive_option_switches_after_latency_and_commitment_holds() {
        let mut c = Chooser::new(names(3), ChooserConfig::default(), 9, 0);
        c.set(1, 0.0);
        c.set(0, 0.0);
        let d = c.update(0.1, &[0.4, 0.43, 0.9], &[false, false, true], None);
        assert_eq!(d.reason, Reason::Reactive);
        let at = d.pending.unwrap().at;
        let d2 = c.update(at - 0.01, &[0.4, 0.43, 0.9], &[false, false, true], None);
        assert_eq!(d2.current, 0);
        let d3 = c.update(at, &[0.4, 0.43, 0.9], &[false, false, true], None);
        assert!(d3.switched && d3.current == 2);
        // within the dwell a slightly better non reactive option does not take over
        let d4 = c.update(at + 0.1, &[0.4, 0.95, 0.9], &[false, false, true], None);
        assert_eq!(d4.current, 2);
        assert_eq!(d4.reason, Reason::Hold);
    }

    #[test]
    fn canned_path_is_argmax_with_hysteresis() {
        let cfg = ChooserConfig {
            sample: false,
            noise: false,
            ..Default::default()
        };
        let mut c = Chooser::new(names(2), cfg, 1, 0);
        assert_eq!(c.update(0.0, &[0.5, 0.6], &[false; 2], None).current, 0);
        assert_eq!(c.update(0.0, &[0.5, 0.63], &[false; 2], None).current, 1);
    }
}
