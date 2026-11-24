import { clozeIndices, renderCloze } from "./cloze";

export type StudyItem = {
  id: string; kind: "card" | "mcq"; front: string | null; back: string | null; cloze: string | null; mnemonic: string | null; pearl: string | null;
  diagramKey: string | null; compareTable: { headers: string[]; rows: string[][] } | null;
  stem: string | null; options: string[] | null; answerIdx: number | null; rationales: { key: string; options: string[] } | null; blueprint: string | null;
};

export type Face = { prompt: string; options?: string[]; answer: string; extra: string[] };

const L = "ABCDE";

/** What the learner sees before and after flipping. Cloze cards hide the first deletion; MCQs show options and flip to key + rationale. */
export function faceOf(i: StudyItem): Face {
  if (i.kind === "mcq") {
    const k = i.answerIdx ?? 0;
    return {
      prompt: i.stem ?? "", options: i.options ?? [],
      answer: `${L[k]}. ${i.options?.[k] ?? ""}`,
      extra: [i.rationales?.key, i.pearl, i.mnemonic && `Mnemonic: ${i.mnemonic}`].filter((x): x is string => !!x),
    };
  }
  const extra = [i.pearl, i.mnemonic && `Mnemonic: ${i.mnemonic}`].filter((x): x is string => !!x);
  if (i.cloze) {
    const first = clozeIndices(i.cloze)[0] ?? 1;
    return { prompt: renderCloze(i.cloze, first), answer: renderCloze(i.cloze, first, true), extra };
  }
  return { prompt: i.front ?? "", answer: i.back ?? "", extra };
}

/** Text the blurt score is measured against: the answer plus the rationale for MCQs. */
export function blurtTarget(i: StudyItem): string {
  const f = faceOf(i);
  return [f.answer, ...f.extra].join(" ");
}
