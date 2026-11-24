import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { UserButton } from "@clerk/nextjs";
import { getDb, schema } from "@/db/client";
import { NewDeckForm } from "@/components/NewDeckForm";
import { DeckTools } from "@/components/community/DeckTools";
import { MasteryLadder } from "@/components/study/MasteryLadder";
import { WeakRadar } from "@/components/study/WeakRadar";
import { weakTopicsAll } from "@/server/items";
import { bucketCounts } from "@/lib/leitner";
import type { ReviewRow } from "@/lib/fsrs";

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

  // Study state for every item in the user's decks: due queue per deck + mastery ladder overall.
  const now = new Date();
  const states = await db
    .select({ deckId: schema.items.deckId, rs: schema.reviewStates })
    .from(schema.items)
    .innerJoin(schema.deckMembers, and(eq(schema.deckMembers.deckId, schema.items.deckId), eq(schema.deckMembers.userId, userId)))
    .leftJoin(schema.reviewStates, and(eq(schema.reviewStates.itemId, schema.items.id), eq(schema.reviewStates.userId, userId)));
  const asRow = (r: typeof schema.reviewStates.$inferSelect | null): ReviewRow | null =>
    r ? { due: r.due, stability: r.stability, difficulty: r.difficulty, elapsedDays: r.elapsedDays, scheduledDays: r.scheduledDays, learningSteps: r.learningSteps, reps: r.reps, lapses: r.lapses, state: r.state, lastReview: r.lastReview } : null;
  const dueByDeck = new Map<string, { due: number; fresh: number }>();
  for (const { deckId, rs } of states) {
    const d = dueByDeck.get(deckId) ?? { due: 0, fresh: 0 };
    if (!rs) d.fresh++; else if (rs.due <= now) d.due++;
    dueByDeck.set(deckId, d);
  }
  const ladder = bucketCounts(states.map((x) => asRow(x.rs)));
  const dueTotal = [...dueByDeck.values()].reduce((n, d) => n + d.due, 0);
  const freshTotal = [...dueByDeck.values()].reduce((n, d) => n + d.fresh, 0);
  const weak = await weakTopicsAll(userId);

  const [{ n: errors }] = await db.select({ n: count() }).from(schema.errorLog).where(and(eq(schema.errorLog.userId, userId)));

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold"><span aria-hidden className="text-xl text-seal">結</span> Musubi</Link>
        <nav className="ml-auto flex items-center gap-3 text-sm">
          <Link href="/community" className="rounded-lg px-3 py-2 hover:bg-card">Community</Link>
          <UserButton />
        </nav>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-4xl space-y-8">
          <section aria-label="Today" className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-line bg-card p-4">
              <p className="text-xs uppercase tracking-widest text-muted">Due today</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums">{dueTotal}</p>
              <p className="text-xs text-muted tabular-nums">{freshTotal} new cards waiting</p>
              <Link href="/study" className={`mt-3 inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-medium ${dueTotal + freshTotal ? "bg-ink text-paper" : "pointer-events-none bg-line text-muted"}`}>Start studying</Link>
            </div>
            <div className="rounded-xl border border-line bg-card p-4 sm:col-span-2">
              <p className="mb-3 text-xs uppercase tracking-widest text-muted">Mastery ladder</p>
              <MasteryLadder counts={ladder} />
            </div>
            <div className="rounded-xl border border-line bg-card p-4 sm:col-span-3">
              <p className="mb-3 text-xs uppercase tracking-widest text-muted">Weak topics</p>
              <WeakRadar topics={weak} />
            </div>
          </section>

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
                    <p className="mt-1 text-sm tabular-nums"><span className="font-medium">{dueByDeck.get(deck.id)?.due ?? 0}</span> due · <span className="text-muted">{dueByDeck.get(deck.id)?.fresh ?? 0} new</span></p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link href={`/study/${deck.id}`} className="min-h-10 rounded-lg bg-ink px-3 py-2 text-sm font-medium text-paper">Study</Link>
                      <Link href={`/studio/${deck.id}`} className="min-h-10 rounded-lg border border-line px-3 py-2 text-sm font-medium">Open studio</Link>
                      <Link href={`/exam/${deck.id}`} aria-disabled={mcqs === 0}
                        className={`min-h-10 rounded-lg border border-line px-3 py-2 text-sm font-medium ${mcqs ? "" : "pointer-events-none text-muted"}`}>Take exam</Link>
                    </div>
                    {deck.forkedFromDeckId && <p className="mt-2 text-xs text-muted">Forked from a community deck</p>}
                    <DeckTools deckId={deck.id} isOwner={role === "owner"} defaultTrack={deck.examTrack ?? ""} />
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
