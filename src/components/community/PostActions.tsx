"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PostActions({ postId, score, myVote, signedIn }: { postId: string; score: number; myVote: number; signedIn: boolean }) {
  const router = useRouter();
  const [s, setS] = useState(score);
  const [v, setV] = useState(myVote);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function cast(next: -1 | 0 | 1) {
    if (!signedIn) return router.push("/sign-in");
    const value = v === next ? 0 : next;
    setBusy(true);
    const r = await fetch(`/api/community/${postId}/vote`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ value }) });
    setBusy(false);
    if (!r.ok) return setMsg(r.status === 429 ? "Slow down a little." : "Could not vote.");
    setS((await r.json()).score); setV(value); setMsg(null);
  }

  async function fork() {
    if (!signedIn) return router.push("/sign-in");
    setBusy(true);
    const r = await fetch(`/api/community/${postId}/clone`, { method: "POST" });
    setBusy(false);
    if (!r.ok) return setMsg("Could not fork the deck.");
    router.push("/dashboard");
  }

  const btn = "min-h-11 min-w-11 rounded-lg border border-line px-3 text-sm disabled:opacity-40";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button aria-label="Upvote" aria-pressed={v === 1} disabled={busy} onClick={() => cast(1)} className={`${btn} ${v === 1 ? "bg-ink text-paper" : "bg-card"}`}>▲</button>
      <span className="min-w-8 text-center text-sm tabular-nums" aria-live="polite">{s}</span>
      <button aria-label="Downvote" aria-pressed={v === -1} disabled={busy} onClick={() => cast(-1)} className={`${btn} ${v === -1 ? "bg-ink text-paper" : "bg-card"}`}>▼</button>
      <button disabled={busy} onClick={fork} className="min-h-11 rounded-lg bg-ink px-4 text-sm font-medium text-paper disabled:opacity-40">Fork to my library</button>
      {msg && <span role="alert" className="text-sm text-seal">{msg}</span>}
    </div>
  );
}
