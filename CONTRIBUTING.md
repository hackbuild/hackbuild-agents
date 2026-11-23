# Contributing

| rule | what it means |
|---|---|
| authors | people only. The git author of every commit is a person. No AI assistant, model or AI tool is an author, co-author, contributor or credit anywhere: messages, trailers, file headers, CHANGELOG, package metadata. |
| hooks | run `npm ci` once per clone. Its `prepare` script sets `core.hooksPath` to `.githooks`, so the commit-msg and pre-commit hooks run on every commit. Check with `git config core.hooksPath`; never pass `--no-verify`. |
| trailers | none of any kind. No Signed-off-by, Co-Authored-By, Reviewed-by or generated-with lines. The commit-msg hook rejects every `<word>-by:` and `<word>-with:` line, and CI repeats the check. |
| outside PRs | a maintainer squashes the PR and rewrites the message so it passes the hook. Your git author line is kept; that line is the credit. |
| commit subjects | imperative, lowercase, under 60 characters, no trailing punctuation, optional lowercase scope: `memory: merge near duplicate episodes`. |
| licence | inbound equals outbound: code is MIT (LICENSE), README, CHANGELOG and docs are CC-BY-4.0 with code samples also MIT (LICENSES/CC-BY-4.0.txt). No CLA, no DCO sign-off. |
| weights | never commit model weights or owner likeness files. Name each model's weight licence where it is referenced. |
| marks | a contribution grants no right to the hack.build name or logo (TRADEMARKS.md). |

Before you open a PR, run `npm test` and, when `crates/` changed,
`cargo test --workspace`. A harness that did not run is reported as not run.

## Toolchain

| tool | version | how |
|---|---|---|
| Node | 22.18.0 (`.nvmrc`) | `nvm use`, then `npx -y npm@11.21.0 ci` |
| Rust | 1.95.0 with the `wasm32-unknown-unknown` target, clippy and rustfmt | `rust-toolchain.toml`; rustup installs it on first use, or run `rustup toolchain install` |
| wasm-pack | 0.13.1 | `cargo install wasm-pack --version 0.13.1 --locked` |
| Chrome | any current stable | the browser tests find it as `findChrome()` does (`HB_CHROME`, the macOS app, `/usr/bin/google-chrome`); without one they skip |

`tools/build-wasm.mjs` puts `~/.cargo/bin` first on PATH, so the wasm
builds use the rustup toolchain from `rust-toolchain.toml` even when a
Homebrew Rust comes first in your shell. Keep a Homebrew Rust at the
same version, or native `cargo test` and the wasm build can disagree on
lints.
