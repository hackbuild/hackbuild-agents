//! Odour: an intermittent puff plume in a meandering wind plus a decaying
//! ground trail grid, two nostril sniffing in bouts, and a tracker with
//! decide, trail, surge and cast modes. Written for this library from the
//! HACKLE nose (`plumeTick`, `trailDeposit`, `trailDir`, `sniffTick`,
//! `sniffRun`), keeping its random draw order so a seeded run replays.
//!
//! Celani, Villermaux and Vergassola 2014: odour arrives as whiffs and
//! blanks; whiffs keep the animal surging upwind, a loss starts crosswind
//! casting. Sniffs at 4 to 7 Hz in bouts about once a second (Craven 2010).
//! Ground trails: a deciding phase of 3 to 5 s over a few footprints, then
//! follow toward the fresher end (Thesen 1993, Hepper and Wells 2005).
//!
//! Puffs are kept as a struct of arrays with a uniform spatial hash, so no
//! object is made per puff and a concentration query visits only nearby
//! puffs (HACKLE defect 20).

use agent_rng::{Mulberry32, Ou, Rng, ex_gaussian, poisson_gap, range};

#[derive(Clone, Copy, Debug)]
pub struct OdourConfig {
    /// side of the square world in metres, centred on the origin (HACKLE 34)
    pub size: f64,
    /// trail cells per side (HACKLE 64)
    pub cells: usize,
    pub max_puffs: usize,
    /// puffs live this long (s)
    pub puff_life: f64,
    /// puffs leaving this half extent are dropped (HACKLE 17)
    pub bounds: f64,
    /// puffs per second per source at strength 1
    pub puff_rate: f64,
    /// wind speed m/s and meander 0 to 1
    pub wind: f64,
    pub meander: f64,
    /// mean wind heading (rad, 0 is +X toward +Z)
    pub wind_heading: f64,
}

impl Default for OdourConfig {
    fn default() -> Self {
        OdourConfig {
            size: 34.0,
            cells: 64,
            max_puffs: 600,
            puff_life: 14.0,
            bounds: 17.0,
            puff_rate: 5.0,
            wind: 0.7,
            meander: 0.35,
            wind_heading: 0.4,
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub struct Source {
    /// a small integer per source, for the emission accumulator
    pub id: usize,
    pub x: f64,
    pub z: f64,
    pub strength: f64,
}

const HASH_CELL: f64 = 2.0;

pub struct OdourField {
    pub cfg: OdourConfig,
    rng: Mulberry32,
    wind_ou: Ou,
    wind_a: f64,
    wind_v: (f64, f64),
    acc: Vec<f64>,
    px: Vec<f64>,
    pz: Vec<f64>,
    age: Vec<f64>,
    mass: Vec<f64>,
    tx: Vec<Ou>,
    tz: Vec<Ou>,
    trail: Vec<f32>,
    trail_t: Vec<f32>,
    hash_n: usize,
    hash_start: Vec<u32>,
    hash_items: Vec<u32>,
}

impl OdourField {
    pub fn new(cfg: OdourConfig, seed: u32) -> OdourField {
        let mut rng = Mulberry32::new(seed);
        let wind_ou = Ou::new(25.0, 0.6, 0.0, &mut rng);
        let n = cfg.cells * cfg.cells;
        let hash_n = (libm::ceil(2.0 * cfg.bounds / HASH_CELL) as usize).max(1);
        OdourField {
            wind_a: cfg.wind_heading,
            wind_v: (0.0, 0.0),
            cfg,
            rng,
            wind_ou,
            acc: Vec::new(),
            px: Vec::new(),
            pz: Vec::new(),
            age: Vec::new(),
            mass: Vec::new(),
            tx: Vec::new(),
            tz: Vec::new(),
            trail: vec![0.0; n],
            trail_t: vec![-1e9; n],
            hash_n,
            hash_start: vec![0; hash_n * hash_n + 1],
            hash_items: Vec::new(),
        }
    }
    pub fn puff_count(&self) -> usize {
        self.px.len()
    }
    /// Puff positions, ages and masses as x, z, age, mass per puff.
    pub fn puffs(&self) -> Vec<f64> {
        let mut out = Vec::with_capacity(self.px.len() * 4);
        for i in 0..self.px.len() {
            out.extend_from_slice(&[self.px[i], self.pz[i], self.age[i], self.mass[i]]);
        }
        out
    }
    pub fn wind(&self) -> (f64, f64) {
        self.wind_v
    }
    pub fn clear_puffs(&mut self) {
        self.px.clear();
        self.pz.clear();
        self.age.clear();
        self.mass.clear();
        self.tx.clear();
        self.tz.clear();
        self.rebuild_hash();
    }

    /// One plume step: the wind meanders, each source emits at a rate of
    /// `puff_rate * sqrt(strength)`, puffs advect with per puff turbulence.
    pub fn step(&mut self, dt: f64, sources: &[Source]) {
        let c = self.cfg;
        self.wind_a = c.wind_heading + self.wind_ou.step(dt, &mut self.rng) * c.meander * 2.0;
        self.wind_v = (
            libm::cos(self.wind_a) * c.wind,
            libm::sin(self.wind_a) * c.wind,
        );
        for s in sources {
            if self.acc.len() <= s.id {
                self.acc.resize(s.id + 1, 0.0);
            }
            self.acc[s.id] += dt * c.puff_rate * libm::sqrt(s.strength.max(0.0));
            while self.acc[s.id] >= 1.0 {
                self.acc[s.id] -= 1.0;
                if self.px.len() < c.max_puffs {
                    let x = s.x + range(-0.05, 0.05, &mut self.rng);
                    let z = s.z + range(-0.05, 0.05, &mut self.rng);
                    let sig = 0.25 * (c.wind + 0.2);
                    let tx = Ou::new(0.8, sig, 0.0, &mut self.rng);
                    let tz = Ou::new(0.8, sig, 0.0, &mut self.rng);
                    self.px.push(x);
                    self.pz.push(z);
                    self.age.push(0.0);
                    self.mass.push(s.strength);
                    self.tx.push(tx);
                    self.tz.push(tz);
                }
            }
        }
        let mut keep = vec![true; self.px.len()];
        for i in (0..self.px.len()).rev() {
            self.age[i] += dt;
            let vx = self.wind_v.0 + self.tx[i].step(dt, &mut self.rng);
            self.px[i] += vx * dt;
            let vz = self.wind_v.1 + self.tz[i].step(dt, &mut self.rng);
            self.pz[i] += vz * dt;
            if self.age[i] > c.puff_life
                || self.px[i].abs() > c.bounds
                || self.pz[i].abs() > c.bounds
            {
                keep[i] = false;
            }
        }
        if keep.iter().any(|k| !k) {
            let mut j = 0;
            for i in 0..keep.len() {
                if keep[i] {
                    self.px[j] = self.px[i];
                    self.pz[j] = self.pz[i];
                    self.age[j] = self.age[i];
                    self.mass[j] = self.mass[i];
                    self.tx.swap(j, i);
                    self.tz.swap(j, i);
                    j += 1;
                }
            }
            self.px.truncate(j);
            self.pz.truncate(j);
            self.age.truncate(j);
            self.mass.truncate(j);
            self.tx.truncate(j);
            self.tz.truncate(j);
        }
        self.rebuild_hash();
    }

    fn hash_cell(&self, x: f64, z: f64) -> (isize, isize) {
        let b = self.cfg.bounds;
        (
            libm::floor((x + b) / HASH_CELL) as isize,
            libm::floor((z + b) / HASH_CELL) as isize,
        )
    }

    fn rebuild_hash(&mut self) {
        let n = self.hash_n;
        let mut counts = vec![0u32; n * n + 1];
        let cells: Vec<usize> = (0..self.px.len())
            .map(|i| {
                let (a, b) = self.hash_cell(self.px[i], self.pz[i]);
                (b.clamp(0, n as isize - 1) as usize) * n + a.clamp(0, n as isize - 1) as usize
            })
            .collect();
        for &c in &cells {
            counts[c + 1] += 1;
        }
        for k in 1..counts.len() {
            counts[k] += counts[k - 1];
        }
        let mut fill = counts.clone();
        self.hash_items = vec![0; cells.len()];
        for (i, &c) in cells.iter().enumerate() {
            self.hash_items[fill[c] as usize] = i as u32;
            fill[c] += 1;
        }
        self.hash_start = counts;
    }

    /// Plume concentration at a point: a Gaussian per puff whose variance
    /// grows with age, cut off at three sigma.
    pub fn puff_concentration(&self, x: f64, z: f64) -> f64 {
        let n = self.hash_n as isize;
        let (cx, cz) = self.hash_cell(x, z);
        // the widest puff reaches 3 sqrt(0.0025 + 0.03 life) metres (1.95 m at 14 s, computed)
        let reach = 3.0 * libm::sqrt(0.0025 + 0.03 * self.cfg.puff_life);
        let r = libm::ceil(reach / HASH_CELL) as isize;
        let mut c = 0.0;
        for j in (cz - r).max(0)..=(cz + r).min(n - 1) {
            for i in (cx - r).max(0)..=(cx + r).min(n - 1) {
                let cell = (j * n + i) as usize;
                for k in self.hash_start[cell]..self.hash_start[cell + 1] {
                    let p = self.hash_items[k as usize] as usize;
                    let s2 = 0.0025 + 0.03 * self.age[p];
                    let dx = x - self.px[p];
                    let dz = z - self.pz[p];
                    let d2 = dx * dx + dz * dz;
                    if d2 < 9.0 * s2 {
                        c += self.mass[p] * 0.012 / s2 * libm::exp(-d2 / (2.0 * s2));
                    }
                }
            }
        }
        c
    }

    fn trail_index(&self, x: f64, z: f64) -> Option<usize> {
        let (g, s) = (self.cfg.cells as f64, self.cfg.size);
        let i = libm::floor((x + s / 2.0) / s * g);
        let j = libm::floor((z + s / 2.0) / s * g);
        if i < 0.0 || j < 0.0 || i >= g || j >= g {
            None
        } else {
            Some(j as usize * self.cfg.cells + i as usize)
        }
    }

    /// Lays scent on the ground trail, capped at 3 per cell.
    pub fn deposit(&mut self, x: f64, z: f64, amount: f64, now: f64) {
        if let Some(i) = self.trail_index(x, z) {
            self.trail[i] = (self.trail[i] as f64 + amount).min(3.0) as f32;
            self.trail_t[i] = now as f32;
        }
    }

    /// Fades the trail by `elapsed / halflife` halvings (any time unit, the
    /// same for both; HACKLE uses game minutes, halflife 45).
    pub fn decay_trail(&mut self, elapsed: f64, halflife: f64) {
        let k = libm::pow(0.5, elapsed / halflife);
        for v in self.trail.iter_mut() {
            *v = (*v as f64 * k) as f32;
        }
    }

    pub fn ground_concentration(&self, x: f64, z: f64) -> f64 {
        self.trail_index(x, z)
            .map_or(0.0, |i| self.trail[i] as f64 * 0.5)
    }

    pub fn concentration(&self, x: f64, z: f64) -> f64 {
        self.puff_concentration(x, z) + self.ground_concentration(x, z)
    }

    /// Direction of travel along a trail near (x, z): nearby cells weighted
    /// by how much fresher they are than their mean. With `prev`, a reversal
    /// past -0.2 keeps the previous direction.
    pub fn trail_direction(&self, x: f64, z: f64, prev: Option<(f64, f64)>) -> Option<(f64, f64)> {
        let g = self.cfg.cells as isize;
        let cs = self.cfg.size / self.cfg.cells as f64;
        let cx = libm::floor((x + self.cfg.size / 2.0) / cs) as isize;
        let cz = libm::floor((z + self.cfg.size / 2.0) / cs) as isize;
        let mut cells: Vec<(f64, f64, f64)> = Vec::new();
        let mut mt = 0.0;
        for dz in -4isize..=4 {
            for dx in -4isize..=4 {
                let (i, j) = (cx + dx, cz + dz);
                if i < 0 || j < 0 || i >= g || j >= g {
                    continue;
                }
                let k = (j * g + i) as usize;
                if (self.trail[k] as f64) < 0.03 {
                    continue;
                }
                let t = self.trail_t[k] as f64;
                cells.push((dx as f64, dz as f64, t));
                mt += t;
            }
        }
        if cells.len() < 3 {
            return None;
        }
        mt /= cells.len() as f64;
        let (mut sx, mut sz) = (0.0, 0.0);
        for (dx, dz, t) in cells {
            let w = t - mt;
            let l = libm::hypot(dx, dz);
            let l = if l == 0.0 { 1.0 } else { l };
            sx += w * dx / l;
            sz += w * dz / l;
        }
        if sx * sx + sz * sz < 1e-6 {
            return None;
        }
        let l = libm::sqrt(sx * sx + sz * sz);
        let d = (sx / l, sz / l);
        if let Some(p) = prev
            && d.0 * p.0 + d.1 * p.1 < -0.2
        {
            return Some(p);
        }
        Some(d)
    }

    pub fn trail(&self) -> &[f32] {
        &self.trail
    }
}

/// Two nostril sniffing in bouts.
#[derive(Clone, Debug)]
pub struct Sniffer {
    pub sniff_hz: f64,
    pub bout_hz: f64,
    rng: Mulberry32,
    bout_t: f64,
    in_bout: f64,
    phase: f64,
    pub left: f64,
    pub right: f64,
    pub conc: f64,
    pub mean: f64,
    pub whiff_t: f64,
}

impl Sniffer {
    pub fn new(sniff_hz: f64, bout_hz: f64, seed: u32) -> Sniffer {
        Sniffer {
            sniff_hz,
            bout_hz,
            rng: Mulberry32::new(seed),
            bout_t: 0.0,
            in_bout: 0.0,
            phase: 0.0,
            left: 0.0,
            right: 0.0,
            conc: 0.0,
            mean: 0.01,
            whiff_t: -99.0,
        }
    }
    /// Advances the sniff clock; returns true when a sniff was taken this
    /// step. `nose` is the nose tip (x, z), `side` the offset to the left
    /// nostril (HACKLE 3 cm across the head).
    pub fn tick(
        &mut self,
        field: &OdourField,
        dt: f64,
        now: f64,
        active: bool,
        nose: (f64, f64),
        side: (f64, f64),
    ) -> bool {
        if !active {
            self.in_bout = 0.0;
            return false;
        }
        if self.in_bout <= 0.0 {
            self.bout_t -= dt;
            if self.bout_t <= 0.0 {
                self.in_bout = range(0.3, 0.9, &mut self.rng);
                self.bout_t = poisson_gap(self.bout_hz, &mut self.rng);
            }
            return false;
        }
        self.in_bout -= dt;
        self.phase += dt * self.sniff_hz;
        if self.phase < 1.0 {
            return false;
        }
        self.phase -= 1.0;
        self.left = field.concentration(nose.0 + side.0, nose.1 + side.1);
        self.right = field.concentration(nose.0 - side.0, nose.1 - side.1);
        self.conc = (self.left + self.right) / 2.0;
        self.mean += (self.conc - self.mean) * 0.15;
        if self.conc > (self.mean * 1.4).max(0.03) {
            self.whiff_t = now;
        }
        true
    }
    /// A whiff in the last `window` seconds.
    pub fn whiff(&self, now: f64, window: f64) -> bool {
        now - self.whiff_t < window
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TrackMode {
    Decide,
    Trail,
    Surge,
    Cast,
}

impl TrackMode {
    pub fn name(self) -> &'static str {
        match self {
            TrackMode::Decide => "decide",
            TrackMode::Trail => "trail",
            TrackMode::Surge => "surge",
            TrackMode::Cast => "cast",
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub struct TrackStep {
    pub mode: TrackMode,
    /// where to walk, or None to stand
    pub waypoint: Option<(f64, f64)>,
    /// speed scale 0 to 1 and the stop distance in metres
    pub speed: f64,
    pub stop_dist: f64,
    /// the run is over (lost for 9 s, or 24 s spent)
    pub done: bool,
    /// the mode changed on this step
    pub changed: bool,
}

/// The tracking state machine of one sniffing run.
pub struct Tracker {
    rng: Mulberry32,
    mode: TrackMode,
    side: f64,
    amp: f64,
    wp: Option<(f64, f64)>,
    t: f64,
    decide_end: f64,
    tdir: Option<(f64, f64)>,
    trail_done: Option<f64>,
}

impl Tracker {
    pub fn new(seed: u32) -> Tracker {
        let mut rng = Mulberry32::new(seed);
        let side = if rng.next_f64() < 0.5 { 1.0 } else { -1.0 };
        Tracker {
            rng,
            mode: TrackMode::Cast,
            side,
            amp: 0.8,
            wp: None,
            t: 0.0,
            decide_end: 0.0,
            tdir: None,
            trail_done: None,
        }
    }
    pub fn mode(&self) -> TrackMode {
        self.mode
    }
    /// One step. `pos` and `heading` (yaw, 0 is +Z) are the animal's;
    /// `arrived` is the motor reporting the last waypoint reached.
    pub fn step(
        &mut self,
        field: &OdourField,
        sniff: &Sniffer,
        dt: f64,
        now: f64,
        pos: (f64, f64),
        heading: f64,
        arrived: bool,
    ) -> TrackStep {
        let before = self.mode;
        let (wx, wz) = field.wind();
        let mut up = (-wx, -wz);
        if up.0 * up.0 + up.1 * up.1 < 1e-4 {
            up = (libm::sin(heading), libm::cos(heading));
        }
        let ul = libm::sqrt(up.0 * up.0 + up.1 * up.1);
        let up = (up.0 / ul, up.1 / ul);
        let cross = (-up.1, up.0);
        let lr = sniff.left - sniff.right;
        let gnd = field.ground_concentration(pos.0, pos.1);
        self.t += dt;
        let out = |s: &Tracker, speed: f64, stop: f64, done: bool| TrackStep {
            mode: s.mode,
            waypoint: s.wp,
            speed,
            stop_dist: stop,
            done,
            changed: s.mode != before,
        };
        if gnd > 0.08
            && self.mode != TrackMode::Decide
            && self.mode != TrackMode::Trail
            && self.trail_done.is_none_or(|t| now - t > 15.0)
        {
            self.mode = TrackMode::Decide;
            self.decide_end = now + ex_gaussian(3.2, 0.5, 1.0, &mut self.rng);
            self.wp = None;
        }
        if self.mode == TrackMode::Decide {
            if self.wp.is_none() || arrived {
                let dx = range(-0.4, 0.4, &mut self.rng);
                let dz = range(-0.4, 0.4, &mut self.rng);
                self.wp = Some((pos.0 + dx, pos.1 + dz));
            }
            if now > self.decide_end {
                self.tdir = field.trail_direction(pos.0, pos.1, None);
                self.mode = if self.tdir.is_some() {
                    TrackMode::Trail
                } else {
                    TrackMode::Cast
                };
                self.wp = None;
            }
            return out(self, 0.4, 0.15, false);
        }
        if self.mode == TrackMode::Trail {
            if self.wp.is_none() || arrived {
                match field.trail_direction(pos.0, pos.1, self.tdir) {
                    Some(d) if field.ground_concentration(pos.0, pos.1) >= 0.03 => {
                        self.tdir = Some(d);
                        self.wp = Some((pos.0 + d.0 * 1.5, pos.1 + d.1 * 1.5));
                    }
                    _ => {
                        self.mode = TrackMode::Cast;
                        self.trail_done = Some(now);
                        self.wp = None;
                    }
                }
            }
            if self.mode == TrackMode::Trail {
                return out(self, 0.9, 0.3, self.t > 24.0);
            }
        }
        let whiff = sniff.whiff(now, 0.9);
        if whiff && self.mode != TrackMode::Surge {
            self.mode = TrackMode::Surge;
            self.wp = None;
            self.amp = 0.8;
        }
        if !whiff && self.mode == TrackMode::Surge {
            self.mode = TrackMode::Cast;
            self.wp = None;
        }
        if self.wp.is_none() || arrived {
            if self.mode == TrackMode::Surge {
                let lat = (lr * 40.0).clamp(-0.8, 0.8);
                self.wp = Some((
                    pos.0 + up.0 * 1.3 - cross.0 * lat,
                    pos.1 + up.1 * 1.3 - cross.1 * lat,
                ));
            } else {
                self.side = -self.side;
                self.amp = (self.amp * 1.35).min(3.2);
                self.wp = Some((
                    pos.0 + cross.0 * self.side * self.amp + up.0 * 0.25,
                    pos.1 + cross.1 * self.side * self.amp + up.1 * 0.25,
                ));
            }
        }
        let done = (now - sniff.whiff_t > 9.0 && self.t > 6.0) || self.t > 24.0;
        let speed = if self.mode == TrackMode::Surge {
            0.9
        } else {
            0.6
        };
        out(self, speed, 0.25, done)
    }
    /// Replaces the current waypoint, for a caller that keeps it out of obstacles.
    pub fn set_waypoint(&mut self, x: f64, z: f64) {
        self.wp = Some((x, z));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plume_drifts_downwind_and_respects_the_cap() {
        let mut f = OdourField::new(
            OdourConfig {
                meander: 0.0,
                ..Default::default()
            },
            5,
        );
        let src = [Source {
            id: 0,
            x: 0.0,
            z: 0.0,
            strength: 1.0,
        }];
        for _ in 0..600 {
            f.step(1.0 / 60.0, &src);
        }
        // about 5 puffs per second for 10 s (computed)
        assert!((45..=55).contains(&f.puff_count()), "{}", f.puff_count());
        let (wx, wz) = f.wind();
        let down = f.concentration(wx * 3.0, wz * 3.0);
        let up = f.concentration(-wx * 3.0, -wz * 3.0);
        assert!(down > 10.0 * up.max(1e-9), "down {down} up {up}");
        let mut g = OdourField::new(
            OdourConfig {
                max_puffs: 20,
                ..Default::default()
            },
            5,
        );
        for _ in 0..600 {
            g.step(1.0 / 60.0, &src);
        }
        assert!(g.puff_count() <= 20);
    }

    #[test]
    fn hash_query_equals_a_full_scan() {
        let mut f = OdourField::new(OdourConfig::default(), 11);
        let src = [
            Source {
                id: 0,
                x: -3.0,
                z: 1.0,
                strength: 1.2,
            },
            Source {
                id: 1,
                x: 4.0,
                z: -2.0,
                strength: 0.3,
            },
        ];
        for _ in 0..900 {
            f.step(1.0 / 60.0, &src);
        }
        let p = f.puffs();
        for (x, z) in [(-2.0, 1.5), (0.0, 0.0), (4.5, -1.0), (8.0, 3.0)] {
            let mut c = 0.0;
            for k in 0..p.len() / 4 {
                let (px, pz, age, m) = (p[k * 4], p[k * 4 + 1], p[k * 4 + 2], p[k * 4 + 3]);
                let s2 = 0.0025 + 0.03 * age;
                let d2 = (x - px) * (x - px) + (z - pz) * (z - pz);
                if d2 < 9.0 * s2 {
                    c += m * 0.012 / s2 * (-d2 / (2.0 * s2)).exp();
                }
            }
            let h = f.puff_concentration(x, z);
            assert!((h - c).abs() <= 1e-12 * c.max(1.0), "{h} {c}");
        }
    }

    #[test]
    fn trail_points_toward_the_fresher_end() {
        let mut f = OdourField::new(OdourConfig::default(), 1);
        for k in 0..20 {
            f.deposit(-2.0 + k as f64 * 0.25, 0.0, 0.6, k as f64);
        }
        let d = f.trail_direction(0.5, 0.0, None).expect("direction");
        assert!(d.0 > 0.9, "{d:?}");
        let back = f.trail_direction(0.5, 0.0, Some((-1.0, 0.0))).unwrap();
        assert_eq!(back, (-1.0, 0.0));
        let before = f.ground_concentration(0.0, 0.0);
        f.decay_trail(45.0, 45.0);
        assert!((f.ground_concentration(0.0, 0.0) - before / 2.0).abs() < 1e-6);
    }

    #[test]
    fn tracker_decides_then_follows_a_ground_trail() {
        let mut f = OdourField::new(
            OdourConfig {
                wind: 0.0,
                ..Default::default()
            },
            2,
        );
        for k in 0..60 {
            f.deposit(-6.0 + k as f64 * 0.2, 0.0, 0.6, k as f64 * 0.2);
        }
        let s = Sniffer::new(6.0, 1.0, 3);
        let mut t = Tracker::new(4);
        let mut pos = (-1.0, 0.0);
        let mut modes = Vec::new();
        for k in 0..900 {
            let now = 20.0 + k as f64 / 60.0;
            let st = t.step(&f, &s, 1.0 / 60.0, now, pos, 0.0, false);
            if modes.last() != Some(&st.mode) {
                modes.push(st.mode);
            }
            if st.mode == TrackMode::Trail
                && let Some(w) = st.waypoint
            {
                let (dx, dz) = (w.0 - pos.0, w.1 - pos.1);
                let l = (dx * dx + dz * dz).sqrt();
                if l > 0.3 {
                    pos = (pos.0 + dx / l * 0.015, pos.1 + dz / l * 0.015);
                } else {
                    t.step(&f, &s, 0.0, now, pos, 0.0, true);
                }
            }
        }
        assert_eq!(&modes[..2], &[TrackMode::Decide, TrackMode::Trail]);
        assert!(pos.0 > 2.0, "followed toward +x, at {pos:?}");
    }
}
