// build-package: wasm (when the package has a crate), tsc, a copy of the wasm
// glue into dist/wasm, and a single file IIFE bundle with the wasm inlined
// for pages opened from file://.
// With --esm (Node packages) the single file is an ES module,
// dist/<name>.bundle.mjs, with node: builtins and peers left external.
// Usage: node tools/build-package.mjs <package-name> [GlobalName] [--esm]
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { build } from "rolldown";

const esm = process.argv.includes("--esm");
const [name, globalName] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (!name) {
  console.error("usage: node tools/build-package.mjs <package-name> [GlobalName]");
  process.exit(2);
}
const root = resolve(import.meta.dirname, "..");
const pkg = join(root, "packages", name);
const step = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd: root });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
if (existsSync(join(root, "crates", name))) step("node", ["tools/build-wasm.mjs", name]);
step("npx", ["tsc", "-p", join(pkg, "tsconfig.json")]);
if (existsSync(join(pkg, "src", "wasm"))) cpSync(join(pkg, "src", "wasm"), join(pkg, "dist", "wasm"), { recursive: true });
const global = globalName ?? `Hackbuild${name.replace(/(^|-)(\w)/g, (_, _d, c) => c.toUpperCase())}`;
const peers = Object.keys(JSON.parse(readFileSync(join(pkg, "package.json"), "utf8")).peerDependencies ?? {});
// src/single.ts is the main single file; each src/single-<part>.ts adds
// dist/<name>-<part>.iife.js defining <Global><Part>, so a part that needs
// a page global (the three.js eye) never stops the core from loading
const entries = [["single.ts", ""], ...readdirSync(join(pkg, "src")).flatMap((f) => (/^single-[a-z]+\.ts$/.test(f) && !esm ? [[f, f.slice(7, -3)]] : []))];
for (const [entry, part] of entries) {
  const file = join(pkg, "dist", esm ? `${name}.bundle.mjs` : `${name}${part ? `-${part}` : ""}.iife.js`);
  const g = part ? `${global}${part[0].toUpperCase()}${part.slice(1)}` : global;
  await build({
    input: join(pkg, "src", entry),
    external: esm ? (id) => id.startsWith("node:") || peers.some((p) => id === p || id.startsWith(`${p}/`)) : ["three"],
    platform: esm ? "node" : "browser",
    output: esm ? { file, format: "esm", codeSplitting: false } : { file, format: "iife", name: g, globals: { three: "THREE" }, codeSplitting: false },
    transform: esm ? {} : { define: { "import.meta": "{}" } },
    logLevel: "warn",
  });
  const size = statSync(file).size;
  const gz = gzipSync(readFileSync(file), { level: 9 }).length;
  console.log(`build-package: ${file.split("/").pop()} ${size} bytes, ${gz} gzip (measured)`);
}
