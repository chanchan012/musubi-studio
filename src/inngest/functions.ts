import { Inngest } from "inngest";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import * as Y from "yjs";
import { getDb, schema } from "@/db/client";
import { putText } from "@/lib/r2-binding";
import { EXPORT_FORMATS, countsFromGroups, isVerified, render, type ExportFormat, type ExportItem } from "@/lib/analytics";
import { lb, roomId } from "@/server/liveblocks";

export const exportKey = (deckId: string, exportId: string, format: ExportFormat) => `exports/${deckId}/${exportId}.${EXPORT_FORMATS[format].ext}`;

/**
 * Env is read per request on Workers (process.env is empty at module load), so the client and its functions
 * are built by a factory that the /api/inngest handler calls for each request.
 */
export function buildInngest() {
  const inngest = new Inngest({ id: "musubi", eventKey: process.env.INNGEST_EVENT_KEY, signingKey: process.env.INNGEST_SIGNING_KEY });

  // Deck export -> R2 (CSV / JSON / Anki TSV)
  const exportDeck = inngest.createFunction(
    { id: "export-deck", retries: 2, triggers: [{ event: "deck/export.requested" }] },
    async ({ event, step }) => {
      const { deckId, exportId, format } = event.data as { deckId: string; exportId: string; format: ExportFormat };
      const items = await step.run("load-items", async () => {
        const rows = await getDb().select().from(schema.items).where(eq(schema.items.deckId, deckId)).orderBy(schema.items.createdAt);
        return rows.map((r): ExportItem => ({
          kind: r.kind, front: r.front, back: r.back, cloze: r.cloze, stem: r.stem, options: r.options, answerIdx: r.answerIdx,
          rationaleKey: r.rationales?.key ?? null, blueprint: r.blueprint, difficulty: r.difficulty, mnemonic: r.mnemonic, pearl: r.pearl, citation: r.citation,
        }));
      });
      const key = await step.run("write-r2", async () => {
        const k = exportKey(deckId, exportId, format);
        await putText(k, render(format, items), EXPORT_FORMATS[format].mime);
        return k;
      });
      return { key, count: items.length };
    },
  );

  // Item stats + Verified badges, every 6 hours (or on demand)
  const recalcStats = inngest.createFunction(
    { id: "recalc-stats", triggers: [{ cron: "0 */6 * * *" }, { event: "stats/recalc.requested" }] },
    async ({ step }) => {
      const updated = await step.run("recompute-item-stats", async () => {
        const db = getDb();
        const groups = await db.select({
          itemId: schema.attempts.itemId, choice: schema.attempts.choiceIdx,
          n: sql<number>`count(*)`.mapWith(Number), ok: sql<number>`count(*) filter (where ${schema.attempts.correct})`.mapWith(Number),
        }).from(schema.attempts).groupBy(schema.attempts.itemId, schema.attempts.choiceIdx);
        const byItem = new Map<string, { choice: number | null; n: number }[]>();
        const tot = new Map<string, { a: number; c: number }>();
        for (const g of groups) {
          byItem.set(g.itemId, [...(byItem.get(g.itemId) ?? []), { choice: g.choice, n: g.n }]);
          const t = tot.get(g.itemId) ?? { a: 0, c: 0 };
          tot.set(g.itemId, { a: t.a + g.n, c: t.c + g.ok });
        }
        const ids = [...tot.keys()];
        const opts = ids.length ? await db.select({ id: schema.items.id, options: schema.items.options }).from(schema.items).where(inArray(schema.items.id, ids)) : [];
        for (const o of opts) {
          const t = tot.get(o.id)!;
          const row = { attempts: t.a, correct: t.c, optionCounts: countsFromGroups(byItem.get(o.id) ?? [], (o.options ?? []).length), updatedAt: new Date() };
          await db.insert(schema.itemStats).values({ itemId: o.id, ...row }).onConflictDoUpdate({ target: schema.itemStats.itemId, set: row });
        }
        return opts.length;
      });
      const verified = await step.run("verify-posts", async () => {
        const db = getDb();
        const posts = await db.select({
          id: schema.communityPosts.id, score: schema.communityPosts.score, was: schema.communityPosts.verified,
          attempts: sql<number>`coalesce((select sum(s.attempts) from item_stats s join items i on i.id = s.item_id where i.deck_id = ${schema.communityPosts.deckId}), 0)`.mapWith(Number),
          openErrata: sql<number>`(select count(*) from errata e join items i on i.id = e.item_id where i.deck_id = ${schema.communityPosts.deckId} and not e.resolved)`.mapWith(Number),
        }).from(schema.communityPosts);
        let changed = 0;
        for (const p of posts) {
          const v = isVerified(p);
          if (v !== p.was) { await db.update(schema.communityPosts).set({ verified: v }).where(eq(schema.communityPosts.id, p.id)); changed++; }
        }
        return changed;
      });
      return { updated, verifiedChanged: verified };
    },
  );

  // Liveblocks (Yjs rationale text) -> Neon snapshot. Safety net for edits whose debounced save never landed.
  const snapshotDeck = inngest.createFunction(
    { id: "snapshot-deck", concurrency: 2, triggers: [{ event: "deck/snapshot.requested" }] },
    async ({ event, step }) => {
      const { deckId } = event.data as { deckId: string };
      return step.run("snapshot", () => snapshotRoom(deckId));
    },
  );
  const snapshotRecent = inngest.createFunction(
    { id: "snapshot-recent", triggers: [{ cron: "0 3 * * *" }] },
    async ({ step }) => {
      const ids = await step.run("recent-decks", async () => {
        const since = new Date(Date.now() - 7 * 864e5);
        const r = await getDb().select({ id: schema.decks.id }).from(schema.decks).where(gte(schema.decks.updatedAt, since)).orderBy(desc(schema.decks.updatedAt)).limit(50);
        return r.map((x) => x.id);
      });
      if (ids.length) await step.sendEvent("fan-out", ids.map((deckId) => ({ name: "deck/snapshot.requested", data: { deckId } })));
      return { decks: ids.length };
    },
  );

  return { inngest, functions: [exportDeck, recalcStats, snapshotDeck, snapshotRecent] };
}

/** Pull the room's Yjs doc from Liveblocks and write changed `rationale:{itemId}` text back to items.rationales.key. */
export async function snapshotRoom(deckId: string) {
  const live = lb();
  if (!live) return { skipped: "liveblocks not configured", changed: 0 };
  let update: ArrayBuffer;
  try {
    update = await live.getYjsDocumentAsBinaryUpdate(roomId(deckId));
  } catch {
    return { skipped: "no room yet", changed: 0 }; // nobody has opened the studio
  }
  const doc = new Y.Doc();
  Y.applyUpdate(doc, new Uint8Array(update));
  const db = getDb();
  const rows = await db.select({ id: schema.items.id, rationales: schema.items.rationales }).from(schema.items).where(eq(schema.items.deckId, deckId));
  let changed = 0;
  for (const r of rows) {
    const text = doc.getText(`rationale:${r.id}`).toString();
    if (!text || text === r.rationales?.key) continue;
    await db.update(schema.items).set({ rationales: { key: text, options: r.rationales?.options ?? [] }, updatedAt: new Date() })
      .where(and(eq(schema.items.id, r.id), eq(schema.items.deckId, deckId)));
    changed++;
  }
  return { changed };
}
