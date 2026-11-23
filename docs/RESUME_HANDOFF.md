# Resume handoff

State: M0–M3 done, M4 built (verify live) (see PROGRESS.md). Live: https://musubi-studio.c-notesacc12.workers.dev. Push to `main` auto-deploys via Workers Builds; work on feature branches and merge PRs via `gh api` REST (GraphQL is blocked in this sandbox).

Open items:
1. Clerk webhook configured and secret set (done).
2. Worker secrets live in the dashboard / API (not `.env.local`). Set via `PUT /accounts/{id}/workers/scripts/musubi-studio/secrets`.
3. Later milestones need Liveblocks + Upstash keys, Inngest keys, sandbox network allowlist for those hosts.

Done: Error 1101 fixed (pnpm override `@opennextjs/aws>cookie: 0.7.2`, test in tests/opennext-cookie.test.ts).
M4 layout: server `src/server/{items,mcp,mcp-tokens,liveblocks,ratelimit}.ts`, routes `routes/{studio,mcp}.ts` (MCP mounted before Clerk middleware; bearer `mus_…` tokens). Client `src/lib/studio-store.ts` (zustand + liveblocks), `src/components/studio/*`. Rooms are `deck:{deckId}`; server broadcasts `items-changed` / `threads-changed`.
Next: live-verify MCP + studio, then M5 (community, Inngest), M6 (E2E).

MCP auth: `/api/mcp` is a plain 8-tool Streamable HTTP server. Auth is Clerk OAuth (RFC 9728 metadata at `/.well-known/oauth-protected-resource/api/mcp`, token audience = `<origin>/api/mcp`, registered via Clerk `configure_mcp_server`) with `mus_` personal tokens as a fallback. Code Mode was dropped (needs a paid Workers plan). If the origin changes (custom domain), re-register the resource URL in Clerk.
