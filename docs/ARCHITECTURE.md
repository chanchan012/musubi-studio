# Architecture (living doc)

- **Runtime:** Next.js 16 (App Router) on Cloudflare Workers via OpenNext (`wrangler.jsonc`, `nodejs_compat`). Worker `musubi-studio`, auto-deployed from GitHub `main` by Workers Builds.
- **Auth:** Clerk (development instance). `proxy.ts` protects `/dashboard|/studio|/exam`; Hono `clerk` + `requireUser` guard all mutating API routes.

## Hono routes (`src/server/app.ts`, mounted at `/api`)
| Route | Auth | Notes |
|---|---|---|
| `GET /health` | public | |
| `POST /webhooks/clerk` | svix signature | upserts/deletes `users`; 503 if `CLERK_WEBHOOK_SIGNING_SECRET` unset |
| `GET /me` | session | |
| `GET /decks`, `POST /decks` | session | list decks the user belongs to; create deck + owner membership |
| `GET /decks/:id` | viewer+ | deck + items; 404 (not 403) when not a member |
| `POST /uploads/presign` | editor+ | body `{deckId, filename, contentType, size<=5MB}` -> presigned PUT (10 min) |
| `GET /uploads/url?key=` | viewer+ | presigned GET; deck derived from key |
| `GET /study/queue?deckId&mode&limit&newLimit&retention&seed` | member | due + new items with 4 rating previews and retrievability; modes fsrs\|blurt\|interleave\|feynman\|dual |
| `POST /study/review` | viewer+ | `{itemId, rating 1-4}` -> FSRS update, returns next previews + `feynmanPrompt` |
| `GET /study/stats` | member | total, due, Leitner bucket counts |
| `GET /exam/:deckId/questions?count&seed&interleave` | viewer+ | MCQs without key/rationales |
| `POST /exam/submit` | viewer+ | `{deckId, answers[{itemId, choice, certainty 1-3, ms, eliminated, trap}]}` -> score, calibration, per-item flags + rationales; logs misses/low-certainty to error_log |
| `GET /exam/errors`, `PATCH /exam/errors/:id` | owner of entry | mistake journal; root cause tag |
| `GET /exam/redrill` | member | items whose Day 1/3/7 re-test is due |
| `POST/GET /study/feynman` | viewer+ | learner "why & how" notes (agent feedback column filled via MCP in M4) |

## Neon (project still-bird-86777802, db `musubi`) — `src/db/schema.ts`
users, feynman_notes, decks, deck_members(role owner|editor|viewer), items(kind card|mcq, cloze, options jsonb, rationales jsonb, author_kind human|agent), review_states (FSRS fields, pk user+item), attempts (certainty, eliminations, trap_tags), error_log, mcp_tokens (sha256), community_posts/votes, errata, item_stats.
ACL: `src/lib/acl.ts` (`roleAtLeast`), `src/server/auth.ts` (`getDeckRole`, `assertDeckRole`) — every deck query goes through deck_members.

## R2 (`musubi-assets`, binding `R2`, private)
Keys: `decks/{deckId}/{uuid}-{sanitised-filename}`; exports (M5): `exports/{userId}/{uuid}.{ext}`. Presign via S3 API (`src/lib/r2.ts`).

## Not yet built
Liveblocks schema, MCP API (Clerk OAuth) (M4); Inngest events (M5); rate limits (M4).

## M4: studio, MCP
| Route | Auth | Purpose |
|---|---|---|
| `POST /api/studio/liveblocks-auth` | Clerk + deck membership | Liveblocks token for room `deck:{id}` (viewer = read-only) |
| `GET/POST /api/studio/decks/:id/items`, `PATCH/DELETE …/:itemId` | Clerk, editor | Item CRUD; broadcasts `items-changed` |
| `GET/POST /api/studio/decks/:id/threads` | Clerk | Comment threads (Liveblocks Comments, server-side) |
| `GET/POST/DELETE /api/studio/mcp-tokens` | Clerk | Personal MCP tokens (plaintext shown once, sha256 stored) |
| `/api/mcp` | Clerk OAuth token (aud = this URL) or Bearer `mus_…` | 8 Zod tools over Streamable HTTP (`/api/mcp/direct` is an alias) |
| `/api/mcp/direct` | Bearer | The 8 tools directly |
Rate limits (Upstash sliding window, fail-open): api 60/min per user, mcp 30/min per token.
