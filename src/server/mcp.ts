import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { assertDeckRole } from "./auth";
import { createFlashcards, createMcqs, updateItem, weakTopics } from "./items";
import { notifyItemsChanged } from "./liveblocks";
import { critiqueDistractors, flashcardInput, itemPatch, mcqInput } from "@/lib/item-schemas";
import { deckIdFromKey } from "@/lib/r2";

type Ctx = { userId: string; tokenName: string };
const text = (v: unknown) => ({ content: [{ type: "text" as const, text: typeof v === "string" ? v : JSON.stringify(v) }] });
const fail = (m: string) => ({ isError: true, content: [{ type: "text" as const, text: m }] });
const deckId = z.string().uuid().describe("Deck id (see the studio URL)");

/** Build the 8-tool Musubi MCP server for one authenticated caller. Every tool re-checks deck ACL. */
export function buildMcpServer(ctx: Ctx): McpServer {
  const server = new McpServer({ name: "musubi", version: "1.0.0" });
  const by = { kind: "ai" as const, name: ctx.tokenName };
  const author = { kind: "ai" as const, userId: ctx.userId };
  const can = (d: string, min: "viewer" | "editor") => assertDeckRole(d, ctx.userId, min);

  server.registerTool("create_flashcards_batch", {
    description: "Create up to 50 flashcards in a deck. Appear live in open studios, labelled AI.",
    inputSchema: { deckId, cards: z.array(flashcardInput).min(1).max(50) },
  }, async ({ deckId: d, cards }) => {
    if (!(await can(d, "editor"))) return fail("forbidden: editor access required");
    const created = await createFlashcards(d, cards, author);
    await notifyItemsChanged(d, by, created.length);
    return text({ created: created.map((c) => c.id) });
  });

  server.registerTool("create_mcqs_batch", {
    description: "Create up to 25 board-style MCQs (4-5 options, per-option rationales). Appear live, labelled AI.",
    inputSchema: { deckId, questions: z.array(mcqInput).min(1).max(25) },
  }, async ({ deckId: d, questions }) => {
    if (!(await can(d, "editor"))) return fail("forbidden: editor access required");
    const created = await createMcqs(d, questions, author);
    await notifyItemsChanged(d, by, created.length);
    return text({ created: created.map((c) => c.id) });
  });

  server.registerTool("update_card_item", {
    description: "Patch fields of an existing card or MCQ.",
    inputSchema: { deckId, itemId: z.string().uuid(), patch: itemPatch },
  }, async ({ deckId: d, itemId, patch }) => {
    if (!(await can(d, "editor"))) return fail("forbidden: editor access required");
    const r = await updateItem(d, itemId, patch);
    if (!r) return fail("item not found");
    await notifyItemsChanged(d, by, 1);
    return text({ updated: itemId });
  });

  server.registerTool("attach_r2_diagram", {
    description: "Attach an uploaded R2 diagram (key from the uploads API, under decks/{deckId}/) to an item.",
    inputSchema: { deckId, itemId: z.string().uuid(), r2Key: z.string().max(500) },
  }, async ({ deckId: d, itemId, r2Key }) => {
    if (!(await can(d, "editor"))) return fail("forbidden: editor access required");
    if (r2Key.includes("..") || deckIdFromKey(r2Key) !== d) return fail("r2Key must live under this deck's prefix");
    const r = await updateItem(d, itemId, { diagramKey: r2Key });
    if (!r) return fail("item not found");
    await notifyItemsChanged(d, by, 1);
    return text({ attached: r2Key });
  });

  server.registerTool("tag_exam_blueprint", {
    description: "Set the exam-blueprint domain/topic on many items at once.",
    inputSchema: { deckId, tags: z.array(z.object({ itemId: z.string().uuid(), blueprint: z.string().min(1).max(120) })).min(1).max(100) },
  }, async ({ deckId: d, tags }) => {
    if (!(await can(d, "editor"))) return fail("forbidden: editor access required");
    let n = 0;
    for (const t of tags) if (await updateItem(d, t.itemId, { blueprint: t.blueprint })) n++;
    await notifyItemsChanged(d, by, n);
    return text({ tagged: n });
  });

  server.registerTool("critique_distractors", {
    description: "Heuristic critique of an MCQ's distractors (length cues, all-of-the-above, duplicates). Pass itemId or inline options.",
    inputSchema: { deckId, itemId: z.string().uuid().optional(), options: z.array(z.string()).min(4).max(5).optional(), answerIdx: z.number().int().min(0).max(4).optional() },
  }, async ({ deckId: d, itemId, options, answerIdx }) => {
    if (!(await can(d, "viewer"))) return fail("forbidden");
    let opts = options, idx = answerIdx;
    if (itemId) {
      const [row] = await getDb().select().from(schema.items).where(and(eq(schema.items.id, itemId), eq(schema.items.deckId, d))).limit(1);
      if (!row?.options || row.answerIdx == null) return fail("MCQ not found");
      opts = row.options; idx = row.answerIdx;
    }
    if (!opts || idx == null) return fail("provide itemId, or options and answerIdx");
    return text({ notes: critiqueDistractors({ options: opts, answerIdx: idx }) });
  });

  server.registerTool("publish_to_community", {
    description: "Publish a deck to the community library (owner only). Requires a track.",
    inputSchema: { deckId, track: z.string().min(1).max(60), subject: z.string().max(80).optional(), topic: z.string().max(120).optional() },
  }, async ({ deckId: d, track, subject, topic }) => {
    if (!(await assertDeckRole(d, ctx.userId, "owner"))) return fail("forbidden: owner access required");
    const [post] = await getDb().insert(schema.communityPosts).values({ deckId: d, publisherId: ctx.userId, track, subject, topic }).returning({ id: schema.communityPosts.id });
    return text({ postId: post.id });
  });

  server.registerTool("query_weak_topics", {
    description: "The caller's weakest blueprint topics in a deck, by error rate. Use it to target new questions.",
    inputSchema: { deckId, limit: z.number().int().min(1).max(20).optional() },
  }, async ({ deckId: d, limit }) => {
    if (!(await can(d, "viewer"))) return fail("forbidden");
    return text({ topics: await weakTopics(ctx.userId, d, limit ?? 8) });
  });

  return server;
}
