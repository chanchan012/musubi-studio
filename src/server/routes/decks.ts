import { Hono } from "hono";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { assertDeckRole, requireUser, type Vars } from "../auth";
import { clerkClient } from "@/server/clerk-user";

export const decks = new Hono<{ Variables: Vars }>();
decks.use("*", requireUser);

const createSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().max(2000).optional(),
  examTrack: z.string().max(60).optional(),
  subject: z.string().max(80).optional(),
});

decks.get("/", async (c) => {
  const db = getDb();
  const rows = await db
    .select({ deck: schema.decks, role: schema.deckMembers.role })
    .from(schema.deckMembers)
    .innerJoin(schema.decks, eq(schema.decks.id, schema.deckMembers.deckId))
    .where(eq(schema.deckMembers.userId, c.var.userId))
    .orderBy(desc(schema.decks.updatedAt));
  return c.json({ decks: rows.map((r) => ({ ...r.deck, role: r.role })) });
});

decks.post("/", async (c) => {
  const parsed = createSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid body", issues: parsed.error.issues }, 400);
  const userId = c.var.userId;
  await clerkClient.ensureUser(userId); // lazily mirror Clerk user if webhook hasn't run yet
  const db = getDb();
  const [deck] = await db.insert(schema.decks).values({ ownerId: userId, ...parsed.data }).returning();
  await db.insert(schema.deckMembers).values({ deckId: deck.id, userId, role: "owner" });
  return c.json({ deck: { ...deck, role: "owner" } }, 201);
});

decks.get("/:id", async (c) => {
  const id = c.req.param("id");
  if (!z.string().uuid().safeParse(id).success) return c.json({ error: "not found" }, 404);
  if (!(await assertDeckRole(id, c.var.userId, "viewer"))) return c.json({ error: "not found" }, 404);
  const db = getDb();
  const [deck] = await db.select().from(schema.decks).where(eq(schema.decks.id, id)).limit(1);
  const items = await db.select().from(schema.items).where(eq(schema.items.deckId, id));
  return c.json({ deck, items });
});
