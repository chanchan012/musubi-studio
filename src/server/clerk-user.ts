import { createClerkClient } from "@clerk/backend";
import { getDb, schema } from "@/db/client";

/** Mirrors a Clerk user into Neon on demand (covers the window before the webhook fires). */
export const clerkClient = {
  async ensureUser(userId: string) {
    const db = getDb();
    const secretKey = process.env.CLERK_SECRET_KEY;
    let email: string | null = null, name: string | null = null, imageUrl: string | null = null;
    if (secretKey) {
      try {
        const u = await createClerkClient({ secretKey }).users.getUser(userId);
        email = u.primaryEmailAddress?.emailAddress ?? null;
        name = [u.firstName, u.lastName].filter(Boolean).join(" ") || null;
        imageUrl = u.imageUrl ?? null;
      } catch { /* fall through with bare row */ }
    }
    await db.insert(schema.users).values({ id: userId, email, name, imageUrl }).onConflictDoNothing();
  },
};
