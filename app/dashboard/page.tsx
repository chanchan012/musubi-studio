import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { UserButton } from "@clerk/nextjs";
import { getDb, schema } from "@/db/client";
import { NewDeckForm } from "@/components/NewDeckForm";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const db = getDb();

  const rows = await db
    .select({
      deck: schema.decks, role: schema.deckMembers.role,
      items: count(schema.items.id),
      mcqs: sql<number>`count(*) filter (where ${schema.items.kind} = 'mcq')`.mapWith(Number),
    })
    .from(schema.deckMembers)
    .innerJoin(schema.decks, eq(schema.decks.id, schema.deckMembers.deckId))
    .leftJoin(schema.items, eq(schema.items.deckId, schema.decks.id))
    .where(eq(schema.deckMembers.userId, userId))
    .groupBy(schema.decks.id, schema.deckMembers.role)
    .orderBy(desc(schema.decks.updatedAt));

  const [{ n: errors }] = await db.select({ n: count() }).from(schema.errorLog).where(and(eq(schema.errorLog.userId, userId)));

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold"><span aria-hidden className="text-xl text-seal">結</span> Musubi</Link>
        <nav className="ml-auto flex items-center gap-3 text-sm">
          <UserButton />
        </nav>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-4xl space-y-8">
          <section><NewDeckForm /></section>

          <section aria-label="Your decks">
            <div className="mb-3 flex items-baseline justify-between">
              <h1 className="text-xl font-semibold">Your decks</h1>
              <p className="text-sm text-muted tabular-nums">{errors} in your Error Log</p>
            </div>
            {rows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line p-8 text-center text-muted">
                No decks yet. Create one above, then let your AI agent fill it with questions over MCP.
              </div>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {rows.map(({ deck, role, items, mcqs }) => (
                  <li key={deck.id} className="rounded-xl border border-line bg-card p-4">
                    <div className="flex items-start gap-2">
                      <h2 className="min-w-0 flex-1 truncate font-medium">{deck.title}</h2>
                      <span className="rounded-sm border border-line px-1.5 py-0.5 text-[11px] capitalize text-muted">{role}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted tabular-nums">{items} items · {mcqs} questions</p>
                    <div className="mt-4 flex gap-2">
                      <Link href={`/exam/${deck.id}`} aria-disabled={mcqs === 0}
                        className={`min-h-10 rounded-lg px-3 py-2 text-sm font-medium ${mcqs ? "bg-ink text-paper" : "pointer-events-none bg-line text-muted"}`}>Take exam</Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
