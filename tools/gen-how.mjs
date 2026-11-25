// gen-how: writes the skeleton of packages/<name>/how.ts, the one source of
// the "how this works" fold (design D8). The package page and the suite
// both render it. From package.json and the README it takes the name, the
// one line of what the package is, the install lines, the first code block
// under "## Use" and the links; the "how" paragraphs start as the README
// intro and are rewritten by hand. An existing how.ts is left alone unless
// --force is passed. The shape is tools/how.d.ts (HowDoc), the same file in
// the three library repos; `tsc -p tsconfig.how.json` checks every how.ts.
// Usage: node tools/gen-how.mjs [--force] [name ...]
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const SITE = "https://hackbuild.github.io/hackbuild-agents/";
const REPO = "https://github.com/hackbuild/hackbuild-agents";
const args = process.argv.slice(2);
const force = args.includes("--force");
const only = args.filter((a) => !a.startsWith("--"));
const pkgs = readdirSync(join(root, "packages")).filter((n) => existsSync(join(root, "packages", n, "package.json")));
const pages = new Set(JSON.parse(readFileSync(join(root, "examples", "pages.json"), "utf8")).pages.map((p) => p.name));

const str = (s) => JSON.stringify(s);
// a template literal keeps the code sample readable in the file
const tpl = (s) => "`" + s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${") + "`";

function skeleton(name) {
  const dir = join(root, "packages", name);
  const pj = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  const md = readFileSync(join(dir, "README.md"), "utf8");
  const intro = md.split(/\n\n/)[1]?.replace(/\s*\n\s*/g, " ").trim() ?? "";
  const use = md.split(/^## Use\s*$/m)[1] ?? "";
  const code = /```(\w*)\n([\s\S]*?)```/.exec(use);
  return `// how this works: the fold of the package page and of the suite tool. Plain data, no imports;
// checked by tsconfig.how.json, shipped in the tarball, never imported by the runtime entry.
const how: HowDoc = {
  packages: [${str(pj.name)}],
  what: ${str(pj.description.toLowerCase())},
  how: [
    ${str(intro)},
  ],
  install: ${str(`npm install ${pj.name}`)},
  today: ${tpl(`git clone ${REPO}\ncd hackbuild-agents && npm ci && npm run build -w ${pj.name}`)},
  lang: ${str(code?.[1] || "ts")},
  code: ${tpl((code?.[2] ?? "").trimEnd())},
  links: { page: ${str(SITE + name + "/")}, source: ${str(`${REPO}/tree/main/packages/${name}`)} },
};
export default how;
`;


let wrote = 0;
for (const name of only.length ? only : pkgs) {
  const file = join(root, "packages", name, "how.ts");
  if (existsSync(file) && !force) continue;
  writeFileSync(file, skeleton(name));
  wrote++;
}

console.log(`gen-how: ${wrote} how.ts written; ${pkgs.filter((n) => !pages.has(n)).length} packages have no demo page and get a fold only page from tools/build-pages.mjs`);
