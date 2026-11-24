import { currentUserId } from "@/server/identity";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db/client";
import { getDeckRole } from "@/server/auth";
import { listItems } from "@/server/items";
import { StudioClient } from "@/components/studio/StudioClient";

export const dynamic = "force-dynamic";

export default async function StudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const userId = await currentUserId();
  if (!userId) redirect("/sign-in");
  const role = await getDeckRole(id, userId);
  if (!role) notFound();
  const [deck] = await getDb().select().from(schema.decks).where(eq(schema.decks.id, id)).limit(1);
  if (!deck) notFound();
  const items = await listItems(id);
  return <StudioClient deckId={id} title={deck.title} role={role} initialItems={items} liveblocksReady={!!process.env.LIVEBLOCKS_SECRET_KEY} backHref="/dashboard" />;
}
