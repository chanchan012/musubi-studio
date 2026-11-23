"use client";
import { create } from "zustand";
import { createClient } from "@liveblocks/client";
import { liveblocks, type WithLiveblocks } from "@liveblocks/zustand";
import { canRedo, canUndo, describe, emptyHistory, push, redo, undo, type Actor, type Command, type History } from "./history";
import type { ItemView } from "@/server/items";
import type { ItemPatch } from "./item-schemas";

type Presence = { editing: string | null; cursorLabel: string | null };
/** Forward/inverse payloads are item patches (or a create/delete pair for add/remove). */
export type Op = { type: "patch"; itemId: string; patch: ItemPatch } | { type: "restore"; item: ItemView } | { type: "remove"; itemId: string };

export type Toast = { id: number; text: string; ai: boolean };

type State = {
  deckId: string;
  role: "owner" | "editor" | "viewer";
  items: ItemView[];
  selectedId: string | null;
  history: History<Op>;
  toasts: Toast[];
  busy: boolean;
  editing: string | null; // presence: item I am editing
  cursorLabel: string | null;
  init: (deckId: string, role: State["role"], items: ItemView[]) => void;
  select: (id: string | null) => void;
  setEditing: (id: string | null) => void;
  refetch: (actor?: Actor, count?: number) => Promise<void>;
  patchItem: (itemId: string, patch: ItemPatch, label: string) => Promise<boolean>;
  addCard: () => Promise<void>;
  addMcq: () => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  dismissToast: (id: number) => void;
};

const HUMAN: Actor = { kind: "human", name: "you" };
let toastId = 0;

async function api<T>(deckId: string, path: string, init?: RequestInit): Promise<T | null> {
  const res = await fetch(`/api/studio/decks/${deckId}${path}`, { ...init, headers: { "content-type": "application/json" } });
  return res.ok ? ((await res.json()) as T) : null;
}

export const client = createClient({
  authEndpoint: async (room) => {
    const res = await fetch("/api/studio/liveblocks-auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ room }) });
    if (!res.ok) throw new Error("liveblocks auth failed");
    return res.json();
  },
  throttle: 50,
});

export const useStudio = create<WithLiveblocks<State, Presence>>()(
  liveblocks(
    (set, get) => ({
      deckId: "", role: "viewer", items: [], selectedId: null, history: emptyHistory<Op>(), toasts: [], busy: false, editing: null, cursorLabel: null,

      init: (deckId, role, items) => set({ deckId, role, items, selectedId: items[0]?.id ?? null, history: emptyHistory<Op>() }),
      select: (id) => set({ selectedId: id }),
      setEditing: (id) => set({ editing: id }),
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

      refetch: async (actor, count) => {
        const r = await api<{ items: ItemView[] }>(get().deckId, "/items");
        if (!r) return;
        set((s) => ({
          items: r.items,
          selectedId: r.items.some((i) => i.id === s.selectedId) ? s.selectedId : (r.items[0]?.id ?? null),
          toasts: actor && actor.name !== "you" && count
            ? [...s.toasts, { id: ++toastId, ai: actor.kind === "ai", text: `${actor.kind === "ai" ? "AI" : "Human"} · ${actor.name} changed ${count} item${count === 1 ? "" : "s"}` }].slice(-3)
            : s.toasts,
        }));
      },

      patchItem: async (itemId, patch, label) => {
        const { deckId, items } = get();
        const before = items.find((i) => i.id === itemId);
        if (!before) return false;
        const r = await api<{ before: ItemView; after: ItemView }>(deckId, `/items/${itemId}`, { method: "PATCH", body: JSON.stringify(patch) });
        if (!r) return false;
        const inverse: ItemPatch = {};
        for (const k of Object.keys(patch) as (keyof ItemPatch)[]) (inverse as Record<string, unknown>)[k] = (r.before as unknown as Record<string, unknown>)[k];
        const cmd: Command<Op> = { id: crypto.randomUUID(), label, actor: HUMAN, at: Date.now(), forward: { type: "patch", itemId, patch }, inverse: { type: "patch", itemId, patch: inverse } };
        set((s) => ({ items: s.items.map((i) => (i.id === itemId ? r.after : i)), history: push(s.history, cmd) }));
        return true;
      },

      addCard: async () => {
        const r = await api<{ items: ItemView[] }>(get().deckId, "/items", { method: "POST", body: JSON.stringify({ cards: [{ front: "New card — front", back: "Back" }] }) });
        if (!r) return;
        const item = r.items[0];
        set((s) => ({ items: [...s.items, item], selectedId: item.id, history: push(s.history, { id: crypto.randomUUID(), label: "add card", actor: HUMAN, at: Date.now(), forward: { type: "restore", item }, inverse: { type: "remove", itemId: item.id } }) }));
      },

      addMcq: async () => {
        const q = { stem: "New question stem", options: ["Option A", "Option B", "Option C", "Option D"], answerIdx: 0, keyRationale: "Why A is correct", optionRationales: ["Correct", "Why B is wrong", "Why C is wrong", "Why D is wrong"] };
        const r = await api<{ items: ItemView[] }>(get().deckId, "/items", { method: "POST", body: JSON.stringify({ questions: [q] }) });
        if (!r) return;
        const item = r.items[0];
        set((s) => ({ items: [...s.items, item], selectedId: item.id, history: push(s.history, { id: crypto.randomUUID(), label: "add MCQ", actor: HUMAN, at: Date.now(), forward: { type: "restore", item }, inverse: { type: "remove", itemId: item.id } }) }));
      },

      removeItem: async (itemId) => {
        const item = get().items.find((i) => i.id === itemId);
        if (!item) return;
        const r = await api<{ deleted: number }>(get().deckId, `/items/${itemId}`, { method: "DELETE" });
        if (!r) return;
        set((s) => ({ items: s.items.filter((i) => i.id !== itemId), selectedId: s.selectedId === itemId ? null : s.selectedId, history: push(s.history, { id: crypto.randomUUID(), label: "delete item", actor: HUMAN, at: Date.now(), forward: { type: "remove", itemId }, inverse: { type: "restore", item } }) }));
      },

      undo: async () => { await step(get, set, "undo"); },
      redo: async () => { await step(get, set, "redo"); },
    }),
    { client, presenceMapping: { editing: true, cursorLabel: true } },
  ),
);

async function step(get: () => State, set: (p: Partial<State> | ((s: State) => Partial<State>)) => void, dir: "undo" | "redo") {
  const s = get();
  const { history, cmd } = dir === "undo" ? undo(s.history) : redo(s.history);
  if (!cmd) return;
  set({ busy: true });
  const op = dir === "undo" ? cmd.inverse : cmd.forward;
  if (op.type === "patch") {
    const r = await api<{ after: ItemView }>(s.deckId, `/items/${op.itemId}`, { method: "PATCH", body: JSON.stringify(op.patch) });
    if (r) set((st) => ({ items: st.items.map((i) => (i.id === op.itemId ? r.after : i)), history }));
  } else if (op.type === "remove") {
    await api(s.deckId, `/items/${op.itemId}`, { method: "DELETE" });
    set((st) => ({ items: st.items.filter((i) => i.id !== op.itemId), history }));
  } else {
    // Recreate a deleted item (gets a new id; history refs to the old id become no-ops).
    const it = op.item;
    const body = it.kind === "mcq"
      ? { questions: [{ stem: it.stem ?? "", options: it.options ?? [], answerIdx: it.answerIdx ?? 0, keyRationale: it.keyRationale ?? "", optionRationales: it.optionRationales ?? [], blueprint: it.blueprint ?? undefined, citation: it.citation ?? undefined }] }
      : { cards: [{ front: it.front ?? "", back: it.back ?? "", cloze: it.cloze ?? undefined, mnemonic: it.mnemonic ?? undefined, pearl: it.pearl ?? undefined }] };
    const r = await api<{ items: ItemView[] }>(s.deckId, "/items", { method: "POST", body: JSON.stringify(body) });
    if (r) set((st) => ({ items: [...st.items, ...r.items], selectedId: r.items[0].id, history }));
  }
  set({ busy: false });
}

export const selectCanUndo = (s: State) => canUndo(s.history);
export const selectCanRedo = (s: State) => canRedo(s.history);
export const lastLabel = (s: State) => (s.history.past.length ? describe(s.history.past[s.history.past.length - 1]) : "");
