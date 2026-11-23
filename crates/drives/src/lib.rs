//! Homeostatic drives with drive reduction reward, behaviour choice by
//! softmax with commitment and reactive latencies (every choice returns a
//! why), cue learning with associability, eligibility traces and decaying
//! inhibition, sleep pressure with a body clock and a stage machine, and a
//! memory stream ranked by recency, importance and relevance.
//!
//! "The legacy" in these sources is the earlier dog simulator whose code is
//! public at https://github.com/hackbuild/dog-simulator/tree/main/legacy
//! (MIT parts only); the crate was written for this library from it.
//!
//! Every transcendental function goes through `libm` and every random draw
//! through a seeded Mulberry32, so a native build and a `wasm32` build give
//! bit identical numbers for the same seed.

#![allow(clippy::needless_range_loop, clippy::too_many_arguments)]

pub mod chooser;
pub mod drives;
pub mod golden;
pub mod learn;
pub mod memory;
pub mod sleep;

#[cfg(feature = "wasm")]
mod wasm;

pub use agent_rng::{Mulberry32, Rng};
