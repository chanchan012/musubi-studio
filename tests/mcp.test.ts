import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildMcpServer } from "@/server/mcp";
import { newTokenValue, TOKEN_PREFIX } from "@/server/mcp-tokens";
import { sha256Hex } from "@/lib/hash";

describe("mcp", () => {
  it("exposes exactly the 8 tools with Zod-derived schemas", async () => {
    const [a, b] = InMemoryTransport.createLinkedPair();
    await buildMcpServer({ userId: "u", tokenName: "t" }).connect(b);
    const client = new Client({ name: "test", version: "0" });
    await client.connect(a);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "attach_r2_diagram", "create_flashcards_batch", "create_mcqs_batch", "critique_distractors",
      "publish_to_community", "query_weak_topics", "tag_exam_blueprint", "update_card_item",
    ]);
    expect(tools.every((t) => t.inputSchema.type === "object")).toBe(true);
  });
  it("rejects invalid input before touching the db", async () => {
    const [a, b] = InMemoryTransport.createLinkedPair();
    await buildMcpServer({ userId: "u", tokenName: "t" }).connect(b);
    const client = new Client({ name: "test", version: "0" });
    await client.connect(a);
    const r = await client.callTool({ name: "create_mcqs_batch", arguments: { deckId: "nope", questions: [] } }).catch((e) => ({ isError: true, e }));
    expect((r as { isError?: boolean }).isError).toBe(true);
  });
  it("tokens are prefixed, unique and hash to 64 hex", async () => {
    const t = newTokenValue();
    expect(t.startsWith(TOKEN_PREFIX)).toBe(true);
    expect(newTokenValue()).not.toBe(t);
    expect(await sha256Hex(t)).toMatch(/^[0-9a-f]{64}$/);
  });
});
