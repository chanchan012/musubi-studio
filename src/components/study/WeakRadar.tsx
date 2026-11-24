type Topic = { topic: string; attempts: number; error_rate: number };

/** Weak-topic radar (inline SVG). With fewer than 3 topics a radar is meaningless, so it falls back to bars only. */
export function WeakRadar({ topics }: { topics: Topic[] }) {
  if (!topics.length) return <p className="text-sm text-muted">No exam attempts yet. Take a mock exam and your weakest topics will show here.</p>;
  const t = topics.slice(0, 8);
  const R = 70, C = 90;
  const pt = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / t.length - Math.PI / 2;
    return [C + Math.cos(a) * R * v, C + Math.sin(a) * R * v] as const;
  };
  const poly = t.map((x, i) => pt(i, Math.max(0.04, x.error_rate)).join(",")).join(" ");
  return (
    <div className="grid gap-4 sm:grid-cols-[180px_1fr] sm:items-center">
      {t.length >= 3 && (
        <svg viewBox="0 0 180 180" className="mx-auto h-44 w-44" role="img" aria-label={`Error rate by topic: ${t.map((x) => `${x.topic} ${Math.round(x.error_rate * 100)}%`).join(", ")}`}>
          {[0.25, 0.5, 0.75, 1].map((r) => (
            <polygon key={r} points={t.map((_, i) => pt(i, r).join(",")).join(" ")} fill="none" stroke="var(--line)" strokeWidth="1" />
          ))}
          {t.map((_, i) => <line key={i} x1={C} y1={C} x2={pt(i, 1)[0]} y2={pt(i, 1)[1]} stroke="var(--line)" />)}
          <polygon points={poly} fill="var(--seal)" fillOpacity="0.22" stroke="var(--seal)" strokeWidth="2" />
          {t.map((x, i) => { const [px, py] = pt(i, Math.max(0.04, x.error_rate)); return <circle key={i} cx={px} cy={py} r="3" fill="var(--seal)" />; })}
        </svg>
      )}
      <ul className="space-y-2">
        {t.map((x) => (
          <li key={x.topic} className="text-sm">
            <div className="flex items-baseline gap-2"><span className="min-w-0 flex-1 truncate">{x.topic}</span><span className="text-xs text-muted tabular-nums">{x.attempts} tried · {Math.round(x.error_rate * 100)}% missed</span></div>
            <div className="mt-1 h-1.5 rounded-full bg-line"><div className="h-full rounded-full bg-seal" style={{ width: `${Math.round(x.error_rate * 100)}%` }} /></div>
          </li>
        ))}
      </ul>
    </div>
  );
}
