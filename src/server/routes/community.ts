import { Hono } from "hono";
import { z } from "zod";
import { addErratum, cloneDeck, facets, getPost, listPosts, publishDeck, resolveErratum, vote } from "../community";
import { assertDeckRole, requireUser, type Vars } from "../auth";
import { limit } from "../ratelimit";
import { clerkClient } from "../clerk-user";

export const community = new Hono<{ Variables: Vars }>();
const uuid = z.string().uuid();

community.get("/", async (c) => {
  const q = c.req.query();
  const sort = q.sort === "new" || q.sort === "verified" ? q.sort : "top";
  return c.json({ posts: await listPosts({ q: q.q, track: q.track, subject: q.subject, sort, offset: Number(q.offset) || 0 }), ...(await facets()) });
});

community.get("/:id", async (c) => {
  const id = c.req.param("id");
  if (!uuid.safeParse(id).success) return c.json({ error: "not found" }, 404);
  const r = await getPost(id);
  return r ? c.json(r) : c.json({ error: "not found" }, 404);
});

// Writes: signed in + 20 per 5 minutes.
community.use("*", async (c, next) => {
  if (c.req.method === "GET") return next();
  const gate = await requireUser(c, async () => {});
  if (gate) return gate; // 401
  if (!(await limit("community", c.var.userId)).ok) return c.json({ error: "rate limited" }, 429);
  return next();
});

community.post("/publish", async (c) => {
  const p = z.object({ deckId: uuid, track: z.string().trim().min(1).max(60), subject: z.string().max(80).optional(), topic: z.string().max(120).optional() }).safeParse(await c.req.json().catch(() => null));
  if (!p.success) return c.json({ error: "invalid body" }, 400);
  if (!(await assertDeckRole(p.data.deckId, c.var.userId, "owner"))) return c.json({ error: "forbidden" }, 403);
  return c.json({ postId: await publishDeck(p.data.deckId, c.var.userId, p.data) }, 201);
});

community.post("/:id/vote", async (c) => {
  const id = c.req.param("id");
  const p = z.object({ value: z.union([z.literal(-1), z.literal(0), z.literal(1)]) }).safeParse(await c.req.json().catch(() => null));
  if (!uuid.safeParse(id).success || !p.success) return c.json({ error: "invalid" }, 400);
  await clerkClient.ensureUser(c.var.userId);
  return c.json({ score: await vote(id, c.var.userId, p.data.value) });
});

community.post("/:id/clone", async (c) => {
  const id = c.req.param("id");
  if (!uuid.safeParse(id).success) return c.json({ error: "not found" }, 404);
  await clerkClient.ensureUser(c.var.userId);
  const r = await cloneDeck(id, c.var.userId);
  return r ? c.json(r, 201) : c.json({ error: "not found" }, 404);
});

community.post("/items/:itemId/errata", async (c) => {
  const itemId = c.req.param("itemId");
  const p = z.object({ body: z.string().trim().min(5).max(1000) }).safeParse(await c.req.json().catch(() => null));
  if (!uuid.safeParse(itemId).success || !p.success) return c.json({ error: "invalid" }, 400);
  await clerkClient.ensureUser(c.var.userId);
  const id = await addErratum(itemId, c.var.userId, p.data.body);
  return id ? c.json({ id }, 201) : c.json({ error: "not found" }, 404);
});

community.post("/errata/:errId/resolve", async (c) => {
  const errId = c.req.param("errId");
  if (!uuid.safeParse(errId).success) return c.json({ error: "not found" }, 404);
  const r = await resolveErratum(errId, c.var.userId);
  return r === "ok" ? c.json({ ok: true }) : r === "forbidden" ? c.json({ error: "forbidden" }, 403) : c.json({ error: "not found" }, 404);
});
