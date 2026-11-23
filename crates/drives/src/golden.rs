//! A fixed scenario over every module, used to prove that the native and
//! the wasm build give identical numbers for one seed.

use crate::chooser::{Chooser, ChooserConfig};
use crate::drives::Drives;
use crate::learn::{CueLearner, LearnConfig, Response};
use crate::memory::MemoryStream;
use crate::sleep::{Sleep, SleepConfig, body_clock};
use alloc_free::names;

mod alloc_free {
    pub fn names(n: usize) -> Vec<String> {
        (0..n).map(|i| format!("b{i}")).collect()
    }
}

pub fn trace(seed: u32) -> Vec<f64> {
    let mut out = Vec::new();
    let mut d = Drives::new(vec![1.0, 1.0, 0.8, 0.9, 0.6, 1.1], 3.0, 4.0, 2.4);
    d.values = vec![0.35, 0.15, 0.5, 0.4, 0.5, 0.0];
    let effects: [[f64; 6]; 5] = [
        [0.0, 0.03, 0.0, 0.0, -0.35, 0.0],
        [-0.5, 0.0, 0.0, 0.0, 0.0, 0.0],
        [0.0, 0.05, -0.4, -0.1, 0.0, 0.0],
        [0.0, 0.0, 0.0, -0.45, 0.0, 0.0],
        [0.0, -0.25, 0.0, 0.0, 0.0, 0.0],
    ];
    let mut c = Chooser::new(names(6), ChooserConfig::default(), seed, 0);
    for k in 0..120 {
        let now = k as f64 * 0.25;
        d.grow(0.25, &[0.0022, 0.001, 0.0045, 0.0032, 0.004, -0.03]);
        let mut u: Vec<f64> = effects.iter().map(|e| d.reward_of(e, 1.0)).collect();
        u.insert(0, 0.12);
        if k == 40 {
            c.mark_done();
        }
        let dec = c.update(
            now,
            &u,
            &[false, false, false, true, false, false],
            if k == 70 { Some(3) } else { None },
        );
        if dec.switched || k % 20 == 0 {
            out.extend_from_slice(&[now, dec.current as f64, dec.utility, dec.best as f64]);
        }
    }
    out.push(d.distance(&d.values));
    let mut l = CueLearner::new(5, LearnConfig::default(), seed);
    let mut t = 0.0;
    for k in 0..30 {
        let (r, lat) = l.respond(
            "sit",
            t,
            if k % 7 == 0 { 0.6 } else { 0.0 },
            0.3,
            k % 3 != 0,
            &[true; 5],
        );
        out.push(lat);
        if let Response::Act { action, .. } = r {
            l.mark_done(action, t + lat + 0.4);
            let rw = if action == 0 { 1.0 } else { -0.4 };
            if let Some(cr) = l.reward(rw, t + lat + 0.6, 0.3) {
                out.extend_from_slice(&[cr.action as f64, cr.value, cr.credit]);
            }
        }
        l.decay(30.0);
        t += 30.0;
    }
    let ci = l.cue_index("sit").unwrap_or(0);
    for a in 0..5 {
        out.push(l.value(ci, a));
    }
    let mut s = Sleep::new(SleepConfig::default(), 0.8, seed);
    s.lie_down(k_neg(seed));
    for k in 0..900 {
        s.pressure_step(0.5 / 60.0, 1.0);
        if s.step(0.5, (22.0 + k as f64 * 0.5 / 60.0) % 24.0, false) {
            out.push(k as f64);
            break;
        }
        if k % 50 == 0 {
            out.extend_from_slice(&[s.stage().index() as f64, s.pressure]);
        }
    }
    for h in [3.0, 7.0, 13.5, 19.0, 22.0] {
        out.push(body_clock(h));
    }
    let mut m = MemoryStream::new(60);
    for k in 0..20 {
        m.add(
            if k % 3 == 0 {
                "the ball rolled"
            } else {
                "quiet yard"
            },
            (k % 5) as f64,
            k as f64,
        );
    }
    for x in m.retrieve(25.0, &["ball"], 4) {
        out.extend_from_slice(&[x.hour, x.importance]);
    }
    out
}

fn k_neg(seed: u32) -> bool {
    seed % 2 == 1
}
