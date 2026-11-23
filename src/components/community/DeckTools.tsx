"use client";

import { useState } from "react";

type Fmt = "csv" | "json" | "anki";

export function DeckTools({ deckId, isOwner, defaultTrack }: { deckId: string; isOwner: boolean; defaultTrack: string }) {
  const [fmt, setFmt] = useState<Fmt>("csv");
  const [status, setStatus] = useState<string | null>(null);
  const [track, setTrack] = useState(defaultTrack);
  const [pub, setPub] = useState(false);

  async function doExport() {
    setStatus("Queued…");
    const r = await fetch("/api/exports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ deckId, format: fmt }) });
    if (!r.ok) return setStatus(r.status === 429 ? "Too many exports, try again shortly." : "Could not start the export.");
    const { exportId } = await r.json();
    for (let i = 0; i < 30; i++) {
      await new Promise((res) => setTimeout(res, 2000));
      const g = await fetch(`/api/exports/${exportId}?deckId=${deckId}&format=${fmt}`);
      if (!g.ok) return setStatus("Export failed.");
      const j = await g.json();
      if (j.status === "ready") { setStatus("Ready."); window.open(j.url, "_blank", "noopener"); return; }
      setStatus("Building…");
    }
    setStatus("Still working. Try again in a minute.");
  }

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/community/publish", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ deckId, track }) });
    setStatus(r.ok ? "Published to the community." : "Could not publish.");
    if (r.ok) setPub(false);
  }

  return (
    <div className="mt-3 space-y-2 border-t border-line pt-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`fmt-${deckId}`}>Export format</label>
        <select id={`fmt-${deckId}`} value={fmt} onChange={(e) => setFmt(e.target.value as Fmt)} className="min-h-10 rounded-lg border border-line bg-paper px-2">
          <option value="csv">CSV</option><option value="json">JSON</option><option value="anki">Anki TSV</option>
        </select>
        <button onClick={doExport} className="min-h-10 rounded-lg border border-line px-3">Export</button>
        {isOwner && <button onClick={() => setPub((v) => !v)} aria-expanded={pub} className="min-h-10 rounded-lg border border-line px-3">Publish</button>}
      </div>
      {pub && (
        <form onSubmit={publish} className="flex gap-2">
          <label className="sr-only" htmlFor={`trk-${deckId}`}>Exam track</label>
          <input id={`trk-${deckId}`} value={track} onChange={(e) => setTrack(e.target.value)} required maxLength={60} placeholder="Exam track, e.g. NCLEX-RN"
            className="min-h-10 min-w-0 flex-1 rounded-lg border border-line bg-paper px-3" />
          <button className="min-h-10 rounded-lg bg-ink px-3 text-paper">Share</button>
        </form>
      )}
      {status && <p role="status" className="text-xs text-muted">{status}</p>}
    </div>
  );
}
