//! Sleep: pressure that rises awake and falls asleep, a body clock with
//! activity peaks near 7 and 19 and a midday dip (Scientific Reports 2020),
//! and a stage machine for one sleep (onset, NREM, REM, brief wake) with
//! ex-Gaussian stage lengths and a hypnogram. After a bad experience onset
//! is faster and REM longer (Kis 2017). Written for this library from the
//! HACKLE `brain.tick` sleep terms, `bodyClock` and `sleepRun`.

use agent_rng::{Mulberry32, Rng, ex_gaussian};

fn smoothstep(a: f64, b: f64, x: f64) -> f64 {
    let t = ((x - a) / (b - a)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

/// Sleepiness from the body clock at hour `h` (0 to 24), 0 to 1.
pub fn body_clock(h: f64) -> f64 {
    let day = smoothstep(5.5, 7.5, h) * (1.0 - smoothstep(20.0, 22.5, h));
    let sq = |x: f64| x * x;
    let pk = libm::exp(-sq((h - 7.0) / 1.6)) + libm::exp(-sq((h - 19.0) / 1.6));
    let dip = libm::exp(-sq((h - 13.5) / 1.8));
    (1.0 - (0.6 * day + 0.45 * pk - 0.22 * dip)).clamp(0.0, 1.0)
}

#[derive(Clone, Copy, Debug)]
pub struct SleepConfig {
    /// pressure rise per game hour awake (HACKLE 0.055)
    pub up: f64,
    /// pressure fall per game hour asleep (HACKLE 0.11)
    pub down: f64,
    /// NREM game minutes (HACKLE 6) and REM game minutes (HACKLE 2.5)
    pub nrem: f64,
    pub rem: f64,
    /// chance of a brief wake after REM (HACKLE 0.45)
    pub wake: f64,
    /// sleepiness under this ends the sleep at a brief wake (HACKLE 0.45)
    pub enough: f64,
}

impl Default for SleepConfig {
    fn default() -> Self {
        SleepConfig {
            up: 0.055,
            down: 0.11,
            nrem: 6.0,
            rem: 2.5,
            wake: 0.45,
            enough: 0.45,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Stage {
    Awake,
    Onset,
    Nrem,
    Rem,
    Wake,
}

impl Stage {
    pub fn name(self) -> &'static str {
        match self {
            Stage::Awake => "awake",
            Stage::Onset => "onset",
            Stage::Nrem => "nrem",
            Stage::Rem => "rem",
            Stage::Wake => "wake",
        }
    }
    pub fn index(self) -> u8 {
        self as u8
    }
}

pub struct Sleep {
    pub cfg: SleepConfig,
    /// sleep pressure 0 to 1
    pub pressure: f64,
    stage: Stage,
    stage_t: f64,
    stage_dur: f64,
    hypnogram: Vec<Stage>,
    rng: Mulberry32,
}

impl Sleep {
    pub fn new(cfg: SleepConfig, pressure: f64, seed: u32) -> Sleep {
        Sleep {
            cfg,
            pressure,
            stage: Stage::Awake,
            stage_t: 0.0,
            stage_dur: 0.0,
            hypnogram: Vec::new(),
            rng: Mulberry32::new(seed),
        }
    }
    pub fn stage(&self) -> Stage {
        self.stage
    }
    /// Pressure over `game_hours`: down while asleep, up while awake
    /// scaled by `activity` (0.7 at rest to 1.3 running in HACKLE).
    pub fn pressure_step(&mut self, game_hours: f64, activity: f64) {
        if self.stage == Stage::Awake {
            self.pressure = (self.pressure + self.cfg.up * game_hours * activity).clamp(0.0, 1.0);
        } else {
            self.pressure = (self.pressure - self.cfg.down * game_hours).clamp(0.0, 1.0);
        }
    }
    /// Sleepiness: pressure plus the body clock at `hour`.
    pub fn sleepiness(&self, hour: f64) -> f64 {
        0.8 * self.pressure + 0.5 * body_clock(hour)
    }
    /// HACKLE's fatigue drive from pressure and the clock.
    pub fn fatigue(&self, hour: f64, running: bool) -> f64 {
        (0.8 * self.pressure + 0.45 * body_clock(hour) - 0.15 + if running { 0.05 } else { 0.0 })
            .clamp(0.0, 1.0)
    }
    /// Lying down: the onset stage starts. `negative` shortens onset.
    pub fn lie_down(&mut self, negative: bool) {
        self.stage = Stage::Onset;
        self.stage_t = 0.0;
        self.stage_dur =
            ex_gaussian(1.5, 0.4, 1.5, &mut self.rng) * if negative { 0.5 } else { 1.0 };
    }
    /// Woken (a loud sound, a name): back to awake. Pressure drops a little.
    pub fn wake_up(&mut self) {
        if self.stage != Stage::Awake {
            self.pressure = (self.pressure - 0.05).max(0.0);
        }
        self.stage = Stage::Awake;
    }
    fn nrem_dur(&mut self, negative: bool) -> f64 {
        ex_gaussian(self.cfg.nrem, 0.8, self.cfg.nrem * 0.6, &mut self.rng)
            * if negative { 0.7 } else { 1.0 }
    }
    /// Advances the stage machine by `game_minutes`. Returns true when the
    /// sleep ended on its own (slept enough).
    pub fn step(&mut self, game_minutes: f64, hour: f64, negative: bool) -> bool {
        if self.stage == Stage::Awake {
            return false;
        }
        self.stage_t += game_minutes;
        if self.stage_t <= self.stage_dur {
            return false;
        }
        self.stage_t = 0.0;
        match self.stage {
            Stage::Onset => {
                self.stage = Stage::Nrem;
                self.stage_dur = self.nrem_dur(negative);
            }
            Stage::Nrem => {
                self.stage = Stage::Rem;
                self.stage_dur =
                    ex_gaussian(self.cfg.rem * 0.7, 0.3, self.cfg.rem * 0.4, &mut self.rng)
                        * if negative { 1.6 } else { 1.0 };
            }
            Stage::Rem => {
                if self.rng.next_f64() < self.cfg.wake {
                    self.stage = Stage::Wake;
                    self.stage_dur = ex_gaussian(0.6, 0.2, 0.6, &mut self.rng);
                } else {
                    self.stage = Stage::Nrem;
                    self.stage_dur = self.nrem_dur(false);
                }
            }
            Stage::Wake => {
                if self.sleepiness(hour) < self.cfg.enough {
                    self.wake_up();
                    return true;
                }
                self.stage = Stage::Nrem;
                self.stage_dur = self.nrem_dur(false);
            }
            Stage::Awake => {}
        }
        false
    }
    /// Records the stage into the hypnogram (call at a fixed rate; keeps 160).
    pub fn sample(&mut self) {
        self.hypnogram.push(self.stage);
        if self.hypnogram.len() > 160 {
            self.hypnogram.remove(0);
        }
    }
    pub fn hypnogram(&self) -> &[Stage] {
        &self.hypnogram
    }
    /// Light sleepers wake to quieter sounds than deep NREM sleepers.
    pub fn wake_threshold(&self) -> f64 {
        if self.stage == Stage::Nrem {
            0.75
        } else {
            0.45
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn body_clock_peaks_and_dips() {
        // most alert near 7 and 19, sleepier at midday and at night (computed)
        assert!(body_clock(7.0) < body_clock(13.5));
        assert!(body_clock(19.0) < body_clock(13.5));
        assert!(body_clock(2.0) > 0.95);
    }

    #[test]
    fn a_night_cycles_nrem_and_rem_then_wakes() {
        let mut s = Sleep::new(SleepConfig::default(), 0.9, 2);
        s.lie_down(false);
        let mut seen = std::collections::HashSet::new();
        let mut woke = false;
        // one game hour per minute of steps: 600 game minutes
        for k in 0..6000 {
            s.pressure_step(0.1 / 60.0, 1.0);
            if s.step(0.1, (23.0 + k as f64 * 0.1 / 60.0) % 24.0, false) {
                woke = true;
                break;
            }
            seen.insert(s.stage());
        }
        assert!(seen.contains(&Stage::Nrem) && seen.contains(&Stage::Rem));
        assert!(woke, "pressure {}", s.pressure);
    }
}
