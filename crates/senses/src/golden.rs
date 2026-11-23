//! A fixed scenario over every module, used to prove that the native and
//! the wasm build give identical numbers for one seed.

use crate::hearing::localize;
use crate::loom::{LoomConfig, Looming, angular_size, time_to_contact};
use crate::math::{Camera, Vec3};
use crate::occupancy::{GridConfig, OccupancyGrid};
use crate::odour::{OdourConfig, OdourField, Sniffer, Source, Tracker};
use crate::saliency::{Saliency, SaliencyConfig};
use crate::vision::{PerceptMemory, Sighting, VisionProfile};
use agent_rng::{Mulberry32, Rng};

/// A seeded RGBA frame: noise plus a bright patch that moves with `k`.
pub fn test_frame(w: usize, h: usize, k: usize, seed: u32) -> Vec<u8> {
    let mut r = Mulberry32::new(seed.wrapping_add(k as u32));
    let mut f = vec![0u8; w * h * 4];
    for y in 0..h {
        for x in 0..w {
            let i = (y * w + x) * 4;
            let n = (r.next_f64() * 40.0) as u8;
            let sky = if y < h / 3 { 150 } else { 70 };
            f[i] = sky / 2 + n;
            f[i + 1] = sky / 2 + n;
            f[i + 2] = sky + n;
            f[i + 3] = 255;
            let (cx, cy) = (40 + k * 23 % (w - 80), h / 2 + (k * 7) % (h / 4));
            if x.abs_diff(cx) < 10 && y.abs_diff(cy) < 8 {
                f[i] = 240;
                f[i + 1] = 210;
                f[i + 2] = 30;
            }
        }
    }
    f
}

pub fn trace(seed: u32) -> Vec<f64> {
    let mut out = Vec::new();
    let cam = Camera::look(Vec3::new(0.0, 0.55, 0.0), 0.3, -0.1, 70.0, 2.0, 0.05, 60.0);
    let mut s = Saliency::new(SaliencyConfig::default(), seed);
    for k in 0..4 {
        s.bias_point(Vec3::new(1.0, 0.2, 3.0), 0.5);
        s.update(
            &test_frame(320, 160, k, seed),
            320,
            160,
            k as f64 * 0.1,
            &cam,
        );
        let m = s.map();
        out.push(m.iter().map(|&v| v as f64).sum());
        if let Some(f) = s.shift(k as f64 * 0.1, &cam, &[Vec3::new(1.0, 0.2, 3.0)], 0.4) {
            out.extend_from_slice(&[f.x as f64, f.y as f64, f.value, f.point.x, f.point.z]);
        }
    }
    let mut l = Looming::new(LoomConfig::default());
    for k in 0..30 {
        if let Some(tau) = l.observe(0, 0.3, 4.0 - k as f64 * 0.12, k as f64 * 0.033) {
            out.push(tau);
        }
    }
    out.push(time_to_contact(
        angular_size(0.5, 2.0),
        angular_size(0.5, 1.9),
        0.1,
    ));
    let mut r = Mulberry32::new(seed);
    for k in 0..4 {
        out.push(localize(0.2 * k as f64, 0.1, 7.6, k % 2 == 0, &mut r));
    }
    let mut f = OdourField::new(OdourConfig::default(), seed);
    let src = [
        Source {
            id: 0,
            x: -2.0,
            z: 0.5,
            strength: 1.0,
        },
        Source {
            id: 2,
            x: 3.0,
            z: -1.0,
            strength: 0.4,
        },
    ];
    let mut sn = Sniffer::new(6.0, 1.0, seed);
    let mut tr = Tracker::new(seed);
    for k in 0..240 {
        let now = k as f64 / 60.0;
        f.step(1.0 / 60.0, &src);
        if k % 10 == 0 {
            f.deposit(-1.0 + k as f64 * 0.01, 0.2, 0.6, now);
        }
        sn.tick(&f, 1.0 / 60.0, now, true, (0.0, 0.0), (0.0, 0.03));
        let st = tr.step(&f, &sn, 1.0 / 60.0, now, (0.0, 0.0), 0.0, k % 30 == 0);
        if k % 40 == 0 {
            out.push(f.concentration(0.5, 0.3));
            out.push(sn.conc);
            out.push(st.waypoint.map_or(0.0, |w| w.0 + w.1));
        }
    }
    out.push(f.puff_count() as f64);
    f.decay_trail(10.0, 45.0);
    out.push(f.ground_concentration(-0.5, 0.2));
    if let Some(d) = f.trail_direction(0.0, 0.2, None) {
        out.extend_from_slice(&[d.0, d.1]);
    }
    let mut m = PerceptMemory::new(VisionProfile::default());
    let eye = Vec3::new(0.0, 0.5, 0.0);
    let mut sg = Sighting {
        pos: Vec3::new(1.0, 0.0, 4.0),
        vel: Vec3::new(0.5, 0.0, 0.0),
        size: 0.3,
        ..Default::default()
    };
    m.sense(1, eye, 0.0, &sg, 0.8, 0.0, &mut r);
    sg.occluded = true;
    m.sense(1, eye, 0.0, &sg, 0.8, 2.0, &mut r);
    let (p, c) = m.recall(1, 30.0).unwrap_or_default();
    out.extend_from_slice(&[p.x, p.z, c]);
    let mut g = OccupancyGrid::new(
        GridConfig {
            cells: 80,
            ..Default::default()
        },
        0.0,
        0.0,
    );
    let gc = Camera::look(
        Vec3::new(0.0, 0.6, 0.0),
        0.2,
        -0.3,
        74.0,
        96.0 / 54.0,
        0.05,
        12.0,
    );
    let mut depth = vec![12.0f32; 96 * 54];
    for y in 0..54 {
        for x in 0..96 {
            let d = gc.ray(
                (x as f64 + 0.5) / 96.0 * 2.0 - 1.0,
                1.0 - (y as f64 + 0.5) / 54.0 * 2.0,
            );
            let tw = if d.z > 1e-6 { 2.5 / d.z } else { f64::INFINITY };
            let tf = if d.y < -1e-6 {
                0.6 / -d.y
            } else {
                f64::INFINITY
            };
            let t = tw.min(tf);
            if t < 12.0 {
                depth[y * 96 + x] = t as f32;
            }
        }
    }
    g.integrate(&gc, &depth, 96, 54, 12.0, Vec3::default());
    let (free, occ) = g.known();
    out.extend_from_slice(&[free, occ as f64]);
    if let Some(p) = g.path(Vec3::new(0.0, 0.0, 0.0), Vec3::new(1.0, 0.0, 2.0)) {
        for q in p {
            out.extend_from_slice(&[q.x, q.z]);
        }
    }
    out.push(g.frontiers(Vec3::default()).len() as f64);
    out
}
