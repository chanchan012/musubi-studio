import { cookies } from "next/headers";

/**
 * Signed-in user for server components. E2E_NO_AUTH=1 is set only by the Playwright web server (Clerk's dev handshake
 * can't run in the test box): identity then comes from the `e2e_user` cookie or E2E_USER_ID. Never set it in production.
 */
export async function currentUserId(): Promise<string | null> {
  if (process.env.E2E_NO_AUTH === "1") return (await cookies()).get("e2e_user")?.value ?? process.env.E2E_USER_ID ?? null;
  const { auth } = await import("@clerk/nextjs/server");
  return (await auth().catch(() => ({ userId: null }))).userId ?? null;
}

/** Same bypass for Hono routes, from a raw Cookie header. */
export function e2eUserFromCookie(header: string | undefined): string | null {
  if (process.env.E2E_NO_AUTH !== "1") return null;
  const m = /(?:^|;\s*)e2e_user=([^;]+)/.exec(header ?? "");
  return m ? decodeURIComponent(m[1]) : (process.env.E2E_USER_ID ?? null);
}
