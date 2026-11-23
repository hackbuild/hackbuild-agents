//! Itti Koch saliency on an eye frame, after Itti, Koch and Niebur 1998:
//! center surround differences on a pyramid, the N() normalization, a
//! winner take all, and inhibition of return. Written for this library from
//! the legacy `attention` object, with the same arithmetic: maps are stored
//! as f32 and computed in f64, so the map matches the original to the last
//! f32 bit on the same frame (the parity test measures this).
//!
//! Channels: intensity, blue yellow (dogs are dichromats, so red green is
//! dropped), edges and frame difference motion. Inhibition of return is kept
//! as world directions from the eye, so it survives head turns.

use crate::math::{Camera, Vec3};
use agent_rng::{Mulberry32, Rng, log_normal};

/// Channel weights; the legacy simulator uses 1, 0.7, 0.6, 1.7.
#[derive(Clone, Copy, Debug)]
pub struct Channels {
    pub intensity: f64,
    pub blue_yellow: f64,
    pub edges: f64,
    pub motion: f64,
}

impl Default for Channels {
    fn default() -> Self {
        Channels {
            intensity: 1.0,
            blue_yellow: 0.7,
            edges: 0.6,
            motion: 1.7,
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub struct SaliencyConfig {
    /// feature grid the frame is sampled to (legacy 80 by 40)
    pub width: usize,
    pub height: usize,
    pub channels: Channels,
    pub gain: f64,
    /// the winner must beat this to become a fixation (legacy 0.35)
    pub threshold: f64,
    /// fixation dwell median in seconds (Barber 2016: mean 827 ms)
    pub fixation_median: f64,
    /// inhibition of return duration in seconds
    pub ior_seconds: f64,
    /// an object within this angle of the winner ray takes the fixation (rad)
    pub snap_angle: f64,
    /// ground height for fixations that hit no object
    pub ground_y: f64,
}

impl Default for SaliencyConfig {
    fn default() -> Self {
        SaliencyConfig {
            width: 80,
            height: 40,
            channels: Channels::default(),
            gain: 1.0,
            threshold: 0.35,
            fixation_median: 0.83,
            ior_seconds: 0.7,
            snap_angle: 0.25,
            ground_y: 0.0,
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub struct Fixation {
    /// cell in the saliency map (half the feature grid)
    pub x: usize,
    pub y: usize,
    pub value: f64,
    /// the world point fixated: a snapped object, or the ground under the ray
    pub point: Vec3,
    /// index into the objects passed to `shift`, or None for the ground
    pub object: Option<usize>,
}

struct Level {
    d: Vec<f32>,
    w: usize,
    h: usize,
}

#[derive(Clone, Copy, Debug)]
struct Ior {
    dir: Vec3,
    until: f64,
}

pub struct Saliency {
    pub cfg: SaliencyConfig,
    map: Vec<f32>,
    prev_i: Option<Vec<f32>>,
    ior: Vec<Ior>,
    bias: Vec<(Vec3, f64)>,
    bias_uv: Vec<(f64, f64, f64)>,
    next_shift: f64,
    focus: Option<Fixation>,
    rng: Mulberry32,
}

fn levels(src: Vec<f32>, w: usize, h: usize) -> Vec<Level> {
    let mut out = vec![Level { d: src, w, h }];
    for _ in 0..4 {
        let p = out.last().expect("level");
        let nw = (p.w >> 1).max(1);
        let nh = (p.h >> 1).max(1);
        let mut o = vec![0f32; nw * nh];
        for y in 0..nh {
            for x in 0..nw {
                let (x0, y0) = (x * 2, y * 2);
                let x1 = (x0 + 1).min(p.w - 1);
                let y1 = (y0 + 1).min(p.h - 1);
                let s = p.d[y0 * p.w + x0] as f64
                    + p.d[y0 * p.w + x1] as f64
                    + p.d[y1 * p.w + x0] as f64
                    + p.d[y1 * p.w + x1] as f64;
                o[y * nw + x] = (s / 4.0) as f32;
            }
        }
        out.push(Level { d: o, w: nw, h: nh });
    }
    out
}

fn sample(l: &Level, u: f64, v: f64) -> f64 {
    let x = (libm::floor(u * l.w as f64) as isize).clamp(0, l.w as isize - 1) as usize;
    let y = (libm::floor(v * l.h as f64) as isize).clamp(0, l.h as isize - 1) as usize;
    l.d[y * l.w + x] as f64
}

/// Center surround at level 1 from centers 1, 2 and surrounds c + 2, c + 3.
fn cs_map(l: &[Level]) -> Vec<f32> {
    let (w, h) = (l[1].w, l[1].h);
    let mut out = vec![0f32; w * h];
    for y in 0..h {
        for x in 0..w {
            let u = (x as f64 + 0.5) / w as f64;
            let v = (y as f64 + 0.5) / h as f64;
            let mut s = 0.0;
            for c in [1usize, 2] {
                for dd in [2usize, 3] {
                    if c + dd >= l.len() {
                        continue;
                    }
                    s += (sample(&l[c], u, v) - sample(&l[c + dd], u, v)).abs();
                }
            }
            out[y * w + x] = s as f32;
        }
    }
    out
}

/// Itti's N(): scale to a max of 1, then multiply by (1 - mean local max)^2.
fn normalize(m: &mut [f32], w: usize, h: usize) {
    let mut mx = 0f32;
    for &v in m.iter() {
        if v > mx {
            mx = v;
        }
    }
    if (mx as f64) < 1e-6 {
        m.fill(0.0);
        return;
    }
    for v in m.iter_mut() {
        *v = (*v as f64 / mx as f64) as f32;
    }
    let (mut sum, mut n) = (0.0f64, 0u32);
    for y in 1..h.saturating_sub(1) {
        for x in 1..w.saturating_sub(1) {
            let i = y * w + x;
            let v = m[i];
            if (v as f64) < 0.999
                && (v as f64) > 0.05
                && v >= m[i - 1]
                && v >= m[i + 1]
                && v >= m[i - w]
                && v >= m[i + w]
            {
                sum += v as f64;
                n += 1;
            }
        }
    }
    let mb = if n > 0 { sum / n as f64 } else { 0.0 };
    let k = (1.0 - mb) * (1.0 - mb);
    for v in m.iter_mut() {
        *v = (*v as f64 * k) as f32;
    }
}

impl Saliency {
    pub fn new(cfg: SaliencyConfig, seed: u32) -> Saliency {
        assert!(
            cfg.width >= 8 && cfg.height >= 8,
            "saliency grid must be at least 8 by 8"
        );
        Saliency {
            map: vec![0.0; (cfg.width / 2) * (cfg.height / 2)],
            cfg,
            prev_i: None,
            ior: Vec::new(),
            bias: Vec::new(),
            bias_uv: Vec::new(),
            next_shift: 0.0,
            focus: None,
            rng: Mulberry32::new(seed),
        }
    }
    pub fn map_width(&self) -> usize {
        self.cfg.width / 2
    }
    pub fn map_height(&self) -> usize {
        self.cfg.height / 2
    }
    pub fn map(&self) -> &[f32] {
        &self.map
    }
    pub fn focus(&self) -> Option<Fixation> {
        self.focus
    }
    /// Top down bias at a world point for the next update: adds
    /// `weight * exp(-d^2 / 6)` around its projection, d in map cells.
    pub fn bias_point(&mut self, p: Vec3, weight: f64) {
        self.bias.push((p, weight));
    }
    /// Top down bias at image coordinates u, v in 0 to 1 (v down).
    pub fn bias_uv(&mut self, u: f64, v: f64, weight: f64) {
        self.bias_uv.push((u, v, weight));
    }
    /// Inhibit a world direction from the eye until `until`.
    pub fn inhibit(&mut self, dir: Vec3, until: f64) {
        self.ior.push(Ior {
            dir: dir.normalize(),
            until,
        });
    }
    pub fn inhibited(&self) -> usize {
        self.ior.len()
    }
    /// Due for a new fixation at `now`.
    pub fn ready(&self, now: f64) -> bool {
        now > self.next_shift
    }

    /// Computes the saliency map from an RGBA frame of `fw` by `fh` pixels
    /// (row 0 at the top) seen through `cam`. Biases queued since the last
    /// update are applied and cleared.
    pub fn update(&mut self, frame: &[u8], fw: usize, fh: usize, now: f64, cam: &Camera) -> &[f32] {
        let (sw, sh) = (self.cfg.width, self.cfg.height);
        assert!(
            frame.len() >= fw * fh * 4,
            "frame is shorter than width * height * 4"
        );
        let n = sw * sh;
        let mut ii = vec![0f32; n];
        let mut by = vec![0f32; n];
        let sx = fw as f64 / sw as f64;
        let sy = fh as f64 / sh as f64;
        for y in 0..sh {
            for x in 0..sw {
                let px = (libm::floor(y as f64 * sy) as usize * fw
                    + libm::floor(x as f64 * sx) as usize)
                    * 4;
                let r = frame[px] as f64 / 255.0;
                let g = frame[px + 1] as f64 / 255.0;
                let b = frame[px + 2] as f64 / 255.0;
                ii[y * sw + x] = ((r + g + b) / 3.0) as f32;
                by[y * sw + x] = (b - (r + g) / 2.0) as f32;
            }
        }
        let mut mo = vec![0f32; n];
        if let Some(p) = &self.prev_i {
            for i in 0..n {
                mo[i] = ((ii[i] as f64 - p[i] as f64).abs() * 4.0) as f32;
            }
        }
        let mut e = vec![0f32; n];
        for y in 1..sh - 1 {
            for x in 1..sw - 1 {
                let i = y * sw + x;
                e[i] = libm::hypot(
                    ii[i + 1] as f64 - ii[i - 1] as f64,
                    ii[i + sw] as f64 - ii[i - sw] as f64,
                ) as f32;
            }
        }
        let (w, h) = (sw / 2, sh / 2);
        let cs = |d: Vec<f32>| {
            let mut m = cs_map(&levels(d, sw, sh));
            normalize(&mut m, w, h);
            m
        };
        let m_i = cs(ii.clone());
        let m_b = cs(by);
        let m_e = cs(e);
        let mut m_m = levels(mo, sw, sh).swap_remove(1).d;
        normalize(&mut m_m, w, h);
        self.prev_i = Some(ii);
        let c = self.cfg.channels;
        let g = self.cfg.gain;
        for i in 0..self.map.len() {
            self.map[i] = (g
                * (m_i[i] as f64
                    + c.blue_yellow * m_b[i] as f64
                    + c.edges * m_e[i] as f64
                    + c.motion * m_m[i] as f64)) as f32;
            // the intensity weight is folded in below so the default keeps the legacy simulator's operation order
        }
        if c.intensity != 1.0 {
            for i in 0..self.map.len() {
                self.map[i] = (self.map[i] as f64 + g * (c.intensity - 1.0) * m_i[i] as f64) as f32;
            }
        }
        let blobs: Vec<(f64, f64, f64)> = self
            .bias
            .drain(..)
            .filter_map(|(p, k)| {
                let v = cam.project(p);
                // a point at the eye projects to NaN, which every
                // comparison below would let through
                if !(v.x.is_finite() && v.y.is_finite() && v.z.is_finite()) {
                    return None;
                }
                if v.z > 1.0 || v.x.abs() > 1.0 || v.y.abs() > 1.0 {
                    return None;
                }
                Some((
                    (v.x + 1.0) / 2.0 * w as f64,
                    (1.0 - v.y) / 2.0 * h as f64,
                    k,
                ))
            })
            .chain(
                self.bias_uv
                    .drain(..)
                    .map(|(u, v, k)| (u * w as f64, v * h as f64, k)),
            )
            .collect();
        for (cx, cy, k) in blobs {
            for y in 0..h {
                for x in 0..w {
                    let d2 = (x as f64 - cx) * (x as f64 - cx) + (y as f64 - cy) * (y as f64 - cy);
                    let i = y * w + x;
                    self.map[i] = (self.map[i] as f64 + k * libm::exp(-d2 / 6.0)) as f32;
                }
            }
        }
        self.ior.retain(|o| o.until > now);
        let r = w as f64 / 6.0;
        for o in &self.ior {
            let v = cam.project(cam.pos.add(o.dir));
            if v.z > 1.0 || !(v.x.is_finite() && v.y.is_finite()) {
                continue;
            }
            let cx = (v.x + 1.0) / 2.0 * w as f64;
            let cy = (1.0 - v.y) / 2.0 * h as f64;
            for y in 0..h {
                for x in 0..w {
                    let d2 = (x as f64 - cx) * (x as f64 - cx) + (y as f64 - cy) * (y as f64 - cy);
                    if d2 < r * r {
                        let i = y * w + x;
                        self.map[i] = (self.map[i] as f64 * (0.15 + 0.85 * d2 / (r * r))) as f32;
                    }
                }
            }
        }
        &self.map
    }

    /// The strongest cell above the threshold, as (index, value).
    pub fn winner(&self) -> Option<(usize, f64)> {
        let mut bi = None;
        let mut bv = self.cfg.threshold;
        for (i, &v) in self.map.iter().enumerate() {
            if v as f64 > bv {
                bv = v as f64;
                bi = Some(i);
            }
        }
        bi.map(|i| (i, bv))
    }

    /// Moves the fixation: winner take all, snap to the nearest object
    /// within `snap_angle` of the winner ray, else the ground under it;
    /// schedules the next shift by a lognormal dwell, shorter when aroused
    /// (`arousal` 0 to 1), and inhibits the new direction.
    pub fn shift(
        &mut self,
        now: f64,
        cam: &Camera,
        objects: &[Vec3],
        arousal: f64,
    ) -> Option<Fixation> {
        let (w, h) = (self.map_width(), self.map_height());
        let win = self.winner();
        let dwell = log_normal(self.cfg.fixation_median, 0.6, &mut self.rng).min(4.0);
        self.next_shift = now + dwell * (1.15 - 0.3 * arousal);
        let Some((bi, bv)) = win else {
            self.focus = None;
            return None;
        };
        let (x, y) = (bi % w, bi / w);
        let dir = cam.ray(
            (x as f64 + 0.5) / w as f64 * 2.0 - 1.0,
            1.0 - (y as f64 + 0.5) / h as f64 * 2.0,
        );
        let mut best = None;
        let mut bd = self.cfg.snap_angle;
        for (k, p) in objects.iter().enumerate() {
            let to = p.sub(cam.pos).normalize();
            let a = libm::acos(to.dot(dir).clamp(-1.0, 1.0));
            if a < bd {
                bd = a;
                best = Some(k);
            }
        }
        let point = match best {
            Some(k) => objects[k],
            None => {
                let eye_h = cam.pos.y - self.cfg.ground_y;
                let t = if dir.y < -0.02 {
                    (eye_h - 0.05) / -dir.y
                } else {
                    6.0
                };
                cam.pos.add(dir.scale(t.min(8.0)))
            }
        };
        let f = Fixation {
            x,
            y,
            value: bv,
            point,
            object: best,
        };
        self.focus = Some(f);
        let until = now + self.cfg.ior_seconds * (0.7 + self.rng.next_f64() * 0.6);
        self.inhibit(point.sub(cam.pos), until);
        Some(f)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_bias_or_inhibition_at_the_eye_is_skipped() {
        // before: a point at the eye projected to NaN and turned all 800
        // cells of the map NaN (measured)
        let cam = Camera::look(Vec3::new(0.0, 0.5, 0.0), 0.0, 0.0, 60.0, 2.0, 0.05, 50.0);
        let mut s = Saliency::new(SaliencyConfig::default(), 1);
        let f = vec![90u8; 320 * 160 * 4];
        s.bias_point(cam.pos, 1.0);
        s.inhibit(Vec3::new(0.0, 0.0, 0.0), 10.0);
        let m = s.update(&f, 320, 160, 0.0, &cam);
        assert!(m.iter().all(|v| v.is_finite()));
    }

    fn frame(w: usize, h: usize, spot: (usize, usize), rgb: [u8; 3]) -> Vec<u8> {
        let mut f = vec![60u8; w * h * 4];
        for y in 0..h {
            for x in 0..w {
                if x.abs_diff(spot.0) < 12 && y.abs_diff(spot.1) < 12 {
                    let i = (y * w + x) * 4;
                    f[i..i + 3].copy_from_slice(&rgb);
                }
            }
        }
        f
    }

    #[test]
    fn a_bright_blob_wins_and_inhibition_moves_the_next_fixation() {
        let cam = Camera::look(Vec3::new(0.0, 0.5, 0.0), 0.0, 0.0, 60.0, 2.0, 0.05, 50.0);
        let mut s = Saliency::new(SaliencyConfig::default(), 1);
        s.update(
            &frame(320, 160, (240, 80), [250, 240, 40]),
            320,
            160,
            0.0,
            &cam,
        );
        let f = s.shift(0.0, &cam, &[], 0.3).expect("fixation");
        // blob at x 240 of 320 is map column 30 of 40 (computed)
        assert!(f.x.abs_diff(30) <= 2, "x {}", f.x);
        assert_eq!(s.inhibited(), 1);
        s.update(
            &frame(320, 160, (240, 80), [250, 240, 40]),
            320,
            160,
            0.1,
            &cam,
        );
        let i = f.y * s.map_width() + f.x;
        assert!((s.map()[i] as f64) < 0.2 * f.value);
    }

    #[test]
    fn flat_frame_has_no_winner() {
        let cam = Camera::look(Vec3::new(0.0, 0.5, 0.0), 0.0, 0.0, 60.0, 2.0, 0.05, 50.0);
        let mut s = Saliency::new(SaliencyConfig::default(), 1);
        s.update(&vec![90u8; 320 * 160 * 4], 320, 160, 0.0, &cam);
        assert!(s.winner().is_none());
        assert!(s.shift(0.0, &cam, &[], 0.0).is_none());
    }

    #[test]
    fn snaps_to_an_object_near_the_ray() {
        let cam = Camera::look(Vec3::new(0.0, 0.5, 0.0), 0.0, 0.0, 60.0, 2.0, 0.05, 50.0);
        let mut s = Saliency::new(SaliencyConfig::default(), 3);
        let target = cam.pos.add(cam.ray(0.0, 0.0).scale(3.0));
        s.bias_point(target, 2.0);
        s.update(&vec![90u8; 320 * 160 * 4], 320, 160, 0.0, &cam);
        let f = s
            .shift(0.0, &cam, &[Vec3::new(9.0, 0.0, 9.0), target], 0.0)
            .expect("fixation");
        assert_eq!(f.object, Some(1));
    }
}
