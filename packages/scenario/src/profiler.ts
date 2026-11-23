// A per system frame profiler, from the HACKLE lessons: mark after each
// system in the frame and read the average and worst ms per label. Runs
// in a page or in Node; the clock is injected (performance.now).

export interface ProfileEntry {
  total: number;
  max: number;
  n: number;
}

export interface Profiler {
  /** starts timing the next system */
  begin(): void;
  /** charges the time since the last begin or mark to `label` */
  mark(label: string): void;
  /** average and worst ms per label, worst first */
  report(): { label: string; avg: number; max: number; n: number }[];
  reset(): void;
  entries: Record<string, ProfileEntry>;
}

export function createProfiler(clock: () => number): Profiler {
  const entries: Record<string, ProfileEntry> = {};
  let t = clock();
  return {
    entries,
    begin() {
      t = clock();
    },
    mark(label) {
      const now = clock();
      const d = now - t;
      t = now;
      const e = entries[label] ?? (entries[label] = { total: 0, max: 0, n: 0 });
      e.total += d;
      e.n++;
      if (d > e.max) e.max = d;
    },
    report() {
      return Object.entries(entries)
        .map(([label, e]) => ({ label, avg: e.n ? e.total / e.n : 0, max: e.max, n: e.n }))
        .sort((a, b) => b.max - a.max);
    },
    reset() {
      for (const k of Object.keys(entries)) delete entries[k];
      t = clock();
    },
  };
}
