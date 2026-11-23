"use client";
import { useCallback, useEffect, useState } from "react";

type Thread = { id: string; itemId: string | null; comments: { id: string; userId: string; createdAt: string; text: string }[] };

export function Threads({ deckId, itemId, canWrite, tick }: { deckId: string; itemId: string; canWrite: boolean; tick: number }) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/studio/decks/${deckId}/threads`);
    if (r.ok) setThreads(((await r.json()) as { threads: Thread[] }).threads.filter((t) => t.itemId === itemId));
  }, [deckId, itemId]);
  useEffect(() => { void load(); }, [load, tick]);

  async function send(threadId?: string) {
    if (!text.trim()) return;
    setSending(true);
    const r = await fetch(`/api/studio/decks/${deckId}/threads`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ itemId, threadId, text }) });
    setSending(false);
    if (r.ok) { setText(""); void load(); }
  }

  return (
    <section aria-label="Comments" className="space-y-2">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted">Comments</h3>
      {threads.length === 0 && <p className="text-sm text-muted">No comments yet.</p>}
      <ul className="space-y-2">
        {threads.map((t) => (
          <li key={t.id} className="rounded-lg border border-line bg-card p-2 text-sm">
            {t.comments.map((c) => <p key={c.id} className="break-words py-0.5">{c.text}</p>)}
            {canWrite && text.trim() && <button onClick={() => void send(t.id)} className="mt-1 text-xs text-seal underline">Reply with draft</button>}
          </li>
        ))}
      </ul>
      {canWrite && (
        <div className="flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Comment on this item…" aria-label="New comment"
            className="min-h-10 min-w-0 flex-1 rounded-lg border border-line bg-card px-3 text-sm outline-none focus:border-ink" />
          <button disabled={sending || !text.trim()} onClick={() => void send()} className="min-h-10 rounded-lg bg-ink px-3 text-sm font-medium text-paper disabled:opacity-40">Post</button>
        </div>
      )}
    </section>
  );
}
