import type { schema } from "@/db/client";

/** The learner-safe view of an MCQ: never includes the key or rationales. */
export function publicQuestion(i: typeof schema.items.$inferSelect) {
  return { id: i.id, stem: i.stem, options: i.options ?? [], difficulty: i.difficulty, blueprint: i.blueprint, citation: i.citation };
}
