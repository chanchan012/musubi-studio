import { Hono } from "hono";
import { z } from "zod";
import { getDb, schema } from "@/db/client";
import { eq } from "drizzle-orm";
import { assertDeckRole, getDeckRole, requireUser, type Vars } from "../auth";
import { createFlashcards, createMcqs, deleteItems, listItems, updateItem } from "../items";
import { deckIdFromRoom, lb, notifyItemsChanged, roomId } from "../liveblocks";
import { createToken, listTokens, revokeToken } from "../mcp-tokens";
import { flashcardInput, itemPatch, mcqInput } from "@/lib/item-schemas";
import { limit } from "../ratelimit";
import { clerkClient } from "@/server/clerk-user";

export const studio = new Hono<{ Variables: Vars }>();
studio.use("*", requireUser);
studio.use("*", async (c, next) => {
  const rl = await limit("api", c.var.userId);
  if (!rl.ok) return c.json({ error: "rate limited" }, 429);
  await next();
});

const human = (c: { var: Vars }) => ({ kind: "human" as const, userId: c.var.userId });
const HUMAN = { kind: "human" as const, name: "you" };

/** Liveblocks access token: Clerk session + deck membership. Viewers get read access. */
studio.post("/liveblocks-auth", async (c) => {
  const client = lb();
  if (!client) return c.json({ error: "liveblocks not configured" }, 503);
  const body = z.object({ room: z.string() }).safeParse(await c.req.json().catch(() => null));
  const deckId = body.success ? deckIdFromRoom(body.data.room) : null;
  if (!deckId || !z.string().uuid().safeParse(deckId).success) return c.json({ error: "bad room" }, 400);
  const role = await getDeckRole(deckId, c.var.userId);
  if (!role) return c.json({ error: "forbidden" }, 403);
  const [u] = await getDb().select({ name: schema.users.name, email: schema.users.email, imageUrl: schema.users.imageUrl }).from(schema.users).where(eq(schema.users.id, c.var.userId)).limit(1);
  const session = client.prepareSession(c.var.userId, { userInfo: { name: u?.name || u?.email || "Member", avatar: u?.imageUrl ?? "" } });
  session.allow(roomId(deckId), role === "viewer" ? session.READ_ACCESS : session.FULL_ACCESS);
  const { status, body: out } = await session.authorize();
  return new Response(out, { status, headers: { "content-type": "application/json" } });
});

studio.get("/decks/:id/items", async (c) => {
  const id = c.req.param("id");
  if (!(await assertDeckRole(id, c.var.userId, "viewer"))) return c.json({ error: "not found" }, 404);
  return c.json({ items: await listItems(id) });
});

studio.post("/decks/:id/items", async (c) => {
  const id = c.req.param("id");
  if (!(await assertDeckRole(id, c.var.userId, "editor"))) return c.json({ error: "forbidden" }, 403);
  const parsed = z.object({ cards: z.array(flashcardInput).max(50).default([]), questions: z.array(mcqInput).max(25).default([]) }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid body", issues: parsed.error.issues }, 400);
  const created = [...(await createFlashcards(id, parsed.data.cards, human(c))), ...(await createMcqs(id, parsed.data.questions, human(c)))];
  await notifyItemsChanged(id, HUMAN, created.length);
  return c.json({ items: created }, 201);
});

studio.patch("/decks/:id/items/:itemId", async (c) => {
  const id = c.req.param("id");
  if (!(await assertDeckRole(id, c.var.userId, "editor"))) return c.json({ error: "forbidden" }, 403);
  const parsed = itemPatch.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid body", issues: parsed.error.issues }, 400);
  const r = await updateItem(id, c.req.param("itemId"), parsed.data);
  if (!r) return c.json({ error: "not found" }, 404);
  await notifyItemsChanged(id, HUMAN, 1);
  return c.json(r);
});

studio.delete("/decks/:id/items/:itemId", async (c) => {
  const id = c.req.param("id");
  if (!(await assertDeckRole(id, c.var.userId, "editor"))) return c.json({ error: "forbidden" }, 403);
  const n = await deleteItems(id, [c.req.param("itemId")]);
  await notifyItemsChanged(id, HUMAN, n);
  return c.json({ deleted: n });
});

// Personal MCP tokens
studio.get("/mcp-tokens", async (c) => c.json({ tokens: await listTokens(c.var.userId) }));
studio.post("/mcp-tokens", async (c) => {
  const p = z.object({ name: z.string().trim().min(1).max(60) }).safeParse(await c.req.json().catch(() => null));
  if (!p.success) return c.json({ error: "invalid body" }, 400);
  await clerkClient.ensureUser(c.var.userId);
  return c.json(await createToken(c.var.userId, p.data.name), 201);
});
studio.delete("/mcp-tokens/:id", async (c) => c.json({ revoked: await revokeToken(c.var.userId, c.req.param("id")) }));
