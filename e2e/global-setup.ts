import { existsSync } from "node:fs";
import { eq, inArray } from "drizzle-orm";
import { ALICE, BOB, DECK, POST, cardIds, mcqIds } from "./fixtures";

/** Seeds two users, one shared deck (cards + MCQs) and a community post in the real Neon db; tears them down after. */
export default async function setup() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const { getDb, schema } = await import("../src/db/client");
  const db = getDb();
  const clean = async () => {
    await db.delete(schema.decks).where(eq(schema.decks.id, DECK)); // cascades items, members, post, attempts
    await db.delete(schema.users).where(inArray(schema.users.id, [ALICE, BOB]));
  };
  await clean();
  await db.insert(schema.users).values([{ id: ALICE, name: "Alice E2E" }, { id: BOB, name: "Bob E2E" }]);
  await db.insert(schema.decks).values({ id: DECK, ownerId: ALICE, title: "E2E Pharmacology", description: "Seeded by Playwright", examTrack: "NCLEX-RN", isPublic: true });
  await db.insert(schema.deckMembers).values([{ deckId: DECK, userId: ALICE, role: "owner" }, { deckId: DECK, userId: BOB, role: "editor" }]);
  await db.insert(schema.items).values([
    ...mcqIds.map((id, n) => ({
      id, deckId: DECK, kind: "mcq" as const, stem: `Which drug class treats condition ${n + 1}?`,
      options: ["Alpha", "Beta", "Gamma", "Delta"], answerIdx: n % 4, difficulty: "application" as const, blueprint: n === 0 ? "Cardio" : "Renal",
      rationales: { key: `Because ${n + 1}`, options: ["a", "b", "c", "d"] },
    })),
    ...cardIds.map((id, n) => ({ id, deckId: DECK, kind: "card" as const, front: `Card front ${n + 1}`, back: `Card back ${n + 1}`, blueprint: "Cardio" })),
  ]);
  await db.insert(schema.communityPosts).values({ id: POST, deckId: DECK, publisherId: ALICE, track: "NCLEX-RN", subject: "Pharm" });
  return clean;
}
