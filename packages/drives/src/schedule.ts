// Scheduling heavy inference, from lessons of earlier builds: GPU contention is
// invisible to JS profiling, so a model call runs only after a minimum
// interval, optionally only while the agent is idle, and only while recent
// frames are inside a budget; one call at a time, with a busy state the UI
// can show.

export interface ScheduleOptions {
  /** seconds between the starts of two calls (legacy cortex: 25) */
  minInterval: number;
  /** only start while the caller says the agent is idle */
  idleOnly?: boolean;
  /** skip while the smoothed frame time is above this (ms) */
  frameBudgetMs?: number;
  /** smoothing of the frame time, 0 to 1 per frame (default 0.1) */
  smoothing?: number;
}

export type ScheduleState = "busy" | "cooling down" | "waiting for idle" | "over frame budget" | "ready";

export class InferenceScheduler {
  private lastStart = Number.NEGATIVE_INFINITY;
  private running = false;
  private frameMs = 0;
  private frames = 0;
  lastMs = 0;
  calls = 0;
  skipped = 0;
  constructor(readonly opts: ScheduleOptions) {}
  /** Feeds one frame time in ms. */
  frame(ms: number): void {
    const a = this.opts.smoothing ?? 0.1;
    this.frameMs = this.frames++ === 0 ? ms : this.frameMs + (ms - this.frameMs) * a;
  }
  get smoothedFrameMs(): number {
    return this.frameMs;
  }
  get busy(): boolean {
    return this.running;
  }
  state(now: number, idle = true): ScheduleState {
    if (this.running) return "busy";
    if (now - this.lastStart < this.opts.minInterval) return "cooling down";
    if (this.opts.idleOnly && !idle) return "waiting for idle";
    if (this.opts.frameBudgetMs !== undefined && this.frames > 0 && this.frameMs > this.opts.frameBudgetMs) return "over frame budget";
    return "ready";
  }
  /**
   * Runs `fn` when the state is ready; otherwise returns null without
   * calling it. `clock` measures the call in ms (inject performance.now).
   */
  async run<T>(now: number, idle: boolean, fn: () => Promise<T>, clock: () => number = () => 0): Promise<T | null> {
    if (this.state(now, idle) !== "ready") {
      this.skipped++;
      return null;
    }
    this.running = true;
    this.lastStart = now;
    const t0 = clock();
    try {
      return await fn();
    } finally {
      this.lastMs = clock() - t0;
      this.calls++;
      this.running = false;
    }
  }
}
