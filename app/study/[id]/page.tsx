import { currentUserId } from "@/server/identity";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db/client";
import { getDeckRole } from "@/server/auth";
import { StudyClient } from "@/components/study/StudyClient";

export const dynamic = "force-dynamic";

export default async function StudyDeck({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const userId = await currentUserId();
  if (!userId) redirect("/sign-in");
  if (!(await getDeckRole(id, userId))) notFound();
  const [deck] = await getDb().select({ title: schema.decks.title }).from(schema.decks).where(eq(schema.decks.id, id)).limit(1);
  return <StudyClient deckId={id} title={deck?.title ?? "Deck"} />;
}
