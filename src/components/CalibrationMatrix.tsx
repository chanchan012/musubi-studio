import type { Calibration } from "@/lib/cbm";

/** Perceived confidence vs. actual accuracy: bar = accuracy, tick = what that certainty level implies. */
export function CalibrationMatrix({ calibration }: { calibration: Calibration }) {
  const over = calibration.overconfidence;
  return (
    <section aria-label="Calibration matrix" data-testid="calibration">
      <h3 className="mb-2 text-xs uppercase tracking-widest text-muted">Calibration</h3>
      <div className="space-y-2">
        {calibration.rows.map((r) => (
          <div key={r.certainty} className="grid grid-cols-[2.5rem_1fr_5.5rem] items-center gap-3 text-sm">
            <span className="font-semibold">C{r.certainty}</span>
            <svg viewBox="0 0 100 10" preserveAspectRatio="none" className="h-3 w-full" role="img"
              aria-label={`C${r.certainty}: ${Math.round(r.accuracy * 100)}% correct, expected about ${Math.round(r.target * 100)}%`}>
              <rect x="0" y="0" width="100" height="10" rx="2" className="fill-line" />
              {r.n > 0 && <rect x="0" y="0" width={r.accuracy * 100} height="10" rx="2" className={r.gap < -0.1 ? "fill-seal" : "fill-sage"} />}
              <rect x={r.target * 100 - 0.5} y="-1" width="1" height="12" className="fill-ink" />
            </svg>
            <span className="text-right tabular-nums text-muted">{r.n ? `${r.correct}/${r.n}` : "—"}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">
        {over > 0.05 ? "You were more sure than your accuracy justified — slow down on C3 answers."
          : over < -0.05 ? "You knew more than you gave yourself credit for — trust your recall."
          : "Your confidence tracks your accuracy well."}
      </p>
    </section>
  );
}
