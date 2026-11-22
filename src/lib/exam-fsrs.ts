import { review, type Rating4, type ReviewRow } from "./fsrs";
import { cbmFlag, type Certainty } from "./cbm";
import { State } from "ts-fsrs";

export const FAST_MS = 45_000;

/** Map an exam attempt to the FSRS rating the learner effectively earned. */
export function examRating(correct: boolean, certainty: Certainty, ms: number): Rating4 {
  if (!correct) return 1;
  if (certainty === 1) return 2; // lucky guess: barely knew it
  if (certainty === 3 && ms <= FAST_MS) return 4;
  return 3;
}

/**
 * Apply an exam attempt to a review row with certainty-based overrides:
 *  - High certainty + wrong ("Dangerous Misconception"): reset stability, relearn in ~10 minutes.
 *  - Low certainty + right ("Lucky Guess"): keep in short-term rotation (due within a day, stability capped).
 */
export function applyExamOutcome(row: ReviewRow | null, correct: boolean, certainty: Certainty, ms: number, now = new Date()): ReviewRow {
  const next = review(row, examRating(correct, certainty, ms), now);
  const flag = cbmFlag(correct, certainty);
  if (flag === "dangerous_misconception") {
    return { ...next, stability: Math.min(next.stability, 0.5), scheduledDays: 0, state: State.Relearning, due: new Date(now.getTime() + 10 * 60_000) };
  }
  if (flag === "lucky_guess") {
    const cap = new Date(now.getTime() + 24 * 3_600_000);
    return { ...next, stability: Math.min(next.stability, 1), due: next.due > cap ? cap : next.due };
  }
  return next;
}
