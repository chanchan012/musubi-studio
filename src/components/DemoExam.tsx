"use client";

import { useCallback } from "react";
import { DEMO_QUESTIONS, gradeLocal } from "@/lib/demo";
import type { SubmitAnswer } from "@/lib/exam-types";
import { ExamRunner } from "./ExamRunner";

export function DemoExam() {
  const submit = useCallback((a: SubmitAnswer[]) => gradeLocal(DEMO_QUESTIONS, a), []);
  return <ExamRunner embedded title="Practice sheet · sandbox" questions={DEMO_QUESTIONS} submit={submit} />;
}
