export type Certainty = 1 | 2 | 3; // C1 guess, C2 moderate, C3 sure
export const CERTAINTY_LABELS: Record<Certainty, string> = { 1: "Low / Guess", 2: "Moderate", 3: "High / Sure" };

/** Implied probability of being right at each certainty level (used for calibration gaps). */
export const CERTAINTY_TARGET: Record<Certainty, number> = { 1: 0.33, 2: 0.67, 3: 0.9 };

/** Classic Gardner-Medley CBM marks: right 1/2/3, wrong 0/-2/-6. */
export function cbmMarks(correct: boolean, certainty: Certainty): number {
  return correct ? certainty : ({ 1: 0, 2: -2, 3: -6 } as const)[certainty];
}

export type Flag = "dangerous_misconception" | "lucky_guess" | null;

export function cbmFlag(correct: boolean, certainty: Certainty): Flag {
  if (!correct && certainty === 3) return "dangerous_misconception";
  if (correct && certainty === 1) return "lucky_guess";
  return null;
}

export type Graded = { correct: boolean; certainty: Certainty };
export type CalibrationRow = { certainty: Certainty; n: number; correct: number; accuracy: number; target: number; gap: number };
export type Calibration = { rows: CalibrationRow[]; marks: number; maxMarks: number; overconfidence: number };

/** Calibration matrix: perceived confidence vs. actual accuracy. gap = accuracy - target (negative = overconfident). */
export function calibration(items: Graded[]): Calibration {
  const rows = ([1, 2, 3] as Certainty[]).map((certainty) => {
    const mine = items.filter((i) => i.certainty === certainty);
    const correct = mine.filter((i) => i.correct).length;
    const accuracy = mine.length ? correct / mine.length : 0;
    const target = CERTAINTY_TARGET[certainty];
    return {
      certainty, n: mine.length, correct,
      accuracy: Math.round(accuracy * 100) / 100, target,
      gap: mine.length ? Math.round((accuracy - target) * 100) / 100 : 0,
    };
  });
  const answered = items.length;
  const meanConfidence = answered ? items.reduce((s, i) => s + CERTAINTY_TARGET[i.certainty], 0) / answered : 0;
  const meanAccuracy = answered ? items.filter((i) => i.correct).length / answered : 0;
  return {
    rows,
    marks: items.reduce((s, i) => s + cbmMarks(i.correct, i.certainty), 0),
    maxMarks: items.length * 3,
    overconfidence: Math.round((meanConfidence - meanAccuracy) * 100) / 100,
  };
}
