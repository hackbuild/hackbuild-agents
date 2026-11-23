//! Homeostatic drive reduction reward after Keramati and Gutkin 2011: the
//! drive is a weighted n-norm root of the deficits, and the reward of an
//! act is how far its expected effect lowers that drive. Written for this
//! library from the legacy `driveD` and `gain`.

#[derive(Clone, Debug)]
pub struct Drives {
    /// weight per deficit
    pub weights: Vec<f64>,
    /// current deficits, 0 to 1
    pub values: Vec<f64>,
    /// exponent n and root m (legacy 3 and 4)
    pub n: f64,
    pub m: f64,
    /// reward gain (legacy 2.4)
    pub gain: f64,
}

impl Drives {
    pub fn new(weights: Vec<f64>, n: f64, m: f64, gain: f64) -> Drives {
        let values = vec![0.0; weights.len()];
        Drives {
            weights,
            values,
            n,
            m,
            gain,
        }
    }
    /// The drive of a deficit state: (sum w_i h_i^n)^(1/m).
    pub fn distance(&self, h: &[f64]) -> f64 {
        let mut s = 0.0;
        for (w, &x) in self.weights.iter().zip(h) {
            s += w * libm::pow(x.max(0.0), self.n);
        }
        libm::pow(s, 1.0 / self.m)
    }
    /// The reward of an act with expected `effect` per deficit: the drop in
    /// drive, times the gain. Reductions are scaled by `scale`, increases
    /// are not (the legacy simulator's secure base and nearness scaling).
    pub fn reward_of(&self, effect: &[f64], scale: f64) -> f64 {
        let mut h = self.values.clone();
        for (i, &k) in effect.iter().enumerate() {
            if i < h.len() {
                h[i] = (h[i] + k * if k < 0.0 { scale } else { 1.0 }).clamp(0.0, 1.0);
            }
        }
        self.gain * (self.distance(&self.values) - self.distance(&h))
    }
    /// Deficits grow by `rates` per second, clamped to 0 to 1.
    pub fn grow(&mut self, dt: f64, rates: &[f64]) {
        for (v, r) in self.values.iter_mut().zip(rates) {
            *v = (*v + r * dt).clamp(0.0, 1.0);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reward_is_larger_for_the_bigger_need() {
        let mut d = Drives::new(vec![1.0, 1.0, 0.8, 0.9, 0.6, 1.1], 3.0, 4.0, 2.4);
        d.values = vec![0.8, 0.2, 0.3, 0.3, 0.3, 0.0];
        let eat = d.reward_of(&[-0.5, 0.0, 0.0, 0.0, 0.0, 0.0], 1.0);
        let play = d.reward_of(&[0.0, 0.0, -0.5, 0.0, 0.0, 0.0], 1.0);
        assert!(eat > 3.0 * play, "{eat} {play}");
        // an act that adds fatigue costs reward
        assert!(d.reward_of(&[0.0, 0.3, 0.0, 0.0, 0.0, 0.0], 1.0) < 0.0);
        // scale cuts reductions only
        assert!(d.reward_of(&[-0.5, 0.0, 0.0, 0.0, 0.0, 0.0], 0.5) < eat);
    }
}
