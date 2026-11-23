import { and, eq, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { sha256Hex } from "@/lib/hash";

export const TOKEN_PREFIX = "mus_";

export function newTokenValue(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return TOKEN_PREFIX + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Returns the plaintext once; only the sha256 is stored. */
export async function createToken(userId: string, name: string) {
  const token = newTokenValue();
  const [row] = await getDb().insert(schema.mcpTokens).values({ userId, name, tokenHash: await sha256Hex(token) }).returning({ id: schema.mcpTokens.id, name: schema.mcpTokens.name, createdAt: schema.mcpTokens.createdAt });
  return { ...row, token };
}

export async function verifyToken(raw: string): Promise<{ userId: string; tokenId: string; name: string } | null> {
  if (!raw.startsWith(TOKEN_PREFIX) || raw.length > 100) return null;
  const db = getDb();
  const [row] = await db
    .select({ id: schema.mcpTokens.id, userId: schema.mcpTokens.userId, name: schema.mcpTokens.name })
    .from(schema.mcpTokens)
    .where(and(eq(schema.mcpTokens.tokenHash, await sha256Hex(raw)), isNull(schema.mcpTokens.revokedAt)))
    .limit(1);
  if (!row) return null;
  void db.update(schema.mcpTokens).set({ lastUsedAt: new Date() }).where(eq(schema.mcpTokens.id, row.id)).catch(() => {});
  return { userId: row.userId, tokenId: row.id, name: row.name };
}

export async function listTokens(userId: string) {
  return getDb().select({ id: schema.mcpTokens.id, name: schema.mcpTokens.name, lastUsedAt: schema.mcpTokens.lastUsedAt, revokedAt: schema.mcpTokens.revokedAt, createdAt: schema.mcpTokens.createdAt }).from(schema.mcpTokens).where(eq(schema.mcpTokens.userId, userId));
}

export async function revokeToken(userId: string, id: string) {
  const r = await getDb().update(schema.mcpTokens).set({ revokedAt: new Date() }).where(and(eq(schema.mcpTokens.id, id), eq(schema.mcpTokens.userId, userId))).returning({ id: schema.mcpTokens.id });
  return r.length > 0;
}
