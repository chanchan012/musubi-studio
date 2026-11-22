"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CERTAINTY_LABELS, type Certainty } from "@/lib/cbm";
import { ROOT_CAUSES, ROOT_CAUSE_LABELS, TRAP_LABELS, TRAP_TAGS, type RootCause } from "@/lib/error-log";
import * as S from "@/lib/exam-state";
import type { ExamQuestion, ExamResult, SubmitAnswer } from "@/lib/exam-types";
import { CalibrationMatrix } from "./CalibrationMatrix";

const LETTERS = ["A", "B", "C", "D", "E"];
const fmt = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

type Props = {
  title: string;
  questions: ExamQuestion[];
  submit: (answers: SubmitAnswer[]) => Promise<ExamResult>;
  onTagCause?: (itemId: string, cause: RootCause) => void | Promise<void>;
  /** Embedded = no viewport lock (landing page sandbox). */
  embedded?: boolean;
};

export function ExamRunner({ title, questions, submit, onTagCause, embedded }: Props) {
  const [state, setState] = useState(() => S.init(questions.map((q) => q.id)));
  const [cursor, setCursor] = useState(0);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagged, setTagged] = useState<Record<string, RootCause>>({});
  const [now, setNow] = useState(() => Date.now());
  const enteredAt = useRef(Date.now());
  const qById = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);

  const id = S.currentId(state);
  const q = qById.get(id);
  const a = state.answers[id];
  const list = state.pass === 1 ? state.ids : state.pass2;
  const prog = S.progress(state);
  const elapsed = (a?.ms ?? 0) + Math.max(0, now - enteredAt.current);
  const nudge = S.needsNudge(elapsed);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  /** Bank the time spent on the current question, then run a transition. */
  const leave = useCallback((fn: (s: S.ExamState) => S.ExamState) => {
    const spent = Date.now() - enteredAt.current;
    enteredAt.current = Date.now();
    setCursor(0);
    setState((s) => fn(S.addTime(s, S.currentId(s), spent)));
  }, []);

  const finish = useCallback(async (s: S.ExamState) => {
    setBusy(true); setError(null);
    const spent = Date.now() - enteredAt.current;
    const final = S.addTime(s, S.currentId(s), spent);
    const payload: SubmitAnswer[] = final.ids.map((qid) => {
      const x = final.answers[qid];
      return { itemId: qid, choice: x.choice, certainty: x.certainty, ms: x.ms, eliminated: x.eliminated, trap: x.trap };
    });
    try { setResult(await submit(payload)); }
    catch { setError("Could not submit. Your answers are still here — try again."); }
    finally { setBusy(false); }
  }, [submit]);

  const advance = useCallback(() => {
    const { state: ns, done } = S.next(state);
    if (done) { void finish(state); return; }
    leave(() => ns);
  }, [state, finish, leave]);

  const markAndMove = () => {
    const flagged = a.flagged ? state : S.toggleFlag(state, id);
    const { state: ns, done } = S.next(flagged);
    if (done) { void finish(flagged); return; }
    leave(() => ns);
  };

  // keyboard: A–E choose, X strike cursor option, 1–3 certainty, F flag, Enter next
  useEffect(() => {
    if (result || !q) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      const n = q.options.length;
      const letter = LETTERS.findIndex((l) => l.toLowerCase() === k);
      if (letter >= 0 && letter < n) { setCursor(letter); setState((s) => S.select(s, id, letter)); }
      else if (k === "x") setState((s) => S.toggleStrike(s, id, cursor));
      else if (k === "arrowdown") { e.preventDefault(); setCursor((c) => Math.min(n - 1, c + 1)); }
      else if (k === "arrowup") { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
      else if (k === "1" || k === "2" || k === "3") setState((s) => S.setCertainty(s, id, Number(k) as Certainty));
      else if (k === "f") setState((s) => S.toggleFlag(s, id));
      else if (k === "enter" && S.isAnswered(a)) advance();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [result, q, id, cursor, a, advance]);

  const shell = embedded ? "flex flex-col" : "flex h-dvh w-full flex-col overflow-hidden";

  if (result) {
    return (
      <div className={shell}>
        <Results title={title} result={result} qById={qById} tagged={tagged}
          onTag={async (qid, cause) => { setTagged((t) => ({ ...t, [qid]: cause })); await onTagCause?.(qid, cause); }}
          embedded={embedded} />
      </div>
    );
  }
  if (!q || !a) return <p className="p-6 text-muted">No questions in this exam.</p>;

  const answered = S.isAnswered(a);
  const isLast = state.index === list.length - 1 && (state.pass === 2 || !state.ids.some((x) => state.answers[x].flagged));

  return (
    <div className={shell}>
      <header className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs uppercase tracking-widest text-muted">{title}</p>
          <p className="text-sm font-medium tabular-nums">
            Question {state.index + 1} / {list.length}
            <span className="ml-2 rounded-sm border border-line px-1.5 py-0.5 text-[11px] text-muted">Pass {state.pass}</span>
          </p>
        </div>
        <p className="text-xs text-muted tabular-nums" aria-label="Answered">{prog.answered}/{prog.total} answered · {prog.flagged} flagged</p>
        <p aria-live="off" data-testid="stopwatch" className={`min-w-[3.5rem] rounded-md border px-2 py-1 text-center text-lg font-semibold tabular-nums ${nudge ? "border-seal text-seal" : "border-line"}`}>
          {fmt(elapsed)}
        </p>
      </header>

      {nudge && (
        <div role="status" className="flex items-center gap-3 border-b border-seal/40 bg-seal/10 px-4 py-2 text-sm sm:px-6">
          <span className="font-medium text-seal">90 seconds on this one.</span>
          <span className="flex-1 text-muted">Flag it for Pass 2 and keep your pace.</span>
          <button onClick={markAndMove} className="rounded-md bg-seal px-3 py-1 text-sm font-medium text-white">Mark &amp; move</button>
        </div>
      )}

      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-2xl">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted">
            {q.blueprint && <span className="rounded-sm bg-card px-2 py-0.5 ring-1 ring-line">{q.blueprint}</span>}
            {q.difficulty && <span className="rounded-sm bg-card px-2 py-0.5 capitalize ring-1 ring-line">{q.difficulty}</span>}
            {a.flagged && <span className="rounded-sm bg-seal/10 px-2 py-0.5 text-seal ring-1 ring-seal/40">Flagged for Pass 2</span>}
          </div>
          <p className="text-lg leading-relaxed">{q.stem}</p>

          <ul className="mt-5 space-y-2" role="radiogroup" aria-label="Answer choices">
            {q.options.map((opt, i) => {
              const struck = a.eliminated.includes(i);
              const picked = a.choice === i;
              return (
                <li key={i}>
                  <div className={`flex items-stretch overflow-hidden rounded-lg border bg-card transition ${picked ? "border-ink ring-1 ring-ink" : "border-line"} ${cursor === i ? "outline outline-1 outline-offset-2 outline-muted/50" : ""}`}>
                    <button
                      role="radio" aria-checked={picked} aria-label={`Option ${LETTERS[i]}${struck ? " (eliminated)" : ""}`}
                      onClick={() => { setCursor(i); setState((s) => S.select(s, id, i)); }}
                      className="flex min-h-12 flex-1 items-center gap-3 px-3 py-2 text-left"
                    >
                      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-sm font-semibold ${picked ? "border-ink bg-ink text-paper" : "border-line"}`}>{LETTERS[i]}</span>
                      <span className={struck ? "text-muted line-through decoration-seal decoration-2" : ""}>{opt}</span>
                    </button>
                    <button
                      onClick={() => { setCursor(i); setState((s) => S.toggleStrike(s, id, i)); }}
                      aria-pressed={struck} aria-label={`Eliminate option ${LETTERS[i]}`} title="Eliminate (X)"
                      className={`w-12 shrink-0 border-l border-line text-sm font-semibold ${struck ? "bg-seal/10 text-seal" : "text-muted"}`}
                    >✕</button>
                  </div>
                  {struck && (
                    <div className="mt-1 flex flex-wrap gap-1.5 pl-1" aria-label={`Why option ${LETTERS[i]} was ruled out`}>
                      {TRAP_TAGS.map((t) => (
                        <button key={t} onClick={() => setState((s) => S.setTrap(s, id, i, a.trap[i] === t ? null : t))}
                          aria-pressed={a.trap[i] === t}
                          className={`rounded-full border px-2 py-0.5 text-[11px] ${a.trap[i] === t ? "border-seal bg-seal/10 text-seal" : "border-line text-muted"}`}>
                          {TRAP_LABELS[t]}
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <fieldset className="mt-6">
            <legend className="mb-2 text-xs uppercase tracking-widest text-muted">How sure are you?</legend>
            <div className="grid grid-cols-3 gap-2">
              {([1, 2, 3] as Certainty[]).map((c) => (
                <button key={c} onClick={() => setState((s) => S.setCertainty(s, id, c))} aria-pressed={a.certainty === c}
                  className={`min-h-12 rounded-lg border px-2 py-2 text-sm ${a.certainty === c ? "border-ink bg-ink text-paper" : "border-line bg-card"}`}>
                  <span className="block font-semibold">C{c}</span>
                  <span className="block text-[11px] opacity-80">{CERTAINTY_LABELS[c]}</span>
                </button>
              ))}
            </div>
          </fieldset>
          {error && <p role="alert" className="mt-4 text-sm text-seal">{error}</p>}
        </div>
      </main>

      <footer className="flex items-center gap-2 border-t border-line bg-paper px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
        <button onClick={() => setState((s) => S.toggleFlag(s, id))} aria-pressed={a.flagged}
          className={`min-h-11 rounded-lg border px-3 text-sm ${a.flagged ? "border-seal text-seal" : "border-line"}`}>⚑ Flag</button>
        <p className="hidden flex-1 text-center text-xs text-muted md:block">A–E choose · X strike · 1–3 certainty · F flag · Enter next</p>
        <span className="flex-1 md:hidden" />
        <button onClick={markAndMove} disabled={busy} className="min-h-11 rounded-lg border border-line px-3 text-sm">Mark &amp; move</button>
        <button onClick={advance} disabled={!answered || busy}
          className="min-h-11 rounded-lg bg-ink px-4 text-sm font-medium text-paper disabled:opacity-40">
          {busy ? "Submitting…" : isLast ? "Submit exam" : "Next"}
        </button>
      </footer>
    </div>
  );
}

function Results({ title, result, qById, tagged, onTag, embedded }: {
  title: string; result: ExamResult; qById: Map<string, ExamQuestion>;
  tagged: Record<string, RootCause>; onTag: (id: string, c: RootCause) => void; embedded?: boolean;
}) {
  const pct = result.answered ? Math.round((result.correct / result.answered) * 100) : 0;
  return (
    <>
      <header className="border-b border-line px-4 py-3 sm:px-6">
        <p className="truncate text-xs uppercase tracking-widest text-muted">{title} · results</p>
      </header>
      <main className={`px-4 py-5 sm:px-6 ${embedded ? "" : "min-h-0 flex-1 overflow-y-auto"}`}>
        <div className="mx-auto max-w-2xl space-y-6">
          <section className="flex items-end gap-6">
            <p className="text-5xl font-semibold tabular-nums" data-testid="score">{result.correct}<span className="text-2xl text-muted">/{result.answered}</span></p>
            <div className="pb-1 text-sm text-muted">
              <p><span className="tabular-nums text-ink">{pct}%</span> correct</p>
              <p>CBM <span className="tabular-nums text-ink">{result.calibration.marks}</span> / {result.calibration.maxMarks}</p>
              {result.skipped.length > 0 && <p>{result.skipped.length} unanswered</p>}
            </div>
          </section>

          <CalibrationMatrix calibration={result.calibration} />

          {result.logged > 0 && (
            <p className="rounded-lg border border-line bg-card px-3 py-2 text-sm">
              {result.logged} item{result.logged > 1 ? "s" : ""} added to your Error Log, queued for Day 1 / 3 / 7 re-tests.
            </p>
          )}

          <ol className="space-y-4">
            {result.results.map((r, n) => {
              const q = qById.get(r.itemId);
              const logged = !r.correct || r.certainty === 1;
              return (
                <li key={r.itemId} className="rounded-lg border border-line bg-card p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold tabular-nums">Q{n + 1}</span>
                    <span className={r.correct ? "text-sage" : "text-seal"}>{r.correct ? "Correct" : "Incorrect"}</span>
                    <span className="text-muted">C{r.certainty} · {r.marks > 0 ? "+" : ""}{r.marks}</span>
                    {r.flag === "dangerous_misconception" && <span className="rounded-sm bg-seal px-1.5 py-0.5 font-medium text-white">Dangerous misconception</span>}
                    {r.flag === "lucky_guess" && <span className="rounded-sm bg-ink px-1.5 py-0.5 font-medium text-paper">Lucky guess</span>}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed">{q?.stem}</p>
                  {r.rationales && (
                    <div className="mt-3 space-y-1 text-sm">
                      <p><span className="font-medium text-sage">Key {r.answerIdx !== null ? LETTERS[r.answerIdx] : ""}:</span> {r.rationales.key}</p>
                      {r.choice !== null && r.choice !== r.answerIdx && r.rationales.options[r.choice] && (
                        <p><span className="font-medium text-seal">Your pick {LETTERS[r.choice]}:</span> {r.rationales.options[r.choice]}</p>
                      )}
                    </div>
                  )}
                  {logged && (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Root cause">
                      <span className="text-xs text-muted">Why?</span>
                      {ROOT_CAUSES.map((c) => (
                        <button key={c} onClick={() => onTag(r.itemId, c)} aria-pressed={tagged[r.itemId] === c}
                          className={`rounded-full border px-2.5 py-1 text-xs ${tagged[r.itemId] === c ? "border-ink bg-ink text-paper" : "border-line"}`}>
                          {ROOT_CAUSE_LABELS[c]}
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </main>
    </>
  );
}
