const CLOZE = /\{\{c(\d+)::(.*?)(?:::(.*?))?\}\}/g;

export type ClozeSpan = { index: number; answer: string; hint?: string };

export function parseCloze(text: string): ClozeSpan[] {
  return [...text.matchAll(CLOZE)].map((m) => ({ index: Number(m[1]), answer: m[2], hint: m[3] }));
}

export function clozeIndices(text: string): number[] {
  return [...new Set(parseCloze(text).map((s) => s.index))].sort((a, b) => a - b);
}

/** Render one cloze card: hide deletions numbered `active`, show the rest. */
export function renderCloze(text: string, active: number, reveal = false): string {
  return text.replace(CLOZE, (_m, n, answer, hint) =>
    Number(n) !== active || reveal ? answer : `[${hint ?? "…"}]`);
}
