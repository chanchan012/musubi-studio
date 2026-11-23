import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { difficultyBand, distractorRates, pValue } from "@/lib/analytics";

export type PostFilter = { q?: string; track?: string; subject?: string; sort?: "top" | "new" | "verified"; limit?: number; offset?: number };

const esc = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function listPosts(f: PostFilter) {
  const db = getDb();
  const conds = [];
  if (f.track) conds.push(eq(schema.communityPosts.track, f.track));
  if (f.subject) conds.push(eq(schema.communityPosts.subject, f.subject));
  if (f.sort === "verified") conds.push(eq(schema.communityPosts.verified, true));
  if (f.q?.trim()) {
    const like = `%${esc(f.q.trim())}%`;
    conds.push(or(ilike(schema.decks.title, like), ilike(schema.decks.description, like), ilike(schema.communityPosts.topic, like), ilike(schema.communityPosts.subject, like)));
  }
  const order = f.sort === "new" ? desc(schema.communityPosts.createdAt) : desc(schema.communityPosts.score);
  return db
    .select({
      id: schema.communityPosts.id, deckId: schema.communityPosts.deckId, title: schema.decks.title, description: schema.decks.description,
      track: schema.communityPosts.track, subject: schema.communityPosts.subject, topic: schema.communityPosts.topic,
      score: schema.communityPosts.score, verified: schema.communityPosts.verified, createdAt: schema.communityPosts.createdAt,
      publisher: schema.users.name,
      items: sql<number>`(select count(*) from items i where i.deck_id = ${schema.communityPosts.deckId})`.mapWith(Number),
    })
    .from(schema.communityPosts)
    .innerJoin(schema.decks, eq(schema.decks.id, schema.communityPosts.deckId))
    .innerJoin(schema.users, eq(schema.users.id, schema.communityPosts.publisherId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(order, desc(schema.communityPosts.createdAt))
    .limit(Math.min(f.limit ?? 24, 50))
    .offset(f.offset ?? 0);
}

export async function facets() {
  const db = getDb();
  const [tracks, subjects] = await Promise.all([
    db.selectDistinct({ v: schema.communityPosts.track }).from(schema.communityPosts).orderBy(schema.communityPosts.track),
    db.selectDistinct({ v: schema.communityPosts.subject }).from(schema.communityPosts).orderBy(schema.communityPosts.subject),
  ]);
  return { tracks: tracks.map((t) => t.v), subjects: subjects.map((s) => s.v).filter((s): s is string => !!s) };
}

/** Public view of a post: learner-safe items (no key/rationales for MCQs) with analytics and open-errata counts. */
export async function getPost(id: string, viewerId?: string | null) {
  const db = getDb();
  const [post] = await db
    .select({
      id: schema.communityPosts.id, deckId: schema.communityPosts.deckId, publisherId: schema.communityPosts.publisherId,
      track: schema.communityPosts.track, subject: schema.communityPosts.subject, topic: schema.communityPosts.topic,
      score: schema.communityPosts.score, verified: schema.communityPosts.verified, createdAt: schema.communityPosts.createdAt,
      title: schema.decks.title, description: schema.decks.description, publisher: schema.users.name,
    })
    .from(schema.communityPosts)
    .innerJoin(schema.decks, eq(schema.decks.id, schema.communityPosts.deckId))
    .innerJoin(schema.users, eq(schema.users.id, schema.communityPosts.publisherId))
    .where(eq(schema.communityPosts.id, id)).limit(1);
  if (!post) return null;

  const rows = await db.select().from(schema.items).where(eq(schema.items.deckId, post.deckId)).orderBy(schema.items.createdAt);
  const ids = rows.map((r) => r.id);
  const [stats, errs, mine] = ids.length ? await Promise.all([
    db.select().from(schema.itemStats).where(inArray(schema.itemStats.itemId, ids)),
    db.select({ itemId: schema.errata.itemId, n: sql<number>`count(*) filter (where not ${schema.errata.resolved})`.mapWith(Number) })
      .from(schema.errata).where(inArray(schema.errata.itemId, ids)).groupBy(schema.errata.itemId),
    viewerId ? db.select().from(schema.communityVotes).where(and(eq(schema.communityVotes.postId, id), eq(schema.communityVotes.userId, viewerId))) : Promise.resolve([]),
  ]) : [[], [], []];
  const statOf = new Map(stats.map((s) => [s.itemId, s]));
  const errOf = new Map(errs.map((e) => [e.itemId, e.n]));

  const items = rows.map((r) => {
    const s = statOf.get(r.id);
    const attempts = s?.attempts ?? 0;
    const p = pValue(s?.correct ?? 0, attempts);
    return {
      id: r.id, kind: r.kind, front: r.front, stem: r.stem, options: r.options ?? [], blueprint: r.blueprint, difficulty: r.difficulty,
      authorKind: r.authorKind, openErrata: errOf.get(r.id) ?? 0,
      attempts, p, band: difficultyBand(p),
      distractors: r.kind === "mcq" ? distractorRates(s?.optionCounts ?? null, r.answerIdx, attempts) : [],
    };
  });
  return { post, items, myVote: (mine as { value: number }[])[0]?.value ?? 0 };
}

export async function vote(postId: string, userId: string, value: -1 | 0 | 1) {
  const db = getDb();
  if (value === 0) await db.delete(schema.communityVotes).where(and(eq(schema.communityVotes.postId, postId), eq(schema.communityVotes.userId, userId)));
  else await db.insert(schema.communityVotes).values({ postId, userId, value }).onConflictDoUpdate({ target: [schema.communityVotes.postId, schema.communityVotes.userId], set: { value } });
  const [{ s }] = await db.select({ s: sql<number>`coalesce(sum(${schema.communityVotes.value}), 0)`.mapWith(Number) }).from(schema.communityVotes).where(eq(schema.communityVotes.postId, postId));
  await db.update(schema.communityPosts).set({ score: s }).where(eq(schema.communityPosts.id, postId));
  return s;
}

/** Errata can only be filed against items in a published deck. */
export async function addErratum(itemId: string, userId: string, body: string) {
  const db = getDb();
  const [hit] = await db.select({ id: schema.items.id }).from(schema.items)
    .innerJoin(schema.communityPosts, eq(schema.communityPosts.deckId, schema.items.deckId)).where(eq(schema.items.id, itemId)).limit(1);
  if (!hit) return null;
  const [row] = await db.insert(schema.errata).values({ itemId, userId, body }).returning({ id: schema.errata.id });
  return row.id;
}

/** Publish (or re-publish) a deck. Owner-checked by callers. */
export async function publishDeck(deckId: string, userId: string, meta: { track: string; subject?: string | null; topic?: string | null }) {
  const db = getDb();
  const [post] = await db.insert(schema.communityPosts)
    .values({ deckId, publisherId: userId, track: meta.track, subject: meta.subject ?? null, topic: meta.topic ?? null })
    .onConflictDoUpdate({ target: schema.communityPosts.deckId, set: { track: meta.track, subject: meta.subject ?? null, topic: meta.topic ?? null } })
    .returning({ id: schema.communityPosts.id });
  await db.update(schema.decks).set({ isPublic: true }).where(eq(schema.decks.id, deckId));
  return post.id;
}

/** Copy a published deck into the caller's library, keeping attribution on the deck and a forkedFrom link on each item. */
export async function cloneDeck(postId: string, userId: string) {
  const db = getDb();
  const [src] = await db.select({ deck: schema.decks, publisherId: schema.communityPosts.publisherId, track: schema.communityPosts.track })
    .from(schema.communityPosts).innerJoin(schema.decks, eq(schema.decks.id, schema.communityPosts.deckId))
    .where(eq(schema.communityPosts.id, postId)).limit(1);
  if (!src) return null;
  const [deck] = await db.insert(schema.decks).values({
    ownerId: userId, title: `${src.deck.title} (fork)`, description: src.deck.description, examTrack: src.track, subject: src.deck.subject,
    forkedFromDeckId: src.deck.id, forkedFromUserId: src.publisherId,
  }).returning({ id: schema.decks.id });
  await db.insert(schema.deckMembers).values({ deckId: deck.id, userId, role: "owner" });
  const rows = await db.select().from(schema.items).where(eq(schema.items.deckId, src.deck.id));
  for (let i = 0; i < rows.length; i += 100) {
    await db.insert(schema.items).values(rows.slice(i, i + 100).map((r) => ({
      deckId: deck.id, kind: r.kind, front: r.front, back: r.back, cloze: r.cloze, mnemonic: r.mnemonic, pearl: r.pearl, compareTable: r.compareTable,
      stem: r.stem, options: r.options, answerIdx: r.answerIdx, rationales: r.rationales, difficulty: r.difficulty, citation: r.citation,
      blueprint: r.blueprint, authorKind: r.authorKind, authorId: r.authorId, forkedFrom: r.id,
    })));
  }
  return { deckId: deck.id, items: rows.length };
}

/** Only the deck owner can resolve an erratum on their items. */
export async function resolveErratum(errId: string, userId: string) {
  const db = getDb();
  const [hit] = await db.select({ id: schema.errata.id, deckId: schema.items.deckId }).from(schema.errata)
    .innerJoin(schema.items, eq(schema.items.id, schema.errata.itemId)).where(eq(schema.errata.id, errId)).limit(1);
  if (!hit) return "missing" as const;
  const [m] = await db.select({ role: schema.deckMembers.role }).from(schema.deckMembers)
    .where(and(eq(schema.deckMembers.deckId, hit.deckId), eq(schema.deckMembers.userId, userId))).limit(1);
  if (m?.role !== "owner") return "forbidden" as const;
  await db.update(schema.errata).set({ resolved: true }).where(eq(schema.errata.id, errId));
  return "ok" as const;
}
