//! Perception for simulated animals: Itti Koch saliency with world space
//! inhibition of return, looming time to contact, an odour plume and ground
//! trail with a tracking state machine, sound localisation error, geometric
//! field of view vision with percept memory, and an occupancy grid built
//! from eye depth renders.
//!
//! "The legacy" in these sources is the earlier dog simulator whose code is
//! public at https://github.com/hackbuild/dog-simulator/tree/main/legacy
//! (MIT parts only); the crate was written for this library from it.
//!
//! Every transcendental function goes through `libm` and every random draw
//! through a seeded Mulberry32, so a native build and a `wasm32` build give
//! bit identical numbers for the same seed (`tests/golden.rs` and the
//! TypeScript package test check this).

#![allow(clippy::needless_range_loop, clippy::too_many_arguments)]

pub mod golden;
pub mod hearing;
pub mod loom;
pub mod math;
pub mod occupancy;
pub mod odour;
pub mod saliency;
pub mod vision;

#[cfg(feature = "wasm")]
mod wasm;

pub use agent_rng::{Mulberry32, Rng};
pub use math::{Camera, Vec3};
