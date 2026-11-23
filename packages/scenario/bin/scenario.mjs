#!/usr/bin/env node
// hb-scenario: runs a scenario list against a built page.
//   hb-scenario record|compare|check --file dist/app.html --list scenarios/list.mjs
//     [--golden scenarios/golden] [--only a,b] [--jobs 2] [--report out.json] [--offline]
// The list module exports `scenarios` and may export `routes` (an array of
// route functions) and `options` (runner options such as api and handle).
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { formatReport, reportPasses, runSuite } from "../dist/index.js";

const argv = process.argv.slice(2);
const mode = argv[0];
const opt = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
if (!["record", "compare", "check"].includes(mode) || !opt("file") || !opt("list")) {
  console.error("usage: hb-scenario record|compare|check --file F --list L [--golden D] [--only a,b] [--jobs n] [--report R] [--offline]");
  process.exit(2);
}
const mod = await import(pathToFileURL(resolve(opt("list"))).href);
const only = opt("only") ? opt("only").split(",") : null;
const scenarios = mod.scenarios.filter((s) => !only || only.includes(s.name));
const t0 = Date.now();
const report = await runSuite({
  ...(mod.options ?? {}),
  file: resolve(opt("file")),
  scenarios,
  mode,
  goldenDir: opt("golden") ? resolve(opt("golden")) : undefined,
  routes: mod.routes ?? [],
  offline: argv.includes("--offline"),
  jobs: Number(opt("jobs", 2)),
  onProgress: (s, w) => console.log(`[${Math.round((Date.now() - t0) / 1000)}s] sim ${s.toFixed(0)} s, wall ${w.toFixed(0)} s`),
});
const { traces, ...plain } = report;
if (opt("report")) writeFileSync(opt("report"), `${JSON.stringify(plain, null, 1)}\n`);
console.log(formatReport(plain));
process.exit(reportPasses(plain) ? 0 : 1);
