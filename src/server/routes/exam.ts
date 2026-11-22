import { Hono } from "hono";
import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { assertDeckRole, requireUser, type Vars } from "../auth";
import { calibration, cbmFlag, cbmMarks, type Certainty } from "@/lib/cbm";
import { applyExamOutcome } from "@/lib/exam-fsrs";
import { ROOT_CAUSES, TRAP_TAGS, isRedrillDue, redrillSchedule, shouldLog } from "@/lib/error-log";
import { interleave, rng, shuffle } from "@/lib/interleave";
import type { ReviewRow } from "@/lib/fsrs";
import { publicQuestion } from "../public";

export const exam = new Hono<{ Variables: Vars }>();
exam.use("*", requireUser);

const uuid = z.string().uuid();

const qQuery = z.object({
  count: z.coerce.number().int().min(1).max(200).default(20),
  seed: z.coerce.number().int().optional(),
  interleave: z.enum(["0", "1"]).default("0"),
});

exam.get("/errors", async (c) => {
  const db = getDb();
  const rows = await db
    .select({ log: schema.errorLog, stem: schema.items.stem, deckId: schema.items.deckId })
    .from(schema.errorLog)
    .innerJoin(schema.items, eq(schema.items.id, schema.errorLog.itemId))
    .where(eq(schema.errorLog.userId, c.var.userId))
    .orderBy(desc(schema.errorLog.createdAt))
    .limit(200);
  return c.json({ errors: rows.map((r) => ({ ...r.log, stem: r.stem, deckId: r.deckId })) });
});

const patchBody = z.object({ rootCause: z.enum(ROOT_CAUSES), notes: z.string().max(1000).optional() });
exam.patch("/errors/:id", async (c) => {
  const id = c.req.param("id");
  const body = patchBody.safeParse(await c.req.json().catch(() => null));
  if (!uuid.safeParse(id).success || !body.success) return c.json({ error: "invalid request" }, 400);
  const [row] = await getDb().update(schema.errorLog).set(body.data)
    .where(and(eq(schema.errorLog.id, id), eq(schema.errorLog.userId, c.var.userId))).returning();
  return row ? c.json({ error: null, entry: row }) : c.json({ error: "not found" }, 404);
});

/** Mistake-journal items whose Day 1/3/7 re-test is due. */
exam.get("/redrill", async (c) => {
  const db = getDb();
  const logs = await db.select().from(schema.errorLog).where(eq(schema.errorLog.userId, c.var.userId));
  if (!logs.length) return c.json({ questions: [] });
  const ids = [...new Set(logs.map((l) => l.itemId))];
  const atts = await db.select({ itemId: schema.attempts.itemId, at: schema.attempts.createdAt })
    .from(schema.attempts).where(and(eq(schema.attempts.userId, c.var.userId), inArray(schema.attempts.itemId, ids)));
  const last = new Map<string, Date>();
  for (const a of atts) if (!last.get(a.itemId) || a.at > last.get(a.itemId)!) last.set(a.itemId, a.at);
  const now = new Date();
  const dueIds = ids.filter((id) => logs.some((l) => l.itemId === id && isRedrillDue(l.redrillAt, last.get(id) ?? null, now)));
  if (!dueIds.length) return c.json({ questions: [] });
  const items = await db.select().from(schema.items).where(and(inArray(schema.items.id, dueIds), eq(schema.items.kind, "mcq")));
  const ok: typeof items = [];
  for (const it of items) if (await assertDeckRole(it.deckId, c.var.userId, "viewer")) ok.push(it);
  return c.json({ questions: ok.map(publicQuestion) });
});

exam.get("/:deckId/questions", async (c) => {
  const deckId = c.req.param("deckId");
  const q = qQuery.safeParse(c.req.query());
  if (!uuid.safeParse(deckId).success || !q.success) return c.json({ error: "invalid request" }, 400);
  if (!(await assertDeckRole(deckId, c.var.userId, "viewer"))) return c.json({ error: "not found" }, 404);
  const items = await getDb().select().from(schema.items).where(and(eq(schema.items.deckId, deckId), eq(schema.items.kind, "mcq")));
  const seed = q.data.seed ?? Math.floor(Date.now() / 60_000);
  const mixed = q.data.interleave === "1" ? interleave(items, (i) => i.blueprint ?? "general", seed) : shuffle(items, rng(seed));
  return c.json({ seed, total: items.length, questions: mixed.slice(0, q.data.count).map(publicQuestion) });
});

const submitBody = z.object({
  deckId: uuid,
  answers: z.array(z.object({
    itemId: uuid,
    choice: z.number().int().min(0).max(4).nullable(),
    certainty: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable(),
    ms: z.number().int().min(0).max(3_600_000).default(0),
    eliminated: z.array(z.number().int().min(0).max(4)).max(5).default([]),
    trap: z.record(z.string(), z.enum(TRAP_TAGS)).default({}),
  })).min(1).max(200),
});

exam.post("/submit", async (c) => {
  const body = submitBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "invalid body", issues: body.error.issues }, 400);
  const { deckId, answers } = body.data;
  const userId = c.var.userId;
  if (!(await assertDeckRole(deckId, userId, "viewer"))) return c.json({ error: "not found" }, 404);

  const db = getDb();
  const ids = [...new Set(answers.map((a) => a.itemId))];
  const items = await db.select().from(schema.items)
    .where(and(inArray(schema.items.id, ids), eq(schema.items.deckId, deckId), eq(schema.items.kind, "mcq")));
  const byId = new Map(items.map((i) => [i.id, i]));
  const now = new Date();

  const graded = answers.flatMap((a) => {
    const item = byId.get(a.itemId);
    if (!item || a.choice === null || a.certainty === null || item.answerIdx === null) return [];
    const certainty = a.certainty as Certainty;
    const correct = a.choice === item.answerIdx;
    return [{ a, item, certainty, correct }];
  });
  const skipped = answers.filter((a) => !graded.some((g) => g.a.itemId === a.itemId)).map((a) => a.itemId);

  if (graded.length) {
    const gIds = graded.map((g) => g.item.id);
    const [states, stats] = await Promise.all([
      db.select().from(schema.reviewStates).where(and(eq(schema.reviewStates.userId, userId), inArray(schema.reviewStates.itemId, gIds))),
      db.select().from(schema.itemStats).where(inArray(schema.itemStats.itemId, gIds)),
    ]);
    const stateOf = new Map(states.map((s) => [s.itemId, s]));
    const statOf = new Map(stats.map((s) => [s.itemId, s]));

    await db.insert(schema.attempts).values(graded.map((g) => ({
      userId, itemId: g.item.id, choiceIdx: g.a.choice, correct: g.correct, certainty: g.certainty, ms: g.a.ms,
      eliminations: g.a.eliminated, trapTags: g.a.trap,
    })));

    for (const g of graded) {
      const prev = stateOf.get(g.item.id);
      const row: ReviewRow | null = prev ? { due: prev.due, stability: prev.stability, difficulty: prev.difficulty, elapsedDays: prev.elapsedDays, scheduledDays: prev.scheduledDays, learningSteps: prev.learningSteps, reps: prev.reps, lapses: prev.lapses, state: prev.state, lastReview: prev.lastReview } : null;
      const next = applyExamOutcome(row, g.correct, g.certainty, g.a.ms, now);
      await db.insert(schema.reviewStates).values({ userId, itemId: g.item.id, ...next })
        .onConflictDoUpdate({ target: [schema.reviewStates.userId, schema.reviewStates.itemId], set: next });

      // anonymised item + distractor telemetry (P-value, per-option pick counts)
      const prevStat = statOf.get(g.item.id);
      const counts = [...(prevStat?.optionCounts ?? Array((g.item.options ?? []).length).fill(0))];
      if (g.a.choice !== null && g.a.choice < counts.length) counts[g.a.choice] += 1;
      const nextStat = { attempts: (prevStat?.attempts ?? 0) + 1, correct: (prevStat?.correct ?? 0) + (g.correct ? 1 : 0), optionCounts: counts, updatedAt: now };
      await db.insert(schema.itemStats).values({ itemId: g.item.id, ...nextStat })
        .onConflictDoUpdate({ target: schema.itemStats.itemId, set: nextStat });
    }

    const toLog = graded.filter((g) => shouldLog(g.correct, g.certainty));
    if (toLog.length) {
      await db.insert(schema.errorLog).values(toLog.map((g) => ({ userId, itemId: g.item.id, redrillAt: redrillSchedule(now) })));
    }
  }

  const cal = calibration(graded.map((g) => ({ correct: g.correct, certainty: g.certainty })));
  return c.json({
    total: answers.length,
    answered: graded.length,
    skipped,
    correct: graded.filter((g) => g.correct).length,
    calibration: cal,
    logged: graded.filter((g) => shouldLog(g.correct, g.certainty)).length,
    results: graded.map((g) => ({
      itemId: g.item.id, choice: g.a.choice, answerIdx: g.item.answerIdx, correct: g.correct, certainty: g.certainty,
      marks: cbmMarks(g.correct, g.certainty), flag: cbmFlag(g.correct, g.certainty), rationales: g.item.rationales,
    })),
  });
});
