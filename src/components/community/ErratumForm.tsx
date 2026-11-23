"use client";

import { useState } from "react";

export function ErratumForm({ itemId }: { itemId: string }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">("idle");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    const r = await fetch(`/api/community/items/${itemId}/errata`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body }) });
    setState(r.ok ? "sent" : "error");
    if (r.ok) { setBody(""); setOpen(false); }
  }

  if (state === "sent") return <span className="text-sage">Thanks, the author has been notified.</span>;
  if (!open) return <button onClick={() => setOpen(true)} className="min-h-11 underline">Report an error</button>;
  return (
    <form onSubmit={send} className="flex w-full flex-wrap gap-2">
      <label className="sr-only" htmlFor={`err-${itemId}`}>What is wrong with this item?</label>
      <input id={`err-${itemId}`} value={body} onChange={(e) => setBody(e.target.value)} minLength={5} maxLength={1000} required placeholder="What is wrong with this item?"
        className="min-h-11 min-w-0 flex-1 rounded-lg border border-line bg-paper px-3 text-sm text-ink" />
      <button disabled={state === "busy" || body.trim().length < 5} className="min-h-11 rounded-lg bg-ink px-3 text-sm text-paper disabled:opacity-40">Send</button>
      {state === "error" && <span role="alert" className="self-center text-seal">Could not send.</span>}
    </form>
  );
}
