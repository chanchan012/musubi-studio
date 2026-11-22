import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card, type Grade } from "ts-fsrs";

export const DEFAULT_RETENTION = 0.9; // board-exam default
export type Rating4 = 1 | 2 | 3 | 4; // Again, Hard, Good, Easy
export const RATING_LABELS: Record<Rating4, string> = { 1: "Again", 2: "Hard", 3: "Good", 4: "Easy" };

/** Row shape of `review_states` (minus ids). */
export type ReviewRow = {
  due: Date; stability: number; difficulty: number; elapsedDays: number; scheduledDays: number;
  learningSteps: number; reps: number; lapses: number; state: number; lastReview: Date | null;
};

export function clampRetention(r: number | undefined): number {
  if (r === undefined || Number.isNaN(r)) return DEFAULT_RETENTION;
  return Math.min(0.97, Math.max(0.7, r));
}

export function scheduler(retention = DEFAULT_RETENTION) {
  // Fuzz off: deterministic previews that always match what is stored after rating.
  return fsrs(generatorParameters({ request_retention: clampRetention(retention), enable_fuzz: false }));
}

export function rowToCard(row: ReviewRow | null, now = new Date()): Card {
  if (!row || row.reps === 0 && row.state === State.New) return createEmptyCard(now);
  return {
    due: row.due, stability: row.stability, difficulty: row.difficulty,
    elapsed_days: row.elapsedDays, scheduled_days: row.scheduledDays, learning_steps: row.learningSteps,
    reps: row.reps, lapses: row.lapses, state: row.state as State, last_review: row.lastReview ?? undefined,
  } as Card;
}

export function cardToRow(card: Card): ReviewRow {
  return {
    due: card.due, stability: card.stability, difficulty: card.difficulty,
    elapsedDays: (card as { elapsed_days?: number }).elapsed_days ?? 0, scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps, reps: card.reps, lapses: card.lapses, state: card.state,
    lastReview: card.last_review ?? null,
  };
}

export function formatInterval(from: Date, to: Date): string {
  const s = Math.max(0, Math.round((to.getTime() - from.getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d`;
  const mo = d / 30.4375;
  if (mo < 12) return `${Math.round(mo * 10) / 10}mo`;
  return `${Math.round((d / 365.25) * 10) / 10}y`;
}

export type Preview = { rating: Rating4; label: string; due: Date; interval: string };

/** Exact next-interval preview for all four rating buttons. */
export function previews(row: ReviewRow | null, now = new Date(), retention = DEFAULT_RETENTION): Preview[] {
  const rec = scheduler(retention).repeat(rowToCard(row, now), now);
  return ([1, 2, 3, 4] as Rating4[]).map((rating) => {
    const due = rec[rating as Grade].card.due;
    return { rating, label: RATING_LABELS[rating], due, interval: formatInterval(now, due) };
  });
}

export function review(row: ReviewRow | null, rating: Rating4, now = new Date(), retention = DEFAULT_RETENTION): ReviewRow {
  const { card } = scheduler(retention).next(rowToCard(row, now), now, rating as Grade);
  return cardToRow(card);
}

/** Probability of recall right now (0..1); 0 for unseen cards. */
export function retrievability(row: ReviewRow | null, now = new Date(), retention = DEFAULT_RETENTION): number {
  if (!row || row.reps === 0) return 0;
  const r = scheduler(retention).retrievability(rowToCard(row, now), now);
  return typeof r === "number" ? r : parseFloat(String(r)) / 100;
}

/** Re-export so callers never import ts-fsrs enums directly. */
export { Rating, State };
