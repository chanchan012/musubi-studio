import { Hono } from "hono";
import { Webhook } from "svix";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db/client";

type ClerkUserEvent = {
  type: string;
  data: {
    id: string;
    first_name?: string | null; last_name?: string | null; image_url?: string | null;
    primary_email_address_id?: string | null;
    email_addresses?: { id: string; email_address: string }[];
  };
};

export const webhooks = new Hono();

webhooks.post("/clerk", async (c) => {
  const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!secret) return c.json({ error: "webhook not configured" }, 503);

  const payload = await c.req.text();
  let evt: ClerkUserEvent;
  try {
    evt = new Webhook(secret).verify(payload, {
      "svix-id": c.req.header("svix-id") ?? "",
      "svix-timestamp": c.req.header("svix-timestamp") ?? "",
      "svix-signature": c.req.header("svix-signature") ?? "",
    }) as unknown as ClerkUserEvent;
  } catch {
    return c.json({ error: "invalid signature" }, 400);
  }

  const db = getDb();
  if (evt.type === "user.deleted") {
    await db.delete(schema.users).where(eq(schema.users.id, evt.data.id));
  } else if (evt.type === "user.created" || evt.type === "user.updated") {
    const d = evt.data;
    const email = d.email_addresses?.find((e) => e.id === d.primary_email_address_id)?.email_address ?? d.email_addresses?.[0]?.email_address ?? null;
    const name = [d.first_name, d.last_name].filter(Boolean).join(" ") || null;
    await db.insert(schema.users).values({ id: d.id, email, name, imageUrl: d.image_url ?? null })
      .onConflictDoUpdate({ target: schema.users.id, set: { email, name, imageUrl: d.image_url ?? null } });
  }
  return c.json({ ok: true });
});
