import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db/client";
import { getDeckRole } from "@/server/auth";
import { publicQuestion } from "@/server/public";
import { interleave, rng, shuffle } from "@/lib/interleave";
import { ExamClient } from "@/components/ExamClient";

export const dynamic = "force-dynamic";

export default async function ExamPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ count?: string; mix?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!(await getDeckRole(id, userId))) notFound();

  const db = getDb();
  const [deck] = await db.select().from(schema.decks).where(eq(schema.decks.id, id)).limit(1);
  const items = await db.select().from(schema.items).where(and(eq(schema.items.deckId, id), eq(schema.items.kind, "mcq")));
  const count = Math.min(200, Math.max(1, Number(sp.count) || 20));
  const seed = Math.floor(Date.now() / 60_000);
  const mixed = sp.mix === "1" ? interleave(items, (i) => i.blueprint ?? "general", seed) : shuffle(items, rng(seed));
  const questions = mixed.slice(0, count).map(publicQuestion);

  if (!questions.length) {
    return (
      <main className="flex h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-lg">This deck has no questions yet.</p>
        <p className="text-sm text-muted">Ask your connected agent to add some, or add them in the studio.</p>
        <Link href="/dashboard" className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper">Back to dashboard</Link>
      </main>
    );
  }
  return <ExamClient deckId={id} title={deck.title} questions={questions} />;
}
