// Task gating, from the HACKLE lessons: completion flags go stale when a
// step reads a flag left over from the previous goal (the human sat
// backwards because the turn step read motor.done from the walk), and a
// task started while a blocking layer was held froze the body (seated,
// crouched, holding). These helpers make both mistakes hard to write.

/** A completion flag bound to the goal it was raised for. */
export class Completion<G = string> {
  private goal: G | null = null;
  private done = false;
  private started = 0;
  /** A new goal: the flag resets. Returns true when the goal changed. */
  begin(goal: G, now: number): boolean {
    if (this.goal === goal) return false;
    this.goal = goal;
    this.done = false;
    this.started = now;
    return true;
  }
  /** Marks done only for the goal that is current; a late report for an old goal is dropped. */
  report(goal: G): boolean {
    if (this.goal !== goal) return false;
    this.done = true;
    return true;
  }
  isDone(goal: G): boolean {
    return this.goal === goal && this.done;
  }
  get current(): G | null {
    return this.goal;
  }
  elapsed(now: number): number {
    return now - this.started;
  }
}

export interface SettleCheck {
  /** remaining error, for a turn the heading error in rad */
  error: number;
  /** current rate, for a turn the angular speed in rad/s */
  rate: number;
  /** seconds since the step began */
  elapsed: number;
  /** give up after this many seconds (default 3) */
  timeout?: number;
  /** defaults from the lesson: 0.12 rad and 0.4 rad/s */
  maxError?: number;
  maxRate?: number;
}

/** Checks the real condition with a timeout, in place of a flag. */
export function settled(c: SettleCheck): { done: boolean; timedOut: boolean } {
  const ok = Math.abs(c.error) < (c.maxError ?? 0.12) && Math.abs(c.rate) < (c.maxRate ?? 0.4);
  const timedOut = !ok && c.elapsed > (c.timeout ?? 3);
  return { done: ok || timedOut, timedOut };
}

/**
 * Blocking layers (seated, crouched, holding). A task declares the layers
 * it needs; starting it releases every held layer it does not need, and
 * reports which, so the body can stand up or put things down first.
 */
export class LayerGate<L extends string> {
  private held = new Set<L>();
  private task: string | null = null;
  private needs = new Set<L>();
  hold(layer: L): void {
    this.held.add(layer);
  }
  release(layer: L): void {
    this.held.delete(layer);
  }
  holding(layer: L): boolean {
    return this.held.has(layer);
  }
  get layers(): L[] {
    return [...this.held];
  }
  get currentTask(): string | null {
    return this.task;
  }
  /** Starts a task; returns the layers released, in the order they were held. */
  startTask(name: string, needs: readonly L[] = []): L[] {
    this.task = name;
    this.needs = new Set(needs);
    const released = [...this.held].filter((l) => !this.needs.has(l));
    for (const l of released) this.held.delete(l);
    return released;
  }
  /** Layers the current task needs and does not hold yet. */
  missing(): L[] {
    return [...this.needs].filter((l) => !this.held.has(l));
  }
}
