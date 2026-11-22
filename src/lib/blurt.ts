import type { Rating4 } from "./fsrs";

const STOP = new Set("a an the of to in on for and or is are was were be been it its as at by with from that this these those which who whom into than then so if not no through across via over under between about during after before".split(" "));

export function keywords(text: string): string[] {
  return [...new Set(text.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)))];
}

export type BlurtResult = { recalled: string[]; missed: string[]; coverage: number; suggested: Rating4 };

/** Free-recall scoring: share of the answer's key terms the learner produced before revealing. */
export function scoreBlurt(blurt: string, answer: string): BlurtResult {
  const want = keywords(answer);
  const got = new Set(keywords(blurt));
  const recalled = want.filter((w) => got.has(w));
  const missed = want.filter((w) => !got.has(w));
  const coverage = want.length ? recalled.length / want.length : 0;
  const suggested: Rating4 = coverage < 0.25 ? 1 : coverage < 0.55 ? 2 : coverage < 0.85 ? 3 : 4;
  return { recalled, missed, coverage: Math.round(coverage * 100) / 100, suggested };
}

/** Feynman / elaborative interrogation is prompted for struggled items. */
export function needsFeynman(rating: Rating4, lapses: number): boolean {
  return rating <= 2 || lapses >= 2;
}
