//! Geometric vision and percept memory. Visibility is a field of view
//! test, a range set by object size, motion and daylight, and an occlusion
//! answer the caller supplies. Remembered positions drift with an error
//! that grows with the square root of time since the last sighting (Fiset
//! 2003). Written for this library from the HACKLE `sense` and `memPos`.

use crate::math::{Vec3, wrap_angle};
use agent_rng::{Rng, gauss};

/// A species profile for geometric vision. The defaults are HACKLE's dog.
#[derive(Clone, Copy, Debug)]
pub struct VisionProfile {
    /// half the horizontal field of view (rad); 2.09 is a 240 degree field
    pub half_fov: f64,
    /// metres of range per metre of object size
    pub range_per_size: f64,
    /// moving objects are seen this much further (Miller, VIN: about 1.5)
    pub motion_gain: f64,
    /// speed in m/s above which an object counts as moving
    pub motion_speed: f64,
    /// range share left at full night (0 to 1)
    pub night_floor: f64,
    /// a remembered percept is forgotten after this many seconds unseen
    pub forget_after: f64,
    /// metres of memory error per sqrt(minute)
    pub drift: f64,
}

impl Default for VisionProfile {
    fn default() -> Self {
        VisionProfile {
            half_fov: 2.09,
            range_per_size: 120.0,
            motion_gain: 1.5,
            motion_speed: 0.2,
            night_floor: 0.35,
            forget_after: 240.0,
            drift: 0.25,
        }
    }
}

#[derive(Clone, Copy, Debug, Default)]
pub struct Sighting {
    pub pos: Vec3,
    pub vel: Vec3,
    pub size: f64,
    /// the caller's line of sight answer (walls, terrain)
    pub occluded: bool,
    /// held in a mouth, eyes shut: never visible
    pub hidden: bool,
    /// a fixed landmark (bowl, bed): remembered without drift
    pub fixed: bool,
}

#[derive(Clone, Copy, Debug)]
pub struct Percept {
    pub visible: bool,
    /// sim time of the last sighting, or None if never seen or forgotten
    pub seen: Option<f64>,
    pub pos: Vec3,
    pub vel: Vec3,
    pub dist: f64,
    pub speed: f64,
    /// bottom up salience 0 to 2
    pub salience: f64,
    /// 1 when visible, fading over 30 s after
    pub confidence: f64,
    err: Option<(f64, f64)>,
}

impl Default for Percept {
    fn default() -> Self {
        Percept {
            visible: false,
            seen: None,
            pos: Vec3::default(),
            vel: Vec3::default(),
            dist: 0.0,
            speed: 0.0,
            salience: 0.0,
            confidence: 0.0,
            err: None,
        }
    }
}

/// Visibility of one object from an eye facing `facing_yaw` (0 is +Z) in
/// daylight `light` (0 night, 1 day).
pub fn visible(
    p: &VisionProfile,
    eye: Vec3,
    facing_yaw: f64,
    s: &Sighting,
    light: f64,
) -> (bool, f64, f64) {
    let d = s.pos.sub(eye);
    let dist = d.length();
    let ang = wrap_angle(libm::atan2(d.x, d.z) - facing_yaw).abs();
    let speed = s.vel.length();
    let range = s.size
        * p.range_per_size
        * if speed > p.motion_speed {
            p.motion_gain
        } else {
            1.0
        }
        * (p.night_floor + (1.0 - p.night_floor) * light);
    (
        ang < p.half_fov && dist < range && !s.occluded && !s.hidden,
        dist,
        ang,
    )
}

/// Percepts indexed by a small integer id.
pub struct PerceptMemory {
    pub profile: VisionProfile,
    items: Vec<Percept>,
}

impl PerceptMemory {
    pub fn new(profile: VisionProfile) -> PerceptMemory {
        PerceptMemory {
            profile,
            items: Vec::new(),
        }
    }
    /// Updates percept `id` from a sighting at time `t`.
    pub fn sense<R: Rng + ?Sized>(
        &mut self,
        id: usize,
        eye: Vec3,
        facing_yaw: f64,
        s: &Sighting,
        light: f64,
        t: f64,
        rng: &mut R,
    ) -> &Percept {
        if self.items.len() <= id {
            self.items.resize(id + 1, Percept::default());
        }
        let prof = self.profile;
        let (vis, dist, ang) = visible(&prof, eye, facing_yaw, s, light);
        let p = &mut self.items[id];
        p.visible = vis;
        p.dist = dist;
        p.speed = s.vel.length();
        if vis {
            p.seen = Some(t);
            p.pos = s.pos;
            p.vel = s.vel;
            p.err = None;
        } else if let (Some(seen), false) = (p.seen, s.fixed) {
            if p.err.is_none() {
                let ex = gauss(rng);
                let ez = gauss(rng);
                p.err = Some((ex, ez));
            }
            if t - seen > prof.forget_after {
                p.seen = None;
                p.err = None;
            }
        }
        let novelty = p
            .seen
            .map_or(0.0, |seen| (1.0 - (t - seen) / 30.0).clamp(0.0, 1.0));
        p.salience = if vis {
            ((s.size / dist.max(0.3)) * 2.0
                + p.speed.clamp(0.0, 4.0) * 0.4
                + if ang < 0.5 { 0.2 } else { 0.0 })
            .clamp(0.0, 2.0)
        } else {
            0.0
        };
        p.confidence = if vis { 1.0 } else { novelty };
        p
    }
    pub fn get(&self, id: usize) -> Option<&Percept> {
        self.items.get(id).filter(|p| p.seen.is_some())
    }
    /// Remembered position at `now`, with the drift error applied.
    pub fn recall(&self, id: usize, now: f64) -> Option<(Vec3, f64)> {
        let p = self.get(id)?;
        let seen = p.seen?;
        let age = (now - seen).max(0.0);
        let pos = match p.err {
            Some((ex, ez)) => p
                .pos
                .add(Vec3::new(ex, 0.0, ez).scale(self.profile.drift * libm::sqrt(age / 60.0))),
            None => p.pos,
        };
        Some((pos, p.confidence))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use agent_rng::Mulberry32;

    #[test]
    fn field_of_view_range_and_night() {
        let p = VisionProfile::default();
        let eye = Vec3::new(0.0, 0.5, 0.0);
        let ball = Sighting {
            pos: Vec3::new(0.0, 0.0, 9.0),
            size: 0.09,
            ..Default::default()
        };
        // 0.09 m ball: 10.8 m range by day, 3.8 m at night (computed)
        assert!(visible(&p, eye, 0.0, &ball, 1.0).0);
        assert!(!visible(&p, eye, 0.0, &ball, 0.0).0);
        // behind the 240 degree field
        assert!(!visible(&p, eye, core::f64::consts::PI, &ball, 1.0).0);
        assert!(visible(&p, eye, 1.9, &ball, 1.0).0);
    }

    #[test]
    fn memory_drifts_with_sqrt_age_and_forgets() {
        let mut m = PerceptMemory::new(VisionProfile::default());
        let mut r = Mulberry32::new(2);
        let eye = Vec3::new(0.0, 0.5, 0.0);
        let mut s = Sighting {
            pos: Vec3::new(1.0, 0.0, 3.0),
            size: 0.3,
            ..Default::default()
        };
        m.sense(0, eye, 0.0, &s, 1.0, 0.0, &mut r);
        s.occluded = true;
        m.sense(0, eye, 0.0, &s, 1.0, 1.0, &mut r);
        let (a, _) = m.recall(0, 1.0 + 60.0).unwrap();
        let (b, _) = m.recall(0, 1.0 + 240.0).unwrap();
        let ea = a.sub(s.pos).length();
        let eb = b.sub(s.pos).length();
        // four times the age doubles the error, within the second's offset (computed)
        assert!(
            (eb / ea - (240.0f64 / 60.0).sqrt()).abs() < 0.02,
            "{ea} {eb}"
        );
        m.sense(0, eye, 0.0, &s, 1.0, 300.0, &mut r);
        assert!(m.recall(0, 300.0).is_none());
    }
}
