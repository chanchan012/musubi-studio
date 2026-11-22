import { calibration, cbmFlag, cbmMarks, type Certainty } from "./cbm";
import type { ExamQuestion, ExamResult, Rationales, SubmitAnswer } from "./exam-types";
import { shouldLog } from "./error-log";

export type DemoQuestion = ExamQuestion & { answerIdx: number; rationales: NonNullable<Rationales> };

/** Sample board-style items for the landing-page sandbox (graded locally, nothing is sent). */
export const DEMO_QUESTIONS: DemoQuestion[] = [
  {
    id: "demo-1", difficulty: "application", blueprint: "Pharmacology",
    stem: "A 58-year-old man with newly diagnosed hypertension and a history of angioedema after enalapril is started on a new antihypertensive. Which drug is the safest first choice?",
    options: ["Lisinopril", "Losartan", "Captopril", "Ramipril", "Benazepril"], answerIdx: 1,
    rationales: {
      key: "Angiotensin-receptor blockers do not raise bradykinin the way ACE inhibitors do, so angioedema risk is far lower.",
      options: ["ACE inhibitor: shares the bradykinin mechanism behind prior angioedema.", "Correct: ARB, no meaningful bradykinin accumulation.", "ACE inhibitor: same class effect.", "ACE inhibitor: same class effect.", "ACE inhibitor: same class effect."],
    },
  },
  {
    id: "demo-2", difficulty: "foundational", blueprint: "Biochemistry",
    stem: "Which molecule is the immediate electron donor to Complex I of the electron transport chain?",
    options: ["FADH2", "NADH", "Succinate", "Cytochrome c", "Ubiquinone"], answerIdx: 1,
    rationales: {
      key: "NADH is oxidised at Complex I, passing electrons to ubiquinone.",
      options: ["FADH2 donates at Complex II, not Complex I.", "Correct: NADH feeds Complex I.", "Succinate is oxidised by Complex II.", "Cytochrome c carries electrons from III to IV.", "Ubiquinone is the acceptor from Complex I, not the donor."],
    },
  },
];

export async function gradeLocal(questions: DemoQuestion[], answers: SubmitAnswer[]): Promise<ExamResult> {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const graded = answers.flatMap((a) => {
    const q = byId.get(a.itemId);
    if (!q || a.choice === null || a.certainty === null) return [];
    return [{ a, q, certainty: a.certainty as Certainty, correct: a.choice === q.answerIdx }];
  });
  return {
    total: answers.length, answered: graded.length, correct: graded.filter((g) => g.correct).length,
    skipped: answers.filter((a) => !graded.some((g) => g.a.itemId === a.itemId)).map((a) => a.itemId),
    logged: graded.filter((g) => shouldLog(g.correct, g.certainty)).length,
    calibration: calibration(graded.map((g) => ({ correct: g.correct, certainty: g.certainty }))),
    results: graded.map((g) => ({
      itemId: g.q.id, choice: g.a.choice, answerIdx: g.q.answerIdx, correct: g.correct, certainty: g.certainty,
      marks: cbmMarks(g.correct, g.certainty), flag: cbmFlag(g.correct, g.certainty), rationales: g.q.rationales,
    })),
  };
}
