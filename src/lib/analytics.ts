/** Classical test-theory item analytics for community MCQs. Pure functions, no I/O. */

export const MIN_ATTEMPTS = 20; // below this a distractor rate is noise
export const NON_FUNCTIONING = 0.05; // a distractor chosen by <5% of examinees isn't doing its job

export type DistractorRow = { idx: number; picks: number; rate: number; isKey: boolean; nonFunctioning: boolean };

/** P-value = proportion answering correctly (item difficulty). null until anyone has attempted it. */
export function pValue(correct: number, attempts: number): number | null {
  return attempts > 0 ? correct / attempts : null;
}

export function difficultyBand(p: number | null): "untested" | "hard" | "moderate" | "easy" {
  if (p === null) return "untested";
  if (p < 0.3) return "hard";
  if (p > 0.85) return "easy";
  return "moderate";
}

export function distractorRates(optionCounts: number[] | null, answerIdx: number | null, attempts: number): DistractorRow[] {
  const counts = optionCounts ?? [];
  const total = attempts > 0 ? attempts : counts.reduce((a, b) => a + b, 0);
  return counts.map((picks, idx) => {
    const isKey = idx === answerIdx;
    const rate = total > 0 ? picks / total : 0;
    return { idx, picks, rate, isKey, nonFunctioning: !isKey && total >= MIN_ATTEMPTS && rate < NON_FUNCTIONING };
  });
}

/** Rebuild per-option pick counts from raw (choice, n) groups. */
export function countsFromGroups(groups: { choice: number | null; n: number }[], optionCount: number): number[] {
  const out = Array<number>(optionCount).fill(0);
  for (const g of groups) if (g.choice !== null && g.choice >= 0 && g.choice < optionCount) out[g.choice] += g.n;
  return out;
}

export const VERIFY = { attempts: 30, score: 3 } as const;

/** A community deck earns the Verified badge once it has real usage, positive reception and no open errata. */
export function isVerified(s: { attempts: number; score: number; openErrata: number }): boolean {
  return s.attempts >= VERIFY.attempts && s.score >= VERIFY.score && s.openErrata === 0;
}

// ---- exports ----
export type ExportItem = {
  kind: "card" | "mcq"; front?: string | null; back?: string | null; cloze?: string | null; stem?: string | null;
  options?: string[] | null; answerIdx?: number | null; rationaleKey?: string | null; blueprint?: string | null;
  difficulty?: string | null; mnemonic?: string | null; pearl?: string | null; citation?: string | null;
};

const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(items: ExportItem[]): string {
  const head = ["kind", "front_or_stem", "back_or_answer", "options", "answer", "rationale", "blueprint", "difficulty", "citation"];
  const rows = items.map((i) => [
    i.kind, i.kind === "mcq" ? i.stem : i.front,
    i.kind === "mcq" ? (i.options?.[i.answerIdx ?? -1] ?? "") : i.back,
    (i.options ?? []).join(" | "), i.answerIdx == null ? "" : "ABCDE"[i.answerIdx] ?? "", i.rationaleKey, i.blueprint, i.difficulty, i.citation,
  ]);
  return [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
}

export function toJson(items: ExportItem[]): string {
  return JSON.stringify({ format: "musubi-deck", version: 1, items }, null, 2);
}

const tsvCell = (v: unknown) => String(v ?? "").replace(/[\t\r\n]+/g, " ").trim();

/** Anki "Basic" notes: Front<TAB>Back<TAB>Tags. MCQs fold options into the front and the rationale into the back. */
export function toAnkiTsv(items: ExportItem[]): string {
  return items.map((i) => {
    let front: string, back: string;
    if (i.kind === "mcq") {
      front = `${tsvCell(i.stem)}<br>${(i.options ?? []).map((o, n) => `${"ABCDE"[n]}. ${tsvCell(o)}`).join("<br>")}`;
      back = `${"ABCDE"[i.answerIdx ?? 0]}. ${tsvCell(i.options?.[i.answerIdx ?? 0])}${i.rationaleKey ? `<br>${tsvCell(i.rationaleKey)}` : ""}`;
    } else {
      front = tsvCell(i.cloze || i.front);
      back = [tsvCell(i.back), i.mnemonic ? `Mnemonic: ${tsvCell(i.mnemonic)}` : "", i.pearl ? `Pearl: ${tsvCell(i.pearl)}` : ""].filter(Boolean).join("<br>");
    }
    const tags = [i.blueprint, i.difficulty].filter(Boolean).map((t) => String(t).replace(/\s+/g, "_")).join(" ");
    return `${front}\t${back}\t${tags}`;
  }).join("\n") + "\n";
}

export const EXPORT_FORMATS = { csv: { ext: "csv", mime: "text/csv" }, json: { ext: "json", mime: "application/json" }, anki: { ext: "tsv", mime: "text/tab-separated-values" } } as const;
export type ExportFormat = keyof typeof EXPORT_FORMATS;
export function render(format: ExportFormat, items: ExportItem[]) {
  return format === "csv" ? toCsv(items) : format === "json" ? toJson(items) : toAnkiTsv(items);
}
