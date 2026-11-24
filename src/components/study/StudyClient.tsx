"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { scoreBlurt, type BlurtResult } from "@/lib/blurt";
import { flowtimeBreakMs, pomodoro, sessionVelocity, type Cadence } from "@/lib/focus";
import { blurtTarget, faceOf, type StudyItem } from "@/lib/study-card";
import { RATING_LABELS, type Rating4 } from "@/lib/fsrs";
import type { Bucket } from "@/lib/leitner";
import { MasteryLadder } from "./MasteryLadder";

type Mode = "fsrs" | "blurt" | "interleave" | "feynman" | "dual";
const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "fsrs", label: "Review", hint: "Flip, then rate how well you recalled it." },
  { id: "blurt", label: "Blurt", hint: "Write what you remember before the answer appears." },
  { id: "interleave", label: "Mixed", hint: "Topics shuffled so you learn to tell them apart." },
  { id: "feynman", label: "Feynman", hint: "Explain it in plain words after each card." },
  { id: "dual", label: "Dual coding", hint: "Diagram beside a comparison table." },
];
type Preview = { rating: Rating4; label: string; interval: string };
type QItem = StudyItem & { previews: Preview[] };
type Stats = { total: number; due: number; buckets: Record<Bucket, number> };

const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

export function StudyClient({ deckId, title }: { deckId?: string; title: string }) {
  const [mode, setMode] = useState<Mode>("fsrs");
  const [queue, setQueue] = useState<QItem[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [blurt, setBlurt] = useState("");
  const [blurtRes, setBlurtRes] = useState<BlurtResult | null>(null);
  const [fey, setFey] = useState<{ itemId: string } | null>(null);
  const [feyText, setFeyText] = useState("");
  const [ratings, setRatings] = useState<number[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [diagram, setDiagram] = useState<string | null>(null);
  const [cadence, setCadence] = useState<Cadence>("25/5");
  const [tick, setTick] = useState(() => Date.now());
  const startedAt = useRef(Date.now());
  const shownAt = useRef(Date.now());
  const activeMs = useRef(0);

  const qs = useMemo(() => (deckId ? `deckId=${deckId}&` : ""), [deckId]);

  const load = useCallback(async (m: Mode) => {
    setQueue(null); setIdx(0); setRevealed(false); setBlurt(""); setBlurtRes(null); setError(null);
    const r = await fetch(`/api/study/queue?${qs}mode=${m}&limit=30`);
    if (!r.ok) { setError("Could not load your queue."); setQueue([]); return; }
    setQueue((await r.json()).queue);
    shownAt.current = Date.now();
  }, [qs]);
  const loadStats = useCallback(async () => {
    const r = await fetch(`/api/study/stats?${deckId ? `deckId=${deckId}` : ""}`);
    if (r.ok) setStats(await r.json());
  }, [deckId]);

  useEffect(() => { void load(mode); }, [mode, load]);
  useEffect(() => { void loadStats(); }, [loadStats]);
  useEffect(() => { const t = setInterval(() => setTick(Date.now()), 1000); return () => clearInterval(t); }, []);

  const item = queue?.[idx];
  const face = item ? faceOf(item) : null;

  // dual-coding diagram URL
  useEffect(() => {
    setDiagram(null);
    if (mode !== "dual" || !item?.diagramKey) return;
    let live = true;
    fetch(`/api/uploads/url?key=${encodeURIComponent(item.diagramKey)}`).then((r) => r.json()).then((j) => live && setDiagram(j.url)).catch(() => {});
    return () => { live = false; };
  }, [mode, item?.id, item?.diagramKey]);

  const reveal = useCallback(() => {
    if (!item || revealed) return;
    if (mode === "blurt") setBlurtRes(scoreBlurt(blurt, blurtTarget(item)));
    setRevealed(true);
  }, [item, revealed, mode, blurt]);

  const advance = useCallback(() => {
    setIdx((i) => i + 1); setRevealed(false); setBlurt(""); setBlurtRes(null); setFey(null); setFeyText("");
    shownAt.current = Date.now();
  }, []);

  const rate = useCallback(async (rating: Rating4) => {
    if (!item || busy) return;
    setBusy(true); setError(null);
    const r = await fetch("/api/study/review", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ itemId: item.id, rating }) });
    setBusy(false);
    if (!r.ok) return setError("Could not save that rating. Try again.");
    const j = await r.json();
    activeMs.current += Math.min(Date.now() - shownAt.current, 120_000);
    setRatings((x) => [...x, rating]);
    void loadStats();
    if (mode === "feynman" || j.feynmanPrompt) setFey({ itemId: item.id }); else advance();
  }, [item, busy, mode, advance, loadStats]);

  async function saveFeynman(skip: boolean) {
    if (!fey) return;
    if (!skip && feyText.trim()) {
      const r = await fetch("/api/study/feynman", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ itemId: fey.itemId, body: feyText }) });
      if (!r.ok) return setError("Could not save your explanation.");
    }
    advance();
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey || fey) return;
      if ((e.key === " " || e.key === "Enter") && !revealed && mode !== "blurt") { e.preventDefault(); reveal(); }
      else if (revealed && ["1", "2", "3", "4"].includes(e.key)) void rate(Number(e.key) as Rating4);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revealed, mode, fey, reveal, rate]);

  // focus cadence
  const elapsed = tick - startedAt.current;
  const focus = cadence === "flowtime" ? null : pomodoro(cadence, elapsed);
  const flowBreak = cadence === "flowtime" ? flowtimeBreakMs(activeMs.current) : 0;
  const vel = sessionVelocity(ratings, activeMs.current);
  const done = queue !== null && idx >= queue.length;

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-6">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold"><span aria-hidden className="text-xl text-seal-ink">結</span><span className="sr-only">Musubi dashboard</span></Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs uppercase tracking-widest text-muted">{title}</p>
          <p className="text-sm font-medium tabular-nums">{queue ? (done ? "Queue clear" : `Card ${idx + 1} / ${queue.length}`) : "Loading…"}</p>
        </div>
        <label className="sr-only" htmlFor="cadence">Focus cadence</label>
        <select id="cadence" value={cadence} onChange={(e) => { setCadence(e.target.value as Cadence); startedAt.current = Date.now(); }} className="min-h-10 rounded-lg border border-line bg-card px-2 text-sm">
          <option value="25/5">25/5</option><option value="50/10">50/10</option><option value="flowtime">Flowtime</option>
        </select>
        <p className={`min-w-[3.5rem] rounded-md border px-2 py-1 text-center text-sm font-semibold tabular-nums ${focus?.phase === "break" ? "border-sage text-sage" : "border-line"}`} aria-label={focus ? `${focus.phase} time left` : "Session time"}>
          {focus ? mmss(focus.remainingMs) : mmss(elapsed)}
        </p>
      </header>

      <nav className="flex gap-1 overflow-x-auto border-b border-line px-4 py-2 sm:px-6" aria-label="Study mode">
        {MODES.map((m) => (
          <button key={m.id} onClick={() => setMode(m.id)} aria-pressed={mode === m.id}
            className={`min-h-10 shrink-0 rounded-lg px-3 text-sm ${mode === m.id ? "bg-ink font-medium text-paper" : "hover:bg-card"}`}>{m.label}</button>
        ))}
      </nav>

      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-2xl space-y-4">
          {focus?.phase === "break" && <p role="status" className="rounded-lg border border-sage px-3 py-2 text-sm text-sage">Break time. Step away; your queue will wait.</p>}
          {cadence === "flowtime" && ratings.length >= 10 && <p role="status" className="rounded-lg border border-line px-3 py-2 text-sm text-muted">You have been going a while. A {Math.round(flowBreak / 60000)}-minute break would help.</p>}
          {error && <p role="alert" className="text-sm text-seal-ink">{error}</p>}
          <p className="text-sm text-muted">{MODES.find((m) => m.id === mode)?.hint}</p>

          {queue === null && <p className="text-muted">Loading your queue…</p>}

          {done && (
            <section className="rounded-xl border border-line bg-card p-6 text-center">
              <p className="text-lg font-medium">{queue!.length === 0 ? "Nothing due right now." : "Nice. Queue clear."}</p>
              <p className="mt-1 text-sm text-muted tabular-nums">{vel.reviews} reviewed · {Math.round(vel.accuracy * 100)}% recalled · {vel.perMinute}/min</p>
              <div className="mt-4 flex justify-center gap-2">
                <button onClick={() => void load(mode)} className="min-h-11 rounded-lg border border-line px-4 text-sm">Check again</button>
                <Link href="/dashboard" className="min-h-11 rounded-lg bg-ink px-4 py-3 text-sm font-medium text-paper">Dashboard</Link>
              </div>
            </section>
          )}

          {item && face && !done && (
            <section aria-live="polite" className="space-y-4">
              <article className="rounded-xl border border-line bg-card p-5">
                {item.blueprint && <p className="mb-2 text-[11px] uppercase tracking-widest text-muted">{item.blueprint}</p>}
                <p className="whitespace-pre-wrap break-words text-lg leading-relaxed" data-testid="prompt">{face.prompt}</p>
                {face.options && (
                  <ol className="mt-3 space-y-1.5 text-sm">
                    {face.options.map((o, i) => <li key={i} className="flex gap-2"><span className="text-muted">{"ABCDE"[i]}</span><span className="min-w-0 break-words">{o}</span></li>)}
                  </ol>
                )}
                {mode === "dual" && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {diagram ? <img src={diagram} alt="Diagram for this card" className="max-h-56 w-full rounded-lg border border-line object-contain" /> : <p className="rounded-lg border border-dashed border-line p-3 text-xs text-muted">No diagram on this card.</p>}
                    {item.compareTable ? (
                      <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr>{item.compareTable.headers.map((h) => <th key={h} className="border-b border-line px-2 py-1 font-medium">{h}</th>)}</tr></thead>
                        <tbody>{item.compareTable.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="border-b border-line px-2 py-1">{c}</td>)}</tr>)}</tbody></table></div>
                    ) : <p className="rounded-lg border border-dashed border-line p-3 text-xs text-muted">No comparison table.</p>}
                  </div>
                )}
              </article>

              {mode === "blurt" && !revealed && (
                <div className="space-y-2">
                  <label htmlFor="blurt" className="text-sm font-medium">Write everything you remember</label>
                  <textarea id="blurt" value={blurt} onChange={(e) => setBlurt(e.target.value)} rows={5} className="w-full rounded-lg border border-line bg-card p-3 text-sm outline-none focus:border-ink" />
                </div>
              )}

              {!revealed ? (
                <button onClick={reveal} className="min-h-12 w-full rounded-lg bg-ink px-4 text-sm font-medium text-paper">{mode === "blurt" ? "Check my answer" : "Show answer"} <kbd className="ml-2 text-xs opacity-60">Space</kbd></button>
              ) : (
                <>
                  <article className="rounded-xl border border-sage bg-card p-5" data-testid="answer">
                    <p className="whitespace-pre-wrap break-words text-lg leading-relaxed">{face.answer}</p>
                    {face.extra.map((x, i) => <p key={i} className="mt-2 whitespace-pre-wrap break-words text-sm text-muted">{x}</p>)}
                  </article>
                  {blurtRes && (
                    <p className="text-sm tabular-nums">
                      You recalled {Math.round(blurtRes.coverage * 100)}% of the key terms
                      {blurtRes.missed.length > 0 && <> · missed: <span className="text-seal-ink">{blurtRes.missed.slice(0, 8).join(", ")}</span></>}.
                      Suggested: <strong>{RATING_LABELS[blurtRes.suggested]}</strong>
                    </p>
                  )}
                  {fey ? (
                    <div className="space-y-2">
                      <label htmlFor="fey" className="text-sm font-medium">Explain it like you are teaching a friend: why is this the answer?</label>
                      <textarea id="fey" value={feyText} onChange={(e) => setFeyText(e.target.value)} rows={4} maxLength={2000} className="w-full rounded-lg border border-line bg-card p-3 text-sm outline-none focus:border-ink" />
                      <div className="flex gap-2">
                        <button onClick={() => void saveFeynman(false)} disabled={!feyText.trim()} className="min-h-11 rounded-lg bg-ink px-4 text-sm font-medium text-paper disabled:opacity-40">Save and continue</button>
                        <button onClick={() => void saveFeynman(true)} className="min-h-11 rounded-lg border border-line px-4 text-sm">Skip</button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-2" role="group" aria-label="Rate your recall">
                      {item.previews.map((p) => (
                        <button key={p.rating} disabled={busy} onClick={() => void rate(p.rating)}
                          className={`min-h-14 rounded-lg border px-1 text-sm disabled:opacity-40 ${blurtRes?.suggested === p.rating ? "border-ink bg-card ring-1 ring-ink" : "border-line bg-card"}`}>
                          <span className="block font-medium">{p.label}</span>
                          <span className="block text-xs text-muted tabular-nums">{p.interval}</span>
                          <kbd className="sr-only">Key {p.rating}</kbd>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          <section className="rounded-xl border border-line p-4" aria-label="Session">
            <div className="mb-3 flex items-baseline justify-between text-xs text-muted tabular-nums">
              <span>Mastery{stats ? ` · ${stats.due} due of ${stats.total}` : ""}</span>
              <span>{vel.reviews} done · {Math.round(vel.accuracy * 100)}% recalled · {vel.perMinute}/min</span>
            </div>
            {stats && <MasteryLadder counts={stats.buckets} />}
          </section>
        </div>
      </main>
    </div>
  );
}
