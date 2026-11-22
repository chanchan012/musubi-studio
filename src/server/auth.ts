import { clerkMiddleware, getAuth } from "@hono/clerk-auth";
import type { MiddlewareHandler } from "hono";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { roleAtLeast, type Role } from "@/lib/acl";

export type Vars = { userId: string };

export const clerk = clerkMiddleware();

/** Requires a signed-in Clerk session; sets c.var.userId. */
export const requireUser: MiddlewareHandler<{ Variables: Vars }> = async (c, next) => {
  const auth = getAuth(c);
  if (!auth?.userId) return c.json({ error: "unauthorized" }, 401);
  c.set("userId", auth.userId);
  await next();
};

/** Role of a user on a deck, or null. Owner is checked through deck_members (owner row). */
export async function getDeckRole(deckId: string, userId: string): Promise<Role | null> {
  const db = getDb();
  const [row] = await db
    .select({ role: schema.deckMembers.role })
    .from(schema.deckMembers)
    .where(and(eq(schema.deckMembers.deckId, deckId), eq(schema.deckMembers.userId, userId)))
    .limit(1);
  return row?.role ?? null;
}

export async function assertDeckRole(deckId: string, userId: string, min: Role): Promise<boolean> {
  return roleAtLeast(await getDeckRole(deckId, userId), min);
}
