import type { Calibration, Certainty, Flag } from "./cbm";
import type { TrapTag } from "./error-log";

export type ExamQuestion = {
  id: string; stem: string | null; options: string[];
  difficulty?: string | null; blueprint?: string | null; citation?: string | null;
};

export type SubmitAnswer = {
  itemId: string; choice: number | null; certainty: Certainty | null; ms: number;
  eliminated: number[]; trap: Record<number, TrapTag>;
};

export type Rationales = { key: string; options: string[] } | null;

export type ExamResult = {
  total: number; answered: number; correct: number; skipped: string[]; logged: number;
  calibration: Calibration;
  results: { itemId: string; choice: number | null; answerIdx: number | null; correct: boolean; certainty: Certainty; marks: number; flag: Flag; rationales: Rationales }[];
};
