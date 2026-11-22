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

## Neon (project still-bird-86777802, db `musubi`) — `src/db/schema.ts`
users, decks, deck_members(role owner|editor|viewer), items(kind card|mcq, cloze, options jsonb, rationales jsonb, author_kind human|agent), review_states (FSRS fields, pk user+item), attempts (certainty, eliminations, trap_tags), error_log, mcp_tokens (sha256), community_posts/votes, errata, item_stats.
ACL: `src/lib/acl.ts` (`roleAtLeast`), `src/server/auth.ts` (`getDeckRole`, `assertDeckRole`) — every deck query goes through deck_members.

## R2 (`musubi-assets`, binding `R2`, private)
Keys: `decks/{deckId}/{uuid}-{sanitised-filename}`; exports (M5): `exports/{userId}/{uuid}.{ext}`. Presign via S3 API (`src/lib/r2.ts`).

## Not yet built
Liveblocks schema, MCP + Code Mode API (M4); Inngest events (M5); rate limits (M4).
