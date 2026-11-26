import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { formatReport, reportPasses, runSuite, stallSeconds } from "@hackbuild/scenario";

// a page with the lockstep contract: window.__sim steps whole frames and returns a trace
const file = join(tmpdir(), "walker.html");
writeFileSync(file, `<script>let x = 0, v = 0; const rows = [];
window.__sim = { step(n) { for (let i = 0; i < n; i++) { x += v / 60; rows.push([x, 0]); } }, trace: () => ({ rows }), go() { v = 1; } };</script>`);

// one seeded run of 4 sim seconds, offline, with a stall check on the trace
const report = await runSuite({
  file, mode: "check", offline: true,
  scenarios: [{
    name: "walks", seed: 1, seconds: 4, actions: [{ at: 0.5, js: "h.go()" }],
    checks: (t) => [{ what: "stall", unit: "s", measured: stallSeconds(t.rows as number[][], t.rows.map(() => true), 1 / 60), legal: { max: 1 }, constraint: "set by the walker" }],
  }],
});
console.log(formatReport(report));
process.exitCode = reportPasses(report) ? 0 : 1;
