"use client";
import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import type { LiveblocksYjsProvider } from "@liveblocks/yjs";

/** Collaborative plain-text editor backed by a Y.Text. Local edits (not remote) are debounce-saved to Neon. */
export function RationaleEditor({ doc, provider, itemId, initial, readOnly, label, onSave, onFocusChange }: {
  doc: Y.Doc; provider: LiveblocksYjsProvider | null; itemId: string; initial: string; readOnly: boolean; label: string;
  onSave: (text: string) => void; onFocusChange: (focused: boolean) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(initial);
  const save = useRef(onSave);
  save.current = onSave;

  useEffect(() => {
    const text = doc.getText(`rationale:${itemId}`);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const seed = () => { if (text.length === 0 && initial) doc.transact(() => text.insert(0, initial), "seed"); setValue(text.toString()); };
    // Seed only once the room has synced, so two clients never both insert the DB value.
    if (!provider || provider.synced) seed();
    const onSynced = (ok: boolean) => ok && seed();
    provider?.on("synced", onSynced);
    const obs = (_: Y.YTextEvent, tr: Y.Transaction) => {
      setValue(text.toString());
      if (tr.local && tr.origin !== "seed") { clearTimeout(timer); timer = setTimeout(() => save.current(text.toString()), 900); }
    };
    text.observe(obs);
    setValue(text.toString() || initial);
    return () => { text.unobserve(obs); provider?.off("synced", onSynced); clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, provider, itemId]);

  function onChange(next: string) {
    const text = doc.getText(`rationale:${itemId}`);
    const prev = text.toString();
    let a = 0;
    while (a < prev.length && a < next.length && prev[a] === next[a]) a++;
    let b = 0;
    while (b < prev.length - a && b < next.length - a && prev[prev.length - 1 - b] === next[next.length - 1 - b]) b++;
    doc.transact(() => {
      if (prev.length - a - b > 0) text.delete(a, prev.length - a - b);
      if (next.length - a - b > 0) text.insert(a, next.slice(a, next.length - b));
    });
  }

  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
      <textarea ref={ref} value={value} readOnly={readOnly} rows={5}
        onChange={(e) => onChange(e.target.value)} onFocus={() => onFocusChange(true)} onBlur={() => onFocusChange(false)}
        className="w-full resize-y rounded-lg border border-line bg-card p-3 text-sm leading-relaxed outline-none focus:border-ink read-only:opacity-70" />
    </label>
  );
}
