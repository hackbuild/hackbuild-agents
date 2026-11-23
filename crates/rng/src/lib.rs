//! Seeded random numbers and the samplers shared by the senses and drives
//! crates. Mulberry32 gives the same stream in Rust, wasm and the
//! TypeScript `seededRng`, bit for bit. Every transcendental function goes
//! through `libm`, so native and wasm builds agree.
//!
//! "The legacy" in these sources is the earlier dog simulator whose code is
//! public at https://github.com/hackbuild/dog-simulator/tree/main/legacy
//! (MIT parts only); the crate was written for this library from it.
//!
//! The draw order of each sampler matches the legacy organic kernel
//! (`gauss` draws u then v, `ex_gaussian` draws the normal first), so a
//! stream replayed through both gives the same numbers.

use core::f64::consts::PI;

/// A source of uniform numbers in `[0, 1)`.
pub trait Rng {
    fn next_f64(&mut self) -> f64;
}

impl<F: FnMut() -> f64> Rng for F {
    fn next_f64(&mut self) -> f64 {
        self()
    }
}

#[derive(Clone, Debug)]
pub struct Mulberry32 {
    state: u32,
}

impl Mulberry32 {
    pub fn new(seed: u32) -> Self {
        Mulberry32 { state: seed }
    }
    pub fn next_u32(&mut self) -> u32 {
        self.state = self.state.wrapping_add(0x6D2B_79F5);
        let a = self.state;
        let mut t = (a ^ (a >> 15)).wrapping_mul(1 | a);
        t = t.wrapping_add((t ^ (t >> 7)).wrapping_mul(61 | t)) ^ t;
        t ^ (t >> 14)
    }
    pub fn state(&self) -> u32 {
        self.state
    }
}

impl Rng for Mulberry32 {
    fn next_f64(&mut self) -> f64 {
        self.next_u32() as f64 / 4_294_967_296.0
    }
}

/// Uniform in `[a, b)`.
pub fn range<R: Rng + ?Sized>(a: f64, b: f64, rng: &mut R) -> f64 {
    a + rng.next_f64() * (b - a)
}

fn open01<R: Rng + ?Sized>(rng: &mut R) -> f64 {
    loop {
        let u = rng.next_f64();
        if u != 0.0 {
            return u;
        }
    }
}

/// Standard normal by the Box Muller transform (two draws per call).
pub fn gauss<R: Rng + ?Sized>(rng: &mut R) -> f64 {
    let u = open01(rng);
    let v = open01(rng);
    libm::sqrt(-2.0 * libm::log(u)) * libm::cos(2.0 * PI * v)
}

/// Ex-Gaussian reaction time: Normal(mu, sigma) plus Exponential(tau),
/// floored at 0.02 s as in the legacy simulator.
pub fn ex_gaussian<R: Rng + ?Sized>(mu: f64, sigma: f64, tau: f64, rng: &mut R) -> f64 {
    let g = gauss(rng);
    let u = rng.next_f64();
    let x = mu + sigma * g - tau * libm::log(1.0 - u);
    if x > 0.02 { x } else { 0.02 }
}

/// Exponential gap with the given rate (events per second).
pub fn poisson_gap<R: Rng + ?Sized>(rate: f64, rng: &mut R) -> f64 {
    let u = rng.next_f64();
    -libm::log(1.0 - u) / if rate > 1e-6 { rate } else { 1e-6 }
}

/// Lognormal by median and sigma of the log.
pub fn log_normal<R: Rng + ?Sized>(median: f64, sigma: f64, rng: &mut R) -> f64 {
    libm::exp(libm::log(median) + sigma * gauss(rng))
}

/// Ornstein Uhlenbeck process with the exact discrete update.
#[derive(Clone, Debug)]
pub struct Ou {
    pub tau: f64,
    pub sigma: f64,
    pub mu: f64,
    pub x: f64,
}

impl Ou {
    /// Starts at `mu + sigma * N(0, 1) * 0.5`, as the legacy simulator does (one gauss draw).
    pub fn new<R: Rng + ?Sized>(tau: f64, sigma: f64, mu: f64, rng: &mut R) -> Self {
        let x = mu + sigma * gauss(rng) * 0.5;
        Ou { tau, sigma, mu, x }
    }
    pub fn step<R: Rng + ?Sized>(&mut self, dt: f64, rng: &mut R) -> f64 {
        let e = libm::exp(-(1.0 / self.tau) * dt);
        self.x =
            self.mu + (self.x - self.mu) * e + self.sigma * libm::sqrt(1.0 - e * e) * gauss(rng);
        self.x
    }
}

/// A 32 bit seed drawn from any uniform source; how a JavaScript `Rng`
/// seeds a wasm object.
pub fn seed_from<R: Rng + ?Sized>(rng: &mut R) -> u32 {
    (rng.next_f64() * 4_294_967_296.0) as u32
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mulberry_reference_values() {
        // mulberry32(1) reference values, computed with the JavaScript original
        let mut r = Mulberry32::new(1);
        assert_eq!(r.next_u32(), 2_693_262_067);
        assert_eq!(r.next_u32(), 11_749_833);
    }

    #[test]
    fn samplers_stay_in_range() {
        let mut r = Mulberry32::new(9);
        let mut sum = 0.0;
        for _ in 0..20_000 {
            let x = ex_gaussian(0.3, 0.06, 0.3, &mut r);
            assert!(x >= 0.02);
            sum += x;
        }
        // mean of the ex-Gaussian is mu + tau (computed)
        assert!((sum / 20_000.0 - 0.6).abs() < 0.01);
        let mut ou = Ou::new(0.8, 0.3, 0.0, &mut r);
        for _ in 0..1000 {
            assert!(ou.step(1.0 / 60.0, &mut r).is_finite());
        }
    }
}
