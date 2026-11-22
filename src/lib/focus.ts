export type Cadence = "25/5" | "50/10" | "flowtime";
export type Phase = "focus" | "break";

const PLANS: Record<"25/5" | "50/10", { focus: number; brk: number }> = {
  "25/5": { focus: 25 * 60_000, brk: 5 * 60_000 },
  "50/10": { focus: 50 * 60_000, brk: 10 * 60_000 },
};

export type FocusState = { phase: Phase; remainingMs: number; cycle: number };

/** Pomodoro phase for `elapsedMs` since the session began (focus → break, repeating). */
export function pomodoro(cadence: "25/5" | "50/10", elapsedMs: number): FocusState {
  const { focus, brk } = PLANS[cadence];
  const len = focus + brk;
  const e = Math.max(0, elapsedMs);
  const cycle = Math.floor(e / len);
  const into = e % len;
  return into < focus
    ? { phase: "focus", remainingMs: focus - into, cycle }
    : { phase: "break", remainingMs: len - into, cycle };
}

/** Flowtime: break length scales with the focus block just completed (≤25% , 5–15 min). */
export function flowtimeBreakMs(focusMs: number): number {
  return Math.min(15 * 60_000, Math.max(5 * 60_000, Math.round(focusMs * 0.2)));
}

export type Velocity = { reviews: number; perMinute: number; accuracy: number };

/** Live session velocity from review log entries (rating >= 3 counts as correct recall). */
export function sessionVelocity(ratings: number[], activeMs: number): Velocity {
  const n = ratings.length;
  const minutes = Math.max(activeMs / 60_000, 1 / 60);
  return {
    reviews: n,
    perMinute: Math.round((n / minutes) * 10) / 10,
    accuracy: n ? Math.round((ratings.filter((r) => r >= 3).length / n) * 100) / 100 : 0,
  };
}
