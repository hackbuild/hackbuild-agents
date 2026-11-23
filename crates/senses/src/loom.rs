//! Looming: time to contact tau = theta / (d theta / dt) from the growth of
//! an object's angular size (Lee 1976). A fast approach under the threshold
//! is a startle. Written for this library from the legacy `loomCheck`.

/// Angular size in radians of an object of `size` metres at `dist` metres.
pub fn angular_size(size: f64, dist: f64) -> f64 {
    2.0 * libm::atan(size / 2.0 / dist.max(0.05))
}

/// Time to contact in seconds from two angular sizes `dt` apart; infinite
/// when the object is not growing.
pub fn time_to_contact(prev_angle: f64, angle: f64, dt: f64) -> f64 {
    if dt <= 0.0 {
        return f64::INFINITY;
    }
    let rate = (angle - prev_angle) / dt;
    if rate <= 0.0 {
        f64::INFINITY
    } else {
        angle / rate
    }
}

#[derive(Clone, Copy, Debug)]
pub struct LoomConfig {
    /// startle under this tau in seconds (legacy `Se.loom` 0.6, scaled by temperament)
    pub tau: f64,
    /// ignore objects smaller than this angle (rad)
    pub min_angle: f64,
    /// samples further apart than this are stale (s)
    pub max_gap: f64,
    /// one startle per object per this many seconds
    pub refractory: f64,
}

impl Default for LoomConfig {
    fn default() -> Self {
        LoomConfig {
            tau: 0.6,
            min_angle: 0.04,
            max_gap: 0.3,
            refractory: 2.5,
        }
    }
}

#[derive(Clone, Copy, Debug)]
struct Track {
    angle: f64,
    t: f64,
    last_startle: f64,
}

/// Per object looming tracks keyed by a small integer id.
pub struct Looming {
    pub cfg: LoomConfig,
    tracks: Vec<Option<Track>>,
}

impl Looming {
    pub fn new(cfg: LoomConfig) -> Looming {
        Looming {
            cfg,
            tracks: Vec::new(),
        }
    }
    /// Feeds one sighting; returns the tau when this sighting is a startle.
    pub fn observe(&mut self, id: usize, size: f64, dist: f64, now: f64) -> Option<f64> {
        if self.tracks.len() <= id {
            self.tracks.resize(id + 1, None);
        }
        let th = angular_size(size, dist);
        let prev = self.tracks[id];
        let last = prev.map_or(f64::NEG_INFINITY, |p| p.last_startle);
        self.tracks[id] = Some(Track {
            angle: th,
            t: now,
            last_startle: last,
        });
        let q = prev?;
        let gap = now - q.t;
        if gap > self.cfg.max_gap || gap < 1e-3 {
            return None;
        }
        let tau = time_to_contact(q.angle, th, gap);
        if tau < self.cfg.tau && th > self.cfg.min_angle && now - last > self.cfg.refractory {
            if let Some(t) = self.tracks[id].as_mut() {
                t.last_startle = now;
            }
            return Some(tau);
        }
        None
    }
    pub fn forget(&mut self, id: usize) {
        if let Some(t) = self.tracks.get_mut(id) {
            *t = None;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tau_of_a_constant_approach_is_distance_over_speed() {
        // an object 0.3 m wide approaching at 3 m/s from 1.5 m: tau 0.5 s (computed, dt / (1 - 1.45 / 1.5))
        let a = angular_size(0.3, 1.5);
        let b = angular_size(0.3, 1.5 - 3.0 / 60.0);
        let tau = time_to_contact(a, b, 1.0 / 60.0);
        assert!((tau - 0.5).abs() < 0.01, "tau {tau}");
        assert!(time_to_contact(b, a, 1.0 / 60.0).is_infinite());
    }

    #[test]
    fn startles_once_per_refractory_window() {
        let mut l = Looming::new(LoomConfig::default());
        let mut n = 0;
        for k in 0..60 {
            let t = k as f64 * 0.1;
            let d = (4.0 - t * 4.0).max(0.2);
            if l.observe(0, 0.3, d, t).is_some() {
                n += 1;
            }
        }
        assert_eq!(n, 1);
    }
}
