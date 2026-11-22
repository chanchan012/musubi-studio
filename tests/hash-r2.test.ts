import { describe, expect, it } from "vitest";
import { sha256Hex } from "@/lib/hash";
import { assetKey, deckIdFromKey } from "@/lib/r2";

const DECK = "123e4567-e89b-42d3-a456-426614174000";

describe("sha256Hex", () => {
  it("matches the known digest of 'abc'", async () => {
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("R2 keys", () => {
  it("namespaces by deck and sanitises filenames", () => {
    const key = assetKey(DECK, "My Diagram (v2).PNG", "rand");
    expect(key).toBe(`decks/${DECK}/rand-my-diagram-v2.png`);
    expect(deckIdFromKey(key)).toBe(DECK);
  });
  it("rejects keys outside a deck namespace", () => {
    expect(deckIdFromKey("exports/foo.csv")).toBeNull();
    expect(deckIdFromKey("decks/not-a-uuid/x.png")).toBeNull();
  });
});
