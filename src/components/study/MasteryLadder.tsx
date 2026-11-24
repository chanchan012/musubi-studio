import { BUCKETS, BUCKET_LABELS, type Bucket } from "@/lib/leitner";

const TONE: Record<Bucket, string> = { new: "bg-line", learning: "bg-seal", consolidating: "bg-ink", board_ready: "bg-sage" };

/** Four-rung mastery ladder: share of cards in each bucket, as a stacked bar plus a legend with counts. */
export function MasteryLadder({ counts }: { counts: Record<Bucket, number> }) {
  const total = BUCKETS.reduce((n, b) => n + counts[b], 0);
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-line" role="img"
        aria-label={BUCKETS.map((b) => `${BUCKET_LABELS[b]} ${counts[b]}`).join(", ")}>
        {total > 0 && BUCKETS.map((b) => counts[b] > 0 && <div key={b} className={TONE[b]} style={{ width: `${(counts[b] / total) * 100}%` }} />)}
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
        {BUCKETS.map((b) => (
          <li key={b} className="flex items-center gap-1.5">
            <span aria-hidden className={`h-2.5 w-2.5 rounded-sm ${TONE[b]}`} />
            <span className="text-muted">{BUCKET_LABELS[b]}</span>
            <span className="ml-auto tabular-nums">{counts[b]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
