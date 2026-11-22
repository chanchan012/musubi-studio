# Musubi — Progress

## Roadmap
- [x] **M0 Infrastructure** — live at https://musubi-studio.c-notesacc12.workers.dev (`/api/health` 200). Pending for later: Inngest keys (M5), Liveblocks (M4), Upstash (M4), R2 S3 keys (M1)
- [x] M1 Auth, Neon schema & R2 storage — schema applied to Neon, ACL, Clerk webhook, deck + upload routes, R2 presign (14 Vitest tests). Pending: `CLERK_WEBHOOK_SIGNING_SECRET` (needs Clerk dashboard webhook → `/api/webhooks/clerk`), live R2 upload smoke test with a signed-in user
- [ ] M2 FSRS & study technique engine
- [ ] M3 Board-exam mock & strategy engine
- [ ] M4 Collaborative studio & Cloudflare Code Mode MCP
- [ ] M5 Community question bank & Inngest jobs
- [ ] M6 E2E verification

## M0 log
- Deploy target: Cloudflare **Workers** via `@opennextjs/cloudflare` (Pages can't host OpenNext/Next 16).
- Neon: project `still-bird-86777802` (chanchan-new-projects), branch `br-weathered-meadow-b4sbechg`, database `musubi`.
- Clerk: app `app_3MSjQrYvRaNCvxdZlU3ajQgJ8RJ` "musubi", **development** instance.
- R2: bucket `musubi-assets` (ENAM).
- Verified: `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm cf:build` all pass locally.

- Deploy: Cloudflare Workers Builds connected to GitHub `main` (Worker name `musubi-studio`); runtime secrets set in dashboard (`CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`).
- Sandbox env `musubi-studio` allowlists the live host for health checks.

## M1 log
- Neon migration `drizzle/0000_init.sql` applied via Neon MCP in one transaction (drizzle journal table not populated; apply future migrations the same way or with `drizzle-kit migrate` on a machine that can reach Neon).
- R2 S3 credentials: account API token `musubi-r2-s3` (id `54a3973c7d57194a5aa4c0a6dbc10d49`, R2 Write on `musubi-assets` only). Stored as Worker secrets `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`; also `CLOUDFLARE_ACCOUNT_ID` and `DATABASE_URL`. Not in `.env.local` (secret value never retrieved locally).
- `R2_PUBLIC_URL` intentionally unset: bucket stays private, reads use presigned GET after an ACL check.
