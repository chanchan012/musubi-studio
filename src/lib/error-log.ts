export const ROOT_CAUSES = ["knowledge_gap", "misread_stem", "premature_closure", "calculation_error"] as const;
export type RootCause = (typeof ROOT_CAUSES)[number];
export const ROOT_CAUSE_LABELS: Record<RootCause, string> = {
  knowledge_gap: "Knowledge gap", misread_stem: "Misread stem",
  premature_closure: "Premature closure", calculation_error: "Calculation / unit error",
};

export const TRAP_TAGS = ["extreme_wording", "true_statement_wrong_question", "opposite_pair", "unit_scale_trap"] as const;
export type TrapTag = (typeof TRAP_TAGS)[number];
export const TRAP_LABELS: Record<TrapTag, string> = {
  extreme_wording: "Extreme wording", true_statement_wrong_question: "True statement / wrong question",
  opposite_pair: "Opposite pair", unit_scale_trap: "Unit / scale trap",
};

const DAY = 86_400_000;

/** Day 1 / Day 3 / Day 7 re-test dates after a miss. */
export function redrillSchedule(from: Date): string[] {
  return [1, 3, 7].map((d) => new Date(from.getTime() + d * DAY).toISOString());
}

/** An attempt is logged when the item was missed or answered with low certainty. */
export function shouldLog(correct: boolean, certainty: Certainty3): boolean {
  return !correct || certainty === 1;
}
type Certainty3 = 1 | 2 | 3;

/** A re-drill is due when a scheduled date has passed and no attempt happened since that date. */
export function isRedrillDue(redrillAt: string[] | null, lastAttempt: Date | null, now = new Date()): boolean {
  for (const iso of redrillAt ?? []) {
    const at = new Date(iso);
    if (at <= now && (!lastAttempt || lastAttempt < at)) return true;
  }
  return false;
}
