import { State } from "ts-fsrs";
import type { ReviewRow } from "./fsrs";

export type Bucket = "new" | "learning" | "consolidating" | "board_ready";
export const BUCKETS: Bucket[] = ["new", "learning", "consolidating", "board_ready"];
export const BUCKET_LABELS: Record<Bucket, string> = {
  new: "New", learning: "Learning", consolidating: "Consolidating", board_ready: "Board-Ready",
};

/** Visual mastery ladder derived from FSRS memory stability (days). */
export function leitnerBucket(row: ReviewRow | null): Bucket {
  if (!row || row.reps === 0 || row.state === State.New) return "new";
  if (row.state === State.Learning || row.state === State.Relearning || row.stability < 7) return "learning";
  if (row.stability < 21) return "consolidating";
  return "board_ready";
}

export function bucketCounts(rows: (ReviewRow | null)[]): Record<Bucket, number> {
  const out: Record<Bucket, number> = { new: 0, learning: 0, consolidating: 0, board_ready: 0 };
  for (const r of rows) out[leitnerBucket(r)]++;
  return out;
}
