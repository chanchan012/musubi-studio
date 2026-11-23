"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import * as Y from "yjs";
import { LiveblocksYjsProvider } from "@liveblocks/yjs";
import { selectCanRedo, selectCanUndo, lastLabel, useStudio } from "@/lib/studio-store";
import type { ItemView } from "@/server/items";
import { RationaleEditor } from "./RationaleEditor";
import { Threads } from "./Threads";
import { ConnectAgent } from "./ConnectAgent";

const LETTERS = ["A", "B", "C", "D", "E"];
const DIFFS = ["foundational", "application", "synthesis"] as const;

function Field({ label, value, onCommit, readOnly, multiline, onFocusChange }: { label: string; value: string; onCommit: (v: string) => void; readOnly: boolean; multiline?: boolean; onFocusChange?: (f: boolean) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const cls = "w-full rounded-lg border border-line bg-card p-2.5 text-sm outline-none focus:border-ink read-only:opacity-70";
  const common = { value: v, readOnly, onChange: (e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => setV(e.target.value), onFocus: () => onFocusChange?.(true), onBlur: () => { onFocusChange?.(false); if (v !== value) onCommit(v); } };
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
      {multiline ? <textarea rows={3} className={`${cls} resize-y`} {...common} /> : <input className={cls} {...common} />}
    </label>
  );
}

const Badge = ({ ai }: { ai: boolean }) => (
  <span className={`shrink-0 rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold ${ai ? "border-seal text-seal" : "border-line text-muted"}`}>{ai ? "AI" : "Human"}</span>
);

export function StudioClient({ deckId, title, role, initialItems, liveblocksReady, backHref }: { deckId: string; title: string; role: "owner" | "editor" | "viewer"; initialItems: ItemView[]; liveblocksReady: boolean; backHref: string }) {
  const s = useStudio();
  const room = useStudio((st) => st.liveblocks.room);
  const others = useStudio((st) => st.liveblocks.others);
  const status = useStudio((st) => st.liveblocks.status);
  const canUndo = useStudio(selectCanUndo), canRedo = useStudio(selectCanRedo), last = useStudio(lastLabel);
  const [pane, setPane] = useState<"list" | "edit">("list");
  const [connect, setConnect] = useState(false);
  const [tick, setTick] = useState(0);
  const inited = useRef(false);
  const canEdit = role !== "viewer";

  if (!inited.current) { inited.current = true; useStudio.getState().init(deckId, role, initialItems); }

  useEffect(() => {
    if (!liveblocksReady) return;
    useStudio.getState().liveblocks.enterRoom(`deck:${deckId}`);
    return () => useStudio.getState().liveblocks.leaveRoom();
  }, [deckId, liveblocksReady]);

  // Yjs doc + provider once the room exists
  const doc = useMemo(() => new Y.Doc(), []);
  const [provider, setProvider] = useState<LiveblocksYjsProvider | null>(null);
  useEffect(() => {
    if (!room) return;
    const p = new LiveblocksYjsProvider(room, doc);
    setProvider(p);
    return () => { p.destroy(); setProvider(null); };
  }, [room, doc]);

  // Live refresh when an agent/human elsewhere writes
  useEffect(() => {
    if (!room) return;
    return room.events.customEvent.subscribe(({ event }) => {
      const e = event as { type?: string; by?: { kind: "human" | "ai"; name: string }; count?: number };
      if (e.type === "items-changed") void useStudio.getState().refetch(e.by, e.count);
      if (e.type === "threads-changed") setTick((t) => t + 1);
    });
  }, [room]);

  // undo / redo shortcuts
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA") return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); void (e.shiftKey ? useStudio.getState().redo() : useStudio.getState().undo()); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  const item = s.items.find((i) => i.id === s.selectedId) ?? null;
  const lockedBy = item ? others.find((o) => (o.presence as { editing?: string | null }).editing === item.id) : undefined;
  const ro = !canEdit || !!lockedBy;
  const setEditing = (f: boolean) => s.setEditing(f && item ? item.id : null);
  const save = (patch: Parameters<typeof s.patchItem>[1], label: string) => item && s.patchItem(item.id, patch, label);

  return (
    <div className="flex h-dvh w-dvw flex-col overflow-hidden">
      <header className="flex items-center gap-2 border-b border-line px-3 py-2 sm:px-5">
        <Link href={backHref} aria-label="Back to dashboard" className="flex min-h-10 items-center gap-1 font-semibold"><span aria-hidden className="text-xl text-seal">結</span><span className="hidden sm:inline">Musubi</span></Link>
        <h1 className="min-w-0 flex-1 truncate text-sm font-medium sm:text-base">{title}</h1>
        <div className="flex -space-x-2" aria-label={`${others.length} other collaborator${others.length === 1 ? "" : "s"} online`}>
          {others.slice(0, 4).map((o) => (
            <span key={o.connectionId} title={(o.info as { name?: string })?.name} className="grid size-7 place-items-center rounded-full border-2 border-paper bg-sage text-[11px] font-semibold text-white">
              {((o.info as { name?: string })?.name ?? "?").slice(0, 1).toUpperCase()}
            </span>
          ))}
        </div>
        <span className={`hidden text-xs sm:inline ${status === "connected" ? "text-sage" : "text-muted"}`} role="status">{liveblocksReady ? status : "offline"}</span>
        <button onClick={() => void s.undo()} disabled={!canUndo || s.busy} title={last} aria-label="Undo" className="min-h-10 min-w-10 rounded-lg border border-line text-sm disabled:opacity-40">↶</button>
        <button onClick={() => void s.redo()} disabled={!canRedo || s.busy} aria-label="Redo" className="min-h-10 min-w-10 rounded-lg border border-line text-sm disabled:opacity-40">↷</button>
        {canEdit && <button onClick={() => setConnect(true)} className="min-h-10 rounded-lg bg-seal px-3 text-sm font-medium text-white">Connect agent</button>}
      </header>

      <div className="flex border-b border-line md:hidden" role="tablist">
        {(["list", "edit"] as const).map((p) => (
          <button key={p} role="tab" aria-selected={pane === p} onClick={() => setPane(p)} className={`min-h-10 flex-1 text-sm ${pane === p ? "border-b-2 border-seal font-medium" : "text-muted"}`}>{p === "list" ? `Items (${s.items.length})` : "Editor"}</button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className={`min-h-0 w-full flex-col border-line md:flex md:w-80 md:shrink-0 md:border-r ${pane === "list" ? "flex" : "hidden"}`}>
          {canEdit && (
            <div className="flex gap-2 border-b border-line p-2">
              <button onClick={() => void s.addCard()} className="min-h-10 flex-1 rounded-lg border border-line text-sm">+ Card</button>
              <button onClick={() => void s.addMcq()} className="min-h-10 flex-1 rounded-lg border border-line text-sm">+ MCQ</button>
            </div>
          )}
          <ul className="min-h-0 flex-1 overflow-y-auto" aria-label="Items">
            {s.items.length === 0 && <li className="p-6 text-center text-sm text-muted">Empty deck. Add one, or connect an agent.</li>}
            {s.items.map((i) => {
              const locker = others.find((o) => (o.presence as { editing?: string | null }).editing === i.id);
              return (
                <li key={i.id}>
                  <button onClick={() => { s.select(i.id); setPane("edit"); }} aria-current={i.id === s.selectedId}
                    className={`flex w-full items-start gap-2 border-b border-line px-3 py-2.5 text-left ${i.id === s.selectedId ? "bg-card" : ""}`}>
                    <span className="mt-0.5 w-8 shrink-0 text-[10px] font-semibold uppercase text-muted">{i.kind === "mcq" ? "MCQ" : "Card"}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{(i.kind === "mcq" ? i.stem : i.front) || "(empty)"}</span>
                    {locker && <span aria-label="being edited" title="Being edited" className="text-xs">✎</span>}
                    <Badge ai={i.authorKind === "ai"} />
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <main className={`min-h-0 min-w-0 flex-1 overflow-y-auto p-4 md:block md:p-6 ${pane === "edit" ? "block" : "hidden"}`}>
          {!item ? <p className="text-muted">Select an item to edit.</p> : (
            <div className="mx-auto max-w-2xl space-y-4">
              <div className="flex items-center gap-2">
                <Badge ai={item.authorKind === "ai"} />
                <span className="text-xs text-muted">{item.kind === "mcq" ? "Multiple choice" : "Flashcard"}</span>
                {lockedBy && <span className="rounded-sm bg-seal/10 px-1.5 py-0.5 text-xs text-seal" role="status">{(lockedBy.info as { name?: string })?.name ?? "Someone"} is editing</span>}
                {canEdit && <button onClick={() => void s.removeItem(item.id)} className="ml-auto min-h-10 text-xs text-seal underline">Delete</button>}
              </div>

              {item.kind === "mcq" ? (
                <>
                  <Field label="Stem" multiline value={item.stem ?? ""} readOnly={ro} onFocusChange={setEditing} onCommit={(v) => save({ stem: v }, "edit stem")} />
                  <fieldset className="space-y-2">
                    <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Options (select the key)</legend>
                    {(item.options ?? []).map((o, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <input type="radio" name="key" aria-label={`Option ${LETTERS[idx]} is correct`} checked={item.answerIdx === idx} disabled={ro} onChange={() => void save({ answerIdx: idx }, `set key ${LETTERS[idx]}`)} className="mt-3 size-4 accent-[var(--sage)]" />
                        <div className="min-w-0 flex-1"><Field label={`${LETTERS[idx]}`} value={o} readOnly={ro} onFocusChange={setEditing} onCommit={(v) => save({ options: (item.options ?? []).map((x, j) => (j === idx ? v : x)) }, `edit option ${LETTERS[idx]}`)} /></div>
                      </div>
                    ))}
                  </fieldset>
                  <RationaleEditor doc={doc} provider={provider} itemId={item.id} initial={item.keyRationale ?? ""} readOnly={ro} label="Key rationale (live co-edit)" onFocusChange={setEditing} onSave={(t) => void save({ keyRationale: t }, "edit rationale")} />
                  <label className="block"><span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">Difficulty</span>
                    <select value={item.difficulty ?? ""} disabled={ro} onChange={(e) => void save({ difficulty: (e.target.value || null) as never }, "set difficulty")} className="min-h-10 w-full rounded-lg border border-line bg-card px-2 text-sm">
                      <option value="">—</option>{DIFFS.map((d) => <option key={d}>{d}</option>)}
                    </select></label>
                </>
              ) : (
                <>
                  <Field label="Front" multiline value={item.front ?? ""} readOnly={ro} onFocusChange={setEditing} onCommit={(v) => save({ front: v }, "edit front")} />
                  <RationaleEditor doc={doc} provider={provider} itemId={item.id} initial={item.back ?? ""} readOnly={ro} label="Back (live co-edit)" onFocusChange={setEditing} onSave={(t) => t.trim() && void save({ back: t }, "edit back")} />
                  <Field label="Mnemonic" value={item.mnemonic ?? ""} readOnly={ro} onFocusChange={setEditing} onCommit={(v) => save({ mnemonic: v || null }, "edit mnemonic")} />
                  <Field label="Clinical pearl" value={item.pearl ?? ""} readOnly={ro} onFocusChange={setEditing} onCommit={(v) => save({ pearl: v || null }, "edit pearl")} />
                </>
              )}
              <Field label="Blueprint topic" value={item.blueprint ?? ""} readOnly={ro} onFocusChange={setEditing} onCommit={(v) => save({ blueprint: v || null }, "tag blueprint")} />
              <Field label="Citation" value={item.citation ?? ""} readOnly={ro} onFocusChange={setEditing} onCommit={(v) => save({ citation: v || null }, "edit citation")} />
              {liveblocksReady && <Threads deckId={deckId} itemId={item.id} canWrite={canEdit} tick={tick} />}
            </div>
          )}
        </main>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-3 z-40 flex flex-col items-center gap-2 px-4" aria-live="polite">
        {s.toasts.map((t) => (
          <button key={t.id} onClick={() => s.dismissToast(t.id)} className="pointer-events-auto flex max-w-full items-center gap-2 rounded-full border border-line bg-ink px-4 py-2 text-sm text-paper shadow-lg">
            <Badge ai={t.ai} /><span className="truncate">{t.text}</span>
          </button>
        ))}
      </div>
      {connect && <ConnectAgent deckId={deckId} onClose={() => setConnect(false)} />}
    </div>
  );
}
