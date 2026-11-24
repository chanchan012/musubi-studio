"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function NewDeckForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true); setError(null);
    const res = await fetch("/api/decks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title }) });
    setBusy(false);
    if (!res.ok) { setError("Could not create the deck."); return; }
    setTitle(""); router.refresh();
  }

  return (
    <form onSubmit={create} className="flex gap-2">
      <label className="sr-only" htmlFor="deck-title">Deck title</label>
      <input id="deck-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New deck, e.g. Pharmacology Block 1" maxLength={120}
        className="min-h-11 min-w-0 flex-1 rounded-lg border border-line bg-card px-3 text-sm" />
      <button disabled={busy || !title.trim()} className="min-h-11 rounded-lg bg-ink px-4 text-sm font-medium text-paper disabled:opacity-40">{busy ? "Creating…" : "Create"}</button>
      {error && <span role="alert" className="self-center text-sm text-seal-ink">{error}</span>}
    </form>
  );
}
