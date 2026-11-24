import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import type { FlashcardInput, ItemPatch, McqInput } from "@/lib/item-schemas";

export type Author = { kind: "human" | "ai"; userId: string };
const dbKind = (k: "human" | "ai") => (k === "ai" ? ("agent" as const) : ("human" as const));
type Row = typeof schema.items.$inferSelect;

/** Editor-facing view: includes the answer key (editors only; learners get publicQuestion). */
export function itemView(r: Row) {
  return {
    id: r.id, deckId: r.deckId, kind: r.kind, front: r.front, back: r.back, cloze: r.cloze,
    mnemonic: r.mnemonic, pearl: r.pearl, diagramKey: r.diagramKey, stem: r.stem, options: r.options,
    answerIdx: r.answerIdx, keyRationale: r.rationales?.key ?? null, optionRationales: r.rationales?.options ?? null,
    difficulty: r.difficulty, citation: r.citation, blueprint: r.blueprint, authorKind: (r.authorKind === "agent" ? "ai" : "human") as "ai" | "human",
    authorId: r.authorId, updatedAt: r.updatedAt,
  };
}
export type ItemView = ReturnType<typeof itemView>;

export async function listItems(deckId: string): Promise<ItemView[]> {
  const rows = await getDb().select().from(schema.items).where(eq(schema.items.deckId, deckId)).orderBy(schema.items.createdAt);
  return rows.map(itemView);
}

export async function createFlashcards(deckId: string, cards: FlashcardInput[], a: Author) {
  if (!cards.length) return [];
  const rows = await getDb().insert(schema.items).values(
    cards.map((c) => ({ deckId, kind: "card" as const, ...c, authorKind: dbKind(a.kind), authorId: a.userId })),
  ).returning();
  await touchDeck(deckId);
  return rows.map(itemView);
}

export async function createMcqs(deckId: string, qs: McqInput[], a: Author) {
  if (!qs.length) return [];
  const rows = await getDb().insert(schema.items).values(
    qs.map(({ keyRationale, optionRationales, ...q }) => ({
      deckId, kind: "mcq" as const, ...q,
      rationales: { key: keyRationale, options: optionRationales },
      authorKind: dbKind(a.kind), authorId: a.userId,
    })),
  ).returning();
  await touchDeck(deckId);
  return rows.map(itemView);
}

/** Apply a patch; rationale fields merge into the jsonb column. Returns before/after for undo. */
export async function updateItem(deckId: string, id: string, patch: ItemPatch) {
  const db = getDb();
  const [cur] = await db.select().from(schema.items).where(and(eq(schema.items.id, id), eq(schema.items.deckId, deckId))).limit(1);
  if (!cur) return null;
  const { keyRationale, optionRationales, ...rest } = patch;
  const set: Partial<typeof schema.items.$inferInsert> = { ...rest, updatedAt: new Date() };
  if (keyRationale !== undefined || optionRationales !== undefined) {
    set.rationales = {
      key: keyRationale ?? cur.rationales?.key ?? "",
      options: optionRationales ?? cur.rationales?.options ?? [],
    };
  }
  const [next] = await db.update(schema.items).set(set).where(eq(schema.items.id, id)).returning();
  await touchDeck(deckId);
  return { before: itemView(cur), after: itemView(next) };
}

export async function deleteItems(deckId: string, ids: string[]) {
  if (!ids.length) return 0;
  const res = await getDb().delete(schema.items).where(and(eq(schema.items.deckId, deckId), inArray(schema.items.id, ids))).returning({ id: schema.items.id });
  await touchDeck(deckId);
  return res.length;
}

async function touchDeck(deckId: string) {
  await getDb().update(schema.decks).set({ updatedAt: new Date() }).where(eq(schema.decks.id, deckId));
}

/** Topics where the user's error rate is highest (from attempts joined to items.blueprint). */
export async function weakTopics(userId: string, deckId: string, limit = 8) {
  const res = await getDb().execute(sql`
    select coalesce(i.blueprint, 'untagged') as topic, count(*)::int as attempts,
           avg(case when a.correct then 0 else 1 end)::float as error_rate
    from attempts a join items i on i.id = a.item_id
    where a.user_id = ${userId} and i.deck_id = ${deckId}
    group by 1 having count(*) >= 1 order by error_rate desc, attempts desc limit ${limit}`);
  return (res.rows ?? res) as { topic: string; attempts: number; error_rate: number }[];
}

/** Weakest blueprint topics across every deck the user belongs to (feeds the dashboard radar). */
export async function weakTopicsAll(userId: string, limit = 8) {
  const res = await getDb().execute(sql`
    select coalesce(i.blueprint, 'untagged') as topic, count(*)::int as attempts,
           avg(case when a.correct then 0 else 1 end)::float as error_rate
    from attempts a join items i on i.id = a.item_id
    where a.user_id = ${userId}
    group by 1 order by error_rate desc, attempts desc limit ${limit}`);
  return (res.rows ?? res) as { topic: string; attempts: number; error_rate: number }[];
}
