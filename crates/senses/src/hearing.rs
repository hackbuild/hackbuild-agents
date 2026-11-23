//! Sound localisation error: azimuth noise per animal, smaller once the
//! head points at the source, with rare front back confusion. Written for
//! this library from the legacy `brain.hear` (Guerineau 2022: dogs 1.3 to
//! 13.2 degrees, mean 7.6).

use agent_rng::{Rng, gauss};

/// The heard azimuth for a source at `true_azimuth` (radians, 0 is +Z).
/// `facing` narrows the error to 0.35 of `sd_deg`; when not facing, 6
/// percent of sounds mirror front to back about the body `yaw`.
pub fn localize<R: Rng + ?Sized>(
    true_azimuth: f64,
    yaw: f64,
    sd_deg: f64,
    facing: bool,
    rng: &mut R,
) -> f64 {
    let sd = sd_deg.to_radians() * if facing { 0.35 } else { 1.0 };
    let mut a = true_azimuth + gauss(rng) * sd;
    if !facing && rng.next_f64() < 0.06 {
        a = 2.0 * yaw - a + core::f64::consts::PI;
    }
    a
}

#[cfg(test)]
mod tests {
    use super::*;
    use agent_rng::Mulberry32;

    #[test]
    fn error_spread_and_confusion_rate() {
        let mut r = Mulberry32::new(4);
        let (mut flips, mut ss, n) = (0, 0.0, 20_000);
        for _ in 0..n {
            let a = localize(0.5, 0.0, 7.6, false, &mut r);
            let e = crate::math::wrap_angle(a - 0.5);
            if e.abs() > 0.8 {
                flips += 1;
            } else {
                ss += e * e;
            }
        }
        let rate = flips as f64 / n as f64;
        assert!((rate - 0.06).abs() < 0.008, "rate {rate}");
        let sd = (ss / (n - flips) as f64).sqrt().to_degrees();
        assert!((sd - 7.6).abs() < 0.3, "sd {sd}");
    }
}
