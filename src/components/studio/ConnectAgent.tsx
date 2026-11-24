"use client";
import { useEffect, useRef, useState } from "react";

type Tok = { id: string; name: string; lastUsedAt: string | null; revokedAt: string | null };

export function ConnectAgent({ deckId, onClose }: { deckId: string; onClose: () => void }) {
  const [tokens, setTokens] = useState<Tok[]>([]);
  const [name, setName] = useState("My agent");
  const [fresh, setFresh] = useState<string | null>(null);
  const [copied, setCopied] = useState("");
  const dlg = useRef<HTMLDivElement>(null);
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  async function load() { const r = await fetch("/api/studio/mcp-tokens"); if (r.ok) setTokens(((await r.json()) as { tokens: Tok[] }).tokens); }
  useEffect(() => { void load(); dlg.current?.focus(); const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);

  async function create() {
    const r = await fetch("/api/studio/mcp-tokens", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
    if (r.ok) { setFresh(((await r.json()) as { token: string }).token); void load(); }
  }
  async function revoke(id: string) { await fetch(`/api/studio/mcp-tokens/${id}`, { method: "DELETE" }); void load(); }
  const copy = async (k: string, v: string) => { await navigator.clipboard?.writeText(v).catch(() => {}); setCopied(k); setTimeout(() => setCopied(""), 1500); };

  const cmd = `claude mcp add musubi --transport http ${origin}/api/mcp --header "Authorization: Bearer ${fresh ?? "<TOKEN>"}"`;
  const json = JSON.stringify({ mcpServers: { musubi: { type: "http", url: `${origin}/api/mcp`, headers: { Authorization: `Bearer ${fresh ?? "<TOKEN>"}` } } } }, null, 2);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div ref={dlg} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Connect an AI agent" onClick={(e) => e.stopPropagation()}
        className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-line bg-paper p-4 shadow-xl outline-none sm:rounded-2xl sm:p-6">
        <div className="flex items-start gap-2">
          <h2 className="flex-1 text-lg font-semibold">Connect an AI agent</h2>
          <button onClick={onClose} aria-label="Close" className="min-h-10 min-w-10 rounded-lg text-xl">×</button>
        </div>
        <p className="mt-1 text-sm text-muted">Agents write cards and MCQs into your decks over MCP. Edits show up live, labelled <b>AI</b>. Deck id for this studio: <code className="break-all">{deckId}</code></p>

        <div className="mt-4 flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Token name" className="min-h-10 min-w-0 flex-1 rounded-lg border border-line bg-card px-3 text-sm" />
          <button onClick={() => void create()} className="min-h-10 rounded-lg bg-seal-fill px-3 text-sm font-medium text-white">New token</button>
        </div>

        {fresh && <p className="mt-3 rounded-lg border border-sage/50 bg-sage/10 p-2 text-sm">Copy it now, it is shown once: <code className="break-all">{fresh}</code></p>}

        <h3 className="mt-5 text-xs font-medium uppercase tracking-wide text-muted">Claude Code</h3>
        <pre className="mt-1 overflow-x-auto rounded-lg border border-line bg-card p-3 text-xs"><code>{cmd}</code></pre>
        <button onClick={() => void copy("cmd", cmd)} className="mt-1 text-xs underline">{copied === "cmd" ? "Copied" : "Copy command"}</button>

        <h3 className="mt-4 text-xs font-medium uppercase tracking-wide text-muted">Any MCP client (JSON)</h3>
        <pre className="mt-1 overflow-x-auto rounded-lg border border-line bg-card p-3 text-xs"><code>{json}</code></pre>
        <button onClick={() => void copy("json", json)} className="mt-1 text-xs underline">{copied === "json" ? "Copied" : "Copy JSON"}</button>

        <p className="mt-4 text-xs text-muted">Most MCP clients can skip the token: add the URL and sign in with your Musubi account when prompted (OAuth via Clerk). Tokens are for headless agents.</p>

        <h3 className="mt-5 text-xs font-medium uppercase tracking-wide text-muted">Your tokens</h3>
        <ul className="mt-1 divide-y divide-line text-sm">
          {tokens.map((t) => (
            <li key={t.id} className="flex items-center gap-2 py-2">
              <span className="min-w-0 flex-1 truncate">{t.name}{t.revokedAt && <span className="ml-2 text-xs text-muted">revoked</span>}</span>
              {!t.revokedAt && <button onClick={() => void revoke(t.id)} className="text-xs text-seal-ink underline">Revoke</button>}
            </li>
          ))}
          {tokens.length === 0 && <li className="py-2 text-muted">No tokens yet.</li>}
        </ul>
      </div>
    </div>
  );
}
