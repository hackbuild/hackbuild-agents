// Package metadata the standard asks for: every package ships the MIT
// LICENSE (the same text as the repository's), and a package with a Rust
// crate ships the third party notice for the code compiled into its wasm.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "..");
const licence = readFileSync(join(root, "LICENSE"), "utf8");

for (const name of readdirSync(join(root, "packages"), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
  const dir = join(root, "packages", name);
  if (!existsSync(join(dir, "package.json"))) continue;
  test(`${name} ships its licence`, () => {
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    assert.ok(pkg.files.includes("LICENSE"), "files lists LICENSE");
    assert.equal(readFileSync(join(dir, "LICENSE"), "utf8"), licence);
    if (existsSync(join(root, "crates", name))) {
      assert.ok(pkg.files.includes("THIRD-PARTY-NOTICES.txt"), "files lists THIRD-PARTY-NOTICES.txt");
      assert.match(readFileSync(join(dir, "THIRD-PARTY-NOTICES.txt"), "utf8"), /libm[\s\S]*wasm-bindgen/);
    }
  });
}
