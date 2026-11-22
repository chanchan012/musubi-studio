# Architecture (living doc)

- **Runtime:** Next.js 16 (App Router) on Cloudflare Workers via OpenNext (`wrangler.jsonc`, `nodejs_compat`).
- **API:** Hono mounted at `app/api/[[...route]]/route.ts`; app in `src/server/app.ts` (`AppType` exported for RPC).
  - `GET /api/health`
- **Auth:** Clerk middleware in `proxy.ts` protects `/dashboard|/studio|/exam`.
- **Neon:** project `still-bird-86777802`, db `musubi` (schema: M1).
- **R2:** bucket `musubi-assets`, binding `R2` (keys: M1).
- **Liveblocks schema / MCP + Code Mode API / Inngest events:** M4–M5.
