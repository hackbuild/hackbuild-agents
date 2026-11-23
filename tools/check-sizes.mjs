#!/usr/bin/env node
// Size gate: every row of a package README's "Size budget" table is
// compared with the built file in dist/ (or dist/wasm/). A row more than
// 2 percent off the build fails, so the tables cannot drift, and a file
// over the budget the README states fails. Run after `npm run build`.
//   node tools/check-sizes.mjs          check
//   node tools/check-sizes.mjs --write  rewrite the tables from the build
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const root = resolve(import.meta.dirname, "..");
const write = process.argv.includes("--write");
const fmt = (n) => n.toLocaleString("en-US");
const ROW = /^\| `([^`]+)`([^|]*)\| ([\d,]+) bytes \| ([\d,]+) bytes \|$/;
let fails = 0;
let rows = 0;
for (const name of readdirSync(join(root, "packages"))) {
  const readme = join(root, "packages", name, "README.md");
  if (!existsSync(readme)) continue;
  const text = readFileSync(readme, "utf8");
  const section = text.split("## Size budget")[1]?.split("\n## ")[0];
  if (!section) continue;
  // "Budget: wasm under 128 KB raw" or "Budget: under 16 KB raw"
  const b = /Budget: (wasm )?under (\d+) KB raw/.exec(section);
  let out = text;
  for (const line of section.split("\n")) {
    const m = ROW.exec(line);
    if (!m) continue;
    rows++;
    const [, file, note, raw] = m;
    const path = [join(root, "packages", name, "dist", file), join(root, "packages", name, "dist", "wasm", file)].find(existsSync);
    if (!path) {
      console.error(`${name}: ${file} not built, run npm run build first`);
      fails++;
      continue;
    }
    const size = statSync(path).size;
    const gz = gzipSync(readFileSync(path), { level: 9 }).length;
    const stated = Number(raw.replace(/,/g, ""));
    if (write) out = out.replace(line, `| \`${file}\`${note}| ${fmt(size)} bytes | ${fmt(gz)} bytes |`);
    else if (Math.abs(size - stated) / size > 0.02) {
      console.error(`${name}: ${file} is ${fmt(size)} bytes, the README says ${raw}, legal within 2 percent. fix: node tools/check-sizes.mjs --write`);
      fails++;
    }
    if (b && (!b[1] || file.endsWith(".wasm")) && size > Number(b[2]) * 1024) {
      console.error(`${name}: ${file} is ${fmt(size)} bytes, over the ${b[2]} KB budget the README states`);
      fails++;
    }
  }
  if (write && out !== text) writeFileSync(readme, out);
}
console.log(`check-sizes: ${rows} rows, ${fails} failures${write ? " (tables rewritten from the build)" : ""}`);
process.exitCode = fails ? 1 : 0;
