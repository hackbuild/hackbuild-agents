// Reports in the check message form of the house rules: what failed,
// measured, legal, constraint, then a fix. "stall 4.75 s, legal 0 to 1,
// set by the passing rule. fix: check the side waypoint".

export interface Check {
  /** what was checked, lowercase: "foot slide", "stall" */
  what: string;
  /** the measured value, or null when the check did not run */
  measured: number | null;
  unit?: string;
  /** the legal range, either bound may be open */
  legal: { min?: number; max?: number };
  /** what sets the bound: "set by the stall detector, 0.2 m in 2 s" */
  constraint: string;
  fix?: string;
  /** where the number comes from (RULES: measured, computed, inferred) */
  kind?: "measured" | "computed" | "inferred";
}

export type Verdict = "pass" | "fail" | "not run";

export function verdict(c: Check): Verdict {
  if (c.measured === null || !Number.isFinite(c.measured)) return "not run";
  if (c.legal.min !== undefined && c.measured < c.legal.min) return "fail";
  if (c.legal.max !== undefined && c.measured > c.legal.max) return "fail";
  return "pass";
}

/** Four significant figures, no trailing zeros. */
const num = (x: number) => String(Number(x.toPrecision(4)));

function legalText(c: Check): string {
  const u = c.unit ? ` ${c.unit}` : "";
  const { min, max } = c.legal;
  if (min !== undefined && max !== undefined) return `${num(min)} to ${num(max)}${u}`;
  if (min !== undefined) return `at least ${num(min)}${u}`;
  if (max !== undefined) return `at most ${num(max)}${u}`;
  return "any";
}

/** One line: "stall 4.75 s, legal at most 1 s, set by the passing rule. fix: ..." */
export function checkMessage(c: Check): string {
  const v = verdict(c);
  if (v === "not run") return `${c.what} not run, legal ${legalText(c)}, ${c.constraint}`;
  const u = c.unit ? ` ${c.unit}` : "";
  const base = `${c.what} ${num(c.measured as number)}${u} (${c.kind ?? "measured"}), legal ${legalText(c)}, ${c.constraint}`;
  return v === "fail" && c.fix ? `${base}. fix: ${c.fix}` : base;
}

export interface ScenarioResult {
  name: string;
  seed: number;
  checks: Check[];
  golden?: "identical" | "differs" | "missing" | "recorded";
  firstDifference?: unknown;
  errors: string[];
  blocked: string[];
}

export interface Report {
  date: string;
  chrome: string;
  results: ScenarioResult[];
}

/** Text report: a line per scenario, then a check message per check. Fails first. */
export function formatReport(r: Report): string {
  const lines = [`scenario report ${r.date}, ${r.chrome}`];
  for (const s of r.results) {
    const vs = s.checks.map(verdict);
    const fails = vs.filter((v) => v === "fail").length;
    const notRun = vs.filter((v) => v === "not run").length;
    const head = `${s.name} (seed ${s.seed}): ` + [fails ? `${fails} failed` : "checks pass", notRun ? `${notRun} not run` : "", s.golden ? `golden ${s.golden}` : "", s.errors.length ? `${s.errors.length} page errors` : "", s.blocked.length ? `${s.blocked.length} blocked requests` : ""]
      .filter(Boolean)
      .join(", ");
    lines.push(head);
    const order = s.checks.map((c, i) => [c, vs[i] as Verdict] as const).sort((a, b) => (a[1] === "fail" ? -1 : 0) - (b[1] === "fail" ? -1 : 0));
    for (const [c, v] of order) lines.push(`  ${v}: ${checkMessage(c)}`);
    for (const e of s.errors) lines.push(`  error: ${e}`);
    for (const b of s.blocked) lines.push(`  blocked: ${b}`);
  }
  return lines.join("\n");
}

/** True when nothing failed, no page error, no blocked request, and every golden matched. */
export function reportPasses(r: Report): boolean {
  return r.results.every((s) => s.errors.length === 0 && s.blocked.length === 0 && (s.golden === undefined || s.golden === "identical" || s.golden === "recorded") && s.checks.every((c) => verdict(c) !== "fail"));
}
