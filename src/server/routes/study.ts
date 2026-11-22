import { Hono } from "hono";
import { z } from "zod";
import { and, eq, inArray, lte, isNull, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { assertDeckRole, requireUser, type Vars } from "../auth";
import { clampRetention, previews, review, retrievability, type ReviewRow } from "@/lib/fsrs";
import { bucketCounts } from "@/lib/leitner";
import { interleave } from "@/lib/interleave";
import { needsFeynman } from "@/lib/blurt";

export const study = new Hono<{ Variables: Vars }>();
study.use("*", requireUser);

const stateOf = (r: typeof schema.reviewStates.$inferSelect | null | undefined): ReviewRow | null =>
  r ? { due: r.due, stability: r.stability, difficulty: r.difficulty, elapsedDays: r.elapsedDays, scheduledDays: r.scheduledDays, learningSteps: r.learningSteps, reps: r.reps, lapses: r.lapses, state: r.state, lastReview: r.lastReview } : null;

const queueQuery = z.object({
  deckId: z.string().uuid().optional(),
  mode: z.enum(["fsrs", "blurt", "interleave", "feynman", "dual"]).default("fsrs"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  newLimit: z.coerce.number().int().min(0).max(50).default(10),
  retention: z.coerce.number().optional(),
  seed: z.coerce.number().int().optional(),
});

/** Decks the user can study: one (ACL-checked) or all memberships. */
async function studyDeckIds(userId: string, deckId?: string): Promise<string[]> {
  if (deckId) return (await assertDeckRole(deckId, userId, "viewer")) ? [deckId] : [];
  const rows = await getDb().select({ id: schema.deckMembers.deckId }).from(schema.deckMembers).where(eq(schema.deckMembers.userId, userId));
  return rows.map((r) => r.id);
}

study.get("/queue", async (c) => {
  const q = queueQuery.safeParse(c.req.query());
  if (!q.success) return c.json({ error: "invalid query", issues: q.error.issues }, 400);
  const { deckId, mode, limit, newLimit, seed } = q.data;
  const retention = clampRetention(q.data.retention);
  const userId = c.var.userId;
  const deckIds = await studyDeckIds(userId, deckId);
  if (!deckIds.length) return c.json({ queue: [], due: 0, new: 0 });

  const db = getDb();
  const now = new Date();
  const base = await db
    .select({ item: schema.items, rs: schema.reviewStates })
    .from(schema.items)
    .leftJoin(schema.reviewStates, and(eq(schema.reviewStates.itemId, schema.items.id), eq(schema.reviewStates.userId, userId)))
    .where(and(
      inArray(schema.items.deckId, deckIds),
      mode === "dual" ? sql`${schema.items.diagramKey} is not null` : undefined,
      or(isNull(schema.reviewStates.itemId), lte(schema.reviewStates.due, now)),
    ));

  const due = base.filter((r) => r.rs).sort((a, b) => a.rs!.due.getTime() - b.rs!.due.getTime());
  const fresh = base.filter((r) => !r.rs).slice(0, newLimit);
  let picked = [...due, ...fresh].slice(0, limit);
  if (mode === "interleave") {
    picked = interleave(picked, (r) => r.item.blueprint ?? r.item.deckId, seed ?? Math.floor(now.getTime() / 3_600_000));
  }
  return c.json({
    mode, retention, due: due.length, new: fresh.length,
    queue: picked.map((r) => ({ ...r.item, previews: previews(stateOf(r.rs), now, retention), retrievability: retrievability(stateOf(r.rs), now, retention) })),
  });
});

const reviewBody = z.object({
  itemId: z.string().uuid(),
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  retention: z.number().optional(),
});

study.post("/review", async (c) => {
  const body = reviewBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "invalid body", issues: body.error.issues }, 400);
  const { itemId, rating } = body.data;
  const userId = c.var.userId;
  const db = getDb();
  const [item] = await db.select({ deckId: schema.items.deckId }).from(schema.items).where(eq(schema.items.id, itemId)).limit(1);
  if (!item || !(await assertDeckRole(item.deckId, userId, "viewer"))) return c.json({ error: "not found" }, 404);

  const [existing] = await db.select().from(schema.reviewStates)
    .where(and(eq(schema.reviewStates.userId, userId), eq(schema.reviewStates.itemId, itemId))).limit(1);
  const retention = clampRetention(body.data.retention);
  const now = new Date();
  const next = review(stateOf(existing), rating, now, retention);
  await db.insert(schema.reviewStates).values({ userId, itemId, ...next })
    .onConflictDoUpdate({ target: [schema.reviewStates.userId, schema.reviewStates.itemId], set: next });
  return c.json({ state: next, previews: previews(next, now, retention), feynmanPrompt: needsFeynman(rating, next.lapses) });
});

study.get("/stats", async (c) => {
  const userId = c.var.userId;
  const deckIds = await studyDeckIds(userId, c.req.query("deckId"));
  if (!deckIds.length) return c.json({ total: 0, due: 0, buckets: bucketCounts([]) });
  const db = getDb();
  const now = new Date();
  const rows = await db
    .select({ rs: schema.reviewStates })
    .from(schema.items)
    .leftJoin(schema.reviewStates, and(eq(schema.reviewStates.itemId, schema.items.id), eq(schema.reviewStates.userId, userId)))
    .where(inArray(schema.items.deckId, deckIds));
  const states = rows.map((r) => stateOf(r.rs));
  return c.json({
    total: rows.length,
    due: states.filter((s) => !s || s.due <= now).length,
    buckets: bucketCounts(states),
  });
});

const feynmanBody = z.object({ itemId: z.string().uuid(), body: z.string().trim().min(1).max(2000) });

study.post("/feynman", async (c) => {
  const b = feynmanBody.safeParse(await c.req.json().catch(() => null));
  if (!b.success) return c.json({ error: "invalid body", issues: b.error.issues }, 400);
  const db = getDb();
  const [item] = await db.select({ deckId: schema.items.deckId }).from(schema.items).where(eq(schema.items.id, b.data.itemId)).limit(1);
  if (!item || !(await assertDeckRole(item.deckId, c.var.userId, "viewer"))) return c.json({ error: "not found" }, 404);
  const [note] = await db.insert(schema.feynmanNotes).values({ userId: c.var.userId, itemId: b.data.itemId, body: b.data.body }).returning();
  return c.json({ note }, 201);
});

study.get("/feynman", async (c) => {
  const itemId = c.req.query("itemId") ?? "";
  if (!z.string().uuid().safeParse(itemId).success) return c.json({ error: "bad itemId" }, 400);
  const db = getDb();
  const [item] = await db.select({ deckId: schema.items.deckId }).from(schema.items).where(eq(schema.items.id, itemId)).limit(1);
  if (!item || !(await assertDeckRole(item.deckId, c.var.userId, "viewer"))) return c.json({ error: "not found" }, 404);
  const notes = await db.select().from(schema.feynmanNotes)
    .where(and(eq(schema.feynmanNotes.userId, c.var.userId), eq(schema.feynmanNotes.itemId, itemId)));
  return c.json({ notes });
});
