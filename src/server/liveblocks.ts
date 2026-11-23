import { Liveblocks } from "@liveblocks/node";

export const roomId = (deckId: string) => `deck:${deckId}`;
export const deckIdFromRoom = (room: string) => (room.startsWith("deck:") ? room.slice(5) : null);

export function lb(): Liveblocks | null {
  const secret = process.env.LIVEBLOCKS_SECRET_KEY;
  return secret ? new Liveblocks({ secret }) : null;
}

/** Tell connected studios to refetch. Best effort: never fails the write. */
export async function notifyItemsChanged(deckId: string, by: { kind: "human" | "ai"; name: string }, count: number) {
  try {
    await lb()?.broadcastEvent(roomId(deckId), { type: "items-changed", by, count });
  } catch (e) {
    console.error("liveblocks broadcast failed", e);
  }
}
