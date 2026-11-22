"use client";

import { useCallback } from "react";
import type { RootCause } from "@/lib/error-log";
import type { ExamQuestion, ExamResult, SubmitAnswer } from "@/lib/exam-types";
import { ExamRunner } from "./ExamRunner";

export function ExamClient({ deckId, title, questions }: { deckId: string; title: string; questions: ExamQuestion[] }) {
  const submit = useCallback(async (answers: SubmitAnswer[]): Promise<ExamResult> => {
    const res = await fetch("/api/exam/submit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ deckId, answers }) });
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  }, [deckId]);

  /** Attach a root cause to the newest Error Log entry for this item. */
  const tag = useCallback(async (itemId: string, cause: RootCause) => {
    const list = await fetch("/api/exam/errors").then((r) => r.json()).catch(() => null) as { errors: { id: string; itemId: string }[] } | null;
    const entry = list?.errors.find((e) => e.itemId === itemId);
    if (!entry) return;
    await fetch(`/api/exam/errors/${entry.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ rootCause: cause }) });
  }, []);

  return <ExamRunner title={title} questions={questions} submit={submit} onTagCause={tag} />;
}
