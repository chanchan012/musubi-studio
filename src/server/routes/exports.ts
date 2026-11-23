import { Hono } from "hono";
import { z } from "zod";
import { assertDeckRole, requireUser, type Vars } from "../auth";
import { limit } from "../ratelimit";
import { buildInngest, exportKey } from "@/inngest/functions";
import { presignGet } from "@/lib/r2";
import { exists } from "@/lib/r2-binding";
import { EXPORT_FORMATS } from "@/lib/analytics";

export const exportsRoute = new Hono<{ Variables: Vars }>();
exportsRoute.use("*", requireUser);

const body = z.object({ deckId: z.string().uuid(), format: z.enum(["csv", "json", "anki"]) });

/** Queue an export via Inngest; the client polls GET until the R2 object exists. */
exportsRoute.post("/", async (c) => {
  const p = body.safeParse(await c.req.json().catch(() => null));
  if (!p.success) return c.json({ error: "invalid body" }, 400);
  if (!(await assertDeckRole(p.data.deckId, c.var.userId, "viewer"))) return c.json({ error: "not found" }, 404);
  if (!(await limit("heavy", c.var.userId)).ok) return c.json({ error: "rate limited" }, 429);
  const exportId = crypto.randomUUID();
  await buildInngest().inngest.send({ name: "deck/export.requested", data: { ...p.data, exportId } });
  return c.json({ exportId }, 202);
});

exportsRoute.get("/:exportId", async (c) => {
  const q = z.object({ deckId: z.string().uuid(), format: z.enum(["csv", "json", "anki"]) }).safeParse(c.req.query());
  const exportId = c.req.param("exportId");
  if (!q.success || !z.string().uuid().safeParse(exportId).success) return c.json({ error: "invalid" }, 400);
  if (!(await assertDeckRole(q.data.deckId, c.var.userId, "viewer"))) return c.json({ error: "not found" }, 404);
  const key = exportKey(q.data.deckId, exportId, q.data.format);
  if (!(await exists(key).catch(() => false))) return c.json({ status: "pending" });
  return c.json({ status: "ready", url: await presignGet(key), filename: `deck.${EXPORT_FORMATS[q.data.format].ext}` });
});
