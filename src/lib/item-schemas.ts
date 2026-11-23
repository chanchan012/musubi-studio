import { z } from "zod";

export const difficulty = z.enum(["foundational", "application", "synthesis"]);

export const flashcardInput = z.object({
  front: z.string().min(1).max(4000),
  back: z.string().min(1).max(8000),
  cloze: z.string().max(4000).optional(),
  mnemonic: z.string().max(1000).optional(),
  pearl: z.string().max(1000).optional(),
  blueprint: z.string().max(120).optional(),
  difficulty: difficulty.optional(),
  citation: z.string().max(500).optional(),
});

export const mcqInput = z
  .object({
    stem: z.string().min(1).max(6000),
    options: z.array(z.string().min(1).max(1000)).min(4).max(5),
    answerIdx: z.number().int().min(0).max(4),
    keyRationale: z.string().min(1).max(4000),
    optionRationales: z.array(z.string().max(2000)).min(4).max(5),
    difficulty: difficulty.optional(),
    blueprint: z.string().max(120).optional(),
    citation: z.string().max(500).optional(),
    mnemonic: z.string().max(1000).optional(),
    pearl: z.string().max(1000).optional(),
  })
  .refine((v) => v.answerIdx < v.options.length, { message: "answerIdx out of range", path: ["answerIdx"] })
  .refine((v) => v.optionRationales.length === v.options.length, {
    message: "optionRationales must match options",
    path: ["optionRationales"],
  });

export const itemPatch = z
  .object({
    front: z.string().min(1).max(4000),
    back: z.string().min(1).max(8000),
    cloze: z.string().max(4000).nullable(),
    mnemonic: z.string().max(1000).nullable(),
    pearl: z.string().max(1000).nullable(),
    stem: z.string().min(1).max(6000),
    options: z.array(z.string().min(1).max(1000)).min(4).max(5),
    answerIdx: z.number().int().min(0).max(4),
    keyRationale: z.string().max(4000),
    optionRationales: z.array(z.string().max(2000)).min(4).max(5),
    difficulty: difficulty.nullable(),
    blueprint: z.string().max(120).nullable(),
    citation: z.string().max(500).nullable(),
    diagramKey: z.string().max(500).nullable(),
  })
  .partial();

export type FlashcardInput = z.infer<typeof flashcardInput>;
export type McqInput = z.infer<typeof mcqInput>;
export type ItemPatch = z.infer<typeof itemPatch>;

/** Option-level distractor critique: flags weak distractors without a model call. */
export function critiqueDistractors(m: Pick<McqInput, "options" | "answerIdx">) {
  const notes: { index: number; issue: string }[] = [];
  const key = m.options[m.answerIdx] ?? "";
  m.options.forEach((o, i) => {
    if (i === m.answerIdx) return;
    if (o.trim().toLowerCase() === key.trim().toLowerCase()) notes.push({ index: i, issue: "duplicates the key" });
    else if (/^(all|none) of the above$/i.test(o.trim())) notes.push({ index: i, issue: "'all/none of the above' is a non-functional distractor" });
    else if (o.length < key.length * 0.4 || o.length > key.length * 2.5) notes.push({ index: i, issue: "length differs sharply from the key (a test-wiseness cue)" });
  });
  if (key && m.options.every((o, i) => i === m.answerIdx || o.length < key.length)) notes.push({ index: m.answerIdx, issue: "the key is the longest option (a test-wiseness cue)" });
  return notes;
}
