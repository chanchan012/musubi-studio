import { Hono } from "hono";
import { z } from "zod";
import { assertDeckRole, requireUser, type Vars } from "../auth";
import { ALLOWED_TYPES, MAX_UPLOAD_BYTES, assetKey, deckIdFromKey, presignGet, presignPut } from "@/lib/r2";

export const uploads = new Hono<{ Variables: Vars }>();
uploads.use("*", requireUser);

const putSchema = z.object({
  deckId: z.string().uuid(),
  filename: z.string().min(1).max(200),
  contentType: z.enum(ALLOWED_TYPES),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});

uploads.post("/presign", async (c) => {
  const parsed = putSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "invalid body", issues: parsed.error.issues }, 400);
  const { deckId, filename, contentType, size } = parsed.data;
  if (!(await assertDeckRole(deckId, c.var.userId, "editor"))) return c.json({ error: "forbidden" }, 403);
  const key = assetKey(deckId, filename);
  return c.json({ key, url: await presignPut(key, contentType, size), headers: { "Content-Type": contentType }, expiresIn: 600 });
});

uploads.get("/url", async (c) => {
  const key = c.req.query("key") ?? "";
  const deckId = deckIdFromKey(key);
  if (!deckId || key.includes("..")) return c.json({ error: "bad key" }, 400);
  if (!(await assertDeckRole(deckId, c.var.userId, "viewer"))) return c.json({ error: "forbidden" }, 403);
  return c.json({ url: await presignGet(key), expiresIn: 600 });
});
