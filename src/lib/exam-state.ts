import type { Certainty } from "./cbm";
import type { TrapTag } from "./error-log";

export const NUDGE_MS = 90_000;

export type Answer = {
  choice: number | null; certainty: Certainty | null; eliminated: number[];
  trap: Record<number, TrapTag>; flagged: boolean; ms: number;
};
export type ExamState = { ids: string[]; answers: Record<string, Answer>; index: number; pass: 1 | 2; pass2: string[] };

export const blank = (): Answer => ({ choice: null, certainty: null, eliminated: [], trap: {}, flagged: false, ms: 0 });

export function init(ids: string[]): ExamState {
  return { ids, answers: Object.fromEntries(ids.map((i) => [i, blank()])), index: 0, pass: 1, pass2: [] };
}

export const currentId = (s: ExamState) => (s.pass === 1 ? s.ids : s.pass2)[s.index];

function patch(s: ExamState, id: string, p: Partial<Answer>): ExamState {
  return { ...s, answers: { ...s.answers, [id]: { ...s.answers[id], ...p } } };
}

export function select(s: ExamState, id: string, choice: number): ExamState {
  // Selecting an eliminated option un-strikes it: you cannot both pick and rule out a choice.
  const a = s.answers[id];
  return patch(s, id, { choice, eliminated: a.eliminated.filter((e) => e !== choice) });
}

export function toggleStrike(s: ExamState, id: string, idx: number): ExamState {
  const a = s.answers[id];
  const on = a.eliminated.includes(idx);
  const trap = { ...a.trap };
  if (on) delete trap[idx];
  return patch(s, id, {
    eliminated: on ? a.eliminated.filter((e) => e !== idx) : [...a.eliminated, idx],
    choice: a.choice === idx ? null : a.choice,
    trap,
  });
}

export function setTrap(s: ExamState, id: string, idx: number, tag: TrapTag | null): ExamState {
  const trap = { ...s.answers[id].trap };
  if (tag) trap[idx] = tag; else delete trap[idx];
  return patch(s, id, { trap });
}

export const setCertainty = (s: ExamState, id: string, c: Certainty) => patch(s, id, { certainty: c });
export const toggleFlag = (s: ExamState, id: string) => patch(s, id, { flagged: !s.answers[id].flagged });
export const addTime = (s: ExamState, id: string, ms: number) => patch(s, id, { ms: s.answers[id].ms + ms });
export const isAnswered = (a: Answer) => a.choice !== null && a.certainty !== null;
export const needsNudge = (ms: number) => ms >= NUDGE_MS;

/** Advance: pass 1 walks every question; at the end, flagged-and-unanswered-or-flagged items form pass 2. */
export function next(s: ExamState): { state: ExamState; done: boolean } {
  const list = s.pass === 1 ? s.ids : s.pass2;
  if (s.index < list.length - 1) return { state: { ...s, index: s.index + 1 }, done: false };
  if (s.pass === 1) {
    const pass2 = s.ids.filter((id) => s.answers[id].flagged);
    if (pass2.length) return { state: { ...s, pass: 2, pass2, index: 0 }, done: false };
  }
  return { state: s, done: true };
}

export const progress = (s: ExamState) => ({
  answered: s.ids.filter((id) => isAnswered(s.answers[id])).length,
  flagged: s.ids.filter((id) => s.answers[id].flagged).length,
  total: s.ids.length,
});
